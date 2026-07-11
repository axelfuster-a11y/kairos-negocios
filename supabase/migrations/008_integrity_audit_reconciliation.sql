-- Kairós P0: integridad, auditoría y reconciliación.
-- No modifica migraciones previas ni corrige datos históricos automáticamente.

alter table public.stock_movements
  drop constraint if exists stock_movements_balance_ck;

alter table public.stock_movements
  add constraint stock_movements_balance_ck
  check (
    stock_antes is not null
    and stock_despues is not null
    and stock_antes >= 0
    and stock_despues >= 0
    and stock_despues = stock_antes + cantidad
  ) not valid;

do $do$
begin
  if exists (
    select 1
    from public.team_payments p
    left join public.movimientos_financieros m
      on m.id = p.movimiento_financiero_id
     and m.user_id = p.user_id
    where p.movimiento_financiero_id is not null
      and m.id is null
  ) then
    raise exception 'Hay pagos de equipo con movimientos financieros inexistentes o de otro usuario. Revisar v_team_payment_reconciliation antes de aplicar 008.';
  end if;

  if exists (
    select 1
    from public.team_payments
    where movimiento_financiero_id is not null
    group by user_id, movimiento_financiero_id
    having count(*) > 1
  ) then
    raise exception 'Un movimiento financiero esta vinculado a mas de un pago de equipo.';
  end if;
end;
$do$;

do $do$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'movimientos_financieros_id_user_id_unique'
      and conrelid = 'public.movimientos_financieros'::regclass
  ) then
    alter table public.movimientos_financieros
      add constraint movimientos_financieros_id_user_id_unique unique (id, user_id);
  end if;
end;
$do$;

create unique index if not exists uq_team_payments_movement
  on public.team_payments(user_id, movimiento_financiero_id)
  where movimiento_financiero_id is not null;

do $do$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'team_payments_movement_user_fk'
      and conrelid = 'public.team_payments'::regclass
  ) then
    alter table public.team_payments
      add constraint team_payments_movement_user_fk
      foreign key (movimiento_financiero_id, user_id)
      references public.movimientos_financieros(id, user_id)
      on delete restrict
      not valid;
  end if;
end;
$do$;

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete restrict not null,
  entity_type text not null,
  entity_id text,
  action text not null check (action in ('insert', 'update', 'delete', 'reverse', 'confirm')),
  before_data jsonb,
  after_data jsonb,
  origin text not null default 'database',
  correlation_id uuid,
  created_at timestamptz not null default now()
);

alter table public.audit_events enable row level security;

drop policy if exists "audit_events_select_own" on public.audit_events;
create policy "audit_events_select_own"
  on public.audit_events
  for select
  using (auth.uid() = user_id);

create index if not exists idx_audit_events_user_created
  on public.audit_events(user_id, created_at desc);
create index if not exists idx_audit_events_entity
  on public.audit_events(user_id, entity_type, entity_id);

create or replace function public.capture_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  v_user_id uuid := coalesce((v_new->>'user_id')::uuid, (v_old->>'user_id')::uuid);
  v_entity_id text := coalesce(v_new->>'id', v_old->>'id');
begin
  if v_user_id is null then
    raise exception 'No se puede auditar una operacion sin user_id';
  end if;

  insert into public.audit_events (
    user_id, entity_type, entity_id, action, before_data, after_data, origin
  )
  values (
    v_user_id, tg_table_name, v_entity_id, lower(tg_op), v_old, v_new, 'database'
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.capture_audit_event() from public;
revoke all on function public.capture_audit_event() from anon;
revoke all on function public.capture_audit_event() from authenticated;

do $do$
declare
  v_table text;
begin
  foreach v_table in array array[
    'inventario_items',
    'stock_movements',
    'ventas',
    'venta_items',
    'movimientos_financieros',
    'team_payments'
  ]
  loop
    execute format('drop trigger if exists capture_audit_event_trigger on public.%I', v_table);
    execute format(
      'create trigger capture_audit_event_trigger after insert or update or delete on public.%I for each row execute function public.capture_audit_event()',
      v_table
    );
  end loop;
end;
$do$;

create or replace view public.v_stock_reconciliation
with (security_invoker = true)
as
with latest as (
  select distinct on (user_id, inventory_item_id)
    user_id,
    inventory_item_id,
    stock_despues,
    created_at
  from public.stock_movements
  order by user_id, inventory_item_id, created_at desc, id desc
)
select
  i.user_id,
  i.id as inventory_item_id,
  i.producto,
  i.stock_actual,
  l.stock_despues as ledger_stock,
  l.created_at as last_movement_at,
  case
    when l.inventory_item_id is null and coalesce(i.stock_actual, 0) = 0 then 'ok'
    when l.inventory_item_id is null then 'sin_movimientos'
    when i.stock_actual = l.stock_despues then 'ok'
    else 'desajuste'
  end as status
from public.inventario_items i
left join latest l
  on l.user_id = i.user_id
 and l.inventory_item_id = i.id;

create or replace view public.v_team_payment_reconciliation
with (security_invoker = true)
as
select
  p.user_id,
  p.id as payment_id,
  p.movimiento_financiero_id,
  p.fecha as payment_date,
  p.monto as payment_amount,
  p.tipo as payment_type,
  m.fecha as movement_date,
  m.monto as movement_amount,
  m.tipo as movement_type,
  m.categoria as movement_category,
  case
    when p.movimiento_financiero_id is null then 'sin_movimiento'
    when m.id is null then 'movimiento_inexistente'
    when m.tipo <> 'egreso' then 'tipo_incorrecto'
    when m.monto <> p.monto then 'monto_diferente'
    when m.fecha <> p.fecha then 'fecha_diferente'
    when p.tipo in ('retiro_duenio', 'distribucion_utilidad')
      and m.categoria <> 'retiros_duenio' then 'categoria_incorrecta'
    when p.tipo not in ('retiro_duenio', 'distribucion_utilidad')
      and m.categoria <> 'personal' then 'categoria_incorrecta'
    else 'ok'
  end as status
from public.team_payments p
left join public.movimientos_financieros m
  on m.id = p.movimiento_financiero_id
 and m.user_id = p.user_id;

create or replace function public.get_integrity_summary()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'stock_mismatches', (
      select count(*) from public.v_stock_reconciliation
      where user_id = auth.uid() and status <> 'ok'
    ),
    'team_payment_mismatches', (
      select count(*) from public.v_team_payment_reconciliation
      where user_id = auth.uid() and status <> 'ok'
    ),
    'checked_at', now()
  );
$$;

grant select on public.v_stock_reconciliation to authenticated;
grant select on public.v_team_payment_reconciliation to authenticated;
grant execute on function public.get_integrity_summary() to authenticated;

comment on constraint stock_movements_balance_ck on public.stock_movements is
  'Garantiza nuevos movimientos coherentes. Queda NOT VALID hasta reconciliar el historial.';
comment on table public.audit_events is
  'Historial append-only de cambios en entidades operativas criticas.';
