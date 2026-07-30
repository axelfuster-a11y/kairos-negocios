-- Catalogo multicanal: Shopify, Tiendanube y Meta.
-- Kairos conserva el stock maestro y una cola durable propaga los cambios.

alter table public.inventario_items
  add column if not exists imagen_principal_url text,
  add column if not exists imagenes jsonb not null default '[]'::jsonb,
  add column if not exists barcode text,
  add column if not exists catalogo_actualizado_at timestamptz;

alter table public.inventario_items
  drop constraint if exists inventario_items_imagenes_array_ck;
alter table public.inventario_items
  add constraint inventario_items_imagenes_array_ck
  check (jsonb_typeof(imagenes) = 'array') not valid;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images', 'product-images', true, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "product_images_insert_own" on storage.objects;
drop policy if exists "product_images_update_own" on storage.objects;
drop policy if exists "product_images_delete_own" on storage.objects;
create policy "product_images_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "product_images_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "product_images_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);

create table if not exists public.catalog_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  provider text not null check (provider in ('shopify', 'tiendanube', 'meta')),
  external_store_id text not null,
  display_name text,
  status text not null default 'connected' check (status in ('connected', 'disabled', 'error')),
  sync_direction text not null default 'both' check (sync_direction in ('import', 'export', 'both')),
  config jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, external_store_id),
  unique (id, user_id)
);

create table if not exists public.catalog_connection_secrets (
  connection_id uuid primary key references public.catalog_connections(id) on delete cascade,
  access_token_ciphertext text not null,
  webhook_secret_ciphertext text,
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_item_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  connection_id uuid not null,
  inventory_item_id uuid not null,
  external_product_id text not null,
  external_variant_id text not null default '',
  external_inventory_id text,
  external_location_id text,
  last_source_stock integer,
  last_synced_at timestamptz,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (connection_id, user_id) references public.catalog_connections(id, user_id) on delete cascade,
  foreign key (inventory_item_id, user_id) references public.inventario_items(id, user_id) on delete cascade,
  unique (connection_id, external_product_id, external_variant_id),
  unique (connection_id, inventory_item_id),
  unique (id, user_id)
);

create table if not exists public.catalog_sync_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  connection_id uuid not null,
  inventory_item_id uuid not null,
  action text not null check (action in ('upsert_product', 'stock')),
  desired_stock integer,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'error')),
  attempts integer not null default 0,
  last_error text,
  available_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (connection_id, user_id) references public.catalog_connections(id, user_id) on delete cascade,
  foreign key (inventory_item_id, user_id) references public.inventario_items(id, user_id) on delete cascade
);

create unique index if not exists uq_catalog_sync_pending
  on public.catalog_sync_queue(connection_id, inventory_item_id, action)
  where status = 'pending';
create index if not exists idx_catalog_links_item on public.catalog_item_links(user_id, inventory_item_id);
create index if not exists idx_catalog_queue_ready on public.catalog_sync_queue(status, available_at);

alter table public.catalog_connections enable row level security;
alter table public.catalog_connection_secrets enable row level security;
alter table public.catalog_item_links enable row level security;
alter table public.catalog_sync_queue enable row level security;

drop policy if exists "catalog_connections_select_own" on public.catalog_connections;
drop policy if exists "catalog_links_select_own" on public.catalog_item_links;
drop policy if exists "catalog_queue_select_own" on public.catalog_sync_queue;
create policy "catalog_connections_select_own" on public.catalog_connections
  for select to authenticated using (auth.uid() = user_id);
create policy "catalog_links_select_own" on public.catalog_item_links
  for select to authenticated using (auth.uid() = user_id);
create policy "catalog_queue_select_own" on public.catalog_sync_queue
  for select to authenticated using (auth.uid() = user_id);

create or replace function public.queue_catalog_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_connection record;
  v_action text;
  v_source text := current_setting('kairos.catalog_source', true);
begin
  if tg_op = 'INSERT' then
    v_action := 'upsert_product';
  elsif new.stock_actual is distinct from old.stock_actual then
    v_action := 'stock';
  elsif row(new.producto, new.variante, new.sku, new.barcode, new.precio_venta_web,
            new.imagen_principal_url, new.imagenes)
        is distinct from
        row(old.producto, old.variante, old.sku, old.barcode, old.precio_venta_web,
            old.imagen_principal_url, old.imagenes) then
    v_action := 'upsert_product';
  else
    return new;
  end if;

  for v_connection in
    select id, user_id
    from public.catalog_connections
    where user_id = new.user_id
      and status = 'connected'
      and sync_direction in ('export', 'both')
      and id::text is distinct from nullif(v_source, '')
  loop
    insert into public.catalog_sync_queue (
      user_id, connection_id, inventory_item_id, action, desired_stock, payload
    ) values (
      v_connection.user_id, v_connection.id, new.id, v_action,
      case when v_action = 'stock' then new.stock_actual end,
      jsonb_build_object('source', coalesce(nullif(v_source, ''), 'kairos'))
    )
    on conflict (connection_id, inventory_item_id, action) where status = 'pending'
    do update set
      desired_stock = excluded.desired_stock,
      payload = excluded.payload,
      available_at = now(),
      updated_at = now(),
      last_error = null;
  end loop;
  return new;
end;
$$;

drop trigger if exists queue_catalog_change on public.inventario_items;
create trigger queue_catalog_change
after insert or update on public.inventario_items
for each row execute function public.queue_catalog_change();

create or replace function public.import_catalog_variant(
  p_connection_id uuid,
  p_external_product_id text,
  p_external_variant_id text,
  p_external_inventory_id text,
  p_external_location_id text,
  p_sku text,
  p_barcode text,
  p_product_name text,
  p_variant_name text,
  p_stock integer,
  p_price numeric,
  p_cost numeric,
  p_image_url text,
  p_images jsonb,
  p_raw_data jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_connection public.catalog_connections%rowtype;
  v_item public.inventario_items%rowtype;
  v_item_id uuid;
  v_link_id uuid;
  v_before integer := 0;
  v_after integer := greatest(coalesce(p_stock, 0), 0);
  v_delta integer;
  v_provider text;
begin
  select * into v_connection
  from public.catalog_connections
  where id = p_connection_id and status = 'connected'
  for update;
  if not found then raise exception 'Conexion de catalogo inexistente o inactiva'; end if;
  if nullif(trim(p_external_product_id), '') is null then raise exception 'Falta external_product_id'; end if;
  if nullif(trim(p_product_name), '') is null then raise exception 'Falta nombre de producto'; end if;
  if coalesce(p_stock, 0) < 0 then raise exception 'El stock externo no puede ser negativo'; end if;

  v_provider := v_connection.provider;
  perform set_config('kairos.catalog_source', p_connection_id::text, true);

  select i.* into v_item
  from public.catalog_item_links l
  join public.inventario_items i on i.id = l.inventory_item_id and i.user_id = l.user_id
  where l.connection_id = p_connection_id
    and l.external_product_id = p_external_product_id
    and l.external_variant_id = coalesce(p_external_variant_id, '')
  for update of i;

  if not found and nullif(trim(p_sku), '') is not null then
    select * into v_item
    from public.inventario_items
    where user_id = v_connection.user_id and lower(sku) = lower(trim(p_sku))
    order by created_at limit 1
    for update;
  end if;

  if not found then
    insert into public.inventario_items (
      user_id, sku, barcode, producto, variante, stock_actual, stock_minimo,
      costo_unitario, costo_total, precio_venta_local, precio_venta_web,
      ganancia_local, ganancia_web, margen_local_pct, margen_web_pct,
      estado_stock, origen, imagen_principal_url, imagenes, catalogo_actualizado_at
    ) values (
      v_connection.user_id, nullif(trim(p_sku), ''), nullif(trim(p_barcode), ''), trim(p_product_name),
      nullif(trim(p_variant_name), ''), v_after, 0, greatest(coalesce(p_cost, 0), 0),
      greatest(coalesce(p_cost, 0), 0), greatest(coalesce(p_price, 0), 0),
      greatest(coalesce(p_price, 0), 0), greatest(coalesce(p_price, 0), 0) - greatest(coalesce(p_cost, 0), 0),
      greatest(coalesce(p_price, 0), 0) - greatest(coalesce(p_cost, 0), 0),
      case when coalesce(p_price, 0) > 0 then ((p_price - greatest(coalesce(p_cost, 0), 0)) / p_price) * 100 else 0 end,
      case when coalesce(p_price, 0) > 0 then ((p_price - greatest(coalesce(p_cost, 0), 0)) / p_price) * 100 else 0 end,
      case when v_after <= 0 then 'rojo' else 'verde' end,
      v_provider, nullif(trim(p_image_url), ''),
      case when jsonb_typeof(coalesce(p_images, '[]'::jsonb)) = 'array' then coalesce(p_images, '[]'::jsonb) else '[]'::jsonb end,
      now()
    ) returning id into v_item_id;
  else
    v_item_id := v_item.id;
    v_before := coalesce(v_item.stock_actual, 0);
    if p_stock is null then v_after := v_before; end if;
    update public.inventario_items set
      sku = coalesce(nullif(trim(p_sku), ''), sku),
      barcode = coalesce(nullif(trim(p_barcode), ''), barcode),
      producto = trim(p_product_name),
      variante = nullif(trim(p_variant_name), ''),
      stock_actual = v_after,
      costo_unitario = case when p_cost is null then costo_unitario else greatest(p_cost, 0) end,
      costo_total = case when p_cost is null then costo_total else greatest(p_cost, 0) + coalesce(costo_extra, 0) end,
      precio_venta_web = case when p_price is null then precio_venta_web else greatest(p_price, 0) end,
      precio_venta_local = case when p_price is null then precio_venta_local else greatest(p_price, 0) end,
      ganancia_local = (case when p_price is null then precio_venta_local else greatest(p_price, 0) end)
        - (case when p_cost is null then costo_total else greatest(p_cost, 0) + coalesce(costo_extra, 0) end),
      ganancia_web = (case when p_price is null then precio_venta_web else greatest(p_price, 0) end)
        - (case when p_cost is null then costo_total else greatest(p_cost, 0) + coalesce(costo_extra, 0) end),
      margen_local_pct = case
        when (case when p_price is null then precio_venta_local else greatest(p_price, 0) end) > 0
        then (((case when p_price is null then precio_venta_local else greatest(p_price, 0) end)
          - (case when p_cost is null then costo_total else greatest(p_cost, 0) + coalesce(costo_extra, 0) end))
          / (case when p_price is null then precio_venta_local else greatest(p_price, 0) end)) * 100
        else 0 end,
      margen_web_pct = case
        when (case when p_price is null then precio_venta_web else greatest(p_price, 0) end) > 0
        then (((case when p_price is null then precio_venta_web else greatest(p_price, 0) end)
          - (case when p_cost is null then costo_total else greatest(p_cost, 0) + coalesce(costo_extra, 0) end))
          / (case when p_price is null then precio_venta_web else greatest(p_price, 0) end)) * 100
        else 0 end,
      imagen_principal_url = coalesce(nullif(trim(p_image_url), ''), imagen_principal_url),
      imagenes = case when jsonb_typeof(coalesce(p_images, '[]'::jsonb)) = 'array' and jsonb_array_length(coalesce(p_images, '[]'::jsonb)) > 0 then p_images else imagenes end,
      estado_stock = case when v_after <= 0 then 'rojo' when v_after <= coalesce(stock_minimo, 0) then 'amarillo' else 'verde' end,
      catalogo_actualizado_at = now(),
      origen = v_provider
    where id = v_item_id and user_id = v_connection.user_id;
  end if;

  insert into public.catalog_item_links (
    user_id, connection_id, inventory_item_id, external_product_id, external_variant_id,
    external_inventory_id, external_location_id, last_source_stock, last_synced_at, raw_data
  ) values (
    v_connection.user_id, p_connection_id, v_item_id, p_external_product_id,
    coalesce(p_external_variant_id, ''), nullif(p_external_inventory_id, ''),
    nullif(p_external_location_id, ''), v_after, now(), coalesce(p_raw_data, '{}'::jsonb)
  )
  on conflict (connection_id, external_product_id, external_variant_id)
  do update set
    inventory_item_id = excluded.inventory_item_id,
    external_inventory_id = excluded.external_inventory_id,
    external_location_id = excluded.external_location_id,
    last_source_stock = excluded.last_source_stock,
    last_synced_at = now(),
    raw_data = excluded.raw_data,
    updated_at = now()
  returning id into v_link_id;

  v_delta := v_after - v_before;
  if v_delta <> 0 then
    insert into public.stock_movements (
      user_id, inventory_item_id, tipo, cantidad, stock_antes, stock_despues,
      motivo, referencia_tipo, referencia_id, origen, raw_data
    ) values (
      v_connection.user_id, v_item_id,
      case when v_before = 0 and v_delta > 0 then 'inicial' else 'ajuste' end,
      v_delta, v_before, v_after, 'Sincronizacion desde ' || initcap(v_provider),
      'catalog_item_link', v_link_id, v_provider, coalesce(p_raw_data, '{}'::jsonb)
    );
  end if;

  update public.catalog_connections set last_sync_at = now(), last_error = null, updated_at = now()
  where id = p_connection_id;
  return jsonb_build_object('ok', true, 'inventoryItemId', v_item_id, 'linkId', v_link_id, 'stock', v_after, 'movement', v_delta);
end;
$$;

revoke all on function public.import_catalog_variant(uuid,text,text,text,text,text,text,text,text,integer,numeric,numeric,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.import_catalog_variant(uuid,text,text,text,text,text,text,text,text,integer,numeric,numeric,text,jsonb,jsonb) to service_role;

create or replace function public.set_inventory_images(
  p_inventory_item_id uuid,
  p_main_image_url text,
  p_images jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Usuario no autenticado'; end if;
  if jsonb_typeof(coalesce(p_images, '[]'::jsonb)) <> 'array' then raise exception 'imagenes debe ser un array'; end if;
  update public.inventario_items set
    imagen_principal_url = nullif(trim(p_main_image_url), ''),
    imagenes = coalesce(p_images, '[]'::jsonb),
    catalogo_actualizado_at = now()
  where id = p_inventory_item_id and user_id = v_uid;
  if not found then raise exception 'Producto no encontrado o sin permisos'; end if;
  return jsonb_build_object('ok', true, 'inventoryItemId', p_inventory_item_id);
end;
$$;

grant execute on function public.set_inventory_images(uuid,text,jsonb) to authenticated;

create or replace view public.v_catalog_products
with (security_invoker = true)
as
select
  i.id, i.user_id, i.sku, i.barcode, i.producto, i.variante,
  i.stock_actual, i.precio_venta_local, i.precio_venta_web,
  i.imagen_principal_url, i.imagenes, i.updated_at,
  coalesce(jsonb_agg(jsonb_build_object(
    'provider', c.provider,
    'connectionId', c.id,
    'externalProductId', l.external_product_id,
    'externalVariantId', l.external_variant_id,
    'lastSyncedAt', l.last_synced_at
  )) filter (where l.id is not null), '[]'::jsonb) as canales
from public.inventario_items i
left join public.catalog_item_links l on l.inventory_item_id = i.id and l.user_id = i.user_id
left join public.catalog_connections c on c.id = l.connection_id and c.user_id = l.user_id
group by i.id;

grant select on public.v_catalog_products to authenticated;

comment on table public.catalog_sync_queue is
  'Outbox durable: una Edge Function envia productos y stock a Shopify, Tiendanube y Meta sin perder cambios.';
comment on column public.inventario_items.imagen_principal_url is
  'URL visible en mostrador; puede venir de un canal o de Storage product-images.';
