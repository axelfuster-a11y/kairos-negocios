-- Smoke test de estructura; no modifica datos.
select
  to_regclass('public.catalog_connections') is not null as connections_ok,
  to_regclass('public.catalog_item_links') is not null as links_ok,
  to_regclass('public.catalog_sync_queue') is not null as queue_ok,
  to_regclass('public.v_catalog_products') is not null as view_ok,
  to_regprocedure('public.import_catalog_variant(uuid,text,text,text,text,text,text,text,text,integer,numeric,numeric,text,jsonb,jsonb)') is not null as import_rpc_ok,
  to_regprocedure('public.set_inventory_images(uuid,text,jsonb)') is not null as images_rpc_ok,
  exists (select 1 from storage.buckets where id = 'product-images') as image_bucket_ok;
