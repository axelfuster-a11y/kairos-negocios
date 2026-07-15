-- Kairós Core Flow V2: separa venta, cobro, saldo pendiente y ganancia.
-- Mantiene compatibilidad con las columnas actuales mientras se migra la UI.

alter table public.ventas
  add column if not exists cobrado_total numeric not null default 0,
  add column if not exists saldo_pendiente numeric not null default 0,
  add column if not exists estado_cobro text not null default 'pendiente';

update public.ventas
set
  cobrado_total = greatest(coalesce(monto_recibido, total, 0), 0),
  saldo_pendiente = greatest(coalesce(total, 0) - greatest(coalesce(monto_recibido, total, 0), 0), 0),
  estado_cobro = case
    when greatest(coalesce(monto_recibido, total, 0), 0) <= 0 then 'pendiente'
    when greatest(coalesce(monto_recibido, total, 0), 0) < coalesce(total, 0) then 'parcial'
    else 'cobrada'
  end;

alter table public.ventas
  drop constraint if exists ventas_cobrado_total_non_negative,
  drop constraint if exists ventas_saldo_pendiente_non_negative,
  drop constraint if exists ventas_estado_cobro_ck;

alter table public.ventas
  add constraint ventas_cobrado_total_non_negative check (cobrado_total >= 0),
  add constraint ventas_saldo_pendiente_non_negative check (saldo_pendiente >= 0),
  add constraint ventas_estado_cobro_ck check (estado_cobro in ('pendiente', 'parcial', 'cobrada'));

create table if not exists public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  venta_id uuid not null,
  movimiento_financiero_id uuid,
  fecha date not null default current_date,
  monto numeric not null check (monto > 0),
  medio_pago text,
  referencia text,
  origen text not null default 'manual',
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (venta_id, user_id)
    references public.ventas(id, user_id)
    on delete restrict,
  foreign key (movimiento_financiero_id, user_id)
    references public.movimientos_financieros(id, user_id)
    on delete restrict
);

alter table public.sale_payments enable row level security;

drop policy if exists "sale_payments_select_own" on public.sale_payments;
create policy "sale_payments_select_own" on public.sale_payments
  for select using (auth.uid() = user_id);

create index if not exists idx_sale_payments_user_sale
  on public.sale_payments(user_id, venta_id, fecha desc);
create unique index if not exists uq_sale_payments_movement
  on public.sale_payments(user_id, movimiento_financiero_id)
  where movimiento_financiero_id is not null;

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
  v_payment_id uuid;
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
  v_pending numeric := 0;
  v_payment_status text := 'pendiente';
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
    v_product := nullif(trim(v_item->>'producto_texto'), '');
    v_inventory_id := nullif(v_item->>'inventory_item_id', '')::uuid;

    if v_price <= 0 then
      raise exception 'El precio debe ser mayor a 0';
    end if;
    if v_inventory_id is null and v_product is null then
      raise exception 'Falta el producto';
    end if;

    if v_inventory_id is not null then
      select * into v_inv
      from public.inventario_items
      where id = v_inventory_id and user_id = v_uid
      for update;

      if not found then
        raise exception 'Producto no encontrado o sin permisos';
      end if;
      if coalesce(v_inv.stock_actual, 0) < v_qty then
        raise exception 'Inventario insuficiente para %', coalesce(v_inv.producto, 'producto');
      end if;
      v_unit_cost := greatest(coalesce(v_inv.costo_total, v_inv.costo_unitario, 0), 0);
    else
      v_unit_cost := 0;
    end if;

    v_total := v_total + (v_qty * v_price);
    v_cost := v_cost + (v_qty * v_unit_cost);
  end loop;

  v_received := least(greatest(coalesce(p_monto_recibido, 0), 0), v_total);
  v_pending := greatest(v_total - v_received, 0);
  v_profit := v_total - v_cost;
  v_payment_status := case
    when v_received <= 0 then 'pendiente'
    when v_received < v_total then 'parcial'
    else 'cobrada'
  end;

  insert into public.ventas (
    user_id, fecha, cliente, medio_pago, total, monto_recibido, diferencia_cobro,
    cobrado_total, saldo_pendiente, estado_cobro,
    costo_total, ganancia, margen_pct, origen, notas
  )
  values (
    v_uid, coalesce(p_fecha, current_date), nullif(trim(p_cliente), ''), nullif(trim(p_medio_pago), ''),
    v_total, v_received, v_pending,
    v_received, v_pending, v_payment_status,
    v_cost, v_profit,
    case when v_total > 0 then (v_profit / v_total) * 100 else 0 end,
    coalesce(nullif(trim(p_origen), ''), 'manual'), nullif(trim(p_notas), '')
  )
  returning id into v_sale_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_qty := greatest(1, coalesce(nullif(v_item->>'cantidad', '')::integer, 1));
    v_price := coalesce(nullif(v_item->>'precio_unitario', '')::numeric, 0);
    v_product := nullif(trim(v_item->>'producto_texto'), '');
    v_inventory_id := nullif(v_item->>'inventory_item_id', '')::uuid;
    v_subtotal := v_qty * v_price;

    if v_inventory_id is not null then
      select * into v_inv
      from public.inventario_items
      where id = v_inventory_id and user_id = v_uid
      for update;

      v_unit_cost := greatest(coalesce(v_inv.costo_total, v_inv.costo_unitario, 0), 0);
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
      where id = v_inventory_id and user_id = v_uid;

      insert into public.stock_movements (
        user_id, inventory_item_id, tipo, cantidad, stock_antes, stock_despues,
        motivo, referencia_tipo, referencia_id, origen
      ) values (
        v_uid, v_inventory_id, 'venta', -v_qty, v_before, v_after,
        'Venta registrada', 'venta', v_sale_id, coalesce(nullif(trim(p_origen), ''), 'manual')
      );
    else
      v_unit_cost := 0;
    end if;

    v_first_product := coalesce(v_first_product, v_product, case when v_inventory_id is not null then v_inv.producto else null end);

    insert into public.venta_items (
      user_id, venta_id, inventory_item_id, producto_texto, cantidad,
      precio_unitario, costo_unitario, subtotal, ganancia
    ) values (
      v_uid, v_sale_id, v_inventory_id,
      coalesce(v_product, case when v_inventory_id is not null then v_inv.producto else null end),
      v_qty, v_price, v_unit_cost, v_subtotal, v_subtotal - (v_qty * v_unit_cost)
    );
  end loop;

  if v_received > 0 then
    insert into public.movimientos_financieros (
      user_id, fecha, descripcion, monto, tipo, medio_pago, categoria, mes, origen
    ) values (
      v_uid, coalesce(p_fecha, current_date),
      'Cobro de venta' || case when jsonb_array_length(p_items) = 1 and v_first_product is not null then ': ' || v_first_product else '' end,
      v_received, 'ingreso', nullif(trim(p_medio_pago), ''), 'cobros_ventas',
      to_char(coalesce(p_fecha, current_date), 'YYYY-MM'), coalesce(nullif(trim(p_origen), ''), 'manual')
    ) returning id into v_movement_id;

    insert into public.sale_payments (
      user_id, venta_id, movimiento_financiero_id, fecha, monto, medio_pago, origen
    ) values (
      v_uid, v_sale_id, v_movement_id, coalesce(p_fecha, current_date), v_received,
      nullif(trim(p_medio_pago), ''), coalesce(nullif(trim(p_origen), ''), 'manual')
    ) returning id into v_payment_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'saleId', v_sale_id,
    'movementId', v_movement_id,
    'paymentId', v_payment_id,
    'total', v_total,
    'received', v_received,
    'pending', v_pending,
    'paymentStatus', v_payment_status,
    'profit', v_profit
  );
end;
$$;

grant select on public.sale_payments to authenticated;
grant execute on function public.register_sale_atomic(date, text, text, numeric, text, text, jsonb) to authenticated;

drop trigger if exists capture_audit_event_trigger on public.sale_payments;
create trigger capture_audit_event_trigger
after insert or update or delete on public.sale_payments
for each row execute function public.capture_audit_event();
