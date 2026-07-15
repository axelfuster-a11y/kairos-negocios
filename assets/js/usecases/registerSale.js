(function () {
  let salesRepository = null

  function configure(options = {}) {
    salesRepository = options.salesRepository || salesRepository
  }

  function repository() {
    if (!salesRepository || typeof salesRepository.registerSale !== 'function') {
      throw new Error('RegisterSaleUseCase: sales repository is not configured')
    }
    return salesRepository
  }

  async function execute(draft = {}) {
    const validation = window.KairosSalesDomain.validateSaleDraft(draft)
    if (!validation.valid) return { ok: false, errors: validation.errors }

    const preview = window.KairosSalesDomain.calculateSale(
      validation.items,
      draft.receivedAmount ?? draft.monto_recibido ?? 0,
    )

    const result = await repository().registerSale({
      date: draft.date ?? draft.fecha,
      customer: draft.customer ?? draft.cliente,
      paymentMethod: draft.paymentMethod ?? draft.medio_pago,
      receivedAmount: preview.received,
      origin: draft.origin ?? draft.origen ?? 'manual',
      notes: draft.notes ?? draft.notas,
      items: validation.items,
    })

    if (result?.error) return { ok: false, errors: [result.error.message || String(result.error)] }
    return { ok: true, preview, result }
  }

  window.KairosRegisterSaleUseCase = { configure, execute }
})()
