import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function html(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function errorPage(message: string, status = 400) {
  return html(`<main style="font-family:system-ui;padding:32px"><h1>No se pudo conectar Shopify</h1><p>${escapeHtml(message)}</p></main>`, status)
}

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

async function verifyShopifyHmac(url: URL, secret: string) {
  const params = new URLSearchParams(url.search)
  params.delete('hmac')
  params.delete('signature')
  params.sort()
  const message = params.toString()
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return safeEqual(hex(digest), url.searchParams.get('hmac') || '')
}

function base64(bytes: Uint8Array) {
  let value = ''
  for (const byte of bytes) value += String.fromCharCode(byte)
  return btoa(value)
}

async function encryptionKey(secret: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt'])
}

async function encryptToken(token: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await encryptionKey(secret)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(token))
  return `${base64(iv)}.${base64(new Uint8Array(encrypted))}`
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const clientId = Deno.env.get('SHOPIFY_CLIENT_ID') || ''
  const clientSecret = Deno.env.get('SHOPIFY_CLIENT_SECRET') || ''
  const tokenSecret = Deno.env.get('SHOPIFY_TOKEN_ENCRYPTION_KEY') || ''

  if (!supabaseUrl || !serviceKey || !clientId || !clientSecret || !tokenSecret) {
    return errorPage('Faltan variables de entorno del servidor.', 500)
  }
  if (!await verifyShopifyHmac(url, clientSecret)) return errorPage('La firma de Shopify no es valida.', 401)

  const shop = url.searchParams.get('shop') || ''
  const code = url.searchParams.get('code') || ''
  const state = url.searchParams.get('state') || ''
  if (!shop || !code || !state) return errorPage('La respuesta de Shopify esta incompleta.')

  const serviceClient = createClient(supabaseUrl, serviceKey)
  const { data: stateRow, error: stateError } = await serviceClient.from('shopify_oauth_states')
    .select('*')
    .eq('state', state)
    .maybeSingle()
  if (stateError || !stateRow) return errorPage('La solicitud de conexión venció o no existe.')
  if (stateRow.shop_domain !== shop) return errorPage('La tienda recibida no coincide con la solicitud original.')

  const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  })
  const tokenData = await tokenResponse.json().catch(() => ({}))
  if (!tokenResponse.ok || !tokenData.access_token) {
    return errorPage('Shopify no entrego un token valido.', 502)
  }

  const { data: connection, error: connectionError } = await serviceClient.from('shopify_connections').upsert({
    user_id: stateRow.user_id,
    shop_domain: shop,
    scopes: String(tokenData.scope || ''),
    status: 'connected',
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,shop_domain' }).select('id').single()
  if (connectionError || !connection) return errorPage(connectionError?.message || 'No se pudo guardar la conexión.', 500)

  const encryptedToken = await encryptToken(tokenData.access_token, tokenSecret)
  const { error: secretError } = await serviceClient.from('shopify_connection_secrets').upsert({
    connection_id: connection.id,
    access_token_ciphertext: encryptedToken,
    updated_at: new Date().toISOString(),
  })
  if (secretError) return errorPage(secretError.message, 500)

  await serviceClient.from('shopify_oauth_states').delete().eq('state', state)

  const fallback = Deno.env.get('APP_URL') || stateRow.return_to || '/'
  const redirectTo = stateRow.return_to || fallback
  return html(`<script>location.replace(${JSON.stringify(redirectTo)})</script><main style="font-family:system-ui;padding:32px"><h1>Shopify conectado</h1><p>Volviendo a Kairós...</p></main>`)
})
