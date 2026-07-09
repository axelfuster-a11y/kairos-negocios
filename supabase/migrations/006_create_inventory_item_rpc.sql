create or replace function public.create_inventory_item(
  product_name text,
  product_category text default null,
  product_notes text default null,
  current_stock integer default 0,
  minimum_stock integer default 0,
  unit_cost numeric default 0,
  extra_cost numeric default 0,
  local_price numeric default 0,
  web_price numeric default 0,
  source_name text default 'manual'
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_product text := nullif(trim(product_name), '');
  v_item_id uuid;
  v_total_cost numeric;
  v_local_gain numeric;
  v_web_gain numeric;
begin
  if v_uid is null then
    raise exception 'Usuario no autenticado';
  end if;
  if v_product is null then
    raise exception 'Falta producto';
  end if;
  if coalesce(current_stock, 0) < 0 or coalesce(minimum_stock, 0) < 0 then
    raise exception 'El stock no puede ser negativo';
  end if;
  if coalesce(unit_cost, 0) < 0 or coalesce(extra_cost, 0) < 0 or coalesce(local_price, 0) < 0 or coalesce(web_price, 0) < 0 then
    raise exception 'Costos y precios no pueden ser negativos';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(v_uid::text),
    hashtext(public.bot_normalize_alias(v_product))
  );
  if exists (
    select 1
    from public.inventario_items i
    where i.user_id = v_uid
      and public.bot_normalize_alias(i.producto) = public.bot_normalize_alias(v_product)
  ) or exists (
    select 1
    from public.inventory_aliases a
    where a.user_id = v_uid
      and a.normalized_alias = public.bot_normalize_alias(v_product)
  ) then
    raise exception 'Ese producto ya existe. Use reposicion para sumar stock.';
  end if;

  v_total_cost := coalesce(unit_cost, 0) + coalesce(extra_cost, 0);
  v_local_gain := coalesce(local_price, 0) - v_total_cost;
  v_web_gain := coalesce(web_price, 0) - v_total_cost;

  insert into public.inventario_items (
    user_id, producto, categoria, notas, stock_actual, stock_minimo,
    costo_unitario, costo_extra, costo_total, precio_venta_local, precio_venta_web,
    ganancia_local, margen_local_pct, ganancia_web, margen_web_pct,
    estado_stock, accion_recomendada, origen
  )
  values (
    v_uid,
    v_product,
    nullif(trim(product_category), ''),
    nullif(trim(product_notes), ''),
    coalesce(current_stock, 0),
    coalesce(minimum_stock, 0),
    coalesce(unit_cost, 0),
    coalesce(extra_cost, 0),
    v_total_cost,
    coalesce(local_price, 0),
    coalesce(web_price, 0),
    v_local_gain,
    case when coalesce(local_price, 0) > 0 then (v_local_gain / local_price) * 100 else 0 end,
    v_web_gain,
    case when coalesce(web_price, 0) > 0 then (v_web_gain / web_price) * 100 else 0 end,
    public.bot_stock_state(coalesce(current_stock, 0), coalesce(minimum_stock, 0)),
    public.bot_inventory_action(coalesce(current_stock, 0), coalesce(minimum_stock, 0), v_total_cost, coalesce(local_price, 0)),
    coalesce(nullif(trim(source_name), ''), 'manual')
  )
  returning id into v_item_id;

  insert into public.inventory_aliases (
    user_id, inventory_item_id, alias, normalized_alias
  )
  values (
    v_uid, v_item_id, v_product, public.bot_normalize_alias(v_product)
  );

  if coalesce(current_stock, 0) > 0 then
    insert into public.stock_movements (
      user_id, inventory_item_id, tipo, cantidad, stock_antes, stock_despues,
      motivo, referencia_tipo, referencia_id, origen, raw_data
    )
    values (
      v_uid, v_item_id, 'inicial', current_stock, 0, current_stock,
      'Carga manual desde Productos', 'inventory_item', v_item_id,
      coalesce(nullif(trim(source_name), ''), 'manual'),
      jsonb_build_object('producto', v_product)
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'inventory_item_id', v_item_id,
    'stock_actual', coalesce(current_stock, 0)
  );
end;
$$;

grant execute on function public.create_inventory_item(text, text, text, integer, integer, numeric, numeric, numeric, numeric, text) to authenticated;
