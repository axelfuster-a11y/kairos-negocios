# QA FinanceService

## 1. Resultado general

**No aprobado para seguir con InventoryService todavía.**

El refactor financiero funciona en los flujos principales probados: Inicio carga sin errores, Dinero abre sin errores, los totales de caja se actualizan, la ganancia de ventas sigue leyendo `ventas`, los movimientos invalidos no se registran, un movimiento valido se crea como `manual`, aparece en movimientos unificados y se puede eliminar.

Sin embargo, durante la prueba de logout se detecto un bug de seguridad/estado: despues de cerrar sesion, la app vuelve a login y oculta negocio/email, pero el panel del Asesor IA queda visible con historial de acciones recientes de la sesion anterior. Aunque no pertenece al nucleo de FinanceService, forma parte de los flujos visibles pedidos para esta validacion y puede exponer datos entre sesiones.

## 2. Pruebas ejecutadas

### Pruebas estaticas

- `git status --short`: limpio antes de crear este informe.
- `git diff --check`: sin errores.
- `node tools/run-static-checks.mjs`: OK.
  - JS syntax ok: 12 files.
  - HTML ids ok: 372 ids.
  - Inline handlers ok: 222 callable names scanned.
- `node --check assets/app.js`: OK.
- `node --check assets/js/services/financeService.js`: OK.

### Revision de archivos

- `assets/js/services/financeService.js`
- `assets/app.js`
- `index.html`
- `tools/run-static-checks.mjs`

### Comparacion del refactor

- No se tocaron migraciones.
- No se altero Supabase config.
- No se movio inventario.
- No se movio `recordTeamPayment`.
- No se movio `confirmImportBatch`.
- No se movio la logica completa de importaciones.
- `FinanceService.addManualMovement` inserta siempre con `user_id: userId()`.
- `FinanceService.addManualMovement` rechaza `monto <= 0`.
- `FinanceService.deleteMovement` solo permite `transacciones` y `movimientos_financieros`.
- `loadSalesSummary` sigue leyendo `ventas` y calcula:
  - `total` como suma de `ventas.total`.
  - `cost` como suma de `ventas.costo_total`.
  - `profit` como suma de `ventas.ganancia`.
  - `margin` como `profit / total * 100` si `total > 0`.

### Pruebas funcionales con sesion activa

- Inicio carga sin errores de consola.
- Dinero abre sin errores de consola.
- Dashboard muestra resultado de caja.
- Dashboard muestra ganancia de ventas.
- Dinero muestra ingresos y egresos.
- Movimiento con monto `0` no se registro.
- Movimiento con monto negativo no se registro.
- Movimiento valido de prueba se registro:
  - descripcion: `QA FinanceService valido ...`
  - tipo: `ingreso`
  - monto: `$123`
  - fuente: `manual`
- Al registrar el movimiento valido:
  - Dinero actualizo ingresos de `$261.000` a `$261.123`.
  - Inicio actualizo caja de `$-14.000` a `$-13.877`.
  - Movimientos unificados mostro el registro nuevo.
- Eliminar movimiento funciono:
  - el movimiento QA desaparecio de las tablas.
  - ingresos volvieron a `$261.000`.
  - egresos quedaron en `$275.000`.
- Movimiento operativo sin monto sigue apareciendo como `Sin monto`.
- Ganancia de ventas siguio mostrando `$10.000`.
- Margen de ventas siguio mostrando `50.0%`.
- No hubo `ReferenceError` en consola durante las pruebas.
- `Anotar gasto` abre Dinero > Movimientos, enfoca descripcion y deja tipo `egreso`.
- `Registrar venta` abre Asesor IA sin crear registros.
- Asesor IA abre y enfoca el input.
- Logout vuelve a pantalla de login y oculta negocio/email.

## 3. Pruebas no ejecutadas y por que

- No se probo mobile/responsive: esta validacion se enfoco en el refactor financiero y la sesion activa de escritorio.
- No se probo el caso real de margen sin ventas creando fixtures temporales, para no alterar ventas ni inventario.
- No se probo movimiento legacy creando datos nuevos en `transacciones`; se verifico que la tabla legacy sigue integrada por lectura y que `deleteMovement` permite esa fuente.
- No se probo doble carga de auth con instrumentacion profunda; se verifico por consola y comportamiento visible sin errores.
- No se probo importacion completa porque el alcance indica no mover importaciones y no tocar esa logica.

## 4. Bugs encontrados

### Alto - El Asesor IA queda visible despues de logout

Despues de cerrar sesion, la app muestra login y ya no deja visibles el negocio ni el email del usuario, pero el panel del Asesor IA permanece abierto con historial de acciones recientes.

Impacto:

- Puede exponer datos de la sesion anterior.
- Contradice la prueba "Volver a login no deja datos del usuario anterior".
- No parece causado directamente por `FinanceService`, pero fue detectado en el flujo de validacion requerido.

Evidencia funcional:

- Logout por boton `Salir` volvio a login.
- `Blanqueria Muchi` y `blancos.muchi@gmail.com` dejaron de estar visibles.
- El texto visible siguio incluyendo el panel "Asesor IA", acciones recientes y mensajes anteriores.

## 5. Riesgos pendientes

- `movementTotals` ahora filtra movimientos con `monto > 0`. Esto coincide con la regla pedida para el service, pero cambia el comportamiento anterior de `count`, que antes contaba tambien movimientos sin monto. Conviene revisar cualquier UI que use `count` como cantidad total de filas.
- `loadUnifiedFinances` continua si falla solo una de las dos fuentes (`transacciones` o `movimientos_financieros`). Es resiliente, pero puede mostrar datos parciales si la UI no lo advierte claramente.
- Persisten llamadas directas a `movimientos_financieros` en importaciones/carga inteligente. Estan fuera del alcance de esta fase, pero siguen siendo deuda para `ImportService`.
- Los caches financieros fueron movidos al service y se invalidan en altas/bajas manuales; cualquier futura escritura financiera fuera del service debe invalidarlos explicitamente.
- La app sigue dependiendo de globals y handlers inline; esto limita aislamiento de pruebas y endurecimiento de CSP.

## 6. Recomendacion

**Aprobado para seguir con InventoryService despues del fix de logout/Asesor IA.**

El bug alto de logout/Asesor IA fue corregido en `assets/app.js` con una limpieza explicita de estado del asesor. Se recomienda mantener la mini-regresion de:

- Inicio.
- Dinero.
- alta/baja de movimiento manual.
- logout.
- login limpio sin datos visibles previos.

## 7. Fix verification

Cambio aplicado:

- Se agrego `resetAdvisorState()`.
- `doLogout()` limpia estado user-scoped antes de llamar a `sb.auth.signOut()`.
- `resetUserScopedState()` ahora limpia tambien estado interno y visual del Asesor IA.
- `closeAI()` ahora tolera elementos ausentes y remueve las clases `on` del panel y overlay.

Estado que se limpia:

- `aiH`.
- `botActionPreview`.
- `botActionSurface`.
- `importedData.botActions`.
- input `#ai-inp`.
- mensajes visibles de `#ai-msgs`.
- acciones recientes de `#ai-recent-actions`.
- preview `#ai-bot-action-preview`.
- preview de importacion/bot `#im-bot-preview`.
- cards `#im-bot-preview-card`, `#im-preview-card`, `#im-summary-card`.
- clases visibles de `#ai-panel` y `#ai-ov`.

Pruebas ejecutadas despues del fix:

- `git diff --check`: OK.
- `node tools/run-static-checks.mjs`: OK.
  - JS syntax ok: 12 files.
  - HTML ids ok: 372 ids.
  - Inline handlers ok: 223 callable names scanned.
- `node --check assets/app.js`: OK.
- `node --check assets/js/services/financeService.js`: OK.
- Navegador en login despues de recargar:
  - `#app` no queda activo.
  - login visible.
  - `#ai-panel` sin clase `on`.
  - `#ai-ov` sin clase `on`.
  - panel y overlay no visibles.
  - negocio/email anterior no visibles.
  - sin errores de consola.

Pruebas no repetidas despues del fix:

- Login nuevo, Inicio/Dinero y alta/baja manual no se repitieron porque la sesion usada en QA fue cerrada y no habia credenciales disponibles en el entorno. Esas pruebas habian pasado antes del fix y el cambio no toca calculos, Supabase, FinanceService, inventario ni importaciones.
