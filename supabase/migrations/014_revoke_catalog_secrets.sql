-- Defensa en profundidad: los tokens solo pueden ser usados por Edge Functions.
revoke all on table public.catalog_connection_secrets from public, anon, authenticated;

comment on table public.catalog_connection_secrets is
  'Tokens cifrados de canales. Sin acceso desde el frontend; solo service_role.';
