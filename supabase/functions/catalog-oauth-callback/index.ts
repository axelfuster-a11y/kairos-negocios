import {
  env, errorPage, html, providerName, saveConnection, serviceClient,
} from '../_shared/catalog.ts'

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let result = 0
  for (let index = 0; index < a.length; index++) result |= a.charCodeAt(index) ^ b.charCodeAt(index)
  return result === 0
}

async function verifyShopify(url: URL, secret: string) {
  const params = new URLSearchParams(url.search)
  params.delete('hmac')
  params.delete('signature')
  params.sort()
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return safeEqual(hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(params.toString()))), url.searchParams.get('hmac') || '')
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const state = url.searchParams.get('state') || ''
  const code = url.searchParams.get('code') || ''
  if (!state || !code) return errorPage('La respuesta de autorización está incompleta.')
  const service = serviceClient()
  const { data: row } = await service.from('catalog_oauth_states').select('*').eq('state', state).maybeSingle()
  if (!row || Date.now() - new Date(row.created_at).getTime() > 10 * 60 * 1000) {
    return errorPage('La solicitud venció o no existe.')
  }

  const callback = env('CATALOG_OAUTH_REDIRECT_URI') ||
    `${env('SUPABASE_URL')}/functions/v1/catalog-oauth-callback`
  try {
    let token: Record<string, any>
    let externalStoreId = ''
    let displayName = ''
    let config: Record<string, unknown> = {}
    if (row.provider === 'shopify') {
      if (!await verifyShopify(url, env('SHOPIFY_CLIENT_SECRET'))) throw new Error('La firma de Shopify no es válida')
      if (url.searchParams.get('shop') !== row.shop_domain) throw new Error('La tienda recibida no coincide')
      const response = await fetch(`https://${row.shop_domain}/admin/oauth/access_token`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: env('SHOPIFY_CLIENT_ID'), client_secret: env('SHOPIFY_CLIENT_SECRET'), code }),
      })
      token = await response.json()
      if (!response.ok || !token.access_token) throw new Error('Shopify no entregó un token válido')
      externalStoreId = row.shop_domain
      displayName = row.shop_domain
    } else if (row.provider === 'tiendanube') {
      const response = await fetch('https://www.tiendanube.com/apps/authorize/token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: env('TIENDANUBE_CLIENT_ID'), client_secret: env('TIENDANUBE_CLIENT_SECRET'),
          grant_type: 'authorization_code', code,
        }),
      })
      token = await response.json()
      if (!response.ok || !token.access_token || !token.user_id) throw new Error('Tiendanube no entregó un token válido')
      externalStoreId = String(token.user_id)
      displayName = `Tienda ${token.user_id}`
    } else if (row.provider === 'mercadolibre') {
      const response = await fetch('https://api.mercadolibre.com/oauth/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code', client_id: env('MERCADOLIBRE_CLIENT_ID'),
          client_secret: env('MERCADOLIBRE_CLIENT_SECRET'), code, redirect_uri: callback,
          code_verifier: row.code_verifier || '',
        }),
      })
      token = await response.json()
      if (!response.ok || !token.access_token || !token.user_id) throw new Error('Mercado Libre no entregó un token válido')
      externalStoreId = String(token.user_id)
      displayName = `Mercado Libre ${token.user_id}`
      config = { site_id: 'MLA' }
    } else throw new Error('Proveedor no válido')

    await saveConnection({
      userId: row.user_id, provider: row.provider, externalStoreId, displayName,
      accessToken: token.access_token, refreshToken: token.refresh_token,
      expiresIn: Number(token.expires_in) || undefined, scopes: token.scope, config,
    })
    await service.from('catalog_oauth_states').delete().eq('state', state)
    const target = `${row.return_to || env('APP_URL') || '/'}#integrations`
    return html(`<script>location.replace(${JSON.stringify(target)})</script><main style="font-family:system-ui;padding:32px"><h1>${providerName(row.provider)} conectado</h1><p>Volviendo a Kairós...</p></main>`)
  } catch (error) {
    return errorPage(error instanceof Error ? error.message : String(error), 502)
  }
})
