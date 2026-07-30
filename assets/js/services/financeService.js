(function () {
  let getClient = null
  let getUserId = null
  let unifiedFinanceCache = null
  let unifiedFinancePromise = null
  let salesSummaryCache = null
  let salesSummaryPromise = null

  function configure(options = {}) {
    getClient = options.getClient || getClient
    getUserId = options.getUserId || getUserId
  }

  function client() {
    const value = getClient?.()
    if (!value) throw new Error('FinanceService: Supabase client is not configured')
    return value
  }

  function userId() {
    const value = getUserId?.()
    if (!value) throw new Error('FinanceService: user is not available')
    return value
  }

  function financeDateKey(row) {
    return row.fecha || (row.created_at ? String(row.created_at).slice(0, 10) : null)
  }

  function normalizeLegacyMovement(row) {
    return {
      ...row,
      categoria: row.cat || 'sin_categoria',
      fuente: 'histórico',
      sourceTable: 'transacciones'
    }
  }

  function normalizeOperationalMovement(row) {
    return {
      ...row,
      categoria: row.categoria || 'sin_categoria',
      fuente: row.origen === 'manual' ? 'manual' : row.origen === 'bot' ? 'Asesor IA' : row.origen || 'Carga inteligente',
      sourceTable: 'movimientos_financieros'
    }
  }

  function movementHasAmount(row) {
    return Number(row?.monto) > 0
  }

  function movementAmountText(row) {
    if (!movementHasAmount(row)) return 'Sin monto'
    return `${row.tipo === 'ingreso' ? '+' : '-'}$${fmt(row.monto)}`
  }

  function movementTotals(items) {
    const list = (items || []).filter(movementHasAmount)
    const ingresos = list.filter(m => m.tipo === 'ingreso').reduce((a, m) => a + (Number(m.monto) || 0), 0)
    const egresos = list.filter(m => m.tipo === 'egreso').reduce((a, m) => a + (Number(m.monto) || 0), 0)
    return { ingresos, egresos, balance: ingresos - egresos, count: list.length }
  }

  function invalidateUnifiedFinances() {
    unifiedFinanceCache = null
    unifiedFinancePromise = null
  }

  function invalidateSalesSummary() {
    salesSummaryCache = null
    salesSummaryPromise = null
  }

  function getUnifiedFinanceCache() {
    return unifiedFinanceCache
  }

  function getSalesSummaryCache() {
    return salesSummaryCache
  }

  async function loadUnifiedFinances(force = false) {
    if (!force && unifiedFinanceCache) return unifiedFinanceCache
    if (!force && unifiedFinancePromise) return unifiedFinancePromise
    unifiedFinancePromise = (async () => {
      const { m, y } = getMes()
      const monthStart = `${y}-${String(m).padStart(2, '0')}-01`
      const monthEnd = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
      const sb = client()
      const uid = userId()
      const [legacyResult, operationalResult] = await Promise.all([
        sb.from('transacciones').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(5000),
        sb.from('movimientos_financieros').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(5000)
      ])
      if (legacyResult.error) console.error('[Kairós] finanzas históricas:', legacyResult.error)
      if (operationalResult.error) console.error('[Kairós] finanzas operativas:', operationalResult.error)
      if (legacyResult.error && operationalResult.error) throw operationalResult.error
      const all = [
        ...(legacyResult.data || []).map(normalizeLegacyMovement),
        ...(operationalResult.data || []).map(normalizeOperationalMovement)
      ].sort((a, b) => String(b.created_at || b.fecha || '').localeCompare(String(a.created_at || a.fecha || '')))
      const month = all.filter(row => {
        const key = financeDateKey(row)
        return key && key >= monthStart && key < monthEnd
      })
      unifiedFinanceCache = {
        all,
        month,
        recent: all.slice(0, 50),
        totals: movementTotals(month),
        monthStart,
        monthEnd
      }
      return unifiedFinanceCache
    })()
    try {
      return await unifiedFinancePromise
    } finally {
      unifiedFinancePromise = null
    }
  }

  async function loadSalesSummary(force = false) {
    if (!force && salesSummaryCache) return salesSummaryCache
    if (!force && salesSummaryPromise) return salesSummaryPromise
    salesSummaryPromise = (async () => {
      const { m, y } = getMes()
      const monthStart = `${y}-${String(m).padStart(2, '0')}-01`
      const monthEnd = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
      const { data, error } = await client().from('ventas').select('id,fecha,total,monto_recibido,diferencia_cobro,costo_total,ganancia,created_at').eq('user_id', userId()).order('created_at', { ascending: false }).limit(5000)
      if (error) throw error
      const sales = (data || []).filter(sale => {
        const key = sale.fecha || (sale.created_at ? String(sale.created_at).slice(0, 10) : null)
        return key && key >= monthStart && key < monthEnd
      })
      const total = sales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0)
      const received = sales.reduce((sum, sale) => sum + (Number(sale.monto_recibido ?? sale.total) || 0), 0)
      const pending = sales.reduce((sum, sale) => sum + (Number(sale.diferencia_cobro) || 0), 0)
      const salesWithCost = sales.filter(sale => Number(sale.costo_total) > 0)
      const cost = salesWithCost.reduce((sum, sale) => sum + (Number(sale.costo_total) || 0), 0)
      const profit = salesWithCost.reduce((sum, sale) => sum + (Number(sale.ganancia) || 0), 0)
      const marginBase = salesWithCost.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0)
      salesSummaryCache = {
        sales,
        count: sales.length,
        total,
        received,
        pending,
        cost,
        profit,
        marginBase,
        margin: marginBase > 0 ? (profit / marginBase) * 100 : 0
      }
      return salesSummaryCache
    })()
    try {
      return await salesSummaryPromise
    } finally {
      salesSummaryPromise = null
    }
  }

  async function addManualMovement(input) {
    const descripcion = String(input?.descripcion || '').trim()
    const monto = Number(input?.monto) || 0
    const tipo = input?.tipo
    if (!descripcion) return { error: 'Ingrese una descripción' }
    if (monto <= 0) return { error: 'El monto debe ser mayor a 0' }
    if (!['ingreso', 'egreso'].includes(tipo)) return { error: 'Seleccione ingreso o egreso' }
    const { error } = await client().from('movimientos_financieros').insert({
      user_id: userId(),
      tipo,
      descripcion,
      categoria: input?.categoria || 'sin_categoria',
      monto,
      fecha: input?.fecha || today(),
      origen: 'manual'
    })
    if (!error) invalidateUnifiedFinances()
    return { error }
  }

  async function deleteMovement(sourceTable, id) {
    if (!['transacciones', 'movimientos_financieros'].includes(sourceTable)) {
      return { error: new Error('Tabla de movimiento no permitida') }
    }
    const { error } = await client().from(sourceTable).delete().eq('id', id).eq('user_id', userId())
    if (!error) invalidateUnifiedFinances()
    return { error }
  }

  window.KairosFinanceService = {
    configure,
    loadUnifiedFinances,
    loadSalesSummary,
    invalidateUnifiedFinances,
    invalidateSalesSummary,
    normalizeLegacyMovement,
    normalizeOperationalMovement,
    movementHasAmount,
    movementAmountText,
    movementTotals,
    addManualMovement,
    deleteMovement,
    getUnifiedFinanceCache,
    getSalesSummaryCache
  }

  window.movementHasAmount = movementHasAmount
  window.movementAmountText = movementAmountText
})()
