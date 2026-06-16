# Supabase Schema Notes

Este archivo documenta el schema que el frontend actual de Kairós espera encontrar en Supabase.
No es una migración SQL. La intención es dejar explícitas las tablas, columnas y zonas de uso antes de agregar importaciones.

Todas las tablas listadas deben tener Row Level Security (RLS) por `user_id`, de modo que cada usuario solo pueda leer y escribir sus propios datos.

## `negocios`

Columnas usadas por el frontend:

- `user_id`
- `nom`
- `rub`
- `cli`
- `prec`
- `can`
- `loc`
- `prob`
- `dif`
- `don`
- `prod`

Dónde se usa:

- Wizard inicial: guarda datos base con `upsert`.
- Pantalla "Mi Negocio": carga y guarda el formulario.
- Topbar y dashboard: muestran nombre/rubro del negocio.
- Asesor IA: usa datos del negocio para armar prompts.

Nota RLS: filtrar por `user_id = auth.uid()`.

## `configuracion_costos`

Columnas usadas por el frontend:

- `user_id`
- `packaging_default`
- `envio_default`
- `comision_plataforma_default_pct`
- `comision_pago_default_pct`
- `impuestos_default_pct`
- `descuento_default_pct`
- `margen_deseado_default_pct`

Dónde se usa:

- Pantalla "Productos & Servicios": guarda la configuración de costos por defecto.
- Motor de costos: prellena campos de producto y recalcula precio mínimo, sugerido y margen.

Nota RLS: filtrar por `user_id = auth.uid()`.

## `transacciones`

Columnas usadas por el frontend:

- `id`
- `user_id`
- `tipo`
- `descripcion`
- `cat`
- `monto`
- `fecha`
- `created_at`

Dónde se usa:

- Finanzas: crea, lista y elimina ingresos/egresos.
- Dashboard: calcula ingresos, egresos, ganancia neta, margen y últimos movimientos.
- Métricas: calcula ticket promedio, mejor categoría, margen y ratio ingresos/egresos.

Nota RLS: filtrar por `user_id = auth.uid()`.

## `gastos_fijos`

Columnas usadas por el frontend:

- `id`
- `user_id`
- `nom`
- `mon`

Dónde se usa:

- Finanzas: crea, lista y elimina gastos fijos.
- Finanzas: calcula punto de equilibrio mensual.

Nota RLS: filtrar por `user_id = auth.uid()`.

## `productos`

Columnas usadas por el frontend:

- `id`
- `user_id`
- `nom`
- `cat`
- `descripcion`
- `costo_producto`
- `costo_packaging`
- `costo_envio`
- `envio_pagado_por`
- `comision_plataforma_pct`
- `comision_pago_pct`
- `impuestos_pct`
- `descuento_pct`
- `margen_deseado_pct`
- `precio_minimo_rentable`
- `precio_sugerido`
- `precio_venta`
- `ganancia_estimada`
- `margen_real_pct`
- `stock`
- `estado`
- `created_at`

Dónde se usa:

- Productos & Servicios: crea, lista y elimina productos.
- Motor de costos: calcula precio mínimo rentable, precio sugerido, ganancia estimada y margen real.
- Dashboard: cuenta productos cargados para el estado del negocio.
- Asesor IA: genera descripciones de producto usando el panel de IA.

Nota RLS: filtrar por `user_id = auth.uid()`.

## `leads`

Columnas usadas por el frontend:

- `id`
- `user_id`
- `nom`
- `contacto`
- `valor`
- `nota`
- `estado`
- `created_at`

Dónde se usa:

- Clientes & Leads: crea, mueve entre estados y elimina leads.
- Dashboard: calcula leads activos y clientes en pipeline.

Nota RLS: filtrar por `user_id = auth.uid()`.

## `campanas`

Columnas usadas por el frontend:

- `id`
- `user_id`
- `plat`
- `nom`
- `inv`
- `cli`
- `ing`
- `roas`
- `cac`
- `created_at`

Dónde se usa:

- Publicidad: crea, lista y elimina campañas.
- Publicidad: calcula inversión total, clientes generados, CAC y ROAS.
- Métricas: calcula ROAS, CAC y mejor canal.

Nota RLS: filtrar por `user_id = auth.uid()`.

## `contenido`

Columnas usadas por el frontend:

- `id`
- `user_id`
- `tit`
- `tipo`
- `plat`
- `fecha`
- `estado`

Dónde se usa:

- Contenido: crea, lista y elimina ideas/calendario.
- Asesor IA: genera ideas de contenido.

Nota RLS: filtrar por `user_id = auth.uid()`.

## `referentes`

Columnas usadas por el frontend:

- `id`
- `user_id`
- `nom`
- `why`

Dónde se usa:

- Contenido: crea, lista y elimina referentes.

Nota RLS: filtrar por `user_id = auth.uid()`.

## `angulos`

Columnas usadas por el frontend:

- `user_id`
- `p`
- `t`
- `s`
- `n`

Dónde se usa:

- Contenido: guarda y carga ángulo principal, tono, palabras sí y palabras no.

Nota RLS: filtrar por `user_id = auth.uid()`.

## Tablas preparadas para importaciones

Estas tablas quedan preparadas para un flujo futuro de Excel/texto -> preview -> confirmacion -> Supabase. Todavia no son usadas por el frontend actual y no reemplazan a `transacciones` ni `productos`.

### `movimientos_financieros`

Tabla destino futura para movimientos normalizados de ingresos y egresos importados.

Columnas previstas:

- `id`
- `user_id`
- `fecha`
- `descripcion`
- `monto`
- `tipo`
- `medio_pago`
- `categoria`
- `mes`
- `origen`
- `created_at`

Notas:

- `tipo` acepta solo `ingreso` o `egreso`.
- `monto` no puede ser negativo.
- Debe tener RLS por `user_id`.
- Todavia no reemplaza a `transacciones`.

### `inventario_items`

Tabla destino futura para inventario normalizado importado.

Columnas previstas:

- `id`
- `user_id`
- `sku`
- `categoria`
- `producto`
- `variante`
- `medida`
- `color`
- `stock_actual`
- `stock_minimo`
- `costo_unitario`
- `costo_extra`
- `costo_total`
- `precio_venta_local`
- `precio_venta_web`
- `ganancia_local`
- `margen_local_pct`
- `ganancia_web`
- `margen_web_pct`
- `estado_stock`
- `accion_recomendada`
- `proveedor`
- `notas`
- `origen`
- `created_at`
- `updated_at`

Notas:

- Stocks y numeros de costos/precios/margenes no pueden ser negativos.
- `estado_stock` acepta `verde`, `amarillo`, `rojo` o `sin_datos`.
- Tiene trigger para mantener `updated_at`.
- Debe tener RLS por `user_id`.
- Todavia no reemplaza a `productos`.

### `import_batches`

Tabla de cabecera para cada intento de importacion.

Columnas previstas:

- `id`
- `user_id`
- `source`
- `target`
- `status`
- `nombre_archivo`
- `total_filas`
- `filas_validas`
- `filas_con_error`
- `created_at`

Notas:

- `target` acepta `movimientos_financieros`, `inventario_items`, `mixed` o `unknown`.
- `status` acepta `preview`, `confirmed`, `cancelled` o `failed`.
- Conteos de filas no pueden ser negativos.
- Debe tener RLS por `user_id`.

### `import_rows`

Tabla de detalle fila por fila para preview, validacion y auditoria de importaciones.

Columnas previstas:

- `id`
- `batch_id`
- `user_id`
- `row_number`
- `raw_data`
- `normalized_data`
- `errors`
- `status`
- `created_at`

Notas:

- `batch_id` referencia a `import_batches`.
- `status` acepta `pending`, `valid`, `warning`, `error`, `imported` o `skipped`.
- `raw_data` guarda la fila original como JSON.
- `normalized_data` guarda la version normalizada cuando exista.
- `errors` guarda advertencias o errores de validacion como JSON.
- Debe tener RLS por `user_id`.
