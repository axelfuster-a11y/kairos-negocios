-- OAuth multicanal: una conexión y un secreto cifrado por usuario/proveedor.

alter table public.catalog_connections
  drop constraint if exists catalog_connections_provider_check;
alter table public.catalog_connections
  add constraint catalog_connections_provider_check
  check (provider in ('shopify', 'tiendanube', 'mercadolibre', 'meta'));

create table if not exists public.catalog_oauth_states (
  state text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  provider text not null check (provider in ('shopify', 'tiendanube', 'mercadolibre')),
  shop_domain text,
  return_to text,
  code_verifier text,
  created_at timestamptz not null default now()
);

alter table public.catalog_oauth_states enable row level security;
create index if not exists idx_catalog_oauth_states_created_at
  on public.catalog_oauth_states(created_at);

alter table public.catalog_connection_secrets
  add column if not exists refresh_token_ciphertext text,
  add column if not exists expires_at timestamptz,
  add column if not exists scopes text;

update public.catalog_connections connection
set
  status = 'disabled',
  last_error = 'Vuelva a conectar la cuenta para autorizarla con OAuth.',
  updated_at = now()
where not exists (
  select 1 from public.catalog_connection_secrets secret
  where secret.connection_id = connection.id
);

alter table public.catalog_item_links
  add column if not exists variant_image_url text;

alter table public.catalog_item_links
  drop constraint if exists catalog_links_variant_image_ck;
alter table public.catalog_item_links
  add constraint catalog_links_variant_image_ck
  check (variant_image_url is null or variant_image_url ~ '^https://');

revoke all on table public.catalog_oauth_states from public, anon, authenticated;
revoke all on table public.catalog_connection_secrets from public, anon, authenticated;

comment on column public.catalog_item_links.variant_image_url is
  'Imagen propia de la variante externa. Nunca se completa con la imagen principal del producto.';
