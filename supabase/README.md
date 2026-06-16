# Supabase

Esta carpeta contiene la base SQL de Kairós para importaciones y para el núcleo operativo del negocio.

El frontend actual ya usa las tablas de importación desde el módulo `Carga inteligente`. Las tablas legacy siguen existiendo y no se eliminan.

## Migraciones

### `migrations/001_import_base.sql`

Crea cuatro tablas nuevas para soportar un flujo futuro de importación con preview, confirmación y auditoría:

- `movimientos_financieros`: movimientos normalizados de ingresos y egresos. Está pensada como destino futuro para datos financieros importados.
- `inventario_items`: inventario normalizado con stock, costos, precios, margen y recomendación. Está pensada como destino futuro para productos o stock importado. Las ganancias y márgenes pueden ser negativos para detectar productos con pérdida.
- `import_batches`: cabecera de cada importación, con origen, destino, estado y conteos.
- `import_rows`: detalle fila por fila de cada importación, con datos crudos, datos normalizados, errores y estado.

La migración también:

- Activa RLS en las cuatro tablas.
- Crea policies `select`, `insert`, `update` y `delete` por `user_id`.
- Agrega índices por `user_id` y campos de consulta frecuentes.
- Agrega un trigger para mantener `inventario_items.updated_at`.

## Cómo aplicar en Supabase SQL Editor

1. Abrir el proyecto de Supabase.
2. Entrar a SQL Editor.
3. Crear una nueva query.
4. Copiar el contenido de `supabase/migrations/001_import_base.sql`.
5. Ejecutar la query.
6. Verificar que las cuatro tablas existan en el schema `public`.
7. Confirmar que RLS esté activado y que las policies por `user_id` estén creadas.

## Estado actual

Las tablas de `001_import_base.sql` son usadas por `Carga inteligente`, pero no reemplazan todavía a:

- `transacciones`
- `productos`
- `gastos_fijos`
- otras tablas usadas por secciones legacy del frontend

### `migrations/002_core_business_os.sql`

Crea la base mínima para que ventas, inventario, movimientos de stock y acciones del bot puedan comunicarse entre sí en fases posteriores:

- `stock_movements`: historial de entradas, salidas, ajustes, ventas, compras y devoluciones de stock.
- `ventas`: cabecera de ventas confirmadas con totales, costos, ganancia y margen.
- `venta_items`: detalle de productos o textos vendidos dentro de cada venta.
- `bot_actions`: historial/auditoría de acciones propuestas por el bot antes de ejecutarlas.
- `inventory_aliases`: alias normalizados para vincular textos de usuario con items de inventario.

La migración también:

- Activa RLS en las cinco tablas nuevas.
- Crea policies `select`, `insert`, `update` y `delete` por `user_id`.
- Agrega índices por `user_id`, fechas, estado, `inventory_item_id`, `venta_id` y `normalized_alias`.
- Crea `v_finanzas_unificadas`, que une `transacciones` legacy con `movimientos_financieros`.
- Crea `v_inventario_unificado`, que expone `inventario_items` con `fuente = 'importado'`.
- Crea `confirm_bot_action(action_id uuid)` como placeholder seguro: valida usuario y estado, pero todavía no ejecuta acciones.

## Cómo aplicar en Supabase SQL Editor

1. Abrir el proyecto de Supabase.
2. Entrar a SQL Editor.
3. Crear una nueva query.
4. Ejecutar primero `001_import_base.sql` si todavía no fue aplicado.
5. Ejecutar después `002_core_business_os.sql`.
6. Verificar que las tablas existan en el schema `public`.
7. Confirmar que RLS esté activado y que las policies por `user_id` estén creadas.

## Pruebas SQL recomendadas para `002_core_business_os.sql`

- Confirmar existencia de tablas: `stock_movements`, `ventas`, `venta_items`, `bot_actions`, `inventory_aliases`.
- Confirmar existencia de vistas: `v_finanzas_unificadas`, `v_inventario_unificado`.
- Confirmar existencia de función: `confirm_bot_action(uuid)`.
- Revisar que RLS esté activado en las cinco tablas nuevas.
- Revisar que las policies por `auth.uid() = user_id` existan.
- Consultar `v_finanzas_unificadas` con un usuario autenticado y validar que respete RLS por las tablas base.
- Crear una fila `bot_actions` en estado `preview` y llamar `confirm_bot_action(id)` para validar que devuelve error controlado `not_implemented`.

## Pendientes deliberados

- `v_inventario_unificado` todavía no une `productos` legacy porque el schema legacy tiene una forma distinta y conviene mapearlo con cuidado.
- `confirm_bot_action` todavía no ejecuta ventas, movimientos de stock ni cambios de inventario.
- El frontend todavía no usa las tablas `ventas`, `venta_items`, `stock_movements`, `bot_actions` ni `inventory_aliases`.
