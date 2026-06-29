# Kairos Negocios

Kairos Negocios es una aplicacion web estatica para administrar un negocio chico desde un centro de mando simple. Usa HTML, CSS, JavaScript puro y Supabase para autenticacion, datos, RPC y la funcion de Asesor IA.

## Modulos actuales

La navegacion principal visible tiene cuatro modulos:

1. Inicio: estado general, alertas, proxima accion y accesos rapidos.
2. Dinero: ingresos, egresos, ventas, gastos fijos, equipo, pagos y retiros.
3. Productos: inventario, stock, costos, precios, compras y reposicion.
4. Gestion: clientes, oportunidades, tareas, pedidos, entregas y vencimientos.

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
- `assets/js/ui/`: helpers simples de interfaz.
- `tools/`: checks estaticos sin dependencias externas.
- `supabase/`: documentacion y migraciones SQL versionadas.
- `ARCHITECTURE_AUDIT.md`: auditoria arquitectonica y roadmap de refactor.

## Estado actual

La app ya fue simplificada visualmente a cuatro modulos principales, pero la arquitectura interna sigue en transicion. El objetivo inmediato es preparar una refactorizacion segura sin cambiar comportamiento visible.

La app todavia usa Supabase. No se debe cambiar Supabase, migraciones ni base de datos en una fase de refactor frontend salvo que el prompt lo pida explicitamente.

## Que no tocar por ahora

- No modificar migraciones existentes `001-007`.
- No borrar tablas legacy.
- No cambiar logica financiera, calculos, importaciones, pagos de equipo ni flujos del Asesor IA.
- No redisenar la navegacion principal.
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
- Dinero abre.
- Productos abre.
- Gestion abre.
- Mas herramientas abre.
- Asesor IA abre.
- Registrar venta prepara el mensaje.
- Consola sin `ReferenceError`.

