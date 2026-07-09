create or replace function public.bot_normalize_alias(value text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(translate(lower(coalesce(value, '')), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]+', ' ', 'g'));
$$;

create or replace function public.bot_stock_state(stock_value integer, min_value integer)
returns text
language sql
immutable
as $$
  select case
    when stock_value is null then 'sin_datos'
    when stock_value <= 0 then 'rojo'
    when stock_value <= coalesce(min_value, 0) then 'amarillo'
    else 'verde'
  end;
$$;

create or replace function public.bot_inventory_action(
  stock_value integer,
  min_value integer,
  cost_value numeric,
  price_value numeric
)
returns text
language sql
immutable
as $$
  select case
    when public.bot_stock_state(stock_value, min_value) = 'rojo' then 'Reponer urgente / pausar publicacion'
    when public.bot_stock_state(stock_value, min_value) = 'amarillo' then 'Reponer / vender con cuidado'
    when cost_value is null or price_value is null or price_value <= 0 then 'Completar datos para calcular margen'
    when ((price_value - cost_value) / price_value) * 100 >= 25 then 'Publicar fuerte'
    else 'Revisar precio o liquidar'
  end;
$$;

create or replace function public.confirm_bot_action(action_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_action public.bot_actions%rowtype;
  v_preview jsonb;
  v_result jsonb := '{}'::jsonb;
  v_error text;

  v_item public.inventario_items%rowtype;
  v_item_id uuid;
  v_venta_id uuid;
  v_movimiento_id uuid;

  v_product text;
  v_norm text;
  v_qty integer;
  v_stock integer;
  v_stock_min integer;
  v_preview_stock integer;
  v_before integer;
  v_after integer;

  v_cost numeric;
  v_extra numeric;
  v_cost_total numeric;
  v_price numeric;
  v_price_web numeric;
  v_total numeric;
  v_gain numeric;
  v_margin numeric;
  v_medio text;
  v_descripcion text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'status', 'failed', 'error', 'Usuario no autenticado');
  end if;

  select *
    into v_action
  from public.bot_actions
  where id = action_id
    and user_id = v_uid
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'status', 'failed', 'error', 'Accion no encontrada o sin permisos');
  end if;

  if v_action.status <> 'preview' then
    return jsonb_build_object(
      'ok', false,
      'status', v_action.status,
      'error', 'La accion ya fue procesada'
    );
  end if;

  v_preview := coalesce(v_action.preview_data, '{}'::jsonb);

  begin
    if v_action.action_type = 'crear_producto' then
      v_product := nullif(trim(v_preview->>'producto'), '');
      v_stock := (v_preview->>'stock')::integer;
      v_cost := (v_preview->>'costo')::numeric;
      v_price := (v_preview->>'precio')::numeric;

      if v_product is null then
        raise exception 'Falta producto';
      end if;
      if v_stock is null or v_stock < 0 then
        raise exception 'Stock invalido';
      end if;
      if v_cost is null or v_cost < 0 then
        raise exception 'Costo invalido';
      end if;
      if v_price is null or v_price < 0 then
        raise exception 'Falta el precio de venta. Ejemplo: vendi 2 toalla azul a 10000 cada una.';
      end if;

      v_norm := public.bot_normalize_alias(v_product);
      perform pg_advisory_xact_lock(hashtext(v_uid::text), hashtext(v_norm));
      if exists (
        select 1
        from public.inventario_items i
        where i.user_id = v_uid
          and public.bot_normalize_alias(concat_ws(' ', i.producto, i.color, i.medida)) = v_norm
      ) or exists (
        select 1
        from public.inventory_aliases a
        where a.user_id = v_uid
          and (
            a.normalized_alias = v_norm
            or public.bot_normalize_alias(a.alias) = v_norm
          )
      ) then
        raise exception 'Ese producto ya existe. Use reposicion para sumar stock.';
      end if;

      v_cost_total := v_cost;
      v_gain := v_price - v_cost_total;
      v_margin := case when v_price > 0 then (v_gain / v_price) * 100 else 0 end;

      insert into public.inventario_items (
        user_id, producto, stock_actual, stock_minimo, costo_unitario, costo_extra,
        costo_total, precio_venta_local, precio_venta_web, ganancia_local,
        margen_local_pct, ganancia_web, margen_web_pct, estado_stock,
        accion_recomendada, origen
      )
      values (
        v_uid, v_product, v_stock, 0, v_cost, 0,
        v_cost_total, v_price, 0, v_gain,
        v_margin, 0, 0, public.bot_stock_state(v_stock, 0),
        public.bot_inventory_action(v_stock, 0, v_cost_total, v_price), 'bot'
      )
      returning id into v_item_id;

      insert into public.inventory_aliases (
        user_id, inventory_item_id, alias, normalized_alias
      )
      values (
        v_uid, v_item_id, v_product, v_norm
      );

      if v_stock <> 0 then
        insert into public.stock_movements (
          user_id, inventory_item_id, tipo, cantidad, stock_antes, stock_despues,
          motivo, referencia_tipo, referencia_id, origen, raw_data
        )
        values (
          v_uid, v_item_id, 'inicial', v_stock, 0, v_stock,
          'Producto creado por bot', 'bot_action', v_action.id, 'bot',
          jsonb_build_object('input_text', v_action.input_text)
        );
      end if;

      v_result := jsonb_build_object(
        'ok', true,
        'status', 'confirmed',
        'inventory_item_id', v_item_id,
        'stock_actual', v_stock
      );

    elsif v_action.action_type = 'venta_stock' then
      v_item_id := (v_preview #>> '{match,item,id}')::uuid;
      v_qty := coalesce(nullif(v_preview->>'cantidad', '')::integer, 1);
      v_price := (v_preview->>'precio_unitario')::numeric;
      v_medio := nullif(trim(v_preview->>'medio_pago'), '');
      v_preview_stock := (v_preview #>> '{match,item,stock_actual}')::integer;

      if v_qty <= 0 then
        raise exception 'Cantidad invalida';
      end if;
      if v_price is null or v_price <= 0 then
        raise exception 'Falta el precio de venta. Ejemplo: vendi 2 toalla azul a 10000 cada una.';
      end if;

      select *
        into v_item
      from public.inventario_items
      where id = v_item_id
        and user_id = v_uid
      for update;

      if not found then
        raise exception 'No encontre ese producto. Revise el nombre o creelo primero.';
      end if;

      v_before := coalesce(v_item.stock_actual, 0);
      if v_preview_stock is null or v_before <> v_preview_stock then
        raise exception 'El stock cambio antes de confirmar. Intente nuevamente.';
      end if;
      if v_before < v_qty then
        raise exception 'No hay stock suficiente para confirmar esa venta. Revise el inventario.';
      end if;

      v_after := v_before - v_qty;
      v_cost_total := coalesce(v_item.costo_total, v_item.costo_unitario, 0);
      v_total := v_qty * v_price;
      v_cost := v_qty * v_cost_total;
      v_gain := v_total - v_cost;
      v_margin := case when v_total > 0 then (v_gain / v_total) * 100 else 0 end;

      insert into public.ventas (
        user_id, fecha, medio_pago, total, costo_total, ganancia, margen_pct, origen, notas
      )
      values (
        v_uid, current_date, v_medio, v_total, v_cost, v_gain, v_margin, 'bot', v_action.input_text
      )
      returning id into v_venta_id;

      insert into public.venta_items (
        user_id, venta_id, inventory_item_id, producto_texto, cantidad,
        precio_unitario, costo_unitario, subtotal, ganancia
      )
      values (
        v_uid, v_venta_id, v_item.id, v_item.producto, v_qty,
        v_price, v_cost_total, v_total, v_gain
      );

      insert into public.movimientos_financieros (
        user_id, fecha, descripcion, monto, tipo, medio_pago, categoria, mes, origen
      )
      values (
        v_uid, current_date, 'Venta ' || v_item.producto, v_total, 'ingreso',
        v_medio, 'ventas', to_char(current_date, 'YYYY-MM'), 'bot'
      )
      returning id into v_movimiento_id;

      insert into public.stock_movements (
        user_id, inventory_item_id, tipo, cantidad, stock_antes, stock_despues,
        motivo, referencia_tipo, referencia_id, origen, raw_data
      )
      values (
        v_uid, v_item.id, 'venta', -v_qty, v_before, v_after,
        'Venta registrada por bot', 'venta', v_venta_id, 'bot',
        jsonb_build_object('input_text', v_action.input_text, 'bot_action_id', v_action.id)
      );

      update public.inventario_items
      set
        stock_actual = v_after,
        costo_total = coalesce(v_item.costo_total, coalesce(v_item.costo_unitario, 0) + coalesce(v_item.costo_extra, 0)),
        ganancia_local = coalesce(v_item.precio_venta_local, 0) - coalesce(v_item.costo_total, coalesce(v_item.costo_unitario, 0) + coalesce(v_item.costo_extra, 0)),
        margen_local_pct = case
          when coalesce(v_item.precio_venta_local, 0) > 0
            then ((coalesce(v_item.precio_venta_local, 0) - coalesce(v_item.costo_total, coalesce(v_item.costo_unitario, 0) + coalesce(v_item.costo_extra, 0))) / coalesce(v_item.precio_venta_local, 0)) * 100
          else 0
        end,
        ganancia_web = coalesce(v_item.precio_venta_web, 0) - coalesce(v_item.costo_total, coalesce(v_item.costo_unitario, 0) + coalesce(v_item.costo_extra, 0)),
        margen_web_pct = case
          when coalesce(v_item.precio_venta_web, 0) > 0
            then ((coalesce(v_item.precio_venta_web, 0) - coalesce(v_item.costo_total, coalesce(v_item.costo_unitario, 0) + coalesce(v_item.costo_extra, 0))) / coalesce(v_item.precio_venta_web, 0)) * 100
          else 0
        end,
        estado_stock = public.bot_stock_state(v_after, v_item.stock_minimo),
        accion_recomendada = public.bot_inventory_action(
          v_after,
          v_item.stock_minimo,
          coalesce(v_item.costo_total, coalesce(v_item.costo_unitario, 0) + coalesce(v_item.costo_extra, 0)),
          v_item.precio_venta_local
        )
      where id = v_item.id
        and user_id = v_uid;

      v_result := jsonb_build_object(
        'ok', true,
        'status', 'confirmed',
        'venta_id', v_venta_id,
        'movimiento_id', v_movimiento_id,
        'inventory_item_id', v_item.id,
        'stock_antes', v_before,
        'stock_despues', v_after,
        'total', v_total
      );

    elsif v_action.action_type = 'gasto' then
      v_descripcion := nullif(trim(v_preview->>'descripcion'), '');
      v_total := (v_preview->>'monto')::numeric;
      v_medio := nullif(trim(v_preview->>'medio_pago'), '');

      if v_descripcion is null then
        raise exception 'Falta descripcion';
      end if;
      if v_total is null or v_total <= 0 then
        raise exception 'Monto invalido';
      end if;

      insert into public.movimientos_financieros (
        user_id, fecha, descripcion, monto, tipo, medio_pago, categoria, mes, origen
      )
      values (
        v_uid, current_date, v_descripcion, v_total, 'egreso',
        v_medio, 'gastos', to_char(current_date, 'YYYY-MM'), 'bot'
      )
      returning id into v_movimiento_id;

      v_result := jsonb_build_object(
        'ok', true,
        'status', 'confirmed',
        'movimiento_id', v_movimiento_id,
        'bot_action_id', v_action.id
      );

    elsif v_action.action_type = 'reposicion' then
      v_item_id := (v_preview #>> '{match,item,id}')::uuid;
      v_qty := (v_preview->>'cantidad')::integer;
      v_preview_stock := (v_preview #>> '{match,item,stock_actual}')::integer;
      v_medio := nullif(trim(v_preview->>'medio_pago'), '');
      v_cost := nullif(v_preview->>'costo_unitario', '')::numeric;

      if v_qty is null or v_qty <= 0 then
        raise exception 'Cantidad invalida';
      end if;
      if v_cost is not null and v_cost < 0 then
        raise exception 'Costo invalido';
      end if;

      select *
        into v_item
      from public.inventario_items
      where id = v_item_id
        and user_id = v_uid
      for update;

      if not found then
        raise exception 'No encontre ese producto. Revise el nombre o creelo primero.';
      end if;

      v_before := coalesce(v_item.stock_actual, 0);
      if v_preview_stock is null or v_before <> v_preview_stock then
        raise exception 'El stock cambio antes de confirmar. Intente nuevamente.';
      end if;

      v_after := v_before + v_qty;
      if v_cost is not null then
        insert into public.movimientos_financieros (
          user_id, fecha, descripcion, monto, tipo, medio_pago, categoria, mes, origen
        )
        values (
          v_uid, current_date, 'Compra ' || v_item.producto, v_qty * v_cost,
          'egreso', v_medio, 'compras', to_char(current_date, 'YYYY-MM'), 'bot'
        )
        returning id into v_movimiento_id;
      end if;

      insert into public.stock_movements (
        user_id, inventory_item_id, tipo, cantidad, stock_antes, stock_despues,
        motivo, referencia_tipo, referencia_id, origen, raw_data
      )
      values (
        v_uid, v_item.id, 'compra', v_qty, v_before, v_after,
        'Reposicion registrada por bot',
        case when v_movimiento_id is null then 'bot_action' else 'movimiento_financiero' end,
        coalesce(v_movimiento_id, v_action.id), 'bot',
        jsonb_build_object('input_text', v_action.input_text, 'bot_action_id', v_action.id)
      );

      v_cost := coalesce(v_cost, v_item.costo_unitario, 0);
      v_extra := coalesce(v_item.costo_extra, 0);
      v_cost_total := v_cost + v_extra;
      v_price := coalesce(v_item.precio_venta_local, 0);
      v_price_web := coalesce(v_item.precio_venta_web, 0);

      update public.inventario_items
      set
        stock_actual = v_after,
        costo_unitario = v_cost,
        costo_total = v_cost_total,
        ganancia_local = v_price - v_cost_total,
        margen_local_pct = case when v_price > 0 then ((v_price - v_cost_total) / v_price) * 100 else 0 end,
        ganancia_web = v_price_web - v_cost_total,
        margen_web_pct = case when v_price_web > 0 then ((v_price_web - v_cost_total) / v_price_web) * 100 else 0 end,
        estado_stock = public.bot_stock_state(v_after, v_item.stock_minimo),
        accion_recomendada = public.bot_inventory_action(v_after, v_item.stock_minimo, v_cost_total, v_price)
      where id = v_item.id
        and user_id = v_uid;

      v_result := jsonb_build_object(
        'ok', true,
        'status', 'confirmed',
        'inventory_item_id', v_item.id,
        'movimiento_id', v_movimiento_id,
        'stock_antes', v_before,
        'stock_despues', v_after
      );

    elsif v_action.action_type = 'ajuste_stock' then
      v_item_id := (v_preview #>> '{match,item,id}')::uuid;
      v_after := (v_preview->>'stock_final')::integer;
      v_preview_stock := (v_preview #>> '{match,item,stock_actual}')::integer;

      if v_after is null or v_after < 0 then
        raise exception 'Stock final invalido';
      end if;

      select *
        into v_item
      from public.inventario_items
      where id = v_item_id
        and user_id = v_uid
      for update;

      if not found then
        raise exception 'No encontre ese producto. Revise el nombre o creelo primero.';
      end if;

      v_before := coalesce(v_item.stock_actual, 0);
      if v_preview_stock is null or v_before <> v_preview_stock then
        raise exception 'El stock cambio antes de confirmar. Intente nuevamente.';
      end if;
      if v_before = v_after then
        raise exception 'El stock ya esta en ese valor';
      end if;

      insert into public.stock_movements (
        user_id, inventory_item_id, tipo, cantidad, stock_antes, stock_despues,
        motivo, referencia_tipo, referencia_id, origen, raw_data
      )
      values (
        v_uid, v_item.id, 'ajuste', v_after - v_before, v_before, v_after,
        'Ajuste registrado por bot', 'bot_action', v_action.id, 'bot',
        jsonb_build_object('input_text', v_action.input_text)
      );

      v_cost_total := coalesce(v_item.costo_total, coalesce(v_item.costo_unitario, 0) + coalesce(v_item.costo_extra, 0));
      v_price := coalesce(v_item.precio_venta_local, 0);
      v_price_web := coalesce(v_item.precio_venta_web, 0);

      update public.inventario_items
      set
        stock_actual = v_after,
        ganancia_local = v_price - v_cost_total,
        margen_local_pct = case when v_price > 0 then ((v_price - v_cost_total) / v_price) * 100 else 0 end,
        ganancia_web = v_price_web - v_cost_total,
        margen_web_pct = case when v_price_web > 0 then ((v_price_web - v_cost_total) / v_price_web) * 100 else 0 end,
        estado_stock = public.bot_stock_state(v_after, v_item.stock_minimo),
        accion_recomendada = public.bot_inventory_action(v_after, v_item.stock_minimo, v_cost_total, v_price)
      where id = v_item.id
        and user_id = v_uid;

      v_result := jsonb_build_object(
        'ok', true,
        'status', 'confirmed',
        'inventory_item_id', v_item.id,
        'stock_antes', v_before,
        'stock_despues', v_after
      );

    else
      raise exception 'Accion no soportada';
    end if;

    update public.bot_actions
    set
      status = 'confirmed',
      result_data = v_result,
      error = null,
      confirmed_at = now()
    where id = v_action.id
      and user_id = v_uid;

    return v_result;

  exception
    when others then
      v_error := sqlerrm;

      update public.bot_actions
      set
        status = 'failed',
        error = v_error
      where id = v_action.id
        and user_id = v_uid;

      return jsonb_build_object(
        'ok', false,
        'status', 'failed',
        'action_id', v_action.id,
        'action_type', v_action.action_type,
        'error', v_error
      );
  end;
end;
$$;

grant execute on function public.confirm_bot_action(uuid) to authenticated;
