# Supabase Schema Notes

## Estado de interfaz - 2026-07-09

La navegacion principal actual es: Inicio, Productos, Ventas, Finanzas y Equipo. Las tablas legacy y nuevas se conservan por compatibilidad. Productos concentra catalogo e inventario; Ventas opera compras/ventas; Finanzas consolida caja, ingresos, egresos, gastos fijos, equipo y movimientos.

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
- Dashboard: participa del cálculo unificado de ingresos, egresos, resultado de caja y últimos movimientos.
- Métricas: participa del ticket promedio, mejor categoría y ratio ingresos/egresos.

Nota RLS: filtrar por `user_id = auth.uid()`.

## `gastos_fijos`

Columnas usadas por el frontend:

- `id`
- `user_id`
- `nom`
- `mon`

Dónde se usa:

- Finanzas: crea, lista y elimina gastos fijos.
- Finanzas: calcula la referencia mensual de gastos fijos a cubrir, sin presentarla como punto de equilibrio contable completo.

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

Estas tablas sostienen el flujo Excel/texto -> preview -> confirmación -> Supabase. El frontend las usa, pero todavía no reemplazan ni eliminan a `transacciones` ni `productos`.

### `movimientos_financieros`

Tabla operativa para movimientos normalizados de ingresos y egresos manuales, importados, del Asesor IA y del módulo Equipo.

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
- Convive con `transacciones`; la lectura unificada identifica la fuente.

### `inventario_items`

Tabla operativa para inventario normalizado creado manualmente, por importación o por el Asesor IA.

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

- Stocks, costos y precios no pueden ser negativos.
- Ganancias y margenes pueden ser negativos para detectar productos con perdida.
- `estado_stock` acepta `verde`, `amarillo`, `rojo` o `sin_datos`.
- Tiene trigger para mantener `updated_at`.
- Debe tener RLS por `user_id`.
- Convive con `productos`, que permanece como catálogo legacy.

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

## Core Business OS preparado

Estas tablas quedan preparadas para conectar ventas, inventario, movimientos de stock y acciones del bot. No reemplazan las tablas legacy `productos` ni `transacciones`.

### `stock_movements`

Historial de cambios de stock por item de inventario.

Columnas previstas:

- `id`
- `user_id`
- `inventory_item_id`
- `tipo`
- `cantidad`
- `stock_antes`
- `stock_despues`
- `motivo`
- `referencia_tipo`
- `referencia_id`
- `origen`
- `raw_data`
- `created_at`

Notas:

- `tipo` acepta `entrada`, `salida`, `ajuste`, `inicial`, `venta`, `compra` o `devolucion`.
- `cantidad` no puede ser `0`.
- La relación con `inventario_items` valida `(inventory_item_id, user_id)` para evitar referencias cruzadas entre usuarios.
- Debe tener RLS por `user_id`.
- Sirve para auditar stock sin modificar todavía el flujo de importación.

### `ventas`

Cabecera de ventas confirmadas.

Columnas previstas:

- `id`
- `user_id`
- `fecha`
- `cliente`
- `medio_pago`
- `total`
- `costo_total`
- `ganancia`
- `margen_pct`
- `origen`
- `notas`
- `created_at`

Notas:

- `total` y `costo_total` no pueden ser negativos.
- `ganancia` y `margen_pct` pueden ser negativos para detectar ventas con pérdida.
- Debe tener RLS por `user_id`.

### `venta_items`

Detalle de productos o textos vendidos dentro de una venta.

Columnas previstas:

- `id`
- `user_id`
- `venta_id`
- `inventory_item_id`
- `producto_texto`
- `cantidad`
- `precio_unitario`
- `costo_unitario`
- `subtotal`
- `ganancia`
- `created_at`

Notas:

- `cantidad` debe ser mayor a `0`.
- `precio_unitario`, `costo_unitario` y `subtotal` no pueden ser negativos.
- `ganancia` puede ser negativa.
- La migración referencia la venta por `(venta_id, user_id)` para evitar cruces entre usuarios.
- La relación con `inventario_items` valida `(inventory_item_id, user_id)` para evitar referencias cruzadas entre usuarios.
- Debe tener RLS por `user_id`.

### `bot_actions`

Historial de acciones propuestas por el bot antes de ejecutarlas.

Columnas previstas:

- `id`
- `user_id`
- `input_text`
- `action_type`
- `status`
- `preview_data`
- `result_data`
- `error`
- `created_at`
- `confirmed_at`

Notas:

- `status` acepta `preview`, `confirmed`, `cancelled` o `failed`.
- No debe ejecutar nada sin preview y confirmación.
- Debe tener RLS por `user_id`.
- `confirm_bot_action(action_id uuid)` valida usuario y estado y confirma transaccionalmente creación de producto, venta, gasto, reposición y ajuste de stock.
- Si una acción falla, sus escrituras operativas se revierten y el registro queda con `status = 'failed'`.

### `inventory_aliases`

Alias normalizados para conectar textos del usuario con items de inventario.

Columnas previstas:

- `id`
- `user_id`
- `inventory_item_id`
- `alias`
- `normalized_alias`
- `created_at`

Notas:

- La relación con `inventario_items` valida `(inventory_item_id, user_id)` para evitar referencias cruzadas entre usuarios.
- Debe tener RLS por `user_id`.
- Permite que futuras cargas reconozcan variantes de nombres sin inventar productos.

## Equipo y remuneraciones

El módulo Equipo separa el costo del trabajo de los retiros o distribuciones por propiedad.

### `team_members`

Columnas usadas:

- `id`
- `user_id`
- `nombre`
- `tipo`
- `rol`
- `horas_semanales`
- `remuneracion_objetivo`
- `cargas_pct`
- `comision_pct`
- `participacion_pct`
- `activo`
- `created_at`
- `updated_at`

Dónde se usa:

- Finanzas > Equipo: alta y activación/desactivación de integrantes.
- Cálculo del costo objetivo mensual: remuneración base, comisión configurada sobre ventas del mes y cargas estimadas.
- Cálculo de remuneración por trabajo pendiente para dueños.

Notas:

- `tipo` distingue `duenio`, `socio`, `empleado` y `colaborador`.
- La participación societaria no se interpreta como sueldo.
- Un trigger evita que la participación societaria total del usuario supere 100%.
- Debe tener RLS por `user_id`.

### `team_settings`

Columnas usadas:

- `user_id`
- `reserva_minima`
- `max_pago_duenio_pct`
- `created_at`
- `updated_at`

Dónde se usa:

- Finanzas > Equipo: configura una reserva de caja y el porcentaje máximo de caja disponible para una sugerencia de pago adicional al dueño.

Notas:

- La sugerencia nunca reemplaza obligaciones laborales ni contables.
- Debe tener RLS por `user_id`.

### `team_payments`

Columnas usadas:

- `id`
- `user_id`
- `team_member_id`
- `fecha`
- `monto`
- `tipo`
- `medio_pago`
- `notas`
- `movimiento_financiero_id`
- `created_at`

Dónde se usa:

- Finanzas > Equipo: historial mensual de pagos.
- `record_team_payment(...)`: crea el pago y su egreso financiero en una sola transacción.

Notas:

- Los pagos por trabajo se separan de `retiro_duenio` y `distribucion_utilidad`.
- Los retiros y distribuciones solo corresponden a dueños o socios.
- Debe tener RLS por `user_id`.

## RPC transaccionales

- `confirm_bot_action(uuid)`: confirma acciones críticas del Asesor IA sin dejar ventas o stock parciales.
- `confirm_import_batch(uuid)`: confirma batches de importación de manera atómica.
- `create_inventory_item(...)`: crea item, alias y stock inicial como una operación.
- `record_team_payment(...)`: crea pago de equipo y egreso financiero juntos.

## Vistas preparadas

### `v_finanzas_unificadas`

Vista de lectura para unir movimientos financieros legacy y nuevos.

Columnas:

- `id`
- `user_id`
- `fecha`
- `descripcion`
- `tipo`
- `monto`
- `categoria`
- `fuente`

Notas:

- Incluye `transacciones` con `fuente = 'legacy'`.
- Incluye `movimientos_financieros` con `fuente = 'importado'`.
- No modifica tablas viejas.
- Se crea como `security_invoker` para respetar RLS de las tablas base.

### `v_inventario_unificado`

Vista de lectura sobre `inventario_items`.

Notas:

- Expone `inventario_items` con `fuente = 'importado'`.
- No incluye todavía `productos` legacy porque el mapeo puede ser riesgoso y conviene resolverlo en una fase dedicada.
- Se crea como `security_invoker` para respetar RLS de la tabla base.

## Organización y calendario

### `organization_items`

Columnas usadas:

- `id`
- `user_id`
- `titulo`
- `tipo`
- `estado`
- `prioridad`
- `fecha`
- `responsable`
- `monto`
- `notas`
- `created_at`
- `updated_at`

Dónde se usa:

- Organización: calendario mensual de tareas, pedidos, entregas, vencimientos, cobros, pagos y recordatorios.
- Resumen de pendientes vencidos, próximos siete días y montos agendados.

Notas:

- Un cobro o pago agendado no modifica Finanzas. El movimiento financiero se registra recién cuando ocurre, para no duplicar caja prevista y caja real.
- `monto` es opcional a nivel de interfaz y se guarda como `0` cuando no corresponde.
- Debe tener RLS por `user_id`.
- La crea `supabase/migrations/007_organization_calendar.sql`.
