import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync('supabase/migrations/015_catalog_oauth.sql', 'utf8')
const start = readFileSync('supabase/functions/catalog-oauth-start/index.ts', 'utf8')
const callback = readFileSync('supabase/functions/catalog-oauth-callback/index.ts', 'utf8')
const sync = readFileSync('supabase/functions/catalog-sync/index.ts', 'utf8')
const shared = readFileSync('supabase/functions/_shared/catalog.ts', 'utf8')
const app = readFileSync('assets/app.js', 'utf8')
const html = readFileSync('index.html', 'utf8')

for (const provider of ['shopify', 'tiendanube', 'mercadolibre']) {
  assert.match(start, new RegExp(`['"]${provider}['"]`), `OAuth start missing ${provider}`)
  assert.match(callback, new RegExp(`['"]${provider}['"]`), `OAuth callback missing ${provider}`)
  assert.match(sync, new RegExp(`['"]${provider}['"]`), `Catalog sync missing ${provider}`)
  assert.match(html, new RegExp(`data-provider="${provider}"`), `UI missing ${provider}`)
}

assert.match(migration, /catalog_oauth_states/, 'Generic OAuth state table missing')
assert.match(migration, /refresh_token_ciphertext/, 'Refresh-token storage missing')
assert.match(migration, /revoke all on table public\.catalog_connection_secrets/, 'Catalog secrets must not be browser-readable')
assert.match(start, /code_challenge_method:\s*'S256'/, 'Mercado Libre PKCE missing')
assert.match(start, /Falta configurar.*providerName/, 'Missing provider credentials must return a readable result')
assert.match(callback, /verifyShopify/, 'Shopify HMAC validation missing')
assert.match(callback, /saveConnection/, 'OAuth callback must use the guarded connection writer')
assert.match(shared, /AES-GCM/, 'Tokens must be encrypted with authenticated encryption')
assert.match(sync, /variant\.media\.nodes/, 'Shopify must read variant media')
assert.doesNotMatch(sync, /featuredMedia/, 'Product main image must not replace a variant image')
assert.match(sync, /variant\.image_id/, 'Tiendanube variant image relation missing')
assert.match(sync, /variant\.picture_ids/, 'Mercado Libre variant pictures missing')
assert.match(sync, /refreshMercadolibre/, 'Mercado Libre automatic token refresh missing')
assert.match(sync, /catalog_sync_queue/, 'Stock queue processing missing')
assert.match(sync, /pushOnly/, 'Stock-only automatic synchronization missing')
assert.match(app, /uploadProductImages/, 'Product gallery handling missing')
assert.match(app, /syncPendingCatalogStock/, 'Inventory reload must flush pending stock automatically')
assert.match(app, /new Response\(context\?\.body\)\.json/, 'Catalog connection must surface the Edge Function error detail')
assert.match(html, /id="p-img-file"[^>]*multiple/, 'Product image input must accept multiple files')

console.log('Catalog OAuth, variant-image and stock contracts ok')
