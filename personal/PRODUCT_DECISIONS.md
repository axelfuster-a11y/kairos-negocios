# Kairós Personal — decisiones de producto y UX

## Principio de diseño

Kairós debe reducir carga mental, no convertirse en otro trabajo que mantener. Una acción primaria por pantalla, formularios cortos, valores por defecto prudentes, lenguaje claro y confirmación antes de tocar dinero o borrar información.

## Referencias estudiadas

- **Super Productivity**: proyectos, tareas, timeboxing, Pomodoro y registro de tiempo. Tomamos la separación entre tareas, proyectos y sesiones; evitamos exigir una planificación minuto a minuto.
- **Todoist**: captura rápida y entrada en lenguaje natural. Tomamos el principio de escribir como habla la persona; en Kairós el texto interpretado se convierte en una propuesta revisable antes de guardar.
- **Actual Budget**: cuentas, movimientos, importación y reconciliación. Tomamos la separación de saldos, movimientos y reglas de conciliación. No se debe confundir una transferencia con un ingreso/gasto ni una deuda con el saldo de una cuenta.

## Decisiones para evitar dolores de cabeza

1. **Local-first**: la aplicación debe funcionar sin cuenta externa ni servicio de pago. IndexedDB guarda los datos del navegador; el Service Worker almacena el shell de la PWA.
2. **Una fuente de verdad**: la IA/chat interpreta, pero el dominio calcula saldos, valida importes y persiste cambios.
3. **Confirmar antes de actuar**: el chat no registra movimientos hasta que la persona confirma. Si hay más de una cuenta, pregunta cuál. Si no hay cuenta, no inventa una.
4. **Transferencias neutrales**: reducen una cuenta y aumentan otra; no son ingresos ni gastos.
5. **Deuda separada**: registrar una deuda no modifica saldos. Pagar parcial o totalmente crea un gasto vinculado y reduce el saldo pendiente en una única operación.
6. **Deshacer/rehacer**: acciones confirmadas quedan en un historial acotado; Ctrl/Cmd+Z deshace y Ctrl/Cmd+Y o Ctrl/Cmd+Shift+Z rehace. Se mantiene una copia exportable.
7. **Borrado protegido**: se confirma antes de eliminar. Una cuenta con movimientos no se borra para evitar dejar registros huérfanos.
8. **No duplicar ingresos**: el módulo Trabajo registra actividad y cobros; para cambiar el saldo se registra además el movimiento financiero. La interfaz advierte esta separación.
9. **Calendario agregado**: tareas con fecha, eventos y vencimientos se muestran juntos sin crear copias editables duplicadas.
10. **Móvil y escritorio**: misma lógica y datos; navegación lateral en escritorio y barra inferior en móvil. No mantener dos aplicaciones distintas.
11. **Planificación humana**: prioridades, fechas, estimaciones y revisión diaria; no se fuerza una agenda perfecta ni se castiga una tarea atrasada.
12. **Privacidad**: no hay API key ni secretos de IA en el navegador. El chat actual es local y basado en reglas; un modelo remoto será opcional y deberá pasar por un backend/proxy con consentimiento explícito.

## Límites y riesgos que se mantienen visibles

- Los datos viven en el navegador/dispositivo. Limpiar datos del sitio, perder el dispositivo o usar otro navegador puede hacerlos inaccesibles. Exportar copias es obligatorio hasta que exista una sincronización privada fiable.
- La persistencia del navegador es una solicitud, no una garantía. El sistema operativo puede limpiar almacenamiento.
- El Service Worker permite abrir la app offline tras la primera carga, pero no garantiza sincronización entre dispositivos.
- Los recordatorios diarios funcionan mientras la app está abierta. Un navegador móvil puede suspender pestañas; no se promete ejecución exacta en segundo plano.
- El chat local entiende un conjunto limitado de frases en español. No equivale todavía a un LLM ni debe presentarse como tal.
- Los enlaces a Drive/carpeta son referencias; no se descargan ni sincronizan automáticamente documentos privados.
- No se probó aún en todos los tamaños de pantalla ni en Safari/iOS. La CI comprueba sintaxis y lógica de dominio, no sustituye pruebas manuales de interacción.

## Siguiente validación manual

1. Crear dos cuentas y comprobar saldos.
2. Registrar ingreso y gasto; editar y deshacer.
3. Transferir entre cuentas; comprobar que el total no cambia.
4. Registrar una deuda, pagar una parte y verificar el gasto y el saldo pendiente.
5. Crear tarea con fecha, repetir y completar; comprobar el calendario.
6. Crear proyecto y materia, vincular tareas.
7. Iniciar, pausar y completar una sesión de enfoque.
8. Probar el chat con cuenta única y con varias cuentas; cancelar y confirmar.
9. Exportar copia, restaurarla y comprobar que los datos coinciden.
10. Repetir en celular y escritorio, incluyendo modo offline.
