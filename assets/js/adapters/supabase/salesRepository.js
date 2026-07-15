(function () {
  let getClient = null

  function configure(options = {}) {
    getClient = options.getClient || getClient
  }

  function client() {
    const value = getClient?.()
    if (!value) throw new Error('SupabaseSalesRepository: client is not configured')
    return value
  }

  async function registerSale(input = {}) {
    const items = (input.items || []).map(item => ({
      inventory_item_id: item.productId || null,
      producto_texto: item.description || null,
      cantidad: item.quantity,
      precio_unitario: item.unitPrice,
    }))

    const { data, error } = await client().rpc('register_sale_atomic', {
      p_fecha: input.date || null,
      p_cliente: input.customer || null,
      p_medio_pago: input.paymentMethod || null,
      p_monto_recibido: input.receivedAmount ?? 0,
      p_origen: input.origin || 'manual',
      p_notas: input.notes || null,
      p_items: items,
    })

    return { data, error }
  }

  window.KairosSupabaseSalesRepository = { configure, registerSale }
})()
