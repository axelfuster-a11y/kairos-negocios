import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeShop(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Metodo no permitido' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const clientId = Deno.env.get('SHOPIFY_CLIENT_ID') || ''
  const appUrl = Deno.env.get('APP_URL') || ''
  const redirectUri = Deno.env.get('SHOPIFY_REDIRECT_URI') || `${supabaseUrl}/functions/v1/shopify-oauth-callback`
  const scopes = Deno.env.get('SHOPIFY_SCOPES') || 'read_products,write_products,read_inventory,write_inventory,read_orders'

  if (!supabaseUrl || !anonKey || !serviceKey || !clientId) {
    return json({ error: 'Faltan variables de entorno para Shopify OAuth' }, 500)
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
  })
  const { data: userData, error: userError } = await authClient.auth.getUser()
  if (userError || !userData.user) return json({ error: 'Sesion no valida' }, 401)

  const { shop, returnTo } = await req.json().catch(() => ({}))
  const shopDomain = normalizeShop(shop)
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shopDomain)) {
    return json({ error: 'Dominio Shopify no valido' }, 400)
  }

  const state = crypto.randomUUID()
  const safeReturnTo = appUrl && String(returnTo || '').startsWith(appUrl) ? String(returnTo) : appUrl
  const serviceClient = createClient(supabaseUrl, serviceKey)
  const { error: stateError } = await serviceClient.from('shopify_oauth_states').insert({
    state,
    user_id: userData.user.id,
    shop_domain: shopDomain,
    return_to: safeReturnTo,
  })
  if (stateError) return json({ error: stateError.message }, 500)

  const params = new URLSearchParams({
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    state,
  })
  return json({ authorizationUrl: `https://${shopDomain}/admin/oauth/authorize?${params}` })
})
