# Kairós Core Flow V2

## Objetivo

Kairós debe resolver cuatro tareas diarias con claridad:

1. Vender.
2. Administrar productos e inventario.
3. Registrar y entender dinero.
4. Indicar la próxima acción importante.

## Navegación objetivo

- Hoy
- Vender
- Productos
- Dinero
- Más

`Más` contiene clientes, equipo, agenda, configuración, importación, integraciones y soporte. Publicidad, contenido, métricas avanzadas, historial técnico y funciones futuras no deben competir con el flujo principal.

## Reglas de dominio

- Una venta no es un cobro.
- Una venta puede tener cero, uno o varios cobros.
- Ganancia comercial = total vendido - costo de los productos vendidos.
- Saldo pendiente = total vendido - total cobrado.
- La caja solo refleja movimientos realmente cobrados o pagados.
- El servidor obtiene el costo desde el producto guardado; el navegador no es fuente de verdad.
- Pantalla manual, Asesor IA e integraciones deben llamar a los mismos casos de uso.

## Arquitectura objetivo

La UI no debe conocer tablas ni funciones específicas de Supabase.

Capas:

1. Dominio: modelos y reglas puras.
2. Casos de uso: registrar venta, registrar cobro, crear producto, registrar gasto, ajustar inventario y controlar caja.
3. Puertos/repositorios: contratos neutrales.
4. Adaptadores: Supabase ahora; otro backend más adelante.
5. UI e IA: consumidores de los casos de uso.

## Orden de implementación

1. Separar venta, cobro, saldo pendiente y ganancia.
2. Crear `sale_payments` y registrar cobros por separado.
3. Mover la fuente de costo al servidor.
4. Extraer `SalesService`, `InventoryService`, `CashService` y `BusinessRepository`.
5. Cargar módulos bajo demanda.
6. Simplificar Hoy y mover herramientas secundarias a Más.
7. Migrar datos legacy y bloquear nuevas escrituras en tablas viejas.
8. Crear exportación canónica, versionada y transaccional.
9. Agregar pruebas end-to-end del flujo diario.

## Restricciones de esta rama

- No aplicar migraciones automáticamente en producción.
- No fusionar a `main` automáticamente.
- Mantener compatibilidad temporal con la UI existente.
- No agregar nuevas integraciones hasta estabilizar el núcleo.
