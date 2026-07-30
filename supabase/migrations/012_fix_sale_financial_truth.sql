update public.ventas
set
  monto_recibido = coalesce(monto_recibido, total),
  diferencia_cobro = greatest(total - coalesce(monto_recibido, total), 0),
  ganancia = total - coalesce(costo_total, 0),
  margen_pct = case when total > 0 then ((total - coalesce(costo_total, 0)) / total) * 100 else 0 end;

create table if not exists public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  sale_id uuid not null,
  movement_id uuid,
  fecha date not null default current_date,
  monto numeric not null,
  medio_pago text,
  origen text not null default 'manual',
  notas text,
  created_at timestamptz not null default now(),
  foreign key (sale_id, user_id) references public.ventas(id, user_id) on delete cascade,
  foreign key (movement_id, user_id) references public.movimientos_financieros(id, user_id) on delete restrict,
  check (monto > 0)
);

alter table public.sale_payments enable row level security;
drop policy if exists "sale_payments_select_own" on public.sale_payments;
drop policy if exists "sale_payments_insert_own" on public.sale_payments;
create policy "sale_payments_select_own" on public.sale_payments for select using (auth.uid() = user_id);
create policy "sale_payments_insert_own" on public.sale_payments for insert with check (auth.uid() = user_id);
create index if not exists idx_sale_payments_user_sale on public.sale_payments(user_id, sale_id, fecha);

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

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
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

      v_unit_cost := coalesce(v_inv.costo_total, v_inv.costo_unitario, 0);
      v_product := coalesce(v_product, v_inv.producto);
    elsif v_unit_cost < 0 then
      raise exception 'El costo no puede ser negativo';
    end if;

    v_total := v_total + (v_qty * v_price);
    v_cost := v_cost + (v_qty * v_unit_cost);
  end loop;

  v_received := case when p_monto_recibido is null then v_total else p_monto_recibido end;
  if v_received < 0 or v_received > v_total then
    raise exception 'El importe recibido debe estar entre 0 y el total de la venta';
  end if;
  v_difference := v_total - v_received;
  v_profit := v_total - v_cost;

  insert into public.ventas (
    user_id, fecha, cliente, medio_pago, total, monto_recibido, diferencia_cobro,
    costo_total, ganancia, margen_pct, origen, notas
  )
  values (
    v_uid, coalesce(p_fecha, current_date), nullif(trim(p_cliente), ''), nullif(trim(p_medio_pago), ''),
    v_total, v_received, v_difference, v_cost, v_profit,
    case when v_total > 0 then (v_profit / v_total) * 100 else 0 end,
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

      v_unit_cost := coalesce(v_inv.costo_total, v_inv.costo_unitario, 0);
      v_product := coalesce(v_product, v_inv.producto);
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

    v_first_product := coalesce(v_first_product, v_product);
    insert into public.venta_items (
      user_id, venta_id, inventory_item_id, producto_texto, cantidad,
      precio_unitario, costo_unitario, subtotal, ganancia
    )
    values (
      v_uid, v_sale_id, v_inventory_id, v_product, v_qty,
      v_price, v_unit_cost, v_subtotal, v_subtotal - (v_qty * v_unit_cost)
    );
  end loop;

  if v_received > 0 then
    insert into public.movimientos_financieros (
      user_id, fecha, descripcion, monto, tipo, medio_pago, categoria, mes, origen
    )
    values (
      v_uid, coalesce(p_fecha, current_date),
      'Cobro de venta' || case when jsonb_array_length(p_items) = 1 and v_first_product is not null then ': ' || v_first_product else '' end,
      v_received, 'ingreso', nullif(trim(p_medio_pago), ''), 'ventas',
      to_char(coalesce(p_fecha, current_date), 'YYYY-MM'), coalesce(nullif(trim(p_origen), ''), 'manual')
    )
    returning id into v_movement_id;

    insert into public.sale_payments (
      user_id, sale_id, movement_id, fecha, monto, medio_pago, origen, notas
    )
    values (
      v_uid, v_sale_id, v_movement_id, coalesce(p_fecha, current_date), v_received,
      nullif(trim(p_medio_pago), ''), coalesce(nullif(trim(p_origen), ''), 'manual'), 'Cobro inicial'
    );
  end if;

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

create or replace function public.register_sale_payment(
  p_sale_id uuid,
  p_monto numeric,
  p_fecha date,
  p_medio_pago text,
  p_notas text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sale public.ventas%rowtype;
  v_pending numeric;
  v_received numeric;
  v_movement_id uuid;
  v_payment_id uuid;
begin
  if v_uid is null then
    raise exception 'Usuario no autenticado';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception 'El cobro debe ser mayor a 0';
  end if;

  select *
    into v_sale
  from public.ventas
  where id = p_sale_id
    and user_id = v_uid
  for update;

  if not found then
    raise exception 'Venta no encontrada o sin permisos';
  end if;

  v_pending := greatest(coalesce(v_sale.total, 0) - coalesce(v_sale.monto_recibido, 0), 0);
  if v_pending <= 0 then
    raise exception 'La venta ya está saldada';
  end if;
  if p_monto > v_pending then
    raise exception 'El cobro supera el saldo pendiente';
  end if;

  insert into public.movimientos_financieros (
    user_id, fecha, descripcion, monto, tipo, medio_pago, categoria, mes, origen
  )
  values (
    v_uid, coalesce(p_fecha, current_date), 'Cobro de venta pendiente', p_monto, 'ingreso',
    nullif(trim(p_medio_pago), ''), 'ventas', to_char(coalesce(p_fecha, current_date), 'YYYY-MM'), 'cobro_venta'
  )
  returning id into v_movement_id;

  insert into public.sale_payments (
    user_id, sale_id, movement_id, fecha, monto, medio_pago, origen, notas
  )
  values (
    v_uid, p_sale_id, v_movement_id, coalesce(p_fecha, current_date), p_monto,
    nullif(trim(p_medio_pago), ''), 'manual', nullif(trim(p_notas), '')
  )
  returning id into v_payment_id;

  v_received := coalesce(v_sale.monto_recibido, 0) + p_monto;
  update public.ventas
  set
    monto_recibido = v_received,
    diferencia_cobro = greatest(total - v_received, 0)
  where id = p_sale_id
    and user_id = v_uid;

  return jsonb_build_object(
    'ok', true,
    'paymentId', v_payment_id,
    'movementId', v_movement_id,
    'received', v_received,
    'pending', greatest(v_sale.total - v_received, 0)
  );
end;
$$;

grant execute on function public.register_sale_payment(uuid, numeric, date, text, text) to authenticated;
