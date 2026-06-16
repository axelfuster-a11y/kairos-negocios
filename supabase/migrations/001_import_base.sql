create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.movimientos_financieros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  fecha date,
  descripcion text not null,
  monto numeric not null default 0,
  tipo text not null check (tipo in ('ingreso', 'egreso')),
  medio_pago text,
  categoria text default 'sin_categoria',
  mes text,
  origen text default 'manual',
  created_at timestamptz default now(),
  check (monto >= 0)
);

create table if not exists public.inventario_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  sku text,
  categoria text,
  producto text not null,
  variante text,
  medida text,
  color text,
  stock_actual integer default 0,
  stock_minimo integer default 0,
  costo_unitario numeric default 0,
  costo_extra numeric default 0,
  costo_total numeric default 0,
  precio_venta_local numeric default 0,
  precio_venta_web numeric default 0,
  ganancia_local numeric default 0,
  margen_local_pct numeric default 0,
  ganancia_web numeric default 0,
  margen_web_pct numeric default 0,
  estado_stock text not null default 'sin_datos',
  accion_recomendada text,
  proveedor text,
  notas text,
  origen text default 'manual',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (stock_actual >= 0),
  check (stock_minimo >= 0),
  check (costo_unitario >= 0),
  check (costo_extra >= 0),
  check (costo_total >= 0),
  check (precio_venta_local >= 0),
  check (precio_venta_web >= 0),
  check (estado_stock in ('verde', 'amarillo', 'rojo', 'sin_datos'))
);

drop trigger if exists set_inventario_items_updated_at on public.inventario_items;
create trigger set_inventario_items_updated_at
before update on public.inventario_items
for each row
execute function public.set_updated_at();

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  source text not null,
  target text not null,
  status text not null default 'preview',
  nombre_archivo text,
  total_filas integer not null default 0,
  filas_validas integer not null default 0,
  filas_con_error integer not null default 0,
  created_at timestamptz default now(),
  check (target in ('movimientos_financieros', 'inventario_items', 'mixed', 'unknown')),
  check (status in ('preview', 'confirmed', 'cancelled', 'failed')),
  check (total_filas >= 0),
  check (filas_validas >= 0),
  check (filas_con_error >= 0)
);

do $do$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'import_batches_id_user_id_unique'
      and conrelid = 'public.import_batches'::regclass
  ) then
    alter table public.import_batches
      add constraint import_batches_id_user_id_unique unique (id, user_id);
  end if;
end;
$do$;

create table if not exists public.import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  row_number integer not null,
  raw_data jsonb not null default '{}'::jsonb,
  normalized_data jsonb,
  errors jsonb default '[]'::jsonb,
  status text not null default 'pending',
  created_at timestamptz default now(),
  foreign key (batch_id, user_id) references public.import_batches(id, user_id) on delete cascade,
  check (row_number > 0),
  check (status in ('pending', 'valid', 'warning', 'error', 'imported', 'skipped'))
);

alter table public.movimientos_financieros enable row level security;
alter table public.inventario_items enable row level security;
alter table public.import_batches enable row level security;
alter table public.import_rows enable row level security;

drop policy if exists "movimientos_financieros_select_own" on public.movimientos_financieros;
drop policy if exists "movimientos_financieros_insert_own" on public.movimientos_financieros;
drop policy if exists "movimientos_financieros_update_own" on public.movimientos_financieros;
drop policy if exists "movimientos_financieros_delete_own" on public.movimientos_financieros;
create policy "movimientos_financieros_select_own" on public.movimientos_financieros for select using (auth.uid() = user_id);
create policy "movimientos_financieros_insert_own" on public.movimientos_financieros for insert with check (auth.uid() = user_id);
create policy "movimientos_financieros_update_own" on public.movimientos_financieros for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "movimientos_financieros_delete_own" on public.movimientos_financieros for delete using (auth.uid() = user_id);

drop policy if exists "inventario_items_select_own" on public.inventario_items;
drop policy if exists "inventario_items_insert_own" on public.inventario_items;
drop policy if exists "inventario_items_update_own" on public.inventario_items;
drop policy if exists "inventario_items_delete_own" on public.inventario_items;
create policy "inventario_items_select_own" on public.inventario_items for select using (auth.uid() = user_id);
create policy "inventario_items_insert_own" on public.inventario_items for insert with check (auth.uid() = user_id);
create policy "inventario_items_update_own" on public.inventario_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "inventario_items_delete_own" on public.inventario_items for delete using (auth.uid() = user_id);

drop policy if exists "import_batches_select_own" on public.import_batches;
drop policy if exists "import_batches_insert_own" on public.import_batches;
drop policy if exists "import_batches_update_own" on public.import_batches;
drop policy if exists "import_batches_delete_own" on public.import_batches;
create policy "import_batches_select_own" on public.import_batches for select using (auth.uid() = user_id);
create policy "import_batches_insert_own" on public.import_batches for insert with check (auth.uid() = user_id);
create policy "import_batches_update_own" on public.import_batches for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "import_batches_delete_own" on public.import_batches for delete using (auth.uid() = user_id);

drop policy if exists "import_rows_select_own" on public.import_rows;
drop policy if exists "import_rows_insert_own" on public.import_rows;
drop policy if exists "import_rows_update_own" on public.import_rows;
drop policy if exists "import_rows_delete_own" on public.import_rows;
create policy "import_rows_select_own" on public.import_rows for select using (auth.uid() = user_id);
create policy "import_rows_insert_own" on public.import_rows for insert with check (auth.uid() = user_id);
create policy "import_rows_update_own" on public.import_rows for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "import_rows_delete_own" on public.import_rows for delete using (auth.uid() = user_id);

create index if not exists idx_movimientos_financieros_user_id on public.movimientos_financieros(user_id);
create index if not exists idx_movimientos_financieros_fecha on public.movimientos_financieros(fecha);
create index if not exists idx_movimientos_financieros_tipo on public.movimientos_financieros(tipo);
create index if not exists idx_movimientos_financieros_categoria on public.movimientos_financieros(categoria);
create index if not exists idx_movimientos_financieros_user_fecha on public.movimientos_financieros(user_id, fecha);

create index if not exists idx_inventario_items_user_id on public.inventario_items(user_id);
create index if not exists idx_inventario_items_sku on public.inventario_items(sku);
create index if not exists idx_inventario_items_categoria on public.inventario_items(categoria);
create index if not exists idx_inventario_items_estado_stock on public.inventario_items(estado_stock);
create index if not exists idx_inventario_items_user_estado_stock on public.inventario_items(user_id, estado_stock);

create index if not exists idx_import_batches_user_id on public.import_batches(user_id);
create index if not exists idx_import_batches_status on public.import_batches(status);
create index if not exists idx_import_batches_target on public.import_batches(target);
create index if not exists idx_import_batches_user_status on public.import_batches(user_id, status);

create index if not exists idx_import_rows_user_id on public.import_rows(user_id);
create index if not exists idx_import_rows_batch_id on public.import_rows(batch_id);
create index if not exists idx_import_rows_status on public.import_rows(status);
create index if not exists idx_import_rows_batch_status on public.import_rows(batch_id, status);
