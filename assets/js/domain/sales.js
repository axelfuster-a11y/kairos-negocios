(function () {
  function number(value) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  function normalizeSaleItem(item = {}) {
    const quantity = Math.max(1, Math.trunc(number(item.quantity ?? item.cantidad) || 1))
    const unitPrice = Math.max(0, number(item.unitPrice ?? item.precio_unitario))
    const unitCost = Math.max(0, number(item.unitCost ?? item.costo_unitario))
    return {
      productId: item.productId ?? item.inventory_item_id ?? null,
      description: String(item.description ?? item.producto_texto ?? '').trim(),
      quantity,
      unitPrice,
      unitCost,
      subtotal: quantity * unitPrice,
      costTotal: quantity * unitCost,
    }
  }

  function calculateSale(items = [], receivedAmount = 0) {
    const normalizedItems = items.map(normalizeSaleItem)
    const total = normalizedItems.reduce((sum, item) => sum + item.subtotal, 0)
    const cost = normalizedItems.reduce((sum, item) => sum + item.costTotal, 0)
    const received = Math.min(Math.max(number(receivedAmount), 0), total)
    const pending = Math.max(total - received, 0)
    const profit = total - cost
    const margin = total > 0 ? (profit / total) * 100 : 0
    const paymentStatus = received <= 0 ? 'pendiente' : received < total ? 'parcial' : 'cobrada'

    return {
      items: normalizedItems,
      total,
      cost,
      received,
      pending,
      profit,
      margin,
      paymentStatus,
    }
  }

  function validateSaleDraft(draft = {}) {
    const items = Array.isArray(draft.items) ? draft.items.map(normalizeSaleItem) : []
    const errors = []
    if (!items.length) errors.push('Agregue al menos un producto')
    items.forEach((item, index) => {
      if (!item.productId && !item.description) errors.push(`Falta el producto en la línea ${index + 1}`)
      if (item.unitPrice <= 0) errors.push(`El precio debe ser mayor a 0 en la línea ${index + 1}`)
    })
    return { valid: errors.length === 0, errors, items }
  }

  window.KairosSalesDomain = {
    normalizeSaleItem,
    calculateSale,
    validateSaleDraft,
  }
})()
