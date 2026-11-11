# Kairós Personal — MVP local-first

Esta versión es independiente del sistema anterior de Kairós Negocios. No utiliza Supabase, APIs, cuentas externas ni servicios pagos.

## Ejecutar
Serví esta carpeta con cualquier servidor estático (por ejemplo, `python -m http.server 8080` desde la carpeta `personal`) y abrí `http://localhost:8080`. Para instalar como PWA y usar el modo offline, se requiere HTTPS o localhost.

## Persistencia y privacidad
Los datos se guardan en IndexedDB dentro del perfil del navegador. No salen del dispositivo. No hay sincronización entre dispositivos ni recuperación automática si se pierde el navegador/dispositivo. Usá el botón de copia de seguridad para exportar un JSON y guardalo en un lugar seguro. La importación reemplaza los datos actuales.

## Incluye
- Cuentas y saldos calculados desde saldo inicial y movimientos.
- Ingresos y gastos asociados a una cuenta.
- Deudas separadas de los saldos disponibles; marcarlas pagadas no modifica movimientos.
- Tareas con fecha, notas y estado.
- Resumen del mes, filtros y edición/borrado de movimientos.
- Exportación y restauración de copias.
- PWA con caché offline.

## Límites de esta versión
No incluye IA, nube/sincronización, usuarios múltiples, adjuntos, recurrencias, cuotas automáticas ni integración bancaria. Las operaciones se registran manualmente. No es un sistema contable ni sustituye conciliación bancaria.
