create table if not exists public.organization_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  titulo text not null,
  tipo text not null default 'tarea',
  estado text not null default 'pendiente',
  prioridad text not null default 'normal',
  fecha date not null,
  responsable text,
  monto numeric not null default 0,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (tipo in ('tarea', 'pedido', 'entrega', 'vencimiento', 'cobro', 'pago', 'recordatorio')),
  check (estado in ('pendiente', 'en_progreso', 'completado', 'cancelado')),
  check (prioridad in ('normal', 'alta', 'urgente')),
  check (monto >= 0)
);

drop trigger if exists set_organization_items_updated_at on public.organization_items;
create trigger set_organization_items_updated_at
before update on public.organization_items
for each row
execute function public.set_updated_at();

alter table public.organization_items enable row level security;

drop policy if exists "organization_items_select_own" on public.organization_items;
drop policy if exists "organization_items_insert_own" on public.organization_items;
drop policy if exists "organization_items_update_own" on public.organization_items;
drop policy if exists "organization_items_delete_own" on public.organization_items;

create policy "organization_items_select_own"
on public.organization_items for select
using (auth.uid() = user_id);

create policy "organization_items_insert_own"
on public.organization_items for insert
with check (auth.uid() = user_id);

create policy "organization_items_update_own"
on public.organization_items for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "organization_items_delete_own"
on public.organization_items for delete
using (auth.uid() = user_id);

create index if not exists idx_organization_items_user_id
  on public.organization_items(user_id);
create index if not exists idx_organization_items_user_fecha
  on public.organization_items(user_id, fecha);
create index if not exists idx_organization_items_user_estado
  on public.organization_items(user_id, estado);
create index if not exists idx_organization_items_user_tipo
  on public.organization_items(user_id, tipo);
