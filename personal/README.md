# Kairós Personal — MVP local-first

Versión personal independiente en `personal/`. Funciona en el navegador y guarda los datos localmente; no necesita una cuenta externa ni un servicio de pago.

## Ejecutar

Desde esta carpeta, inicia un servidor estático:

```bash
python -m http.server 8080
```

Abre `http://localhost:8080`. Para instalar la PWA y probar el modo offline se requiere HTTPS o localhost.

## Funciones incluidas

- **Finanzas:** cuentas, saldos calculados, ingresos, gastos, transferencias, conciliación manual y deudas.
- **Pagos de deuda:** pagos parciales y totales vinculados a un gasto; los pagos nuevos conservan los datos necesarios para revertirlos.
- **Organización:** tareas, prioridades, fechas, recurrencias, eventos y calendario combinado.
- **Proyectos y estudios:** proyectos, materias, tareas vinculadas y adjuntos locales PDF/PNG/JPG/WebP de hasta 5 MB por archivo.
- **Trabajo:** clientes y empleadores, actividad, tiempo, cobros y gastos analíticos. Estos registros no modifican automáticamente los saldos.
- **Asistente local:** consultas básicas y preparación de movimientos o tareas con confirmación antes de guardar.
- **Preferencias:** tema claro, oscuro o del sistema; tamaño de letra; moneda y cierre diario.
- **Control de cambios:** deshacer/rehacer y copias JSON para exportar y restaurar.
- **PWA:** shell de la aplicación en caché para abrirla sin conexión después de la primera carga.

## Persistencia y privacidad

Los datos se guardan en IndexedDB dentro del perfil del navegador. No se envían a un servidor ni se sincronizan entre dispositivos. El almacenamiento persistente es una solicitud al navegador, no una garantía: puede borrarse al limpiar los datos del sitio o perder el dispositivo.

Exporta copias JSON con regularidad y guárdalas en un lugar seguro. Restaurar una copia reemplaza los datos actuales. La validación rechaza registros, identificadores y preferencias con formatos no admitidos.

## Límites conocidos

- El asistente usa reglas locales; no es un modelo generativo ni tiene razonamiento abierto.
- No hay sincronización en la nube, cuentas multiusuario, integración bancaria ni API de Google Drive.
- Los recordatorios dependen de que la aplicación esté abierta; no se garantiza ejecución ni notificaciones en segundo plano.
- La caché offline no sincroniza cambios y no reemplaza una copia de seguridad.
- La CI comprueba sintaxis, contratos y lógica de dominio, pero no sustituye las pruebas de interacción en navegadores y teléfonos reales.

## Pruebas automáticas

Desde la raíz del repositorio, ejecuta:

```bash
node tools/run-static-checks.mjs
```

Antes de considerar estable la aplicación, completa también la lista manual: transferencias entre cuentas, pagos parciales/totales y reversión, recurrencias, adjuntos, exportación/restauración, chat con varios importes, deshacer/rehacer, tema/tamaño de letra, navegación móvil y uso offline.
