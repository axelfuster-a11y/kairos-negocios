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
