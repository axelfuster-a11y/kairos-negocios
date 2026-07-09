# Kairos Negocios

Kairos Negocios es una aplicacion web estatica para administrar un negocio chico desde un centro de mando simple. Usa HTML, CSS, JavaScript puro y Supabase para autenticacion, datos, RPC y la funcion de Asesor IA.

## Modulos actuales

La navegacion principal visible tiene cinco modulos:

1. Inicio: estado general, alertas, proxima accion y accesos rapidos.
2. Productos: catalogo, inventario, costos, precios, margen, compras y reposicion.
3. Ventas: operacion comercial, compras, productos vendidos, ganancia comercial y margen.
4. Finanzas: caja, ingresos, egresos, gastos fijos, resultado economico, equipo y movimientos.
5. Equipo: responsables, tareas, pagos, capacidad operativa y accesos a clientes/agenda.

El Asesor IA no es un modulo principal: queda como boton flotante. Las funciones secundarias viven en Mas herramientas: Publicidad, Contenido, Metricas avanzadas, Importaciones, Mi Negocio, Configuracion, Documentos, Historial tecnico e Integraciones futuras.

## Como abrir el proyecto

No hay build obligatorio. Para revisar la app localmente se puede abrir `index.html` en el navegador o servir la carpeta con un servidor estatico simple.

Ejemplo con Python, si esta disponible:

```bash
python -m http.server 8080
```

Luego abrir `http://localhost:8080`.

## Estructura de archivos

- `index.html`: estructura de pantallas, navegacion, modales y handlers inline.
- `assets/app.js`: logica principal de la app. Todavia concentra estado, render, datos, IA e integraciones.
- `assets/styles.css`: estilos visuales y responsive.
- `assets/js/core/`: helpers puros compartidos de formato, DOM, fechas, seguridad y validacion.
- `assets/js/services/financeService.js`: lectura y operaciones financieras simples compartidas por `assets/app.js`.
- `assets/js/ui/`: helpers simples de interfaz.
- `tools/`: checks estaticos sin dependencias externas.
- `supabase/`: documentacion y migraciones SQL versionadas.
- `ARCHITECTURE_AUDIT.md`: auditoria arquitectonica y roadmap de refactor.
- `CHANGELOG.md`: historial de cambios funcionales, visuales y QA.

## Estado actual

La app ya fue simplificada visualmente a cinco modulos principales, pero la arquitectura interna sigue en transicion. La primera extraccion de services es `KairosFinanceService`, cargado como script clasico para no convertir `assets/app.js` a ES modules ni romper handlers inline.

La app todavia usa Supabase. No se debe cambiar Supabase, migraciones ni base de datos en una fase de refactor frontend salvo que el prompt lo pida explicitamente.

## Que no tocar por ahora

- No modificar migraciones existentes `001-007`.
- No borrar tablas legacy.
- No cambiar logica financiera, calculos, importaciones, pagos de equipo ni flujos del Asesor IA.
- No redisenar la navegacion principal sin una razon clara de producto.
- No introducir framework ni build system solo para ordenar archivos.
- No limpiar CSS sospechoso sin validacion visual desktop/mobile.

## package-lock.json

Este repositorio no tiene `package.json` y no usa scripts npm. Por eso `package-lock.json` no debe existir ni agregarse al commit si aparece generado por error.

No ejecutar `npm install` mientras no haya `package.json`. Los checks actuales se corren con Node nativo, sin dependencias.

## Validar cambios

Ejecutar:

```bash
node tools/run-static-checks.mjs
node --check assets/app.js
git diff --check
```

Validacion manual minima:

- Inicio carga.
- Productos abre.
- Ventas abre.
- Finanzas abre.
- Equipo abre.
- Mas herramientas abre.
- Asesor IA abre.
- Registrar venta prepara el mensaje.
- Consola sin `ReferenceError`.
