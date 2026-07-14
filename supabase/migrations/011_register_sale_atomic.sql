alter table public.ventas
  add column if not exists monto_recibido numeric,
  add column if not exists diferencia_cobro numeric;

do $do$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ventas_monto_recibido_non_negative'
      and conrelid = 'public.ventas'::regclass
  ) then
    alter table public.ventas
      add constraint ventas_monto_recibido_non_negative
      check (monto_recibido is null or monto_recibido >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ventas_diferencia_cobro_non_negative'
      and conrelid = 'public.ventas'::regclass
  ) then
    alter table public.ventas
      add constraint ventas_diferencia_cobro_non_negative
      check (diferencia_cobro is null or diferencia_cobro >= 0);
  end if;
end;
$do$;

create or replace function public.register_sale_atomic(
  p_fecha date,
  p_cliente text,
  p_medio_pago text,
  p_monto_recibido numeric,
  p_origen text,
  p_notas text,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_item jsonb;
  v_inv public.inventario_items%rowtype;
  v_sale_id uuid;
  v_movement_id uuid;
  v_inventory_id uuid;
  v_product text;
  v_qty integer;
  v_price numeric;
  v_unit_cost numeric;
  v_subtotal numeric;
  v_total numeric := 0;
  v_cost numeric := 0;
  v_received numeric := 0;
  v_profit numeric := 0;
  v_difference numeric := 0;
  v_before integer;
  v_after integer;
  v_first_product text;
begin
  if v_uid is null then
    raise exception 'Usuario no autenticado';
  end if;

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Agregue al menos un producto';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_qty := greatest(1, coalesce(nullif(v_item->>'cantidad', '')::integer, 1));
    v_price := coalesce(nullif(v_item->>'precio_unitario', '')::numeric, 0);
    v_unit_cost := coalesce(nullif(v_item->>'costo_unitario', '')::numeric, 0);
    v_product := nullif(trim(v_item->>'producto_texto'), '');
    v_inventory_id := nullif(v_item->>'inventory_item_id', '')::uuid;

    if v_price <= 0 then
      raise exception 'El precio debe ser mayor a 0';
    end if;
    if v_unit_cost < 0 then
      raise exception 'El costo no puede ser negativo';
    end if;
    if v_inventory_id is null and v_product is null then
      raise exception 'Falta el producto';
    end if;

    if v_inventory_id is not null then
      select *
        into v_inv
      from public.inventario_items
      where id = v_inventory_id
        and user_id = v_uid
      for update;

      if not found then
        raise exception 'Producto no encontrado o sin permisos';
      end if;
      if coalesce(v_inv.stock_actual, 0) < v_qty then
        raise exception 'Inventario insuficiente para %', coalesce(v_inv.producto, 'producto');
      end if;
    end if;

    v_total := v_total + (v_qty * v_price);
    v_cost := v_cost + (v_qty * v_unit_cost);
  end loop;

  v_received := case
    when coalesce(p_monto_recibido, 0) > 0 then p_monto_recibido
    else v_total
  end;
  v_difference := greatest(v_total - v_received, 0);
  v_profit := v_received - v_cost;

  insert into public.ventas (
    user_id, fecha, cliente, medio_pago, total, monto_recibido, diferencia_cobro,
    costo_total, ganancia, margen_pct, origen, notas
  )
  values (
    v_uid, coalesce(p_fecha, current_date), nullif(trim(p_cliente), ''), nullif(trim(p_medio_pago), ''),
    v_total, v_received, v_difference, v_cost, v_profit,
    case when v_received > 0 then (v_profit / v_received) * 100 else 0 end,
    coalesce(nullif(trim(p_origen), ''), 'manual'), nullif(trim(p_notas), '')
  )
  returning id into v_sale_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_qty := greatest(1, coalesce(nullif(v_item->>'cantidad', '')::integer, 1));
    v_price := coalesce(nullif(v_item->>'precio_unitario', '')::numeric, 0);
    v_unit_cost := coalesce(nullif(v_item->>'costo_unitario', '')::numeric, 0);
    v_product := nullif(trim(v_item->>'producto_texto'), '');
    v_inventory_id := nullif(v_item->>'inventory_item_id', '')::uuid;
    v_subtotal := v_qty * v_price;

    if v_inventory_id is not null then
      select *
        into v_inv
      from public.inventario_items
      where id = v_inventory_id
        and user_id = v_uid
      for update;
      v_before := coalesce(v_inv.stock_actual, 0);
      v_after := v_before - v_qty;
      if v_after < 0 then
        raise exception 'Inventario insuficiente para %', coalesce(v_inv.producto, 'producto');
      end if;

      update public.inventario_items
      set
        stock_actual = v_after,
        estado_stock = case
          when v_after <= 0 then 'rojo'
          when v_after <= coalesce(stock_minimo, 0) then 'amarillo'
          else 'verde'
        end
      where id = v_inventory_id
        and user_id = v_uid;

      insert into public.stock_movements (
        user_id, inventory_item_id, tipo, cantidad, stock_antes, stock_despues,
        motivo, referencia_tipo, referencia_id, origen
      )
      values (
        v_uid, v_inventory_id, 'venta', -v_qty, v_before, v_after,
        'Venta registrada', 'venta', v_sale_id, coalesce(nullif(trim(p_origen), ''), 'manual')
      );
    end if;
    v_first_product := coalesce(v_first_product, v_product, case when v_inventory_id is not null then v_inv.producto else null end);

    insert into public.venta_items (
      user_id, venta_id, inventory_item_id, producto_texto, cantidad,
      precio_unitario, costo_unitario, subtotal, ganancia
    )
    values (
      v_uid, v_sale_id, v_inventory_id, coalesce(v_product, case when v_inventory_id is not null then v_inv.producto else null end),
      v_qty, v_price, v_unit_cost, v_subtotal, v_subtotal - (v_qty * v_unit_cost)
    );
  end loop;

  insert into public.movimientos_financieros (
    user_id, fecha, descripcion, monto, tipo, medio_pago, categoria, mes, origen
  )
  values (
    v_uid, coalesce(p_fecha, current_date),
    'Venta registrada' || case when jsonb_array_length(p_items) = 1 and v_first_product is not null then ': ' || v_first_product else '' end,
    v_received, 'ingreso', nullif(trim(p_medio_pago), ''), 'ventas',
    to_char(coalesce(p_fecha, current_date), 'YYYY-MM'), coalesce(nullif(trim(p_origen), ''), 'manual')
  )
  returning id into v_movement_id;

  return jsonb_build_object(
    'ok', true,
    'saleId', v_sale_id,
    'movementId', v_movement_id,
    'total', v_total,
    'received', v_received,
    'difference', v_difference,
    'profit', v_profit
  );
end;
$$;

grant execute on function public.register_sale_atomic(date, text, text, numeric, text, text, jsonb) to authenticated;
