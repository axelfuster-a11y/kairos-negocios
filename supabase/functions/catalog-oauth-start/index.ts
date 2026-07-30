import {
  authenticatedUser, corsHeaders, env, json, providerName, safeReturnTo, serviceClient,
} from '../_shared/catalog.ts'

const providers = new Set(['shopify', 'tiendanube', 'mercadolibre'])

function normalizeShop(value: unknown) {
  return String(value || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
}

async function pkce() {
  const verifier = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return { verifier, challenge }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
  const user = await authenticatedUser(req)
  if (!user) return json({ error: 'Sesión no válida' }, 401)

  const { provider, shop, returnTo } = await req.json().catch(() => ({}))
  if (!providers.has(provider)) return json({ error: 'Proveedor no válido' }, 400)
  const shopDomain = provider === 'shopify' ? normalizeShop(shop) : null
  if (provider === 'shopify' && !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shopDomain || '')) {
    return json({ error: 'Ingrese el dominio .myshopify.com de su tienda' }, 400)
  }

  const state = crypto.randomUUID()
  const proof = provider === 'mercadolibre' ? await pkce() : null
  const service = serviceClient()
  await service.from('catalog_oauth_states').delete()
    .eq('user_id', user.id).lt('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
  const { error } = await service.from('catalog_oauth_states').insert({
    state,
    user_id: user.id,
    provider,
    shop_domain: shopDomain,
    return_to: safeReturnTo(returnTo),
    code_verifier: proof?.verifier || null,
  })
  if (error) return json({ error: error.message }, 500)

  const callback = env('CATALOG_OAUTH_REDIRECT_URI') ||
    `${env('SUPABASE_URL')}/functions/v1/catalog-oauth-callback`
  let authorizationUrl = ''
  if (provider === 'shopify') {
    const params = new URLSearchParams({
      client_id: env('SHOPIFY_CLIENT_ID'),
      scope: env('SHOPIFY_SCOPES') || 'read_products,write_products,read_inventory,write_inventory,read_orders',
      redirect_uri: callback,
      state,
    })
    authorizationUrl = `https://${shopDomain}/admin/oauth/authorize?${params}`
  } else if (provider === 'tiendanube') {
    authorizationUrl = `https://www.tiendanube.com/apps/${env('TIENDANUBE_CLIENT_ID')}/authorize?state=${encodeURIComponent(state)}`
  } else {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: env('MERCADOLIBRE_CLIENT_ID'),
      redirect_uri: callback,
      state,
      code_challenge: proof!.challenge,
      code_challenge_method: 'S256',
    })
    authorizationUrl = `https://auth.mercadolibre.com.ar/authorization?${params}`
  }
  if (/client_id=&|apps\/\/authorize/.test(authorizationUrl)) {
    return json({ error: `Falta configurar ${providerName(provider)}` })
  }
  return json({ authorizationUrl })
})
