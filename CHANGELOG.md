# Changelog

Todos los cambios relevantes del proyecto Kairós Negocios se documentan en este archivo.

## 2026-07-09

### Cambiado

- Se rediseñó la experiencia interna principal con estética oscura profesional.
- La navegación principal quedó organizada en cinco módulos: Inicio, Productos, Ventas, Finanzas y Equipo.
- Ventas y Finanzas quedaron separadas:
  - Ventas muestra operación comercial, compras/reposición, productos vendidos, ganancia comercial y margen.
  - Finanzas muestra caja, ingresos, egresos, gastos fijos, resultado económico, gráfico y paneles de detalle.
- Productos se consolidó como módulo único para catálogo, inventario, costos, precios, margen y reposición.
- Equipo reemplazó la portada anterior de Gestión por un canvas operativo con integrantes, costo objetivo, trabajo pagado, agenda y accesos a tareas/clientes.
- Se mantuvo la lógica existente de Supabase, rutas, tablas, formularios, modales, Asesor IA e importaciones.
- Se agregaron indicadores, iconos, hover suave, responsive mobile/tablet y cache busting para CSS/JS.

### Corregido

- Se corrigió una estructura HTML que dejaba Ventas y Finanzas fuera del contenedor principal.
- Se corrigió una anidación incorrecta donde Productos podía quedar dentro de Finanzas.
- Se verificó que las pantallas principales y secundarias no tengan overflow horizontal en desktop, tablet ni mobile.
- Se verificó que Productos vuelva a mostrar datos y filtros después de la separación de módulos.
- Se ajustó la tarjeta de autenticación para respetar el ancho disponible en pantallas móviles.

### QA

- Checks ejecutados:
  - `node --check assets/app.js`
  - `node tools/run-static-checks.mjs`
  - `git diff --check`
- QA manual en navegador local:
  - Inicio
  - Productos
  - Ventas
  - Finanzas
  - Equipo
  - Publicidad
  - Contenido
  - Métricas avanzadas
  - Importaciones
  - Mi Negocio
  - Clientes y oportunidades
  - Tareas y vencimientos
  - Perfil
  - Asesor IA
- Responsive probado en mobile y tablet.
- Consola del navegador revisada sin errores ni warnings durante las pruebas.

### Publicado

- Pull request: https://github.com/axelfuster-a11y/kairos-negocios/pull/15
- Merge en `main`: `f7b28a7 Rediseñar módulos principales de Kairós`
