# Supabase

Esta carpeta contiene la base SQL de Kairós para importaciones y para el núcleo operativo del negocio.

El frontend actual organiza la navegacion principal en cinco modulos: `Inicio`, `Productos`, `Ventas`, `Finanzas` y `Equipo`.

Supabase sigue siendo la base de datos de la app. Las migraciones existentes no deben editarse si ya fueron aplicadas; cualquier hardening futuro debe agregarse en una migracion nueva.

Las funciones de importacion viven visualmente dentro de `Mas herramientas > Importaciones` y tambien alimentan los resumenes de `Inicio`, `Productos`, `Ventas` y `Finanzas`. Las tablas legacy siguen existiendo y no se eliminan.

### `migrations/013_multichannel_catalog.sql`

Agrega la base transaccional para sincronizar catÃ¡logos de Shopify, Tiendanube y Meta:

- imagen principal y galerÃ­a por producto, mÃ¡s el bucket `product-images` para cargas manuales;
- conexiones y vÃ­nculos entre cada variante externa y el inventario de KairÃ³s;
- importaciÃ³n idempotente con movimientos de stock;
- cola durable para propagar ventas y cambios locales a todos los canales conectados;
- vista `v_catalog_products` lista para mostrar imagen, stock y canales en el mostrador.

Los tokens se guardan separados de las tablas visibles y las llamadas externas deben ejecutarse desde Edge Functions. El frontend nunca recibe ni lee esos tokens.

### `migrations/015_catalog_oauth.sql`

Unifica la conexión oficial de Shopify, Mercado Libre y Tiendanube:

- OAuth por usuario con `state` de un solo uso y vencimiento corto;
- PKCE y renovación automática de tokens para Mercado Libre;
- verificación HMAC para Shopify;
- tokens cifrados con AES-GCM y sin acceso desde el navegador;
- importación paginada de productos y variantes;
- relación explícita de la foto propia de cada variante;
- cola de actualización de stock para los tres proveedores.

Antes de desplegar, registre la misma URL de callback en las tres aplicaciones:

```text
https://SU-PROYECTO.supabase.co/functions/v1/catalog-oauth-callback
```

Configure las variables indicadas en `supabase/functions/.env.example` como
Supabase Edge Function Secrets. No copie valores reales al repositorio.

Despliegue las funciones:

```bash
supabase functions deploy catalog-oauth-start
supabase functions deploy catalog-oauth-callback --no-verify-jwt
supabase functions deploy catalog-sync
```

La sincronización importa únicamente imágenes vinculadas a la variante:

- Shopify: `ProductVariant.media`;
- Mercado Libre: `variation.picture_ids`;
- Tiendanube: `variant.image_id`.

Si una variante externa no tiene foto propia, Kairós la importa sin inventar
una imagen, muestra la advertencia y permite cargar sus fotos desde Productos.

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

Las tablas de `001_import_base.sql` son usadas por importaciones y carga asistida, pero no reemplazan todavía a:

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
- Agrega una constraint única `(id, user_id)` en `inventario_items` para validar relaciones compuestas.
- Las relaciones desde `stock_movements`, `venta_items` e `inventory_aliases` hacia inventario usan `(inventory_item_id, user_id)` para evitar referencias cruzadas entre usuarios.
- Crea `v_finanzas_unificadas`, que une `transacciones` legacy con `movimientos_financieros`.
- Crea `v_inventario_unificado`, que expone `inventario_items` con `fuente = 'importado'`.
- Crea una versión inicial segura de `confirm_bot_action(action_id uuid)`, reemplazada por la implementación transaccional de la migración `003`.

### `migrations/003_confirm_bot_action_rpc.sql`

Convierte la confirmación del Asesor IA en una operación transaccional dentro de PostgreSQL.

- Confirma `crear_producto`, `venta_stock`, `gasto`, `reposicion` y `ajuste_stock`.
- Valida `auth.uid()`, propiedad de la acción, estado `preview`, stock fresco y duplicados.
- Crea ventas, items, movimientos financieros y movimientos de stock como una sola operación.
- Marca `bot_actions` como `confirmed` o `failed` y devuelve `result_data`.
- Una reposición sin costo informado actualiza stock, pero no inventa un egreso de valor cero.

### `migrations/004_team_compensation.sql`

Agrega el módulo Equipo y remuneraciones:

- `team_members`: dueños, socios, empleados y colaboradores, con rol, dedicación, remuneración objetivo y comisión opcional.
- `team_settings`: reserva mínima y límite prudente para sugerir pagos adicionales al dueño.
- `team_payments`: historial de sueldos, honorarios, bonos, comisiones, retiros y distribuciones.
- `record_team_payment(...)`: registra de forma atómica el pago y su egreso en `movimientos_financieros`.

El modelo separa tres conceptos:

- remuneración por trabajar;
- costo del personal;
- retiro o distribución por ser propietario.

Los retiros y distribuciones solo pueden asignarse a integrantes de tipo `duenio` o `socio`.
La interfaz estima la comisión configurada usando las ventas confirmadas del mes y la muestra dentro del costo objetivo, no como retiro de utilidades.

### `migrations/005_confirm_import_batch_rpc.sql`

Confirma una carga preparada por `Carga inteligente` dentro de una transacción.

- Valida propiedad, estado del batch y filas válidas.
- Inserta movimientos o inventario, alias y stock inicial.
- Bloquea productos duplicados por nombre normalizado.
- Si una fila falla, revierte la carga y marca el batch como `failed`.

### `migrations/006_create_inventory_item_rpc.sql`

Crea manualmente un producto, su alias y su movimiento de stock inicial como una sola operación.

- Valida valores no negativos.
- Evita duplicados exactos normalizados.
- Calcula costo, ganancias, márgenes, estado y acción recomendada.

## Cómo aplicar en Supabase SQL Editor

1. Abrir el proyecto de Supabase.
2. Entrar a SQL Editor.
3. Crear una nueva query.
4. Ejecutar las migraciones en orden: `001`, `002`, `003`, `004`, `005`, `006` y `007`.
5. Verificar que las tablas existan en el schema `public`.
6. Confirmar que RLS esté activado y que las policies por `user_id` estén creadas.
7. Verificar las RPC: `confirm_bot_action`, `record_team_payment`, `confirm_import_batch` y `create_inventory_item`.

## Pruebas SQL recomendadas para `002_core_business_os.sql`

- Confirmar existencia de tablas: `stock_movements`, `ventas`, `venta_items`, `bot_actions`, `inventory_aliases`.
- Confirmar existencia de vistas: `v_finanzas_unificadas`, `v_inventario_unificado`.
- Confirmar existencia de función: `confirm_bot_action(uuid)`.
- Revisar que RLS esté activado en las cinco tablas nuevas.
- Revisar que las policies por `auth.uid() = user_id` existan.
- Revisar que exista `inventario_items_id_user_id_unique`.
- Intentar crear una fila hija con `inventory_item_id` de otro usuario debe fallar por FK compuesta.
- Consultar `v_finanzas_unificadas` con un usuario autenticado y validar que respete RLS por las tablas base.
- Crear una fila `bot_actions` en estado `preview` y validar cada acción soportada con datos de prueba.
- Confirmar que una acción fallida no deje ventas, movimientos o cambios de stock parciales.
- Registrar un pago de equipo y verificar que se creen juntos `team_payments` y `movimientos_financieros`.
- Confirmar una importación con una fila inválida y verificar que el batch quede `failed` sin datos parciales.

## Pendientes deliberados

- `v_inventario_unificado` todavía no une `productos` legacy porque el schema legacy tiene una forma distinta y conviene mapearlo con cuidado.
- Las tablas legacy `productos` y `transacciones` siguen disponibles y no se eliminan.
- El frontend unifica su lectura financiera, pero no intenta deduplicar automáticamente registros históricos iguales porque dos movimientos legítimos pueden compartir fecha, descripción y monto.
- Las recomendaciones de remuneración son orientativas; no reemplazan una liquidación laboral, societaria o impositiva.

### `migrations/007_organization_calendar.sql`

Activa Organización con una agenda propia:

- `organization_items`: tareas, pedidos, entregas, vencimientos, cobros, pagos y recordatorios con fecha, prioridad, responsable y estado.
- RLS y cuatro policies por `user_id`.
- Índices por usuario, fecha, estado y tipo.

Los montos agendados son informativos. No crean ingresos ni egresos automáticamente porque “previsto” y “pagado/cobrado” son conceptos distintos.
