# Integraciones de canales: diagnóstico y camino seguro

## Respuesta corta

Sí, Kairós puede permitir que una persona conecte Shopify, Mercado Libre, Tiendanube, Mercado Pago y WhatsApp Business desde botones del tipo `Conectar cuenta`.

Para el usuario se ve como una conexión normal. Técnicamente, esas conexiones usan OAuth, APIs oficiales y webhooks. No es seguro ni estable leer sesiones del navegador, pedir contraseñas o automatizar pantallas.

## Modelo recomendado

Kairós debe mantener un producto central en `inventario_items` y crear una publicación separada por canal.

Tablas futuras sugeridas:

- `channel_connections`: cuenta conectada, scopes, estado y referencias del proveedor. Los tokens deben guardarse cifrados en backend, nunca en `index.html`.
- `channel_listings`: relación entre un item de inventario y su publicación en cada canal.
- `channel_price_rules`: comisión, cargo fijo, envío, impuestos y margen objetivo por canal.
- `sync_jobs`: cola e historial de publicaciones y sincronizaciones.
- `webhook_events`: eventos recibidos, deduplicación, estado y errores.
- `notifications`: avisos internos para ventas, pagos, stock y errores de sincronización.

## Precio por canal

No conviene copiar un único precio a todos los canales.

Cada preview debería mostrar:

1. costo total del producto;
2. comisión estimada del canal;
3. cargo fijo y costo de financiación, si aplican;
4. envío absorbido por el negocio, si aplica;
5. margen objetivo;
6. precio sugerido;
7. ganancia esperada.

La comisión real depende del canal, categoría, tipo de publicación, medio de pago, cuotas, promociones y envío. Por eso las reglas deben poder actualizarse y el usuario debe confirmar antes de publicar.

## Flujo de publicación

1. El usuario carga texto e imágenes desde Kairós o WhatsApp.
2. Kairós prepara un producto central sin inventar costo, precio o stock.
3. Se eligen los canales de destino.
4. Kairós valida categorías, atributos, variantes e imágenes exigidas por cada canal.
5. Se muestra un preview distinto para cada canal, incluido su precio.
6. El usuario confirma.
7. Un backend publica y guarda los IDs externos.
8. Webhooks mantienen pedidos, pagos y stock sincronizados.

Nada debe publicarse automáticamente sin preview y confirmación.

## Canales

### Shopify

- Usar instalación administrada/OAuth y GraphQL Admin API.
- El REST Admin API usado por el sistema MUCHI es legacy para aplicaciones nuevas.
- Crear productos como borrador antes de activarlos es una buena práctica reutilizable.
- Documentación: https://shopify.dev/docs/apps/build/authentication-authorization
- GraphQL Admin API: https://shopify.dev/docs/api/admin-graphql/latest

### Mercado Libre

- Usar OAuth del vendedor, APIs de publicaciones, categorías, atributos, órdenes y notificaciones.
- La adaptación no es solo de precio: Mercado Libre exige atributos y reglas diferentes por categoría.
- La publicación debe validarse por país, categoría, tipo de publicación, envío y calidad.
- Documentación: https://developers.mercadolibre.com.ar/es_ar/usuarios-y-aplicaciones

### Tiendanube

- Usar OAuth `authorization_code`, APIs de productos/variantes/órdenes y webhooks.
- La cuenta se puede conectar desde un botón, pero Kairós necesita un backend para intercambiar y proteger el token.
- Autenticación: https://tiendanube.github.io/api-documentation/authentication
- Webhooks: https://tiendanube.github.io/api-documentation/resources/webhook

### Mercado Pago

- Usar OAuth cuando Kairós conecte cuentas de terceros.
- Recibir cambios de pagos por webhooks verificados y consultar el detalle antes de registrarlo.
- No convertir cada notificación en ingreso sin deduplicación y conciliación.
- OAuth: https://www.mercadopago.com.ar/developers/en/docs/checkout-api-payments/additional-content/security/oauth/creation
- Webhooks: https://www.mercadopago.com.ar/developers/en/docs/your-integrations/notifications/webhooks

### WhatsApp Business

- Usar WhatsApp Business Platform Cloud API y webhooks.
- Para una conexión simple de cuentas se debe evaluar Embedded Signup.
- Mantener el patrón del sistema MUCHI: acumular texto e imágenes, preparar borrador, pedir datos faltantes y confirmar.
- No usar automatización de WhatsApp Web ni sesiones personales: son frágiles y pueden incumplir políticas.
- Cloud API es la opción preferida por Meta: https://developers.facebook.com/docs/whatsapp/cloud-vs-onprem/

## Auditoría de `MUCHI-AI-SYSTEM.rar`

Conceptos valiosos:

- conversación con estado;
- buffer de varias imágenes;
- parser que no inventa precio ni stock;
- producto pendiente antes de publicar;
- preview y confirmación;
- asociación de imágenes con variantes;
- publicación inicial como borrador;
- separación entre orquestador, parser, pipeline y conectores.

Problemas a corregir antes de reutilizar código:

- el archivo contiene `.env`, archivos con nombres de credenciales, historial `.git` y medios cargados;
- incluye `node_modules`, lo que vuelve el paquete pesado y difícil de auditar;
- Shopify usa endpoints REST y tokens fijos en lugar del flujo multiusuario que necesita Kairós;
- el estado pendiente se guarda localmente y no es adecuado para múltiples usuarios/instancias;
- no hay suite de pruebas declarada;
- Google Sheets funciona como persistencia paralela, mientras Kairós debe usar Supabase como fuente central;
- el código y las imágenes son de un sistema privado: reutilizar conceptos no implica copiarlo sin revisar autoría y licencia.

Antes de mover cualquier parte:

1. crear un paquete limpio solo con código fuente;
2. eliminar `.env`, credenciales, medios, `.git` y `node_modules`;
3. rotar todas las claves que hayan estado dentro del archivo;
4. confirmar autoría/licencia del código;
5. reemplazar secretos fijos por conexiones OAuth cifradas;
6. mover estados y borradores a Supabase;
7. agregar pruebas de idempotencia, webhooks y publicación parcial.

## Orden seguro de implementación

1. Modelo de canales y bóveda de tokens en backend.
2. Shopify como primer conector, con producto borrador y preview de precio.
3. Webhooks de pedidos y stock.
4. Mercado Pago para conciliación y avisos.
5. Tiendanube.
6. Mercado Libre, por su mayor complejidad de categorías, atributos, costos y logística.
7. WhatsApp Business como entrada conversacional al mismo pipeline, sin lógica de publicación duplicada.
