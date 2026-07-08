# Auditoria arquitectonica de Kairos

Fecha: 2026-06-28
Rama auditada: `refactor-simple-professional-ui`
Commit base: `66e6fb3 Simplify navigation into four core modules`
Alcance: analisis y reporte. No se modifico codigo funcional, migraciones, Supabase, diseno ni ramas.

Nota de estado posterior: se inicio una fase segura de preparacion sin cambios de comportamiento visible. Esta fase sincroniza documentacion, elimina el `package-lock.json` accidental cuando no hay `package.json`, agrega checks estaticos sin dependencias npm y extrae helpers puros de bajo riesgo. No cambia Supabase ni migraciones.

Nota de estado de service: se agrego `assets/js/services/financeService.js` como primer service incremental. Centraliza lectura financiera unificada, resumen de ventas, caches, totales, normalizacion y operaciones manuales simples. Importaciones, IA, inventario y pagos de equipo quedan fuera de este service por ahora.

## 1. Resumen ejecutivo

Kairos quedo mejor orientado despues del commit `66e6fb3`: la navegacion principal ya se entiende como cuatro modulos visibles (`Inicio`, `Dinero`, `Productos`, `Gestion`), el `Asesor IA` paso a boton flotante y las herramientas secundarias quedaron fuera del camino principal.

El problema principal no es la navegacion. El problema actual es que la aplicacion sigue siendo una app estatica con arquitectura monolitica: `assets/app.js` concentra datos, UI, reglas financieras, reglas de productos, importaciones, acciones del asesor, estado global y llamadas directas a Supabase.

Los riesgos mas importantes son de consistencia financiera y mantenibilidad: hay tablas legacy y nuevas conviviendo, escrituras directas desde el frontend, varias rutas para registrar dinero/productos, documentacion con nombres anteriores y migraciones que permiten algunos datos validos tecnicamente pero riesgosos para negocio, como movimientos de monto `0`.

No detecte un bloqueo critico confirmado en el analisis local. `git diff --check` y `node --check assets/app.js` no reportaron errores. Tampoco se detectaron IDs duplicados en `index.html`.

La rama base real para seguir el refactor visual y modular deberia ser `refactor-simple-professional-ui`. `main` queda como base estable y destino de integracion por PR.

## 2. Estado general del proyecto

Comandos iniciales ejecutados:

- `git status --short`: habia un archivo sin trackear previo, `package-lock.json`.
- `git branch -vv`: rama actual `refactor-simple-professional-ui`; `main` en `d7133e4`.
- `git log --oneline --decorate --graph --all --max-count=40`: `refactor-simple-professional-ui` esta un commit por delante de `main`.
- `git diff --check`: sin salida, sin problemas de whitespace.

Comprobaciones adicionales:

- `node --check assets/app.js`: sin errores de sintaxis.
- IDs HTML: 372 IDs, 0 duplicados.
- Referencias `getElementById`: 179 referencias; 1 referencia estatica no encontrada, `ai-bot-action-preview`, que se crea dinamicamente.
- Funciones JS declaradas: 214.
- Llamadas directas `sb.from(...)`: 66.
- Asignaciones `innerHTML`: 47.
- RPC usadas desde frontend: `record_team_payment`, `create_inventory_item`, `confirm_import_batch`, `confirm_bot_action`.

Estado de arquitectura:

- Frontend estatico online: `index.html`, `assets/app.js`, `assets/styles.css`.
- Sin bundler, sin `package.json`, sin suite de tests versionada.
- Supabase usado directamente desde el browser.
- Migraciones SQL versionadas de `001` a `007`.
- Edge Function `ai-advisor` referenciada desde frontend, pero su codigo no esta versionado en este repo.

Mapa de riesgos:

| Severidad | Tipo | Riesgo | Observacion |
| --- | --- | --- | --- |
| Critico | General | No se detecto un riesgo critico confirmado localmente | Falta prueba contra Supabase real para cerrar esta conclusion. |
| Alto | Financiero | Varias rutas escriben dinero o stock | `movimientos_financieros`, `ventas`, `team_payments`, `stock_movements` pueden desincronizarse si se escriben fuera de RPC. |
| Alto | Tecnico | `assets/app.js` concentra demasiadas responsabilidades | Dificulta cambios simples sin romper flujos legacy. |
| Alto | Seguridad/producto | `ai-advisor` no esta versionada en repo | No se puede auditar modelo, autorizacion, rate limiting ni manejo de prompts desde este codigo. |
| Alto | Datos | Monto `0` permitido en movimientos confirmados | Puede contaminar metricas y alertas si entra como dato real. |
| Medio | UX | Algunas vistas avanzadas siguen pareciendo panel tecnico | Especialmente importaciones, historial tecnico y metricas avanzadas. |
| Medio | Escalabilidad | CSS y HTML siguen acoplados por IDs y selectores especificos | Cambios visuales pueden romper layouts no relacionados. |
| Medio | Documentacion | Nombres viejos conviven con la nueva navegacion | `Finanzas`, `Organizacion`, `Carga inteligente` aparecen en docs y UI interna. |
| Bajo | Repo | `package-lock.json` sin trackear y sin `package.json` | Parece artefacto accidental; no tocar hasta confirmarlo. |

## 3. Que mejoro con el commit 66e6fb3

- Se redujo la navegacion visible a cuatro modulos: `Inicio`, `Dinero`, `Productos`, `Gestion`.
- Desktop y mobile usan los mismos nombres principales.
- `Asesor IA` ya no compite como modulo principal; queda flotante y accesible.
- `Mas herramientas` ordena funciones secundarias: publicidad, contenido, metricas avanzadas, importaciones, mi negocio, configuracion, documentos, historial tecnico e integraciones futuras.
- Se separo el monolito visual en `index.html`, `assets/app.js` y `assets/styles.css`.
- Las tablas y formularios mas complejos quedaron mayormente detras de botones de detalle.
- Hay explicaciones con `!` en muchos indicadores, lo que ayuda a usuarios no tecnicos.

## 4. Que empeoro o quedo mas complejo

- La separacion en archivos mejoro el orden fisico, pero no creo todavia una arquitectura modular: `assets/app.js` sigue siendo una unica unidad logica.
- La UI principal se simplifico, pero las vistas legacy siguen cargadas dentro del mismo HTML.
- `Mas herramientas` contiene entradas reales y entradas placeholder mezcladas; para el usuario pueden parecer funciones incompletas.
- La documentacion quedo parcialmente desalineada con la navegacion nueva.
- El cambio de nombres visibles no cambio nombres internos, lo cual es correcto para no romper funciones, pero aumenta la necesidad de alias claros.
- El CSS conserva clases de layouts anteriores y reglas muy especificas.

## 5. Ramas recomendadas para conservar o revisar

Git no marca las ramas antiguas como mergeadas por ancestro. Por los nombres de commits y el historial, varias parecen haber entrado por squash, PR o reimplementacion. No conviene borrarlas sin revisar PRs en GitHub.

| Rama | Estado probable | Recomendacion |
| --- | --- | --- |
| `refactor-simple-professional-ui` | Rama actual, 1 commit delante de `main` | Conservar. Base real para continuar el refactor UI/modular. |
| `main` | Base estable remota/local | Conservar. Debe ser destino de integracion. |
| `stabilize-finance-team` | Rama historica con migraciones 003-007, equipo, organizacion e integraciones | Revisar antes de borrar. Parece valiosa como contexto aunque el contenido ya esta mayormente en la rama actual. |
| `game-ui-command-center` | Probable rama de UI integrada por squash en `main` | Revisar PR asociado y borrar mas adelante si no hay cambios unicos. |
| `qa-fixes-after-exhaustive-test` | Probables fixes de QA integrados por squash | Revisar antes de borrar. Importante por fallback del asesor y estabilidad. |
| `aggressive-4-rpc-transacciones` | RPC de confirmacion de bot | Revisar antes de borrar; valor historico alto por decisiones de consistencia. |
| `aggressive-3-bot-actions` | Flujo de acciones del bot e inventario | Revisar si tiene algun fix no migrado. Luego candidata a borrar. |
| `aggressive-1-core-schema` | Schema base ya superado | Candidata a borrar luego de verificar PR/squash. |
| `aggressive-2-dashboard-unificado` | Dashboard importado ya superado | Candidata a borrar luego de verificar PR/squash. |
| `aggressive-3-5-stabilizacion` | Patch equivalente o superado | Candidata fuerte a borrar despues de verificar. |
| `fase-0-estabilizar-kairos` | Fase historica de estabilizacion | Candidata a borrar luego de archivar contexto. |
| `fase-1-sql-import-base` | Fase historica de importaciones SQL | Candidata a borrar luego de verificar que 001 esta en `main`. |
| `fase-2-carga-inteligente-mvp` | Fase historica de carga inteligente | Candidata a borrar luego de confirmar integracion. |

Base recomendada para seguir:

- Para UI, arquitectura frontend y textos: `refactor-simple-professional-ui`.
- Para comparar estabilidad productiva: `main`.
- Para revisar decisiones antiguas antes de borrar ramas: `stabilize-finance-team`, `qa-fixes-after-exhaustive-test`, `aggressive-4-rpc-transacciones`.

## 6. Archivos principales y responsabilidad actual

| Archivo | Responsabilidad actual | Observacion |
| --- | --- | --- |
| `index.html` | Shell completo de la app, paginas, modales, navegacion, formularios e inline handlers | Sigue siendo grande y acoplado a funciones globales. |
| `assets/app.js` | Estado global, autenticacion, renderizado, reglas de negocio, Supabase, importaciones, IA y helpers | Es el principal candidato a modularizacion. |
| `assets/styles.css` | Tema, componentes, responsive, mobile nav y reglas especificas por pagina | Necesita limpieza despues de screenshots. |
| `CODEX_HANDOFF.md` | Handoff operativo | Desactualizado: menciona rama `main`, arquitectura monolitica y tablas `organization_tasks`/`organization_calendar`. |
| `SUPABASE_SCHEMA_NOTES.md` | Documentacion de schema y uso frontend | Bastante completa, pero mantiene nombres anteriores y algunos terminos legacy. |
| `INTEGRATIONS_ROADMAP.md` | Lineamientos de integraciones futuras | Correcto como roadmap; no es codigo activo. |
| `supabase/README.md` | Guia de migraciones | Util, pero usa nombres anteriores como `Carga inteligente` y `Finanzas`. |
| `supabase/migrations/001_import_base.sql` | Movimientos financieros, inventario, import batches/rows | Base todavia necesaria. Permite montos `0`. |
| `supabase/migrations/002_core_business_os.sql` | Ventas, stock movements, bot actions, alias y vistas | Crea stub de `confirm_bot_action`, reemplazado por 003. |
| `supabase/migrations/003_confirm_bot_action_rpc.sql` | Confirmacion segura de acciones del asesor | Central para ventas, gastos, reposicion y ajustes de stock. |
| `supabase/migrations/004_team_compensation.sql` | Equipo, configuracion y pagos | RPC buena, pero tabla permite escrituras directas por RLS. |
| `supabase/migrations/005_confirm_import_batch_rpc.sql` | Confirmacion transaccional de importaciones | Necesita endurecer monto `0` y duplicados. |
| `supabase/migrations/006_create_inventory_item_rpc.sql` | Alta manual segura de inventario | Duplica reglas de producto con import/bot. |
| `supabase/migrations/007_organization_calendar.sql` | Agenda operativa en `organization_items` | Correcta para Gestion; monto `0` parece razonable por ser opcional. |

## 7. Codigo muerto o sospechoso

No encontre IDs duplicados.

Elementos sospechosos o a revisar:

- `package-lock.json` esta sin trackear, mide 100 bytes, no hay `package.json`. Parece artefacto accidental.
- `CODEX_HANDOFF.md` dice que el proyecto sigue en `main` y menciona app monolitica, aunque el commit actual ya separo assets.
- `CODEX_HANDOFF.md` menciona `organization_tasks` y `organization_calendar`, pero la migracion real usa `organization_items`.
- `page-neg`, `page-import`, `page-pub`, `page-cont`, `page-met` no estan muertos: siguen accesibles desde `Mas herramientas`.
- `page-leads` y `page-org` no estan muertos: son detalles de `Gestion`.
- `legacy-prod-card` no esta muerto: aparece solo si existen productos legacy en `productos`.
- `ai-bot-action-preview` no existe en HTML inicial, pero se crea dinamicamente en JS; no es bug confirmado.
- `Documentos` e `Integraciones futuras` aparecen como herramientas secundarias pero solo muestran toast. Son placeholders de producto, no codigo muerto.

CSS posiblemente no usado segun escaneo estatico:

- `action-panel`
- `ai-nav-btn`
- `coming-list`
- `coming-row`
- `command-lower`
- `dashboard-actions`
- `dashboard-link`
- `dashboard-secondary`
- `g3`
- `guided-answer`
- `guided-card`
- `guided-grid`
- `guided-link`
- `guided-number`
- `guided-question`
- `mission-panel`
- `resource-answer`
- `resource-card`
- `resource-code`
- `resource-grid`
- `resource-link`
- `resource-number`
- `resource-question`
- `resource-top`

No conviene borrarlas sin una pasada visual desktop/mobile, porque algunas clases podrian ser restos de pantallas recientes o strings dinamicos.

## 8. Funciones duplicadas o demasiado grandes

Funciones mas grandes detectadas en `assets/app.js`:

| Funcion | Lineas aprox. | Riesgo |
| --- | ---: | --- |
| `renderDash` | 149 | Mezcla datos, calculos, textos, estado visual y misiones. |
| `calcCosto` | 87 | Calcula costos y margen desde DOM; deberia separarse en calculo puro + UI. |
| `normalizeInventoryRow` | 80 | Parser de importacion con reglas de producto mezcladas. |
| `renderTeamData` | 68 | Render, calculo de pagos y estado de equipo juntos. |
| `sendAI` | 59 | UI de chat, llamada Edge Function, fallback y estado en una funcion. |
| `buildBotActionPreview` | 57 | Reglas de acciones IA mezcladas con presentacion. |
| `confirmImport` | 53 | Crea batch, rows, llama RPC y actualiza UI. |
| `renderAnnualSummary` | 52 | Calculo anual y render en una funcion. |
| `parseBotCommand` | 52 | Parser manual de lenguaje natural. |
| `renderImportedInventory` | 51 | Filtros, tabla, ventas asociadas y acciones. |
| `confirmBotAction` | 50 | Persistencia, RPC, UI y navegacion post-confirmacion. |
| `renderOrganization` | 47 | Estado, filtros, cards y calculos de vencimiento. |
| `handleSupaError` | 45 | Mapeo de errores amplio; util, pero podria ir a `core/errors`. |
| `renderFin` | 45 | Datos, calculo y render financiero. |

Duplicaciones conceptuales:

- Finanzas: `loadUnifiedFinances`, `renderFin`, `renderDash`, `renderMet`, `renderAnnualSummary` y datos importados recalculan o re-presentan ingresos, egresos, balance y margen.
- Productos: alta manual, importacion, bot y edicion recalculan costo total, ganancia, margen y estado de stock.
- Supabase: 66 llamadas directas a tablas desde UI. Deberian agruparse en services.
- Validaciones: monto negativo, stock negativo, producto duplicado y campos requeridos aparecen en varias rutas.
- UI: muchas plantillas `innerHTML` repiten tablas, badges, empty states y botones.

Extraccion recomendada cuando se refactorice:

- `core/format`: `fmt`, `money`, fechas, porcentajes.
- `core/dom`: `S`, `V`, `escapeHTML`, helpers de estado, toast.
- `core/errors`: `handleSupaError`, deteccion de schema faltante.
- `services/finance`: transacciones legacy + movimientos nuevos + ventas + gastos fijos.
- `services/inventory`: inventario, alias, stock movements, duplicados.
- `services/team`: miembros, settings, pagos.
- `services/organization`: `organization_items`.
- `services/imports`: batches, rows, confirmacion.
- `services/advisor`: Edge Function, fallback, previews.
- `ui/navigation`: `go`, tabs, advanced panels, more tools.
- `ui/modules/*`: render de Inicio, Dinero, Productos, Gestion y herramientas secundarias.

## 9. Problemas de Supabase y migraciones

Hallazgos principales:

- `001_import_base.sql`: `movimientos_financieros.monto` permite `0`. Esto puede servir para datos incompletos, pero no deberia permitirse en movimientos confirmados reales.
- `002_core_business_os.sql`: `ventas.total` permite `0` y `venta_items.precio_unitario` permite `0`. Puede ser valido para muestras o bonificaciones, pero necesita una regla explicita.
- `002_core_business_os.sql`: `stock_movements.cantidad <> 0` permite negativos para varios tipos. Es flexible, pero no impide combinaciones raras como `tipo = compra` con cantidad negativa si alguien escribe directo.
- `002_core_business_os.sql`: `confirm_bot_action` se define como stub y `003` lo reemplaza. No rompe si se aplican en orden, pero conviene documentarlo.
- `002_core_business_os.sql`: `inventory_aliases` no tiene unique real sobre `(user_id, normalized_alias)`. Hay indice, no constraint.
- `002_core_business_os.sql`: las vistas `v_finanzas_unificadas` y `v_inventario_unificado` etiquetan datos nuevos como `importado`, aunque pueden venir de manual, bot o equipo.
- `003_confirm_bot_action_rpc.sql`: esta bien orientada a transacciones, usa locks y valida stock antes de confirmar ventas. Es una pieza que conviene conservar.
- `003_confirm_bot_action_rpc.sql`: reposicion sin costo registra stock pero no egreso. Es correcto si el costo es desconocido, pero debe explicarse en UX.
- `004_team_compensation.sql`: `record_team_payment` crea movimiento financiero + pago de equipo. Bien. El problema es que `team_payments` tambien permite insert/update/delete directo por RLS, lo que puede desincronizar pagos y movimientos.
- `005_confirm_import_batch_rpc.sql`: valida monto `< 0`, por lo tanto permite `0`. Deberia diferenciar borrador/importacion dudosa de movimiento confirmado.
- `005_confirm_import_batch_rpc.sql`: detecta duplicados de producto por nombre normalizado. Puede bloquear variantes reales o no cubrir combinaciones producto/color/medida segun origen.
- `006_create_inventory_item_rpc.sql`: duplica reglas de producto con `003` y `005`. Conviene consolidar el calculo de costo/margen/stock en una funcion SQL compartida o servicio unico.
- `007_organization_calendar.sql`: `monto >= 0` parece razonable porque el monto es opcional para tareas/vencimientos.

Tablas legacy necesarias todavia:

- `transacciones`: se sigue leyendo para finanzas historicas.
- `productos`: se sigue mostrando como catalogo legacy si existen registros.
- `negocios`, `leads`, `gastos_fijos`, `campanas`, `contenido`, `referentes`, `angulos`, `configuracion_costos`: siguen usadas desde frontend.

Migraciones que no conviene tocar todavia:

- No modificar 001-007 directamente si ya fueron aplicadas en Supabase.
- Cualquier endurecimiento debe ir en una migracion nueva, con pruebas y plan de datos existentes.

## 10. Problemas de seguridad

Fortalezas:

- Las tablas nuevas tienen RLS con `auth.uid() = user_id`.
- Las RPC principales usan `security invoker`.
- `confirm_bot_action` valida ownership y usa `for update`.
- El markdown del chat IA escapa HTML antes de convertir negritas/saltos, lo que baja riesgo de XSS en respuestas.

Riesgos:

- El frontend tiene la publishable key de Supabase. Eso es normal, pero obliga a que RLS y constraints sean muy estrictos.
- Muchas tablas permiten insert/update/delete directo desde el cliente. RLS protege ownership, pero no todas las invariantes de negocio.
- Hay 47 asignaciones `innerHTML`. Muchas usan `escapeHTML`, pero debe mantenerse como regla obligatoria antes de modularizar.
- Los inline handlers (`onclick`, `onchange`) dificultan aplicar una CSP estricta sin `unsafe-inline`.
- La Edge Function `ai-advisor` no esta en el repo. No se puede auditar autenticacion, limites, sanitizacion, modelo ni costo.
- Links externos como WhatsApp se construyen desde datos de contacto; hoy se limpia con `replace(/\D/g, '')`, lo cual esta bien para ese caso.

## 11. Problemas de UX

La simplificacion a cuatro modulos es coherente:

- `Inicio`: funciona como estado general, accion recomendada y accesos rapidos.
- `Dinero`: contiene finanzas, movimientos, gastos fijos y equipo/remuneraciones.
- `Productos`: contiene inventario, stock, costos, precios y carga asistida/manual.
- `Gestion`: funciona como portada para clientes, tareas, pedidos y entregas.
- `Mas herramientas`: contiene funciones secundarias.
- `Asesor IA`: esta disponible desde cualquier modulo.

Problemas que quedan:

- `Inicio` puede volver a sentirse cargado cuando se abre la informacion avanzada.
- `Dinero` concentra muchas decisiones: caja, ventas, gastos fijos, movimientos, equipo y retiros. Debe abrir con pocas tarjetas y dejar lo tecnico en detalle.
- `Productos` esta mejor orientado a carga asistida, pero el detalle todavia es tabla pesada.
- `Gestion` deja clientes y tareas claros, pero el concepto `Equipo` queda dividido: costo/pagos estan en Dinero y responsabilidades podrian vivir en Gestion.
- `Mas herramientas` mezcla herramientas activas con placeholders. `Documentos` e `Integraciones futuras` deberian comunicar claramente que aun no estan activas.
- Siguen apareciendo terminos tecnicos: `Carga inteligente`, `Historial tecnico`, `Metricas avanzadas`, `RPC`, `schema` en estados de error.
- Algunas explicaciones son correctas pero largas. Para usuarios no tecnicos, conviene una frase corta y un "ver mas" opcional.

## 12. Plan recomendado de refactor en fases

Fase 1 - Orden documental y mapa de ramas:

- Actualizar `CODEX_HANDOFF.md`, `SUPABASE_SCHEMA_NOTES.md` y `supabase/README.md` con los cuatro modulos actuales.
- Documentar que `organization_items` es la tabla real.
- Decidir si `package-lock.json` se borra o se formaliza con `package.json`.
- No tocar SQL todavia.

Fase 2 - Modularizacion sin cambio visual:

- Mantener app estatica online, sin build obligatorio.
- Crear modulos JS nativos o archivos separados simples.
- Extraer helpers puros primero: formato, DOM, errores, textos.
- Mantener funciones globales puente para no romper inline handlers mientras se migra.

Fase 3 - Services de datos:

- Extraer `financeService`, `inventoryService`, `teamService`, `organizationService`, `importService`, `advisorService`.
- Reducir llamadas directas `sb.from(...)` desde renders.
- Dejar una sola fuente de verdad para ingresos, egresos, ventas, margen y stock.

Fase 4 - UI por modulo:

- Separar render de `Inicio`, `Dinero`, `Productos`, `Gestion` y `Mas herramientas`.
- Crear componentes simples para `stat`, `empty`, `badge`, `tableRow`, `guidedMenu`.
- Mantener la regla: portada simple, detalles bajo `Ver detalles`.

Fase 5 - Pruebas smoke:

- Agregar pruebas Playwright minimas sin depender de datos reales: navegacion desktop/mobile, `Mas herramientas`, apertura del asesor, tabs principales, ausencia de ReferenceError.
- Agregar script de chequeo de IDs duplicados y handlers faltantes.

Fase 6 - Endurecimiento de datos:

- Recién despues de estabilizar services, crear nueva migracion para constraints o triggers.
- Definir politica de monto `0`.
- Definir como se bloquean escrituras directas que deben pasar por RPC.

## 13. Que NO conviene tocar todavia

- No borrar tablas legacy.
- No modificar migraciones existentes 001-007.
- No cambiar Supabase hasta tener plan de datos reales.
- No borrar ramas antes de revisar PRs/squash en GitHub.
- No introducir framework ni build system solo para ordenar archivos.
- No redisenar otra vez la navegacion principal: los cuatro modulos actuales son una buena base.
- No eliminar CSS sospechoso sin revisar screenshots desktop/mobile.
- No cambiar nombres internos de modulos si hay funciones que dependen de ellos; usar alias visibles.
- No depender solo de IA para carga de datos; mantener carga manual como respaldo.

## 14. Orden recomendado de proximos commits

1. `Sync documentation with four-module navigation`
2. `Add static audit checks for ids and handlers`
3. `Remove or formalize accidental package lock`
4. `Extract core format and DOM helpers`
5. `Extract finance data service`
6. `Extract inventory data service`
7. `Extract advisor and import services`
8. `Split UI renderers by core module`
9. `Clean unused CSS after visual QA`
10. `Add Supabase hardening migration`

## 15. Checklist para el proximo prompt

- Confirmar que la rama sigue siendo `refactor-simple-professional-ui`.
- Ejecutar `git status --short` y verificar si `package-lock.json` sigue sin trackear.
- Decidir si el siguiente paso sera documentacion, services o CSS.
- Si se toca frontend, no cambiar migraciones.
- Si se toca SQL, crear migracion nueva y no editar 001-007.
- Mantener visibles solo `Inicio`, `Dinero`, `Productos`, `Gestion`.
- Mantener `Asesor IA` flotante.
- Mantener legacy accesible desde `Mas herramientas`.
- Probar mobile y desktop despues de cada commit visual.
- Verificar consola sin `ReferenceError`.
- Verificar IDs duplicados.
- Confirmar que los nombres mobile/desktop coinciden.
- No hacer push sin pedido explicito.
