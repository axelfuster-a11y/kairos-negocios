create table if not exists public.shopify_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  shop_domain text not null,
  scopes text not null default '',
  status text not null default 'connected',
  connected_at timestamptz default now(),
  last_sync_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, shop_domain),
  check (status in ('connected', 'disabled', 'error'))
);

create table if not exists public.shopify_connection_secrets (
  connection_id uuid primary key references public.shopify_connections(id) on delete cascade,
  access_token_ciphertext text not null,
  updated_at timestamptz default now()
);

create table if not exists public.shopify_oauth_states (
  state text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  shop_domain text not null,
  return_to text,
  created_at timestamptz default now()
);

alter table public.shopify_connections enable row level security;
alter table public.shopify_connection_secrets enable row level security;
alter table public.shopify_oauth_states enable row level security;

drop policy if exists "shopify_connections_select_own" on public.shopify_connections;
create policy "shopify_connections_select_own" on public.shopify_connections
  for select using (auth.uid() = user_id);

create index if not exists idx_shopify_connections_user_id on public.shopify_connections(user_id);
create index if not exists idx_shopify_oauth_states_created_at on public.shopify_oauth_states(created_at);
