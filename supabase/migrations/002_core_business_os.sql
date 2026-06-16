create extension if not exists "pgcrypto";

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  inventory_item_id uuid references public.inventario_items(id) on delete set null,
  tipo text not null,
  cantidad integer not null,
  stock_antes integer,
  stock_despues integer,
  motivo text,
  referencia_tipo text,
  referencia_id uuid,
  origen text default 'manual',
  raw_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  check (tipo in ('entrada', 'salida', 'ajuste', 'inicial', 'venta', 'compra', 'devolucion')),
  check (cantidad <> 0)
);

create table if not exists public.ventas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  fecha date,
  cliente text,
  medio_pago text,
  total numeric not null default 0,
  costo_total numeric default 0,
  ganancia numeric default 0,
  margen_pct numeric default 0,
  origen text default 'manual',
  notas text,
  created_at timestamptz default now(),
  check (total >= 0),
  check (costo_total >= 0)
);

do $do$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ventas_id_user_id_unique'
      and conrelid = 'public.ventas'::regclass
  ) then
    alter table public.ventas
      add constraint ventas_id_user_id_unique unique (id, user_id);
  end if;
end;
$do$;

create table if not exists public.venta_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  venta_id uuid not null,
  inventory_item_id uuid references public.inventario_items(id) on delete set null,
  producto_texto text,
  cantidad integer not null default 1,
  precio_unitario numeric not null default 0,
  costo_unitario numeric default 0,
  subtotal numeric default 0,
  ganancia numeric default 0,
  created_at timestamptz default now(),
  foreign key (venta_id, user_id) references public.ventas(id, user_id) on delete cascade,
  check (cantidad > 0),
  check (precio_unitario >= 0),
  check (costo_unitario >= 0),
  check (subtotal >= 0)
);

create table if not exists public.bot_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  input_text text not null,
  action_type text not null,
  status text not null default 'preview',
  preview_data jsonb default '{}'::jsonb,
  result_data jsonb default '{}'::jsonb,
  error text,
  created_at timestamptz default now(),
  confirmed_at timestamptz,
  check (status in ('preview', 'confirmed', 'cancelled', 'failed'))
);

create table if not exists public.inventory_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  inventory_item_id uuid references public.inventario_items(id) on delete cascade not null,
  alias text not null,
  normalized_alias text not null,
  created_at timestamptz default now()
);

alter table public.stock_movements enable row level security;
alter table public.ventas enable row level security;
alter table public.venta_items enable row level security;
alter table public.bot_actions enable row level security;
alter table public.inventory_aliases enable row level security;

drop policy if exists "stock_movements_select_own" on public.stock_movements;
drop policy if exists "stock_movements_insert_own" on public.stock_movements;
drop policy if exists "stock_movements_update_own" on public.stock_movements;
drop policy if exists "stock_movements_delete_own" on public.stock_movements;
create policy "stock_movements_select_own" on public.stock_movements for select using (auth.uid() = user_id);
create policy "stock_movements_insert_own" on public.stock_movements for insert with check (auth.uid() = user_id);
create policy "stock_movements_update_own" on public.stock_movements for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "stock_movements_delete_own" on public.stock_movements for delete using (auth.uid() = user_id);

drop policy if exists "ventas_select_own" on public.ventas;
drop policy if exists "ventas_insert_own" on public.ventas;
drop policy if exists "ventas_update_own" on public.ventas;
drop policy if exists "ventas_delete_own" on public.ventas;
create policy "ventas_select_own" on public.ventas for select using (auth.uid() = user_id);
create policy "ventas_insert_own" on public.ventas for insert with check (auth.uid() = user_id);
create policy "ventas_update_own" on public.ventas for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ventas_delete_own" on public.ventas for delete using (auth.uid() = user_id);

drop policy if exists "venta_items_select_own" on public.venta_items;
drop policy if exists "venta_items_insert_own" on public.venta_items;
drop policy if exists "venta_items_update_own" on public.venta_items;
drop policy if exists "venta_items_delete_own" on public.venta_items;
create policy "venta_items_select_own" on public.venta_items for select using (auth.uid() = user_id);
create policy "venta_items_insert_own" on public.venta_items for insert with check (auth.uid() = user_id);
create policy "venta_items_update_own" on public.venta_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "venta_items_delete_own" on public.venta_items for delete using (auth.uid() = user_id);

drop policy if exists "bot_actions_select_own" on public.bot_actions;
drop policy if exists "bot_actions_insert_own" on public.bot_actions;
drop policy if exists "bot_actions_update_own" on public.bot_actions;
drop policy if exists "bot_actions_delete_own" on public.bot_actions;
create policy "bot_actions_select_own" on public.bot_actions for select using (auth.uid() = user_id);
create policy "bot_actions_insert_own" on public.bot_actions for insert with check (auth.uid() = user_id);
create policy "bot_actions_update_own" on public.bot_actions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "bot_actions_delete_own" on public.bot_actions for delete using (auth.uid() = user_id);

drop policy if exists "inventory_aliases_select_own" on public.inventory_aliases;
drop policy if exists "inventory_aliases_insert_own" on public.inventory_aliases;
drop policy if exists "inventory_aliases_update_own" on public.inventory_aliases;
drop policy if exists "inventory_aliases_delete_own" on public.inventory_aliases;
create policy "inventory_aliases_select_own" on public.inventory_aliases for select using (auth.uid() = user_id);
create policy "inventory_aliases_insert_own" on public.inventory_aliases for insert with check (auth.uid() = user_id);
create policy "inventory_aliases_update_own" on public.inventory_aliases for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "inventory_aliases_delete_own" on public.inventory_aliases for delete using (auth.uid() = user_id);

create index if not exists idx_stock_movements_user_id on public.stock_movements(user_id);
create index if not exists idx_stock_movements_inventory_item_id on public.stock_movements(inventory_item_id);
create index if not exists idx_stock_movements_tipo on public.stock_movements(tipo);
create index if not exists idx_stock_movements_created_at on public.stock_movements(created_at);
create index if not exists idx_stock_movements_user_item_created on public.stock_movements(user_id, inventory_item_id, created_at);

create index if not exists idx_ventas_user_id on public.ventas(user_id);
create index if not exists idx_ventas_fecha on public.ventas(fecha);
create index if not exists idx_ventas_user_fecha on public.ventas(user_id, fecha);
create index if not exists idx_ventas_created_at on public.ventas(created_at);

create index if not exists idx_venta_items_user_id on public.venta_items(user_id);
create index if not exists idx_venta_items_venta_id on public.venta_items(venta_id);
create index if not exists idx_venta_items_inventory_item_id on public.venta_items(inventory_item_id);
create index if not exists idx_venta_items_user_venta on public.venta_items(user_id, venta_id);

create index if not exists idx_bot_actions_user_id on public.bot_actions(user_id);
create index if not exists idx_bot_actions_status on public.bot_actions(status);
create index if not exists idx_bot_actions_action_type on public.bot_actions(action_type);
create index if not exists idx_bot_actions_created_at on public.bot_actions(created_at);
create index if not exists idx_bot_actions_user_status on public.bot_actions(user_id, status);

create index if not exists idx_inventory_aliases_user_id on public.inventory_aliases(user_id);
create index if not exists idx_inventory_aliases_inventory_item_id on public.inventory_aliases(inventory_item_id);
create index if not exists idx_inventory_aliases_normalized_alias on public.inventory_aliases(normalized_alias);
create index if not exists idx_inventory_aliases_user_normalized_alias on public.inventory_aliases(user_id, normalized_alias);

create or replace view public.v_finanzas_unificadas
with (security_invoker = true)
as
select
  t.id::text as id,
  t.user_id,
  t.fecha,
  t.descripcion,
  t.tipo,
  t.monto,
  t.cat as categoria,
  'legacy'::text as fuente
from public.transacciones t
union all
select
  m.id::text as id,
  m.user_id,
  m.fecha,
  m.descripcion,
  m.tipo,
  m.monto,
  m.categoria,
  'importado'::text as fuente
from public.movimientos_financieros m;

create or replace view public.v_inventario_unificado
with (security_invoker = true)
as
select
  i.id::text as id,
  i.user_id,
  i.sku,
  i.categoria,
  i.producto,
  i.variante,
  i.medida,
  i.color,
  i.stock_actual,
  i.stock_minimo,
  i.costo_unitario,
  i.costo_extra,
  i.costo_total,
  i.precio_venta_local,
  i.precio_venta_web,
  i.ganancia_local,
  i.margen_local_pct,
  i.ganancia_web,
  i.margen_web_pct,
  i.estado_stock,
  i.accion_recomendada,
  i.proveedor,
  i.notas,
  i.origen,
  i.created_at,
  i.updated_at,
  'importado'::text as fuente
from public.inventario_items i;

create or replace function public.confirm_bot_action(action_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  action_row public.bot_actions%rowtype;
begin
  select *
  into action_row
  from public.bot_actions
  where id = $1
    and user_id = auth.uid();

  if not found then
    return jsonb_build_object(
      'ok', false,
      'status', 'failed',
      'error', 'Accion no encontrada o sin permisos'
    );
  end if;

  if action_row.status <> 'preview' then
    return jsonb_build_object(
      'ok', false,
      'status', action_row.status,
      'error', 'La accion no esta en estado preview'
    );
  end if;

  return jsonb_build_object(
    'ok', false,
    'status', 'not_implemented',
    'action_id', action_row.id,
    'action_type', action_row.action_type,
    'error', 'confirm_bot_action todavia no ejecuta acciones. Requiere implementacion segura por action_type.'
  );
end;
$$;
