-- Fija la resolución de nombres y evita llamar directamente a la función
-- interna que sólo debe ejecutarse mediante su trigger.
alter function public.set_updated_at()
  set search_path = public, pg_temp;

alter function public.bot_normalize_alias(text)
  set search_path = public, pg_temp;

alter function public.bot_stock_state(integer, integer)
  set search_path = public, pg_temp;

alter function public.bot_inventory_action(integer, integer, numeric, numeric)
  set search_path = public, pg_temp;

revoke execute on function public.queue_catalog_change() from public, anon, authenticated;
