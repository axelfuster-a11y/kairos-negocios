# Kairós Negocios - handoff para continuar en Codex

## Contexto rápido

Proyecto: **Kairós Negocios**

Repositorio GitHub:

```text
https://github.com/axelfuster-a11y/kairos-negocios
```

Ruta local usada en Codex:

```text
C:\Users\estudio\Documents\Codex\2026-06-16\tengo-conectado-github\work\kairos-negocios-audit
```

Branch actual:

```text
main
```

Commit actual de `main` al momento de este handoff:

```text
d7133e47f5213c30769a2282f405a4e439291de2
```

Stack:

- App monolítica en `index.html`.
- HTML, CSS y JavaScript puro.
- Supabase Auth.
- Supabase Database.
- Supabase Edge Function `ai-advisor` para el asesor IA.
- Deploy en Vercel.

## Estado general

La app ya tiene una base funcional bastante avanzada:

- Login, registro y recuperación de contraseña.
- Onboarding inicial.
- Dashboard visual tipo centro de mando.
- Finanzas.
- Productos e inventario.
- Personas/equipo.
- Organización/calendario.
- Asesor IA operativo.
- Carga inteligente/manual/archivo.
- Historial de acciones del bot.
- Tablas nuevas para datos operativos.
- Migraciones SQL versionadas en `supabase/migrations`.

El último cambio grande fue una adaptación visual hacia una interfaz más clara, visual y parecida a un panel de gestión tipo videojuego/centro de mando. Se buscó que:

- Lo importante se vea primero.
- Lo secundario siga disponible pero con menor peso visual.
- La versión móvil y escritorio se diferencien mejor.
- El dashboard explique el estado del negocio sin depender sólo de tablas.

## Archivos principales

```text
index.html
SUPABASE_SCHEMA_NOTES.md
INTEGRATIONS_ROADMAP.md
supabase/README.md
supabase/migrations/001_import_base.sql
supabase/migrations/002_core_business_os.sql
supabase/migrations/003_confirm_bot_action_rpc.sql
supabase/migrations/004_team_compensation.sql
supabase/migrations/005_confirm_import_batch_rpc.sql
supabase/migrations/006_create_inventory_item_rpc.sql
supabase/migrations/007_organization_calendar.sql
```

## Tablas principales esperadas

Tablas legacy que no deben borrarse todavía:

- `productos`
- `transacciones`

Tablas nuevas ya usadas como base operativa:

- `movimientos_financieros`
- `inventario_items`
- `import_batches`
- `import_rows`
- `stock_movements`
- `ventas`
- `venta_items`
- `bot_actions`
- `inventory_aliases`
- `team_members`
- `team_payments`
- `organization_tasks`
- `organization_calendar`

Vistas relevantes:

- `v_finanzas_unificadas`
- `v_inventario_unificado`

RPCs importantes:

- `confirm_bot_action(action_id uuid)`
- `record_team_payment(...)`
- `confirm_import_batch(...)`
- `create_inventory_item(...)`

## IA actual

En `index.html`, el chat del Asesor IA llama a:

```js
sb.functions.invoke('ai-advisor', {
  body: { message: msg, history: aiH.slice(-18) }
})
```

Importante:

- El frontend no contiene una API key de IA.
- El frontend no muestra qué modelo exacto usa.
- El modelo exacto depende del código desplegado en la Supabase Edge Function `ai-advisor`.
- Si `ai-advisor` falla, la app usa una respuesta local de respaldo.

## Decisiones importantes ya tomadas

- No borrar tablas legacy.
- No mezclar datos viejos y nuevos sin rotular.
- Nada crítico se guarda sin preview y confirmación.
- No inventar datos críticos:
  - precio;
  - costo;
  - stock;
  - tipo ingreso/egreso;
  - cantidad.
- Si falta un dato crítico, marcar error o pedir aclaración.
- El Asesor IA debe ser el centro operativo diario.
- Carga inteligente queda para importaciones/manual/archivo.
- Productos importados se pueden editar con modal interno.
- Productos con ventas no se borran hard.
- Productos sin ventas pueden eliminarse junto con alias y movimientos de stock.
- Las acciones críticas del bot deben ir por RPC transaccional para evitar datos parciales.

## Restricciones históricas del proyecto

No tocar todavía salvo pedido explícito:

- WhatsApp.
- Mercado Libre.
- Shopify.
- Tienda Nube.
- Automatizaciones externas.
- Combos.

No hacer sin autorización:

- Borrar tablas legacy.
- Reescribir toda la app desde cero.
- Pushear directo a `main` si se está trabajando en una fase con PR.
- Mergear PRs sin aprobación del usuario, salvo que el usuario lo pida explícitamente.

## Estado visual actual

El diseño actual busca combinar:

- Fondo oscuro.
- Dorado Kairós.
- Paneles tipo consola.
- Dashboard más visual.
- Barras de estado.
- Priorización de alertas.
- Botones principales grandes.
- Datos secundarios más discretos.

Referencia conceptual del usuario:

- Interfaz tipo videojuego/gestión.
- Fácil de entender para alguien que no sabe Excel.
- Que cada pantalla explique qué se puede hacer.
- Que las métricas importantes tengan ayuda o explicación.

## Cosas que conviene revisar/mejorar después

### 1. IA / Asesor

- Confirmar qué modelo usa realmente la Edge Function `ai-advisor`.
- Revisar si la función está versionada en el repo; actualmente no aparece el código de `ai-advisor` en el repo local.
- Mejorar respuestas para que nunca diga que hizo algo si no ejecutó una acción real.
- Mantener acciones operativas con preview + confirmación.

### 2. Dashboard

- Seguir afinando conceptos:
  - ingresos del mes;
  - egresos del mes;
  - ganancia;
  - margen;
  - cobertura de gastos fijos;
  - caja estimada.
- Evitar decir "caja disponible" si no se lee saldo real de banco/MP.
- Agregar tooltips claros en métricas importantes.

### 3. Finanzas

- Consolidar ingresos, egresos, gastos fijos, pagos de equipo, ventas y movimientos.
- Mejorar filtros por mes/calendario.
- Mostrar resumen anual.
- Separar mejor:
  - dinero que entró;
  - dinero que salió;
  - gastos fijos;
  - gastos variables;
  - pagos de equipo;
  - retiros del dueño.

### 4. Productos

- Mejorar vista de bajo stock.
- Al tocar una alerta como "productos con poco stock", navegar a inventario y resaltar esos productos.
- Agregar costo de reposición.
- Mejorar proveedor, estado de pedido y compra recomendada.

### 5. Personas / Equipo

- Terminar edición real de integrantes si algo quedó sólo visual.
- Calcular sueldos/retiros sugeridos según ganancia del negocio.
- Separar:
  - dueño;
  - socios;
  - empleados;
  - colaboradores.
- Registrar pagos y que impacten en finanzas.

### 6. Organización

- Hacer accionables las tarjetas.
- Calendario con fechas.
- Tareas, vencimientos, cobros, pagos, responsables.

### 7. Integraciones futuras

La idea del usuario a futuro:

- Conectar Shopify.
- Conectar Mercado Libre.
- Conectar Tienda Nube.
- Conectar Mercado Pago.
- Conectar WhatsApp Business/Catálogo.
- Usar productos cargados en Kairós para publicar/adaptar precios por canal.
- Calcular comisiones por canal.
- Recibir transacciones y conciliarlas.
- Bot conectado a WhatsApp para cargar o publicar productos desde chat.

Esto requiere hacerlo con integraciones oficiales/OAuth y backend seguro. No guardar tokens en frontend.

## Validaciones útiles antes de entregar cambios

Ejecutar:

```powershell
git status --short
git diff --check
```

Para validar JS dentro de `index.html`, extraer scripts o usar el método que ya se venía usando en el repo. Como mínimo, abrir la app local y revisar consola.

Servidor local habitual:

```powershell
npx vite --host 127.0.0.1
```

URL usada por el usuario:

```text
http://127.0.0.1:4173/
```

## Cómo continuar en otro chat

Prompt recomendado:

```text
Continuá el proyecto Kairós Negocios.

Repo local:
C:\Users\estudio\Documents\Codex\2026-06-16\tengo-conectado-github\work\kairos-negocios-audit

Branch base:
main

Commit base:
d7133e47f5213c30769a2282f405a4e439291de2

Leé primero CODEX_HANDOFF.md, revisá git status y no modifiques nada hasta entender el estado.

Objetivo actual:
[escribir acá el próximo objetivo]

Restricciones:
- No tocar WhatsApp/ML/Shopify/Tienda Nube salvo pedido explícito.
- No borrar tablas legacy.
- No reescribir toda la app sin necesidad.
- Mantener preview + confirmación para acciones críticas.
- No inventar datos críticos.
```

