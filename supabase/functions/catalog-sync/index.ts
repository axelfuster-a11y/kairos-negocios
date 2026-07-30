import {
  authenticatedUser, corsHeaders, decryptToken, encryptToken, env, json, serviceClient,
} from '../_shared/catalog.ts'

type Connection = {
  id: string
  user_id: string
  provider: 'shopify' | 'tiendanube' | 'mercadolibre'
  external_store_id: string
  config: Record<string, any>
}

type ImportedVariant = {
  productId: string
  variantId: string
  inventoryId?: string | null
  locationId?: string | null
  sku?: string | null
  barcode?: string | null
  product: string
  variant?: string | null
  stock: number
  price: number
  cost?: number | null
  image?: string | null
  images?: string[]
  raw?: Record<string, unknown>
}

async function request(url: string, init: RequestInit = {}) {
  const response = await fetch(url, init)
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body?.message || body?.error_description || body?.error || `${response.status} ${response.statusText}`)
  return { body, headers: response.headers }
}

async function saveImported(connection: Connection, rows: ImportedVariant[]) {
  const service = serviceClient()
  let missingImages = 0
  for (const row of rows) {
    if (!row.image) missingImages++
    const { data, error } = await service.rpc('import_catalog_variant', {
      p_connection_id: connection.id,
      p_external_product_id: row.productId,
      p_external_variant_id: row.variantId || '',
      p_external_inventory_id: row.inventoryId || null,
      p_external_location_id: row.locationId || null,
      p_sku: row.sku || null,
      p_barcode: row.barcode || null,
      p_product_name: row.product,
      p_variant_name: row.variant || null,
      p_stock: Math.max(0, Math.trunc(row.stock || 0)),
      p_price: Math.max(0, Number(row.price || 0)),
      p_cost: row.cost == null ? null : Math.max(0, Number(row.cost)),
      p_image_url: row.image || null,
      p_images: row.image ? [row.image, ...(row.images || []).filter(image => image !== row.image)] : [],
      p_raw_data: { ...(row.raw || {}), variantImageMissing: !row.image },
    })
    if (error) throw error
    await service.from('catalog_item_links').update({
      variant_image_url: row.image || null,
      raw_data: { ...(row.raw || {}), variantImageMissing: !row.image },
    }).eq('id', data.linkId).eq('user_id', connection.user_id)
  }
  return missingImages
}

async function shopifyImport(connection: Connection, token: string) {
  const rows: ImportedVariant[] = []
  let cursor: string | null = null
  do {
    const query = `query KairosVariants($after: String) {
      productVariants(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id title sku barcode price inventoryQuantity
          product { id title }
          inventoryItem { id inventoryLevels(first: 20) { nodes { location { id } quantities(names: ["available"]) { name quantity } } } }
          media(first: 10) { nodes { preview { image { url } } } }
        }
      }
    }`
    const { body } = await request(`https://${connection.external_store_id}/admin/api/2026-07/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
      body: JSON.stringify({ query, variables: { after: cursor } }),
    })
    if (body.errors?.length) throw new Error(body.errors[0].message)
    const page = body.data.productVariants
    for (const variant of page.nodes) {
      const images = variant.media.nodes.map((media: any) => media.preview?.image?.url).filter(Boolean)
      const level = variant.inventoryItem?.inventoryLevels?.nodes?.[0]
      rows.push({
        productId: variant.product.id,
        variantId: variant.id,
        inventoryId: variant.inventoryItem?.id,
        locationId: level?.location?.id,
        sku: variant.sku,
        barcode: variant.barcode,
        product: variant.product.title,
        variant: variant.title === 'Default Title' ? null : variant.title,
        stock: Number(variant.inventoryQuantity || 0),
        price: Number(variant.price || 0),
        image: images[0] || null,
        images,
        raw: { provider: 'shopify' },
      })
    }
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null
  } while (cursor)
  return rows
}

function translated(value: any) {
  if (typeof value === 'string') return value
  return value?.es || value?.pt || value?.en || Object.values(value || {})[0] || ''
}

async function tiendanubeImport(connection: Connection, token: string) {
  const rows: ImportedVariant[] = []
  for (let page = 1; ; page++) {
    const { body, headers } = await request(
      `https://api.tiendanube.com/2025-03/${connection.external_store_id}/products?page=${page}&per_page=200`,
      { headers: { Authentication: `bearer ${token}`, 'User-Agent': env('TIENDANUBE_USER_AGENT') || 'Kairos Negocios' } },
    )
    for (const product of body) {
      const images = new Map<string, string>((product.images || []).map((image: any) => [String(image.id), String(image.src)]))
      for (const variant of product.variants || []) {
        const image = images.get(String(variant.image_id || '')) || null
        rows.push({
          productId: String(product.id),
          variantId: String(variant.id),
          sku: variant.sku,
          barcode: variant.barcode,
          product: translated(product.name),
          variant: (variant.values || []).map(translated).filter(Boolean).join(' / ') || null,
          stock: Number(variant.stock || 0),
          price: Number(variant.price || 0),
          cost: variant.cost == null ? null : Number(variant.cost),
          image,
          images: image ? [image] : [],
          raw: { provider: 'tiendanube', imageId: variant.image_id || null, inventoryLevels: variant.inventory_levels || [] },
        })
      }
    }
    const next = headers.get('link')?.includes('rel="next"')
    if (!next && body.length < 200) break
  }
  return rows
}

function mlSku(attributes: any[] = []) {
  return attributes.find(attribute => ['SELLER_SKU', 'GTIN'].includes(attribute.id))?.value_name || null
}

async function mercadolibreImport(connection: Connection, token: string) {
  const ids: string[] = []
  for (let offset = 0; ; offset += 50) {
    const { body } = await request(`https://api.mercadolibre.com/users/${connection.external_store_id}/items/search?limit=50&offset=${offset}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    ids.push(...(body.results || []))
    if (offset + 50 >= Number(body.paging?.total || 0)) break
  }
  const rows: ImportedVariant[] = []
  for (let start = 0; start < ids.length; start += 20) {
    const { body } = await request(`https://api.mercadolibre.com/items?ids=${ids.slice(start, start + 20).join(',')}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    for (const result of body) {
      if (result.code !== 200) continue
      const item = result.body
      const pictures = new Map((item.pictures || []).map((picture: any) => [String(picture.id), picture.secure_url || picture.url]))
      const variations = item.variations?.length ? item.variations : [{
        id: '', available_quantity: item.available_quantity, price: item.price,
        picture_ids: (item.pictures || []).slice(0, 1).map((picture: any) => picture.id),
        attributes: item.attributes || [],
      }]
      for (const variant of variations) {
        const imageIds = variant.picture_ids || []
        const images = imageIds.map((id: string) => pictures.get(String(id))).filter(Boolean)
        rows.push({
          productId: String(item.id),
          variantId: String(variant.id || ''),
          sku: mlSku([...(variant.attributes || []), ...(item.attributes || [])]),
          barcode: (variant.attributes || []).find((attribute: any) => attribute.id === 'GTIN')?.value_name || null,
          product: item.title,
          variant: (variant.attribute_combinations || []).map((attribute: any) => attribute.value_name).filter(Boolean).join(' / ') || null,
          stock: Number(variant.available_quantity || 0),
          price: Number(variant.price || item.price || 0),
          image: images[0] || null,
          images,
          raw: { provider: 'mercadolibre', categoryId: item.category_id, status: item.status },
        })
      }
    }
  }
  return rows
}

async function refreshMercadolibre(connection: Connection, secret: any) {
  let accessToken = await decryptToken(secret.access_token_ciphertext)
  if (!secret.expires_at || new Date(secret.expires_at).getTime() > Date.now() + 5 * 60 * 1000) return accessToken
  if (!secret.refresh_token_ciphertext) throw new Error('Mercado Libre requiere volver a conectarse')
  const refreshToken = await decryptToken(secret.refresh_token_ciphertext)
  const { body } = await request('https://api.mercadolibre.com/oauth/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token', client_id: env('MERCADOLIBRE_CLIENT_ID'),
      client_secret: env('MERCADOLIBRE_CLIENT_SECRET'), refresh_token: refreshToken,
    }),
  })
  accessToken = body.access_token
  const { error } = await serviceClient().from('catalog_connection_secrets').update({
    access_token_ciphertext: await encryptToken(body.access_token),
    refresh_token_ciphertext: await encryptToken(body.refresh_token),
    expires_at: new Date(Date.now() + Number(body.expires_in) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('connection_id', connection.id)
  if (error) throw error
  return accessToken
}

async function pushPendingStock(connection: Connection, token: string) {
  const service = serviceClient()
  const { data: jobs, error } = await service.from('catalog_sync_queue')
    .select('id,inventory_item_id,desired_stock')
    .eq('connection_id', connection.id).eq('action', 'stock').eq('status', 'pending')
  if (error) throw error
  let pushed = 0
  for (const job of jobs || []) {
    const { data: link } = await service.from('catalog_item_links').select('*')
      .eq('connection_id', connection.id).eq('inventory_item_id', job.inventory_item_id).maybeSingle()
    if (!link) continue
    try {
      if (connection.provider === 'shopify') {
        const query = `mutation KairosStock($input: InventorySetQuantitiesInput!, $key: String!) {
          inventorySetQuantities(input: $input) @idempotent(key: $key) { userErrors { message } }
        }`
        const { body } = await request(`https://${connection.external_store_id}/admin/api/2026-07/graphql.json`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
          body: JSON.stringify({ query, variables: { key: job.id, input: {
            name: 'available', reason: 'correction', referenceDocumentUri: `kairos://stock-job/${job.id}`,
            quantities: [{ inventoryItemId: link.external_inventory_id, locationId: link.external_location_id, quantity: job.desired_stock }],
            ignoreCompareQuantity: true,
          } } }),
        })
        const message = body.data?.inventorySetQuantities?.userErrors?.[0]?.message || body.errors?.[0]?.message
        if (message) throw new Error(message)
      } else if (connection.provider === 'tiendanube') {
        await request(`https://api.tiendanube.com/2025-03/${connection.external_store_id}/products/${link.external_product_id}/variants/${link.external_variant_id}`, {
          method: 'PUT',
          headers: { Authentication: `bearer ${token}`, 'User-Agent': env('TIENDANUBE_USER_AGENT') || 'Kairos Negocios', 'Content-Type': 'application/json' },
          body: JSON.stringify({ stock: job.desired_stock }),
        })
      } else {
        const payload = link.external_variant_id
          ? { variations: [{ id: Number(link.external_variant_id), available_quantity: job.desired_stock }] }
          : { available_quantity: job.desired_stock }
        await request(`https://api.mercadolibre.com/items/${link.external_product_id}`, {
          method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }
      await service.from('catalog_sync_queue').update({ status: 'sent', attempts: 1, last_error: null, updated_at: new Date().toISOString() }).eq('id', job.id)
      pushed++
    } catch (jobError) {
      await service.from('catalog_sync_queue').update({
        status: 'error', attempts: 1,
        last_error: jobError instanceof Error ? jobError.message : String(jobError),
        updated_at: new Date().toISOString(),
      }).eq('id', job.id)
    }
  }
  return pushed
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
  const user = await authenticatedUser(req)
  if (!user) return json({ error: 'Sesión no válida' }, 401)
  const { provider, pushOnly } = await req.json().catch(() => ({}))
  if (!['shopify', 'tiendanube', 'mercadolibre'].includes(provider)) return json({ error: 'Proveedor no válido' }, 400)

  const service = serviceClient()
  const { data: connection } = await service.from('catalog_connections').select('*')
    .eq('user_id', user.id).eq('provider', provider).eq('status', 'connected')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!connection) return json({ error: 'Primero conecte su cuenta' }, 409)
  const { data: secret } = await service.from('catalog_connection_secrets').select('*').eq('connection_id', connection.id).maybeSingle()
  if (!secret) return json({ error: 'La conexión no tiene credenciales válidas' }, 409)

  try {
    const token = provider === 'mercadolibre'
      ? await refreshMercadolibre(connection, secret)
      : await decryptToken(secret.access_token_ciphertext)
    const pushed = await pushPendingStock(connection, token)
    if (pushOnly) return json({ ok: true, provider, stockUpdatesPushed: pushed })
    const rows = provider === 'shopify'
      ? await shopifyImport(connection, token)
      : provider === 'tiendanube'
        ? await tiendanubeImport(connection, token)
        : await mercadolibreImport(connection, token)
    const missingImages = await saveImported(connection, rows)
    await service.from('catalog_connections').update({
      last_sync_at: new Date().toISOString(),
      last_error: missingImages ? `${missingImages} variantes sin imagen propia` : null,
      updated_at: new Date().toISOString(),
    }).eq('id', connection.id).eq('user_id', user.id)
    return json({ ok: true, provider, variants: rows.length, missingImages, stockUpdatesPushed: pushed })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await service.from('catalog_connections').update({ last_error: message, updated_at: new Date().toISOString() })
      .eq('id', connection.id).eq('user_id', user.id)
    return json({ error: message }, 502)
  }
})
