create or replace function public.confirm_import_batch(batch_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_batch public.import_batches%rowtype;
  v_row public.import_rows%rowtype;
  v_data jsonb;
  v_imported integer := 0;
  v_movements integer := 0;
  v_inventory integer := 0;
  v_error text;
  v_product text;
  v_stock integer;
  v_stock_min integer;
  v_cost numeric;
  v_extra numeric;
  v_cost_total numeric;
  v_price_local numeric;
  v_price_web numeric;
  v_gain_local numeric;
  v_gain_web numeric;
  v_item_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'status', 'failed', 'error', 'Usuario no autenticado');
  end if;

  select *
    into v_batch
  from public.import_batches
  where id = batch_id
    and user_id = v_uid
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'status', 'failed', 'error', 'Carga no encontrada o sin permisos');
  end if;

  if v_batch.status <> 'preview' then
    return jsonb_build_object('ok', false, 'status', v_batch.status, 'error', 'La carga ya fue procesada');
  end if;

  if not exists (
    select 1
    from public.import_rows r
    where r.batch_id = v_batch.id
      and r.user_id = v_uid
      and r.status in ('valid', 'warning')
  ) then
    update public.import_batches
    set status = 'failed'
    where id = v_batch.id
      and user_id = v_uid;

    return jsonb_build_object('ok', false, 'status', 'failed', 'error', 'No hay filas validas para guardar');
  end if;

  begin
    for v_row in
      select r.*
      from public.import_rows r
      where r.batch_id = v_batch.id
        and r.user_id = v_uid
        and r.status in ('valid', 'warning')
      order by r.row_number
      for update
    loop
      v_data := coalesce(v_row.normalized_data, '{}'::jsonb);

      if v_data ? 'producto' then
        v_product := nullif(trim(v_data->>'producto'), '');
        if v_product is null then
          raise exception 'Fila %: falta producto', v_row.row_number;
        end if;

        perform pg_advisory_xact_lock(
          hashtext(v_uid::text),
          hashtext(public.bot_normalize_alias(v_product))
        );
        if exists (
          select 1
          from public.inventario_items i
          where i.user_id = v_uid
            and public.bot_normalize_alias(i.producto) = public.bot_normalize_alias(v_product)
        ) or exists (
          select 1
          from public.inventory_aliases a
          where a.user_id = v_uid
            and a.normalized_alias = public.bot_normalize_alias(v_product)
        ) then
          raise exception 'Fila %: producto ya existente: %', v_row.row_number, v_product;
        end if;

        v_stock := coalesce(nullif(v_data->>'stock_actual', '')::integer, 0);
        v_stock_min := coalesce(nullif(v_data->>'stock_minimo', '')::integer, 0);
        v_cost := coalesce(nullif(v_data->>'costo_unitario', '')::numeric, 0);
        v_extra := coalesce(nullif(v_data->>'costo_extra', '')::numeric, 0);
        v_cost_total := coalesce(nullif(v_data->>'costo_total', '')::numeric, v_cost + v_extra);
        v_price_local := coalesce(nullif(v_data->>'precio_venta_local', '')::numeric, 0);
        v_price_web := coalesce(nullif(v_data->>'precio_venta_web', '')::numeric, 0);
        v_gain_local := v_price_local - v_cost_total;
        v_gain_web := v_price_web - v_cost_total;

        insert into public.inventario_items (
          user_id, sku, categoria, producto, variante, medida, color,
          stock_actual, stock_minimo, costo_unitario, costo_extra, costo_total,
          precio_venta_local, precio_venta_web, ganancia_local, margen_local_pct,
          ganancia_web, margen_web_pct, estado_stock, accion_recomendada,
          proveedor, notas, origen
        )
        values (
          v_uid,
          nullif(trim(v_data->>'sku'), ''),
          nullif(trim(v_data->>'categoria'), ''),
          v_product,
          nullif(trim(v_data->>'variante'), ''),
          nullif(trim(v_data->>'medida'), ''),
          nullif(trim(v_data->>'color'), ''),
          v_stock,
          v_stock_min,
          v_cost,
          v_extra,
          v_cost_total,
          v_price_local,
          v_price_web,
          v_gain_local,
          case when v_price_local > 0 then (v_gain_local / v_price_local) * 100 else 0 end,
          v_gain_web,
          case when v_price_web > 0 then (v_gain_web / v_price_web) * 100 else 0 end,
          public.bot_stock_state(v_stock, v_stock_min),
          public.bot_inventory_action(v_stock, v_stock_min, v_cost_total, v_price_local),
          nullif(trim(v_data->>'proveedor'), ''),
          nullif(trim(v_data->>'notas'), ''),
          coalesce(nullif(trim(v_data->>'origen'), ''), v_batch.source)
        )
        returning id into v_item_id;

        insert into public.inventory_aliases (
          user_id, inventory_item_id, alias, normalized_alias
        )
        values (
          v_uid, v_item_id, v_product, public.bot_normalize_alias(v_product)
        );

        if v_stock > 0 then
          insert into public.stock_movements (
            user_id, inventory_item_id, tipo, cantidad, stock_antes, stock_despues,
            motivo, referencia_tipo, referencia_id, origen, raw_data
          )
          values (
            v_uid, v_item_id, 'inicial', v_stock, 0, v_stock,
            'Stock inicial desde importacion', 'import_batch', v_batch.id,
            'importacion', jsonb_build_object('row_number', v_row.row_number)
          );
        end if;

        v_inventory := v_inventory + 1;
      else
        if nullif(trim(v_data->>'descripcion'), '') is null then
          raise exception 'Fila %: falta descripcion', v_row.row_number;
        end if;
        if nullif(v_data->>'monto', '')::numeric is null or nullif(v_data->>'monto', '')::numeric < 0 then
          raise exception 'Fila %: monto invalido', v_row.row_number;
        end if;
        if v_data->>'tipo' not in ('ingreso', 'egreso') then
          raise exception 'Fila %: falta tipo ingreso o egreso', v_row.row_number;
        end if;

        insert into public.movimientos_financieros (
          user_id, fecha, descripcion, monto, tipo, medio_pago, categoria, mes, origen
        )
        values (
          v_uid,
          nullif(v_data->>'fecha', '')::date,
          trim(v_data->>'descripcion'),
          (v_data->>'monto')::numeric,
          v_data->>'tipo',
          nullif(trim(v_data->>'medio_pago'), ''),
          coalesce(nullif(trim(v_data->>'categoria'), ''), 'sin_categoria'),
          nullif(trim(v_data->>'mes'), ''),
          coalesce(nullif(trim(v_data->>'origen'), ''), v_batch.source)
        );

        v_movements := v_movements + 1;
      end if;

      update public.import_rows
      set status = 'imported'
      where id = v_row.id
        and user_id = v_uid;

      v_imported := v_imported + 1;
    end loop;

    update public.import_rows r
    set status = 'skipped'
    where r.batch_id = v_batch.id
      and r.user_id = v_uid
      and r.status = 'error';

    update public.import_batches
    set status = 'confirmed'
    where id = v_batch.id
      and user_id = v_uid;

    return jsonb_build_object(
      'ok', true,
      'status', 'confirmed',
      'batch_id', v_batch.id,
      'imported_rows', v_imported,
      'movements', v_movements,
      'inventory_items', v_inventory
    );
  exception
    when others then
      v_error := sqlerrm;

      update public.import_batches
      set status = 'failed'
      where id = v_batch.id
        and user_id = v_uid;

      return jsonb_build_object(
        'ok', false,
        'status', 'failed',
        'batch_id', v_batch.id,
        'error', v_error
      );
  end;
end;
$$;

grant execute on function public.confirm_import_batch(uuid) to authenticated;
