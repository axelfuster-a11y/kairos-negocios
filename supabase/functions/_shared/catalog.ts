import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
}

export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

export const html = (body: string, status = 200) => new Response(body, {
  status,
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
})

export const escapeHtml = (value: unknown) => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#039;')

export const errorPage = (message: string, status = 400) =>
  html(`<main style="font-family:system-ui;padding:32px"><h1>No se pudo conectar el canal</h1><p>${escapeHtml(message)}</p></main>`, status)

export const env = (name: string) => Deno.env.get(name) || ''

export const serviceClient = () => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))

export async function authenticatedUser(req: Request) {
  const client = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
  })
  const { data: { user } } = await client.auth.getUser()
  return user
}

function bytesToBase64(bytes: Uint8Array) {
  let value = ''
  for (const byte of bytes) value += String.fromCharCode(byte)
  return btoa(value)
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), char => char.charCodeAt(0))
}

async function tokenKey() {
  const secret = env('CATALOG_TOKEN_ENCRYPTION_KEY')
  if (!secret) throw new Error('Falta CATALOG_TOKEN_ENCRYPTION_KEY')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function encryptToken(token: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await tokenKey(), new TextEncoder().encode(token))
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`
}

export async function decryptToken(value: string) {
  const [iv, encrypted] = String(value || '').split('.')
  if (!iv || !encrypted) throw new Error('Token cifrado inválido')
  const clear = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(iv) },
    await tokenKey(),
    base64ToBytes(encrypted),
  )
  return new TextDecoder().decode(clear)
}

export function providerName(provider: string) {
  return ({ shopify: 'Shopify', tiendanube: 'Tiendanube', mercadolibre: 'Mercado Libre' } as Record<string, string>)[provider] || provider
}

export function safeReturnTo(value: unknown) {
  const appUrl = env('APP_URL')
  const requested = String(value || '')
  return appUrl && requested.startsWith(appUrl) ? requested : appUrl
}

export async function saveConnection(input: {
  userId: string
  provider: string
  externalStoreId: string
  displayName?: string
  accessToken: string
  refreshToken?: string
  expiresIn?: number
  scopes?: string
  config?: Record<string, unknown>
}) {
  const service = serviceClient()
  const now = new Date()
  const expiresAt = input.expiresIn ? new Date(now.getTime() + input.expiresIn * 1000).toISOString() : null
  const { data: connection, error } = await service.from('catalog_connections').upsert({
    user_id: input.userId,
    provider: input.provider,
    external_store_id: input.externalStoreId,
    display_name: input.displayName || input.externalStoreId,
    status: 'connected',
    sync_direction: 'both',
    config: input.config || {},
    last_error: null,
    updated_at: now.toISOString(),
  }, { onConflict: 'user_id,provider,external_store_id' }).select('id').single()
  if (error || !connection) throw error || new Error('No se pudo guardar la conexión')
  const { error: secretError } = await service.from('catalog_connection_secrets').upsert({
    connection_id: connection.id,
    access_token_ciphertext: await encryptToken(input.accessToken),
    refresh_token_ciphertext: input.refreshToken ? await encryptToken(input.refreshToken) : null,
    expires_at: expiresAt,
    scopes: input.scopes || null,
    updated_at: now.toISOString(),
  })
  if (secretError) throw secretError
  return connection.id
}
