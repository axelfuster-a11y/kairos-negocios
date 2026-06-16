# Supabase

Esta carpeta contiene la base SQL preparada para futuras importaciones de Excel o texto en Kairós.

El frontend actual todavía no usa estas tablas. La app sigue leyendo y escribiendo en las tablas existentes documentadas en `SUPABASE_SCHEMA_NOTES.md`.

## Migraciones

### `migrations/001_import_base.sql`

Crea cuatro tablas nuevas para soportar un flujo futuro de importación con preview, confirmación y auditoría:

- `movimientos_financieros`: movimientos normalizados de ingresos y egresos. Está pensada como destino futuro para datos financieros importados.
- `inventario_items`: inventario normalizado con stock, costos, precios, margen y recomendación. Está pensada como destino futuro para productos o stock importado.
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

Estas tablas son infraestructura preparada para Fase 1. No reemplazan todavía a:

- `transacciones`
- `productos`
- `gastos_fijos`
- otras tablas usadas por el frontend actual

La conexión del frontend se mantiene sin cambios hasta implementar el módulo de importación.
