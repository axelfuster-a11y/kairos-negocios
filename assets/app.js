// ══════════════════════════════════════
// SUPABASE — SIN API KEY DE IA EN EL FRONTEND
// ══════════════════════════════════════
const SUPA_URL = 'https://kjnhddhuaydschuqtpad.supabase.co'
const SUPA_KEY = 'sb_publishable_HxIuPmu3GUr5NTlWOlQG0w_pr61ITsM'
const { createClient } = supabase
const sb = createClient(SUPA_URL, SUPA_KEY)
window.KairosFinanceService.configure({ getClient: () => sb, getUserId: () => CU?.id })

let CU = null
let activeAppUserId = null
let lastAutoSuggestedPrice = null

// ══════════════════════════════════════
// HELPERS — XSS PROTECTION
// ══════════════════════════════════════
// Helpers puros cargados antes de este archivo:
// assets/js/core/* y assets/js/ui/toast.js.

function handleSupaError(error, context = '') {
  if (!error) return false
  console.error(`[Kairós] Error${context ? ' en ' + context : ''}:`, error)
  toastErr(`Error: ${error.message || 'algo salió mal'}`)
  return true
}

// ══════════════════════════════════════
// AYUDA CONTEXTUAL — SIMPLE Y CONSISTENTE
// ══════════════════════════════════════
const HELP_TEXT_BY_KEY = {
  ingresos: 'Suma de dinero registrado como ingreso. Puede venir de registros manuales, importaciones, ventas confirmadas o acciones del Asesor IA.',
  'ingresos del mes': 'Suma de ingresos registrados dentro del mes actual.',
  'egresos del mes': 'Suma de salidas de dinero registradas dentro del mes actual.',
  egresos: 'Suma de dinero registrado como egreso o pago.',
  balance: 'Diferencia entre ingresos y egresos del período seleccionado.',
  'resultado de caja': 'Ingresos cobrados menos egresos pagados. Mide flujo de dinero, no reemplaza la rentabilidad contable.',
  'ganancia de ventas': 'Ventas confirmadas menos costo de los productos vendidos.',
  margen: 'Porcentaje de ganancia sobre ventas. Fórmula general: ganancia dividida por ventas.',
  'margen de ventas': 'Ganancia de ventas dividida por el total vendido.',
  'gastos fijos': 'Costos que suelen repetirse todos los meses, como alquiler, servicios o abonos.',
  'gastos fijos a cubrir': 'Total mensual de gastos fijos cargados. Sirve como referencia para saber cuánto debe generar el negocio.',
  stock: 'Cantidad disponible de productos. Se compara con el stock mínimo para detectar reposición.',
  inventario: 'Listado de productos, variantes, costos, precios y disponibilidad.',
  'estado del stock': 'Clasificación por stock actual frente al mínimo: rojo, amarillo o verde.',
  'costo estimado de reposicion': 'Unidades faltantes para llegar al stock mínimo multiplicadas por el costo total unitario.',
  'valor a costo': 'Stock disponible multiplicado por el costo total de cada unidad.',
  'valor a venta': 'Stock disponible multiplicado por el precio de venta cargado.',
  roas: 'Retorno de publicidad. Fórmula: ingresos atribuidos a campañas divididos por inversión publicitaria.',
  cac: 'Costo de adquisición de cliente. Fórmula: inversión publicitaria dividida por clientes generados.',
  'ticket promedio': 'Total vendido dividido por la cantidad de ventas confirmadas.',
  'tasa de cierre': 'Ventas cerradas divididas por consultas u oportunidades recibidas.',
  engagement: 'Interacciones promedio divididas por seguidores. Es una referencia de respuesta del público.',
  'personas activas': 'Integrantes marcados como activos dentro del equipo.',
  'costo objetivo mensual': 'Remuneraciones, comisiones y cargas estimadas del equipo activo.',
  'trabajo pagado este mes': 'Pagos por trabajo registrados durante el mes. No incluye retiros por propiedad.',
  'monto agendado': 'Suma orientativa de cobros y pagos pendientes con monto cargado. No impacta Dinero hasta registrarlo.',
  'para hoy': 'Pendientes cuya fecha es hoy o ya venció.',
  pendientes: 'Elementos que todavía no fueron completados ni cancelados.',
  'proximos 7 dias': 'Pendientes con fecha dentro de la próxima semana.',
  preview: 'Vista previa antes de guardar. Permite revisar errores, avisos y destino de cada dato.',
  'estado del sistema': 'Revisión de tablas, funciones y acciones necesarias para operar sin guardar datos incompletos.',
  'historial del asesor ia': 'Acciones preparadas, confirmadas o fallidas por el Asesor IA.',
}

function readableText(el) {
  return String(el?.textContent || '')
    .replace(/!/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function helpKey(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s%$]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function contextualHelp(text, type = 'elemento') {
  const clean = readableText({ textContent: text })
  const key = helpKey(clean)
  if (HELP_TEXT_BY_KEY[key]) return HELP_TEXT_BY_KEY[key]
  for (const [term, info] of Object.entries(HELP_TEXT_BY_KEY)) {
    if (key.includes(term) || term.includes(key)) return info
  }
  if (type === 'seccion') return `Sección ${clean}. Agrupa la información principal y deja los detalles para vistas secundarias.`
  if (type === 'tarjeta') return `Panel ${clean}. Resume datos o acciones relacionadas para tomar una decisión sin revisar toda la tabla.`
  if (type === 'accion') return `${clean}. Abre una vista guiada o una acción relacionada con esta parte del negocio.`
  if (type === 'campo') return `${clean}. Dato usado para guardar, calcular o filtrar esta sección. Si no aplica, puede quedar vacío salvo que esté marcado con *.`
  return `${clean}. Información de referencia para interpretar este punto.`
}

function appendInfoButton(target, info, className = '') {
  if (!target || target.querySelector?.(':scope > .info-dot')) return
  const button = document.createElement('button')
  button.type = 'button'
  button.className = `info-dot ${className}`.trim()
  button.dataset.info = info
  button.textContent = '!'
  button.setAttribute('aria-label', 'Ver explicación')
  button.onclick = event => toggleInfo(event, button)
  target.appendChild(document.createTextNode(' '))
  target.appendChild(button)
}

function enhanceContextHelp() {
  document.querySelectorAll('.page>.ph .pt').forEach(title => {
    const page = title.closest('.page')
    const subtitle = page?.querySelector('.ps')?.textContent || ''
    appendInfoButton(title, `${contextualHelp(readableText(title), 'seccion')} ${subtitle}`.trim(), 'info-dot-section')
  })
  document.querySelectorAll('.card-t').forEach(title => appendInfoButton(title, contextualHelp(readableText(title), 'tarjeta')))
  document.querySelectorAll('.concept .clbl').forEach(title => appendInfoButton(title, contextualHelp(readableText(title), 'tarjeta')))
  document.querySelectorAll('.guided-menu-copy strong').forEach(title => appendInfoButton(title, contextualHelp(readableText(title), 'accion')))
  document.querySelectorAll('.div>span,.kol-t,.profile-stat span').forEach(title => appendInfoButton(title, contextualHelp(readableText(title), 'tarjeta')))
  document.querySelectorAll('.field>label').forEach(label => appendInfoButton(label, contextualHelp(readableText(label), 'campo'), 'info-dot-field'))
  document.querySelectorAll('.mrow .mlbl,.cost-row .lbl').forEach(label => appendInfoButton(label, contextualHelp(readableText(label), 'elemento')))
}

// ══════════════════════════════════════
// AUTH
// ══════════════════════════════════════
async function init() {
  enhanceContextHelp()
  if (await checkRecovery()) return
  const { data: { session } } = await sb.auth.getSession()
  if (session?.user) { CU = session.user; await enterApp() }
  else { document.getElementById('loading').classList.add('hide'); document.getElementById('auth-screen').style.display = 'flex' }
  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) { CU = session.user; await enterApp() }
    else if (event === 'SIGNED_OUT') {
      resetUserScopedState()
      CU = null
      activeAppUserId = null
      document.getElementById('app').classList.remove('on')
      document.getElementById('auth-screen').style.display = 'flex'
    }
  })
}

function swTab(t) {
  document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'))
  document.querySelectorAll('.auth-tab')[t === 'login' ? 0 : 1].classList.add('active')
  document.getElementById('tab-login').style.display = t === 'login' ? 'block' : 'none'
  document.getElementById('tab-reg').style.display = t === 'reg' ? 'block' : 'none'
  document.getElementById('auth-err').style.display = 'none'
  document.getElementById('auth-ok').style.display = 'none'
}

function showAuthErr(m) { const e = document.getElementById('auth-err'); e.textContent = m; e.style.display = 'block'; document.getElementById('auth-ok').style.display = 'none' }
function showAuthOk(m) { const s = document.getElementById('auth-ok'); s.textContent = m; s.style.display = 'block'; document.getElementById('auth-err').style.display = 'none' }

async function doLogin() {
  const email = V('l-email').trim().toLowerCase(), pass = V('l-pass')
  if (!email || !pass) { showAuthErr('Complete todos los campos'); return }
  const btn = document.getElementById('login-btn'); btn.disabled = true; btn.textContent = 'Ingresando...'
  const { error } = await sb.auth.signInWithPassword({ email, password: pass })
  btn.disabled = false; btn.textContent = 'Ingresar a Kairós'
  if (error) showAuthErr(error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos' : error.message)
}

async function doForgotPassword() {
  const email = V('l-email').trim().toLowerCase()
  if (!email) { showAuthErr('Ingrese su email para recuperar la contraseña'); return }
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
  if (error) showAuthErr(error.message)
  else showAuthOk('Se envió un correo electrónico para recuperar la contraseña.')
}

async function doReg() {
  const name = V('r-name').trim(), email = V('r-email').trim().toLowerCase(), pass = V('r-pass')
  if (!name || !email || !pass) { showAuthErr('Complete todos los campos'); return }
  if (pass.length < 6) { showAuthErr('Contraseña mínimo 6 caracteres'); return }
  const btn = document.getElementById('reg-btn'); btn.disabled = true; btn.textContent = 'Creando...'
  const { error } = await sb.auth.signUp({ email, password: pass, options: { data: { name } } })
  btn.disabled = false; btn.textContent = 'Crear cuenta gratis'
  if (error) showAuthErr(error.message)
  else showAuthOk('Cuenta creada. Ya puede ingresar.')
}

async function doLogout() {
  if (!confirm('¿Salir de Kairós?')) return
  resetUserScopedState()
  await sb.auth.signOut()
}

// ══════════════════════════════════════
// ENTRAR A LA APP
// ══════════════════════════════════════
async function enterApp() {
  if (activeAppUserId !== CU.id) resetUserScopedState()
  activeAppUserId = CU.id
  document.getElementById('loading').classList.add('hide')
  document.getElementById('auth-screen').style.display = 'none'
  document.getElementById('app').classList.add('on')
  document.getElementById('tb-user').textContent = CU.email
  document.getElementById('profile-btn').textContent = String(CU.email || '?').slice(0, 1).toUpperCase()
  document.getElementById('tx-f').value = today()
  document.getElementById('team-payment-date').value = today()
  document.getElementById('org-date').value = today()
  document.getElementById('org-month').value = today().slice(0, 7)
  setDashTitle()
  await renderAll()
  const biz = await getBiz()
  setTbBiz(biz)
  await loadCfg()
  if (!biz || !biz.nom) openWiz()
}

// ══════════════════════════════════════
// WIZARD
// ══════════════════════════════════════
function syncWizardChannels(biz = null) {
  const saved = new Set(String(biz?.can || V('b-can') || '').split(',').map(v => normalizeText(v)).filter(Boolean))
  document.querySelectorAll('#w-canales input').forEach(input => {
    const value = normalizeText(input.value)
    input.checked = saved.has(value) || (value === 'local fisico' && saved.has('local físico'))
  })
}
function openWiz() {
  syncWizardChannels()
  document.getElementById('wizard').classList.add('on')
}
function closeWiz() { document.getElementById('wizard').classList.remove('on') }
function setWDot(n) { document.querySelectorAll('.wdot').forEach((d, i) => d.classList.toggle('on', i < n)) }
function wNext(s) {
  if (s === 1) { if (!V('w-nom').trim()) { alert('Ingrese el nombre'); return }; document.getElementById('ws1').classList.remove('on'); document.getElementById('ws2').classList.add('on'); setWDot(2) }
  else { document.getElementById('ws2').classList.remove('on'); document.getElementById('ws3').classList.add('on'); setWDot(3) }
}
function wBack(s) {
  if (s === 2) { document.getElementById('ws2').classList.remove('on'); document.getElementById('ws1').classList.add('on'); setWDot(1) }
  if (s === 3) { document.getElementById('ws3').classList.remove('on'); document.getElementById('ws2').classList.add('on'); setWDot(2) }
}
async function wFinish() {
  const btn = document.getElementById('w-finish-btn'); btn.disabled = true; btn.textContent = 'Guardando...'
  const can = [...document.querySelectorAll('#w-canales input:checked')].map(c => c.value).join(', ')
  const biz = { user_id: CU.id, nom: V('w-nom').trim(), rub: V('w-rub').trim(), cli: V('w-cli').trim(), prec: parseFloat(V('w-precio')) || 0, can, loc: '', prob: '', dif: '', don: '', prod: '' }
  const { error } = await sb.from('negocios').upsert(biz, { onConflict: 'user_id' })
  btn.disabled = false; btn.textContent = 'Ingresar a Kairós'
  if (handleSupaError(error, 'wizard')) return
  setTbBiz(biz); loadBizForm(biz); closeWiz(); toast('Configuración inicial guardada')
}

// ══════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════
function resetPageScroll() {
  document.querySelector('.content')?.scrollTo({ top: 0, left: 0 })
  window.scrollTo({ top: 0, left: 0 })
}

function go(page, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('on'))
  document.querySelectorAll('.ni,.mobile-ni').forEach(n => n.classList.remove('on'))
  const target = document.getElementById('page-' + page)
  if (!target) return
  target.classList.add('on')
  resetPageScroll()
  document.querySelectorAll(`[data-p="${page}"]`).forEach(n => n.classList.add('on'))
  if (['leads', 'org'].includes(page)) document.querySelectorAll('[data-p="people"]').forEach(n => n.classList.add('on'))
  if (page === 'dash') switchDashboardTab('summary')
  if (page === 'fin') { switchFinanceTab('summary'); renderFin(); loadCashSession() }
  if (page === 'sales') renderSales()
  if (page === 'prod') switchProductTab('inv')
  if (page === 'people') loadTeamData()
  if (page === 'org') loadOrganizationData()
  if (['dash', 'fin', 'sales', 'prod', 'import'].includes(page)) loadImportedData()
}
function goPage(p) {
  if (!document.getElementById('page-' + p)) return
  go(p, document.querySelector(`[data-p="${p}"]`))
}

function showSecondaryTool(name) {
  toast(`${name} quedará disponible desde Más herramientas cuando se active esa integración.`)
}

function scrollToImportHistory() {
  setTimeout(() => {
    document.getElementById('bot-actions-tb')?.closest('.card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 80)
}

function switchSectionTab(prefix, tab, tabs) {
  tabs.forEach(name => {
    document.getElementById(`${prefix}-tab-${name}`)?.classList.toggle('on', name === tab)
    document.getElementById(`${prefix}-tab-${name}-btn`)?.classList.toggle('on', name === tab)
  })
}

function switchDashboardTab(tab) {
  switchSectionTab('dash', tab, ['summary', 'imported'])
  if (tab === 'imported') loadImportedData()
}

function switchFinanceTab(tab) {
  switchSectionTab('fin', tab, ['summary', 'movements', 'imported', 'fixed', 'team'])
  if (tab === 'imported') loadImportedData()
  if (tab === 'team') loadTeamData()
}

function toggleAdvanced(id, button) {
  const section = document.getElementById(id)
  if (!section) return
  const open = section.classList.toggle('on')
  if (button) button.textContent = open ? 'Ocultar detalles' : button.dataset.closedLabel || 'Ver detalles'
}

function openAdvanced(id) {
  document.getElementById(id)?.classList.add('on')
}

function showFinanceQuestion(tab) {
  openAdvanced('fin-advanced')
  switchFinanceTab(tab)
  document.getElementById(`fin-tab-${tab}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function goFinanceDetail(tab) {
  goPage('fin')
  showFinanceQuestion(tab)
}

function showProductQuestion(tab, filter = 'all') {
  inventoryViewFilter = filter
  switchProductTab(tab)
  if (tab === 'inv') renderImportedInventory()
  if (tab === 'carga') openAdvanced('prod-advanced')
  document.getElementById(tab === 'carga' ? 'prod-tab-carga-pane' : 'prod-tab-inv-pane')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function clearInventoryFilter() {
  inventoryViewFilter = 'all'
  ;['product-search', 'prod-quick-search', 'product-category-filter', 'product-state-filter', 'product-profit-filter'].forEach(id => {
    const el = document.getElementById(id)
    if (el) el.value = ''
  })
  renderImportedInventory()
}

function syncProductSearch(value) {
  const main = document.getElementById('product-search')
  if (main) main.value = value
  renderImportedInventory()
}

function productMargin(item) {
  const price = Number(item.precio_venta_local || item.precio_venta_web) || 0
  const cost = Number(item.costo_total || item.costo_unitario) || 0
  return price > 0 && cost > 0 ? ((price - cost) / price) * 100 : null
}

function productStateLabel(item) {
  if (Number(item.costo_total || item.costo_unitario) <= 0) return { label: 'Sin costo', cls: 'by' }
  if (Number(item.precio_venta_local || item.precio_venta_web) <= 0) return { label: 'Sin precio', cls: 'by' }
  if (item.estado_stock === 'amarillo') return { label: 'Inventario bajo', cls: 'by' }
  if (item.estado_stock === 'rojo') return { label: 'Crítico', cls: 'br' }
  if (item.estado_stock === 'sin_datos') return { label: 'Sin datos', cls: 'bb' }
  return { label: 'Activo', cls: 'bg' }
}

function updateProductCategoryFilter(rows) {
  const select = document.getElementById('product-category-filter')
  if (!select) return
  const current = select.value
  const categories = [...new Set(rows.map(item => item.categoria).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)))
  select.innerHTML = '<option value="">Categoría</option>' + categories.map(category => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join('')
  if (categories.includes(current)) select.value = current
}

function updateProductSummary(rows) {
  const priced = rows
    .map(productMargin)
    .filter(value => value !== null && Number.isFinite(value))
  const missingCost = rows.filter(item => Number(item.costo_total || item.costo_unitario) <= 0).length
  const missingPrice = rows.filter(item => Number(item.precio_venta_local || item.precio_venta_web) <= 0).length
  S('prod-active-count', rows.length)
  S('prod-avg-margin', priced.length ? `${fmtDec(priced.reduce((sum, value) => sum + value, 0) / priced.length)}%` : '—')
  S('prod-missing-cost', missingCost)
  S('prod-missing-price', missingPrice)
  const diagnosis = document.getElementById('product-diagnosis-text')
  const btn = document.getElementById('product-diagnosis-btn')
  if (diagnosis) {
    if (!rows.length) diagnosis.textContent = 'Todavía no hay productos cargados. Cree el primer producto para empezar a medir precios, costos e inventario.'
    else if (missingCost || missingPrice) diagnosis.textContent = 'Hay productos que no pueden calcular rentabilidad porque faltan datos de costo o precio. Complete esa información para obtener un análisis más preciso.'
    else diagnosis.textContent = 'Todos los productos tienen costo y precio de venta cargados. Revise inventario bajo y margen antes de comprar o publicar más.'
  }
  if (btn) btn.textContent = (missingCost || missingPrice) ? 'Completar datos pendientes' : rows.length ? 'Revisar inventario y márgenes' : 'Crear producto'
}

function exportProducts() {
  const rows = importedData.inventory || []
  if (!rows.length) { toastErr('No hay productos para exportar'); return }
  const headers = ['Producto', 'SKU', 'Categoría', 'Costo', 'Precio de venta', 'Margen', 'Inventario', 'Estado']
  const csvRows = rows.map(item => {
    const margin = productMargin(item)
    const state = productStateLabel(item).label
    return [
      item.producto || '',
      item.sku || '',
      item.categoria || '',
      Number(item.costo_total || item.costo_unitario) || '',
      Number(item.precio_venta_local || item.precio_venta_web) || '',
      margin === null ? '' : fmtDec(margin) + '%',
      item.stock_actual ?? '',
      state
    ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')
  })
  const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `productos-kairos-${today()}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function openAIWithBusinessSummary() {
  openAI()
  const input = document.getElementById('ai-inp')
  input.value = '¿Cómo está mi negocio y qué me conviene hacer ahora?'
  input.focus()
  input.setSelectionRange(0, input.value.length)
}

function toggleInfo(event, button) {
  event.stopPropagation()
  document.querySelectorAll('.info-dot.on,.metric-help.on').forEach(el => { if (el !== button) el.classList.remove('on') })
  button.classList.toggle('on')
}

function toggleMobileMore() {
  const more = document.querySelector('.mobile-more')
  if (more) more.open = !more.open
}

document.addEventListener('click', event => {
  if (!event.target.closest('.info-dot,.metric-help')) document.querySelectorAll('.info-dot.on,.metric-help.on').forEach(el => el.classList.remove('on'))
})

function startDashboardAction(action) {
  if (action === 'venta') {
    openAI()
    const input = document.getElementById('ai-inp')
    input.value = 'Registrar venta: '
    input.setSelectionRange(input.value.length, input.value.length)
    return
  }
  if (action === 'gasto') {
    goPage('fin')
    showFinanceQuestion('movements')
    document.getElementById('tx-t').value = 'egreso'
    document.getElementById('tx-d').focus()
    return
  }
  if (action === 'compra') {
    openAI()
    const input = document.getElementById('ai-inp')
    input.value = 'Registrar compra: '
    input.setSelectionRange(input.value.length, input.value.length)
    return
  }
  if (action === 'producto') {
    goPage('prod')
    showProductQuestion('carga')
    document.getElementById('p-n').focus()
  }
}

function iconSvg(name) {
  return `<svg class="app-icon"><use href="#i-${name}"></use></svg>`
}

function seedAIExample(text) {
  openAI()
  const input = document.getElementById('ai-inp')
  input.value = text
  input.focus()
  input.setSelectionRange(0, input.value.length)
}

function openProductAIHelp() {
  openAI()
  appendAIMessage('Para crear un producto indique nombre, stock, costo y precio. También puede agregar categoría, color o medida. Se mostrará una vista previa antes de guardar.', 'bot')
  const input = document.getElementById('ai-inp')
  input.value = 'agregar producto '
  input.focus()
  input.setSelectionRange(input.value.length, input.value.length)
}

// ══════════════════════════════════════
// NEGOCIO
// ══════════════════════════════════════
async function getBiz() {
  const { data, error } = await sb.from('negocios').select('*').eq('user_id', CU.id).single()
  if (error && error.code !== 'PGRST116') console.error('[Kairós] getBiz:', error)
  return data
}

let bizTimer = null
async function saveBiz(force = false) {
  const biz = { user_id: CU.id, nom: V('b-nom'), rub: V('b-rub'), loc: V('b-loc'), can: V('b-can'), prob: V('b-prob'), dif: V('b-dif'), cli: V('b-cli'), don: V('b-don'), prod: V('b-prod'), prec: parseFloat(V('b-prec')) || 0 }
  setTbBiz(biz)
  const doSave = async () => {
    const { error } = await sb.from('negocios').upsert(biz, { onConflict: 'user_id' })
    if (handleSupaError(error, 'saveBiz')) return
    if (force) toast('Negocio guardado')
  }
  if (force) { await doSave() } else { clearTimeout(bizTimer); bizTimer = setTimeout(doSave, 1500) }
}

function loadBizForm(b) {
  if (!b) return
  ;[['b-nom', 'nom'], ['b-rub', 'rub'], ['b-loc', 'loc'], ['b-can', 'can'], ['b-prob', 'prob'], ['b-dif', 'dif'], ['b-cli', 'cli'], ['b-don', 'don'], ['b-prod', 'prod'], ['b-prec', 'prec']].forEach(([id, k]) => { const e = document.getElementById(id); if (e) e.value = b[k] || '' })
  syncWizardChannels(b)
  setTbBiz(b)
}

function setTbBiz(b) {
  document.getElementById('tb-biz').innerHTML = b?.nom
    ? `<strong>${escapeHTML(b.nom)}</strong>${b.rub ? ' · ' + escapeHTML(b.rub) : ''}`
    : '<span style="color:var(--txt3)">Sin negocio configurado</span>'
  S('home-business-name', b?.nom || 'Mi negocio')
}

async function openProfile() {
  const modal = document.getElementById('profile-ov')
  modal.classList.add('on')
  document.getElementById('profile-email').textContent = CU?.email || '—'
  document.getElementById('profile-created').textContent = CU?.created_at ? new Date(CU.created_at).toLocaleDateString('es-AR') : '—'
  document.getElementById('profile-business').textContent = 'Cargando...'
  try {
    const [biz, leadResult, finance] = await Promise.all([
      getBiz(),
      sb.from('leads').select('id', { count: 'exact', head: true }).eq('user_id', CU.id).neq('estado', 'cliente'),
      loadUnifiedFinances(),
      loadImportedData()
    ])
    if (leadResult.error) throw leadResult.error
    document.getElementById('profile-business').textContent = biz?.nom || 'Sin configurar'
    document.getElementById('profile-category').textContent = biz?.rub || '—'
    document.getElementById('profile-products').textContent = importedData.inventory.length
    document.getElementById('profile-movements').textContent = finance.recent.length
    document.getElementById('profile-leads').textContent = leadResult.count || 0
    const parts = [
      biz?.nom ? `${biz.nom}${biz.rub ? ` es un negocio de ${biz.rub}` : ''}.` : 'El nombre del negocio aún no está configurado.',
      biz?.cli ? `Cliente principal: ${biz.cli}.` : '',
      biz?.can ? `Canales: ${biz.can}.` : '',
      importedData.inventory.length ? `${importedData.inventory.length} productos en inventario.` : 'Sin productos en el inventario nuevo.'
    ].filter(Boolean)
    document.getElementById('profile-summary-text').textContent = parts.join(' ')
  } catch (error) {
    console.error('[Kairós] openProfile:', error)
    document.getElementById('profile-summary-text').textContent = 'No se pudo cargar el resumen. Intente nuevamente.'
  }
  await loadShopifyConnection()
}

function closeProfile() {
  document.getElementById('profile-ov').classList.remove('on')
}

const KAIROS_EXPORT_VERSION = 1
const KAIROS_EXPORT_TABLES = [
  { name: 'negocios', mode: 'upsert' },
  { name: 'configuracion_costos', mode: 'upsert' },
  { name: 'movimientos_financieros' },
  { name: 'inventario_items' },
  { name: 'ventas' },
  { name: 'venta_items' },
  { name: 'stock_movements' },
  { name: 'inventory_aliases' },
  { name: 'bot_actions' },
  { name: 'import_batches' },
  { name: 'import_rows' },
  { name: 'organization_items' },
  { name: 'team_members' },
  { name: 'team_settings', mode: 'upsert' },
  { name: 'team_payments' },
  { name: 'leads' },
  { name: 'campanas' },
  { name: 'contenido' },
  { name: 'referentes' },
  { name: 'gastos_fijos' },
  { name: 'transacciones' },
  { name: 'productos' },
  { name: 'angulos' },
]
const KAIROS_IMPORT_ORDER = [
  'negocios', 'configuracion_costos', 'inventario_items', 'movimientos_financieros', 'ventas',
  'venta_items', 'stock_movements', 'inventory_aliases', 'bot_actions', 'import_batches',
  'import_rows', 'organization_items', 'team_members', 'team_settings', 'team_payments',
  'leads', 'campanas', 'contenido', 'referentes', 'gastos_fijos', 'transacciones', 'productos', 'angulos'
]
let pendingKairosImport = null

function missingExportTable(error) {
  const msg = String(error?.message || '').toLowerCase()
  return error?.code === '42P01' || msg.includes('does not exist') || msg.includes('could not find the table')
}

function exportFileName(businessName) {
  const clean = String(businessName || 'cuenta')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'cuenta'
  return `kairos-${clean}-${today()}.json`
}

async function exportKairosAccount() {
  if (!CU) return
  const btnText = 'Exportar cuenta'
  const warnings = []
  const tables = {}
  let businessName = ''
  for (const table of KAIROS_EXPORT_TABLES) {
    const { data, error } = await sb.from(table.name).select('*').eq('user_id', CU.id)
    if (error) {
      if (missingExportTable(error)) warnings.push(`${table.name}: tabla no disponible`)
      else warnings.push(`${table.name}: ${error.message}`)
      tables[table.name] = []
      continue
    }
    tables[table.name] = data || []
    if (table.name === 'negocios') businessName = data?.[0]?.nom || ''
  }
  const payload = {
    app: 'kairos-negocios',
    version: KAIROS_EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    source_user: { email: CU.email || null },
    warnings,
    tables,
    excluded: ['shopify_connection_secrets', 'shopify_oauth_states', 'tokens y credenciales externas']
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = exportFileName(businessName)
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  toast(warnings.length ? `Cuenta exportada con ${warnings.length} aviso${warnings.length === 1 ? '' : 's'}` : 'Cuenta exportada')
  const btn = [...document.querySelectorAll('button')].find(b => b.textContent === btnText)
  if (btn) btn.blur()
}

function kairosImportCounts(payload) {
  const tables = payload?.tables || {}
  return KAIROS_EXPORT_TABLES
    .map(t => [t.name, Array.isArray(tables[t.name]) ? tables[t.name].length : 0])
    .filter(([, count]) => count > 0)
}

async function previewKairosImport(event) {
  const file = event?.target?.files?.[0]
  const box = document.getElementById('kairos-import-preview')
  pendingKairosImport = null
  if (!file || !box) return
  try {
    const payload = JSON.parse(await file.text())
    if (payload?.app !== 'kairos-negocios' || !payload?.tables) throw new Error('El archivo no corresponde a una exportación de Kairós')
    const counts = kairosImportCounts(payload)
    pendingKairosImport = payload
    const total = counts.reduce((sum, [, count]) => sum + count, 0)
    box.classList.add('on')
    box.innerHTML = `
      <strong>Vista previa de importación</strong>
      <div>Archivo: ${escapeHTML(file.name)}</div>
      <div>Registros detectados: ${total}</div>
      <div>Los datos se copiaran al usuario actual. No se importan tokens ni credenciales externas.</div>
      <ul>${counts.slice(0, 12).map(([name, count]) => `<li>${escapeHTML(name)}: ${count}</li>`).join('')}${counts.length > 12 ? `<li>y ${counts.length - 12} tabla${counts.length - 12 === 1 ? '' : 's'} más</li>` : ''}</ul>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button class="btn btn-gold btn-sm" onclick="confirmKairosImport()">Importar datos</button>
        <button class="btn btn-ghost btn-sm" onclick="cancelKairosImport()">Cancelar</button>
      </div>`
  } catch (error) {
    box.classList.add('on')
    box.innerHTML = `<strong>No se pudo leer el archivo</strong><div>${escapeHTML(error.message || 'Archivo inválido')}</div>`
  }
}

function cancelKairosImport() {
  pendingKairosImport = null
  const input = document.getElementById('kairos-import-file')
  const box = document.getElementById('kairos-import-preview')
  if (input) input.value = ''
  if (box) { box.classList.remove('on'); box.innerHTML = '' }
}

function remapKairosRow(table, row, idMaps) {
  const copy = { ...row, user_id: CU.id }
  if (copy.id) copy.id = idMaps[table]?.[copy.id] || crypto.randomUUID()
  if (copy.venta_id) copy.venta_id = idMaps.ventas?.[copy.venta_id] || copy.venta_id
  if (copy.inventory_item_id) copy.inventory_item_id = idMaps.inventario_items?.[copy.inventory_item_id] || copy.inventory_item_id
  if (copy.batch_id) copy.batch_id = idMaps.import_batches?.[copy.batch_id] || copy.batch_id
  if (copy.team_member_id) copy.team_member_id = idMaps.team_members?.[copy.team_member_id] || copy.team_member_id
  if (copy.movimiento_financiero_id) copy.movimiento_financiero_id = idMaps.movimientos_financieros?.[copy.movimiento_financiero_id] || copy.movimiento_financiero_id
  if (copy.referencia_id) copy.referencia_id = idMaps.ventas?.[copy.referencia_id] || idMaps.movimientos_financieros?.[copy.referencia_id] || copy.referencia_id
  return copy
}

async function confirmKairosImport() {
  if (!pendingKairosImport || !CU) return
  if (!confirm('¿Importar estos datos en la cuenta actual? Esta acción agregará registros y actualizará configuraciones principales.')) return
  const tables = pendingKairosImport.tables || {}
  const idMaps = {}
  for (const table of KAIROS_EXPORT_TABLES) {
    const rows = Array.isArray(tables[table.name]) ? tables[table.name] : []
    idMaps[table.name] = {}
    rows.forEach(row => { if (row?.id) idMaps[table.name][row.id] = crypto.randomUUID() })
  }
  const errors = []
  for (const tableName of KAIROS_IMPORT_ORDER) {
    const config = KAIROS_EXPORT_TABLES.find(t => t.name === tableName) || {}
    const rows = Array.isArray(tables[tableName]) ? tables[tableName] : []
    if (!rows.length) continue
    const mapped = rows.map(row => remapKairosRow(tableName, row, idMaps))
    const query = config.mode === 'upsert'
      ? sb.from(tableName).upsert(mapped.map(row => ({ ...row, user_id: CU.id, id: undefined })), { onConflict: 'user_id' })
      : sb.from(tableName).insert(mapped)
    const { error } = await query
    if (error) errors.push(`${tableName}: ${error.message}`)
  }
  cancelKairosImport()
  await Promise.all([loadImportedData(), renderDash(), renderFin(), renderSales(), renderProds(), renderMet()])
  if (errors.length) {
    console.error('[Kairós] Importación parcial:', errors)
    toastErr(`Importación parcial: ${errors.length} tabla${errors.length === 1 ? '' : 's'} con error`)
  } else {
    toast('Datos importados')
  }
}

function normalizeShopifyDomain(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
}

async function loadShopifyConnection() {
  const status = document.getElementById('shopify-status-text')
  const btn = document.getElementById('shopify-connect-btn')
  if (!status || !btn || !CU) return
  status.textContent = 'Revisando conexión...'
  const { data, error } = await sb.from('shopify_connections')
    .select('shop_domain,status,connected_at,last_sync_at')
    .eq('user_id', CU.id)
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    status.textContent = 'La conexión con Shopify todavía no está disponible en esta cuenta.'
    btn.textContent = 'Conectar Shopify'
    return
  }
  if (!data) {
    status.textContent = 'Sin conexión activa.'
    btn.textContent = 'Conectar Shopify'
    return
  }
  const syncText = data.last_sync_at ? ` Última sincronización: ${new Date(data.last_sync_at).toLocaleDateString('es-AR')}.` : ''
  status.textContent = `${data.shop_domain} - ${data.status === 'connected' ? 'conectado' : data.status}.${syncText}`
  btn.textContent = 'Reconectar Shopify'
}

async function connectShopify() {
  const raw = V('shopify-domain-input')
  const shop = normalizeShopifyDomain(raw)
  if (!shop) { toastErr('Ingrese el dominio de Shopify'); return }
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) {
    toastErr('Ingrese un dominio valido de Shopify, por ejemplo tienda.myshopify.com')
    return
  }
  const btn = document.getElementById('shopify-connect-btn')
  if (btn) btn.disabled = true
  try {
    const { data, error } = await sb.functions.invoke('shopify-oauth-start', {
      body: { shop, returnTo: window.location.href }
    })
    if (error) throw error
    if (!data?.authorizationUrl) throw new Error('No se recibió la URL de autorización')
    window.location.href = data.authorizationUrl
  } catch (error) {
    console.error('[Kairós] connectShopify:', error)
    toastErr(error.message || 'No se pudo iniciar la conexión con Shopify')
    if (btn) btn.disabled = false
  }
}

function setDashTitle() {
  const name = String(CU?.user_metadata?.name || '').trim().split(/\s+/)[0]
  S('dash-title', name ? `Hola, ${name}` : 'Hola')
}

// ══════════════════════════════════════
// CONFIGURACIÓN DE COSTOS
// ══════════════════════════════════════
let cfgTimer = null
async function saveCfg() {
  clearTimeout(cfgTimer)
  cfgTimer = setTimeout(async () => {
    const cfg = {
      user_id: CU.id,
      packaging_default: numOrDefault('cfg-pkg'),
      envio_default: numOrDefault('cfg-env'),
      comision_plataforma_default_pct: numOrDefault('cfg-cplat'),
      comision_pago_default_pct: numOrDefault('cfg-cpago'),
      impuestos_default_pct: numOrDefault('cfg-imp'),
      descuento_default_pct: numOrDefault('cfg-desc'),
      margen_deseado_default_pct: numOrDefault('cfg-mar', 30),
    }
    const { error } = await sb.from('configuracion_costos').upsert(cfg, { onConflict: 'user_id' })
    if (!handleSupaError(error, 'saveCfg')) calcCosto()
  }, 1000)
}

async function loadCfg() {
  const { data, error } = await sb.from('configuracion_costos').select('*').eq('user_id', CU.id).single()
  if (error && error.code !== 'PGRST116') return
  if (!data) return
  const map = [['cfg-pkg','packaging_default'],['cfg-env','envio_default'],['cfg-cplat','comision_plataforma_default_pct'],['cfg-cpago','comision_pago_default_pct'],['cfg-imp','impuestos_default_pct'],['cfg-desc','descuento_default_pct'],['cfg-mar','margen_deseado_default_pct']]
  map.forEach(([id, k]) => { const e = document.getElementById(id); if (e && data[k] !== undefined) e.value = data[k] })
  // Pre-llenar campos del producto con defaults
  prefillProdFromCfg(data)
}

function prefillProdFromCfg(cfg) {
  if (!cfg) return
  const map = [['p-pkg','packaging_default'],['p-env','envio_default'],['p-cplat','comision_plataforma_default_pct'],['p-cpago','comision_pago_default_pct'],['p-imp','impuestos_default_pct'],['p-desc','descuento_default_pct'],['p-mar','margen_deseado_default_pct']]
  map.forEach(([id, k]) => { const e = document.getElementById(id); if (e && (e.value === '' || e.value === '0') && cfg[k] !== undefined && cfg[k] !== null) e.value = cfg[k] })
}

// ══════════════════════════════════════
// MOTOR DE COSTOS
// ══════════════════════════════════════
function calcCosto() {
  /*
   * Motor de costos:
   * - Costo base = producto + packaging + envio absorbido por el negocio.
   * - Comisiones, impuestos y descuentos se calculan sobre el precio de venta.
   * - Precio minimo rentable = costo base / (1 - porcentajes variables).
   * - Precio sugerido incorpora el margen deseado configurado.
   * - Ganancia bruta = precio elegido - costo base - costos variables.
   * - Margen real = ganancia bruta / precio elegido * 100.
   */
  const co = numOrDefault('p-co')
  const pkg = numOrDefault('p-pkg')
  const env = numOrDefault('p-env')
  const envp = V('p-envp')
  const cplat = numOrDefault('p-cplat') / 100
  const cpago = numOrDefault('p-cpago') / 100
  const imp = numOrDefault('p-imp') / 100
  const desc = numOrDefault('p-desc') / 100
  const mar = numOrDefault('p-mar', 30) / 100
  const currentPrice = numOrDefault('p-pr')
  const pvManual = lastAutoSuggestedPrice !== null && currentPrice === lastAutoSuggestedPrice ? 0 : currentPrice

  const alert = document.getElementById('p-cost-alert')
  const result = document.getElementById('p-cost-result')

  if (co <= 0) { result.style.display = 'none'; alert.style.display = 'none'; return }

  // Envío absorbido
  let envAbs = 0
  if (envp === 'negocio') envAbs = env
  else if (envp === 'mixto') envAbs = env * 0.5

  const costoBase = co + pkg + envAbs
  const pctTotal = cplat + cpago + imp + desc

  // Validaciones de porcentajes
  if (pctTotal >= 1) {
    alert.className = 'cost-alert red'; alert.style.display = 'block'
    alert.textContent = 'Las comisiones y descuentos superan el 100%. Revise los porcentajes.'
    result.style.display = 'none'; return
  }
  if (pctTotal + mar >= 1) {
    alert.className = 'cost-alert red'; alert.style.display = 'block'
    alert.textContent = 'El margen deseado no es posible con estos costos y comisiones.'
    result.style.display = 'none'; return
  }

  const precioMin = costoBase / (1 - pctTotal)
  const precioSug = costoBase / (1 - pctTotal - mar)
  const pv = pvManual > 0 ? pvManual : precioSug
  const ganancia = pv - costoBase - (pv * pctTotal)
  const margenReal = pv > 0 ? (ganancia / pv) * 100 : 0

  // Mostrar resultados
  result.style.display = 'block'
  S('cr-costo', '$' + fmt(costoBase))
  S('cr-min', '$' + fmt(precioMin))
  S('cr-sug', '$' + fmt(precioSug))
  S('cr-gan', '$' + fmt(ganancia))
  S('cr-mar', fmtDec(margenReal) + '%')
  document.getElementById('cr-mar').style.color = margenReal > 15 ? 'var(--green)' : margenReal > 0 ? 'var(--yel)' : 'var(--red)'
  document.getElementById('cr-gan').style.color = ganancia > 0 ? 'var(--green)' : 'var(--red)'

  // Si el usuario no puso precio manual, sugerir
  if (pvManual <= 0) {
    lastAutoSuggestedPrice = Math.ceil(precioSug)
    document.getElementById('p-pr').value = lastAutoSuggestedPrice
  }

  // Alerta de rentabilidad
  if (pvManual > 0 && pvManual < precioMin) {
    alert.className = 'cost-alert red'; alert.style.display = 'block'
    alert.textContent = 'Este producto pierde dinero con el precio actual. Mínimo rentable: $' + fmt(precioMin)
  } else if (margenReal < 0) {
    alert.className = 'cost-alert red'; alert.style.display = 'block'
    alert.textContent = 'Margen negativo. Cada venta queda por debajo del costo.'
  } else if (margenReal < 15) {
    alert.className = 'cost-alert yel'; alert.style.display = 'block'
    alert.textContent = 'Margen bajo (' + fmtDec(margenReal) + '%). Revise costos o ajuste el precio.'
  } else {
    alert.className = 'cost-alert grn'; alert.style.display = 'block'
    alert.textContent = 'Producto rentable. Margen: ' + fmtDec(margenReal) + '%'
  }

  return { costoBase, precioMin, precioSug, pv: pvManual > 0 ? pvManual : precioSug, ganancia, margenReal }
}

function markManualProductPrice() {
  const currentPrice = numOrDefault('p-pr')
  if (lastAutoSuggestedPrice !== null && currentPrice !== lastAutoSuggestedPrice) lastAutoSuggestedPrice = null
}

// ══════════════════════════════════════
// FINANZAS
// ══════════════════════════════════════
function invalidateUnifiedFinances() { window.KairosFinanceService.invalidateUnifiedFinances() }
function invalidateSalesSummary() { window.KairosFinanceService.invalidateSalesSummary() }

function resetUserScopedState() {
  invalidateUnifiedFinances()
  invalidateSalesSummary()
  importedLoadPromise = null
  importedData = { movements: [], movementsMonth: [], inventory: [], inventoryLatest: [], batches: [], loading: false, error: null }
  importedData.botActions = []
  importedData.inventorySaleIds = new Set()
  teamData = { members: [], payments: [], settings: { reserva_minima: 0, max_pago_duenio_pct: 50 }, available: true }
  organizationData = []
  organizationAvailable = true
  importRows = []
  importSource = 'manual'
  botActionPreview = null
  botActionSurface = 'import'
  inventoryViewFilter = 'all'
  aiH = []
  lastAutoSuggestedPrice = null
  resetAdvisorState()
  closeProfile()
  closeImportedInventoryModal()
  document.getElementById('wizard')?.classList.remove('on')
  document.getElementById('im-preview-card').style.display = 'none'
  document.getElementById('im-bot-preview-card').style.display = 'none'
  document.getElementById('im-summary-card').style.display = 'none'
  setTbBiz(null)
  ;[
    'b-nom', 'b-rub', 'b-loc', 'b-can', 'b-prob', 'b-dif', 'b-cli', 'b-don', 'b-prod', 'b-prec',
    'cfg-pkg', 'cfg-env', 'cfg-cplat', 'cfg-cpago', 'cfg-imp', 'cfg-desc', 'cfg-mar',
    'p-n', 'p-c', 'p-d', 'p-co', 'p-pkg', 'p-env', 'p-cplat', 'p-cpago', 'p-imp', 'p-desc', 'p-mar', 'p-pr', 'p-st', 'p-min'
  ]
    .forEach(id => { const element = document.getElementById(id); if (element) element.value = '' })
}

function financeDateKey(row) {
  return row.fecha || (row.created_at ? String(row.created_at).slice(0, 10) : null)
}

function normalizeLegacyMovement(row) { return window.KairosFinanceService.normalizeLegacyMovement(row) }
function normalizeOperationalMovement(row) { return window.KairosFinanceService.normalizeOperationalMovement(row) }
function movementTotals(items) { return window.KairosFinanceService.movementTotals(items) }
async function loadUnifiedFinances(force = false) { return window.KairosFinanceService.loadUnifiedFinances(force) }
async function loadSalesSummary(force = false) { return window.KairosFinanceService.loadSalesSummary(force) }

function setFinanceOverview({ ing, egr, gan, tf, sales, teamPaid = 0 }) {
  const incomeCount = document.getElementById('f-ing-n')?.textContent || '0 registros'
  const expenseCount = document.getElementById('f-egr-n')?.textContent || '0 registros'
  const coverage = tf > 0 ? Math.min(100, Math.round((ing / tf) * 100)) : 0
  const movementCount = (parseInt(incomeCount, 10) || 0) + (parseInt(expenseCount, 10) || 0)
  const cashMargin = ing > 0 ? Math.round((gan / ing) * 100) : 0
  const fixedGap = Math.max(0, tf - ing)
  S('finance-cash', money(gan))
  S('finance-income', money(ing))
  S('finance-expense', money(egr))
  S('finance-income-note', incomeCount)
  S('finance-expense-note', expenseCount)
  S('finance-fixed-coverage', tf > 0 ? coverage + '%' : 'Sin gastos')
  S('finance-detail-cash', money(gan))
  S('finance-detail-movements', movementCount)
  S('finance-detail-cash-margin', ing > 0 ? cashMargin + '%' : '—')
  S('finance-detail-income', money(ing))
  S('finance-detail-expense', money(egr))
  S('finance-detail-ratio', egr > 0 ? (ing / egr).toFixed(2) + 'x' : '—')
  S('finance-detail-fixed', money(tf))
  S('finance-detail-fixed-covered', tf > 0 ? coverage + '%' : 'Sin gastos')
  S('finance-detail-fixed-gap', money(fixedGap))
  S('finance-detail-sales-profit', money(sales.profit))
  S('finance-detail-sales-count', `${sales.count} venta${sales.count === 1 ? '' : 's'}`)
  S('finance-detail-team-paid', money(teamPaid))
  ;[
    ['finance-cash', gan >= 0 ? 'var(--green)' : 'var(--red)'],
    ['finance-income', 'var(--blue)'],
    ['finance-expense', 'var(--red)'],
    ['finance-fixed-coverage', coverage >= 100 ? 'var(--green)' : coverage >= 60 ? 'var(--yel)' : 'var(--red)'],
    ['finance-detail-cash', gan >= 0 ? 'var(--green)' : 'var(--red)'],
    ['finance-detail-cash-margin', cashMargin >= 20 ? 'var(--green)' : cashMargin >= 0 ? 'var(--yel)' : 'var(--red)'],
    ['finance-detail-fixed-covered', coverage >= 100 ? 'var(--green)' : coverage >= 60 ? 'var(--yel)' : 'var(--red)'],
    ['finance-detail-fixed-gap', fixedGap > 0 ? 'var(--yel)' : 'var(--green)'],
    ['finance-detail-sales-profit', sales.profit >= 0 ? 'var(--green)' : 'var(--red)'],
    ['finance-detail-team-paid', teamPaid > 0 ? 'var(--red)' : 'var(--txt2)']
  ].forEach(([id, color]) => {
    const el = document.getElementById(id)
    if (el) el.style.color = color
  })
  const chart = document.getElementById('finance-chart-bars')
  if (chart) {
    const max = Math.max(ing, egr, Math.abs(gan), tf, 1)
    const bars = [
      { label: 'Dinero ingresado', value: ing, cls: 'income', note: incomeCount },
      { label: 'Dinero gastado', value: egr, cls: 'expense', note: expenseCount },
      { label: 'Resultado del mes', value: gan, cls: gan >= 0 ? 'profit' : 'loss', note: gan >= 0 ? 'Caja positiva' : 'Caja negativa' },
      { label: 'Gastos fijos', value: tf, cls: 'fixed', note: tf > 0 ? `${coverage}% cubierto` : 'Sin configurar' }
    ]
    chart.innerHTML = bars.map(item => {
      const width = Math.max(4, Math.round((Math.abs(item.value) / max) * 100))
      return `<div class="finance-flow-row ${item.cls}">
        <div class="finance-flow-head"><span>${escapeHTML(item.label)}</span><strong>${money(item.value)}</strong></div>
        <div class="finance-flow-track"><div class="finance-flow-fill" style="width:${width}%"></div></div>
        <small>${escapeHTML(item.note)}</small>
      </div>`
    }).join('')
  }
  const diagnosis = document.getElementById('finance-diagnosis')
  if (diagnosis) {
    const fixedCopy = tf > 0 ? `La cobertura de gastos fijos está en ${coverage}%.` : 'Todavía no hay gastos fijos configurados.'
    diagnosis.textContent = !ing && !egr
      ? 'Aún no hay movimientos suficientes para leer la situación financiera. Registre ingresos, egresos y gastos fijos para obtener un análisis más preciso.'
      : gan >= 0
        ? `El resultado de caja es positivo y las ventas aportan ${money(sales.profit)} de ganancia comercial. ${fixedCopy}`
        : `El resultado de caja es negativo. Revise egresos, gastos fijos y margen comercial antes de asumir nuevas obligaciones. ${fixedCopy}`
  }
  const priority = document.getElementById('finance-priority-list')
  if (priority) {
    const actions = []
    if (!ing && !egr) actions.push(['warn', 'Registrar el primer movimiento', 'Agregue ingresos o egresos para iniciar la lectura financiera.', "showFinanceQuestion('movements')"])
    if (gan < 0) actions.push(['bad', 'Revisar egresos', 'El resultado de caja está negativo este mes.', "showFinanceQuestion('movements')"])
    if (tf <= 0) actions.push(['warn', 'Configurar gastos fijos', 'Defina alquiler, servicios y compromisos mensuales.', "showFinanceQuestion('fixed')"])
    else if (coverage < 100) actions.push(['warn', 'Cubrir gastos fijos', `Falta ${money(fixedGap)} para cubrir el mes.`, "showFinanceQuestion('fixed')"])
    if (!sales.count) actions.push(['ok', 'Registrar ventas', 'Conecte las ventas con caja y rentabilidad.', "goPage('sales')"])
    actions.push(['ok', 'Ver detalle del mes', 'Abrir tablas y formularios cuando necesite auditar datos.', "showFinanceQuestion('summary')"])
    priority.innerHTML = actions.slice(0, 3).map(([state, title, text, action]) =>
      `<button onclick="${action}"><span class="dot ${state === 'bad' ? 'bad' : state === 'warn' ? 'warn' : ''}"></span><strong>${escapeHTML(title)}</strong><small>${escapeHTML(text)}</small></button>`
    ).join('')
  }
}

function saleDate(row) {
  return row.fecha || (row.created_at ? String(row.created_at).slice(0, 10) : '—')
}

function saleItemCost(item) {
  return Number(item?.costo_total ?? item?.costo_unitario) || 0
}

function saleItemPrice(item) {
  return Number(item?.precio_venta_local || item?.precio_venta_web) || 0
}

function saleItemLabel(item) {
  return [item?.producto, item?.color, item?.medida].filter(Boolean).join(' ') || item?.producto || ''
}

let posCart = {}
let salesTab = 'history'
let posCategories = new Set()

function switchSalesTab(tab = 'pos') {
  salesTab = ['pos', 'manual', 'history'].includes(tab) ? tab : 'pos'
  document.querySelector('.sales-shell')?.setAttribute('data-sales-tab', salesTab)
  document.querySelectorAll('.sales-tab').forEach(btn => btn.classList.toggle('active', btn.id === `sales-tab-${salesTab}`))
  document.querySelectorAll('.sales-tab-panel').forEach(panel => {
    panel.hidden = panel.dataset.salesPanel !== salesTab
  })
  if (salesTab === 'pos') renderSalesCatalog()
  if (salesTab === 'manual') {
    populateManualSaleProducts()
    updateManualSalePreview()
  }
}

function renderPosCategoryOptions() {
  const wrap = document.getElementById('pos-category-pills')
  if (!wrap) return
  const categories = [...new Set((importedData.inventory || []).map(item => item.categoria).filter(Boolean))].sort()
  posCategories = new Set([...posCategories].filter(cat => categories.includes(cat)))
  const allActive = posCategories.size === 0
  wrap.innerHTML = `<button type="button" class="${allActive ? 'active' : ''}" data-cat="">Todas</button>` + categories.map(cat => {
    const active = posCategories.has(cat) ? 'active' : ''
    return `<button type="button" class="${active}" data-cat="${escapeHTML(cat)}">${escapeHTML(cat)}</button>`
  }).join('')
  wrap.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => togglePosCategory(btn.dataset.cat || '')))
}

function togglePosCategory(category) {
  if (!category) posCategories.clear()
  else if (posCategories.has(category)) posCategories.delete(category)
  else posCategories.add(category)
  renderSalesCatalog()
}

function bindPosControls() {
  const grid = document.getElementById('pos-grid')
  if (grid && !grid.dataset.bound) {
    grid.dataset.bound = '1'
    grid.addEventListener('click', event => {
      const btn = event.target.closest('[data-pos-add]')
      if (btn) addPosItem(btn.dataset.posAdd)
    })
  }
  const cart = document.getElementById('pos-cart')
  if (cart && !cart.dataset.bound) {
    cart.dataset.bound = '1'
    cart.addEventListener('click', event => {
      const btn = event.target.closest('[data-pos-qty]')
      if (btn) changePosQty(btn.dataset.posQty, Number(btn.dataset.delta) || 0)
    })
  }
  const confirm = document.getElementById('pos-confirm-sale')
  if (confirm && !confirm.dataset.bound) {
    confirm.dataset.bound = '1'
    confirm.addEventListener('click', confirmPosSale)
  }
  ;['pos-method', 'pos-received'].forEach(id => {
    const el = document.getElementById(id)
    if (el && !el.dataset.bound) {
      el.dataset.bound = '1'
      el.addEventListener(id === 'pos-method' ? 'change' : 'input', renderPosCart)
    }
  })
}

function posProductRows() {
  const query = V('pos-search').trim().toLowerCase()
  return (importedData.inventory || []).filter(item => {
    const label = saleItemLabel(item)
    const haystack = `${label} ${item.sku || ''} ${item.categoria || ''}`.toLowerCase()
    const matchCategory = !posCategories.size || posCategories.has(item.categoria)
    return matchCategory && (!query || haystack.includes(query))
  })
}

function renderSalesCatalog() {
  bindPosControls()
  renderPosCategoryOptions()
  const grid = document.getElementById('pos-grid')
  if (!grid) return
  const rows = posProductRows()
  if (!rows.length) {
    grid.innerHTML = '<div class="empty" style="padding:14px"><div class="empty-i">.</div>No hay productos que coincidan con la busqueda</div>'
    renderPosCart()
    return
  }
  grid.innerHTML = rows.map(item => {
    const id = item.id
    const label = saleItemLabel(item)
    const price = saleItemPrice(item)
    const stock = Number(item.stock_actual) || 0
    const qty = posCart[id] || 0
    const disabled = !price || stock <= 0
    const badge = !price ? 'Sin precio' : stock <= 0 ? 'Sin inventario' : `${stock} disponibles`
    const image = productImageUrl(item)
    return `<article class="pos-product ${disabled ? 'disabled' : ''}">
      <div class="pos-product-media">${image ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(label || 'Producto')}">` : `<span>${escapeHTML((label || 'P').slice(0, 1).toUpperCase())}</span>`}${qty ? `<strong>${qty}</strong>` : ''}</div>
      <div class="pos-product-body">
        <small>${escapeHTML(item.sku || item.categoria || 'Producto')}</small>
        <h4>${escapeHTML(label || 'Producto sin nombre')}</h4>
        <div><b>${price ? money(price) : 'Sin precio'}</b><em>${escapeHTML(badge)}</em></div>
        <button class="btn btn-ghost btn-sm" ${disabled ? 'disabled' : ''} data-pos-add="${id}">Agregar</button>
      </div>
    </article>`
  }).join('')
  renderPosCart()
}

function getPosCartItems() {
  return Object.entries(posCart).map(([id, cantidad]) => {
    const item = (importedData.inventory || []).find(row => row.id === id)
    return item ? { item, cantidad } : null
  }).filter(Boolean)
}

function addPosItem(id) {
  const item = (importedData.inventory || []).find(row => row.id === id)
  if (!item) return
  const stock = Number(item.stock_actual) || 0
  const next = (posCart[id] || 0) + 1
  if (next > stock) { toastErr(`Inventario insuficiente para ${saleItemLabel(item)}`); return }
  posCart[id] = next
  renderSalesCatalog()
}

function changePosQty(id, delta) {
  const item = (importedData.inventory || []).find(row => row.id === id)
  if (!item) return
  const next = Math.max(0, (posCart[id] || 0) + delta)
  if (next > (Number(item.stock_actual) || 0)) { toastErr(`Inventario insuficiente para ${saleItemLabel(item)}`); return }
  if (next) posCart[id] = next
  else delete posCart[id]
  renderSalesCatalog()
}

function clearPosCart() {
  posCart = {}
  const received = document.getElementById('pos-received')
  if (received) received.value = ''
  renderSalesCatalog()
}

function renderPosCart() {
  const cart = document.getElementById('pos-cart')
  const countEl = document.getElementById('pos-ticket-count')
  const totalEl = document.getElementById('pos-total')
  const noteEl = document.getElementById('pos-note')
  if (!cart) return
  const rows = getPosCartItems()
  const count = rows.reduce((sum, row) => sum + row.cantidad, 0)
  const total = rows.reduce((sum, row) => sum + row.cantidad * saleItemPrice(row.item), 0)
  const received = numOrDefault('pos-received')
  if (countEl) countEl.textContent = count ? `${count} producto${count === 1 ? '' : 's'} seleccionado${count === 1 ? '' : 's'}` : 'Sin productos seleccionados'
  cart.innerHTML = rows.length
    ? rows.map(({ item, cantidad }) => `<div class="pos-cart-row">
        <div><strong>${escapeHTML(saleItemLabel(item))}</strong><small>${money(saleItemPrice(item))} c/u</small></div>
        <div class="pos-qty"><button data-pos-qty="${item.id}" data-delta="-1">-</button><span>${cantidad}</span><button data-pos-qty="${item.id}" data-delta="1">+</button></div>
      </div>`).join('')
    : '<div class="empty" style="padding:14px"><div class="empty-i">.</div>Seleccione productos del catálogo</div>'
  if (totalEl) totalEl.textContent = `Total de venta: ${money(total)}`
  if (noteEl) {
    const method = V('pos-method')
    noteEl.textContent = received > 0 && received !== total
      ? `Finanzas registrara ${money(received)} como importe recibido. Diferencia: ${money(total - received)}.`
      : method === 'mercado_pago'
        ? 'Si Mercado Pago acredita menos que el total vendido, complete el importe recibido antes de confirmar.'
        : 'Use importe recibido solo cuando el dinero acreditado difiera del total vendido.'
  }
}

async function confirmPosSale() {
  const rows = getPosCartItems()
  if (!rows.length) { toastErr('Seleccione al menos un producto'); return }
  const total = rows.reduce((sum, row) => sum + row.cantidad * saleItemPrice(row.item), 0)
  const received = numOrDefault('pos-received')
  const channel = V('pos-channel') || 'local'
  const method = V('pos-method')
  const notes = [`Canal: ${channel}`]
  if (received > 0 && received !== total) notes.push(`Importe recibido: ${money(received)} sobre ${money(total)}`)
  const result = await registerSale({
    fecha: V('pos-date') || today(),
    cliente: V('pos-client').trim(),
    medio_pago: method,
    monto_recibido: received > 0 ? received : null,
    origen: 'pos',
    notas: notes.join('. '),
    items: rows.map(({ item, cantidad }) => ({
      inventory_item_id: item.id,
      producto_texto: saleItemLabel(item),
      cantidad,
      precio_unitario: saleItemPrice(item),
      costo_unitario: saleItemCost(item)
    }))
  })
  if (handleSupaError(result.error, 'confirmPosSale')) return
  clearPosCart()
  ;['pos-client', 'pos-received'].forEach(id => { const el = document.getElementById(id); if (el) el.value = '' })
  await refreshAfterSale()
  toast('Venta confirmada desde el punto de venta')
}

function populateManualSaleProducts() {
  const select = document.getElementById('sale-product')
  if (!select) return
  const current = select.value
  const rows = importedData.inventory || []
  select.innerHTML = '<option value="">Producto manual / sin inventario</option>' + rows.map(item => {
    const stock = Number(item.stock_actual) || 0
    const price = saleItemPrice(item)
    return `<option value="${item.id}">${escapeHTML(saleItemLabel(item))} - ${stock} disp. - ${price ? money(price) : 'sin precio'}</option>`
  }).join('')
  if (current && rows.some(item => item.id === current)) select.value = current
}

function selectedManualSaleProduct() {
  const id = V('sale-product')
  return (importedData.inventory || []).find(item => item.id === id) || null
}

function syncManualSaleProduct() {
  const item = selectedManualSaleProduct()
  const manual = document.getElementById('sale-manual-product')
  const price = document.getElementById('sale-price')
  if (item) {
    if (manual) manual.value = ''
    if (price && !Number(price.value)) price.value = saleItemPrice(item) || ''
  }
  updateManualSalePreview()
}

function updateManualSalePreview() {
  const el = document.getElementById('sale-preview')
  if (!el) return
  const item = selectedManualSaleProduct()
  const qty = Math.max(1, Math.trunc(numOrDefault('sale-qty', 1)))
  const price = numOrDefault('sale-price')
  const total = qty * price
  const cost = item ? qty * saleItemCost(item) : 0
  const product = item ? saleItemLabel(item) : V('sale-manual-product').trim()
  if (!product) {
    el.textContent = 'Seleccione un producto o complete un concepto manual.'
    el.className = 'manual-sale-preview'
    return
  }
  const stock = item ? Number(item.stock_actual) || 0 : null
  const stockNote = item && qty > stock ? ` Atencion: inventario disponible ${stock}.` : ''
  const margin = total > 0 ? ((total - cost) / total) * 100 : 0
  el.textContent = `${qty} x ${product} = ${money(total)}. Ganancia estimada: ${cost ? money(total - cost) + ' (' + fmtDec(margin) + '%)' : 'sin costo asociado'}.${stockNote}`
  el.className = `manual-sale-preview ${stockNote ? 'warn' : total > 0 ? 'good' : ''}`
}

function resetManualSaleForm() {
  ;['sale-product', 'sale-method'].forEach(id => { const el = document.getElementById(id); if (el) el.value = '' })
  ;['sale-price', 'sale-client', 'sale-manual-product'].forEach(id => { const el = document.getElementById(id); if (el) el.value = '' })
  const qty = document.getElementById('sale-qty')
  if (qty) qty.value = 1
  const date = document.getElementById('sale-date')
  if (date) date.value = today()
  updateManualSalePreview()
}

async function refreshAfterSale() {
  invalidateUnifiedFinances()
  invalidateSalesSummary()
  await loadImportedData()
  await Promise.all([renderSales(), renderFin(), renderDash(), renderMet()])
}

async function registerSale(payload) {
  const items = (payload.items || []).map(item => ({
    ...item,
    cantidad: Math.max(1, Math.trunc(Number(item.cantidad) || 1)),
    precio_unitario: Number(item.precio_unitario) || 0,
    costo_unitario: Number(item.costo_unitario) || 0
  }))
  if (!items.length) return { error: 'Agregue al menos un producto' }
  if (items.some(item => !String(item.producto_texto || '').trim() && !item.inventory_item_id)) return { error: 'Falta el producto' }
  if (items.some(item => item.precio_unitario <= 0)) return { error: 'El precio debe ser mayor a 0' }

  const total = items.reduce((sum, item) => sum + item.cantidad * item.precio_unitario, 0)
  const cost = items.reduce((sum, item) => sum + item.cantidad * item.costo_unitario, 0)
  const received = Number(payload.monto_recibido) > 0 ? Number(payload.monto_recibido) : total
  const saleDateValue = payload.fecha || today()
  const notes = [payload.notas || null, received !== total ? `Importe recibido: ${money(received)}. Diferencia de cobro: ${money(total - received)}.` : null].filter(Boolean).join(' ')

  const { data, error } = await sb.rpc('register_sale_atomic', {
    p_fecha: saleDateValue,
    p_cliente: payload.cliente || null,
    p_medio_pago: payload.medio_pago || null,
    p_monto_recibido: received,
    p_origen: payload.origen || 'manual',
    p_notas: notes || null,
    p_items: items.map(item => ({
      inventory_item_id: item.inventory_item_id || null,
      producto_texto: item.producto_texto || null,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      costo_unitario: item.costo_unitario
    }))
  })
  if (error) return { error }
  return {
    saleId: data?.saleId,
    movementId: data?.movementId,
    total: Number(data?.total) || total,
    received: Number(data?.received) || received,
    difference: Number(data?.difference) || Math.max(total - received, 0),
    profit: Number(data?.profit) || (received - cost)
  }
}

async function addManualSale() {
  const item = selectedManualSaleProduct()
  const qty = Math.max(1, Math.trunc(numOrDefault('sale-qty', 1)))
  const price = numOrDefault('sale-price')
  const manualProduct = V('sale-manual-product').trim()
  const productText = item ? saleItemLabel(item) : manualProduct
  if (!productText) { toastErr('Seleccione un producto o escriba un producto manual'); return }
  if (price <= 0) { toastErr('Ingrese un precio mayor a 0'); return }
  const result = await registerSale({
    fecha: V('sale-date') || today(),
    cliente: V('sale-client').trim(),
    medio_pago: V('sale-method'),
    origen: 'manual',
    notas: item ? null : 'Producto sin inventario asociado',
    items: [{
      inventory_item_id: item?.id || null,
      producto_texto: productText,
      cantidad: qty,
      precio_unitario: price,
      costo_unitario: item ? saleItemCost(item) : 0
    }]
  })
  if (handleSupaError(result.error, 'addManualSale')) return
  resetManualSaleForm()
  await refreshAfterSale()
  toast(item ? 'Venta registrada' : 'Venta registrada con advertencia: producto sin inventario')
}

async function focusManualSale() {
  goPage('sales')
  await loadImportedData()
  switchSalesTab('pos')
  populateManualSaleProducts()
  renderSalesCatalog()
  const date = document.getElementById('sale-date')
  if (date && !date.value) date.value = today()
  const posDate = document.getElementById('pos-date')
  if (posDate && !posDate.value) posDate.value = today()
  updateManualSalePreview()
  setTimeout(() => document.getElementById('sale-pos-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
}

async function renderSales() {
  if (!CU) return
  const [sales, finance, rowsResult, itemsResult] = await Promise.all([
    loadSalesSummary(),
    loadUnifiedFinances(),
    sb.from('ventas').select('*').eq('user_id', CU.id).order('fecha', { ascending: false }).limit(80),
    sb.from('venta_items').select('id,cantidad,producto_texto,subtotal,venta_id').eq('user_id', CU.id).limit(5000)
  ])
  if (rowsResult.error) console.error('[Kairós] renderSales ventas:', rowsResult.error)
  if (itemsResult.error) console.error('[Kairós] renderSales venta_items:', itemsResult.error)
  const rows = rowsResult.data || []
  const saleItems = itemsResult.data || []
  const itemCount = saleItems.reduce((sum, item) => sum + (Number(item.cantidad) || 1), 0)
  populateManualSaleProducts()
  renderSalesCatalog()
  switchSalesTab(salesTab)
  const saleDateInput = document.getElementById('sale-date')
  if (saleDateInput && !saleDateInput.value) saleDateInput.value = today()
  const posDateInput = document.getElementById('pos-date')
  if (posDateInput && !posDateInput.value) posDateInput.value = today()
  updateManualSalePreview()
  S('sales-total', money(sales.total))
  S('sales-count', `${sales.count} operaci${sales.count === 1 ? 'ón' : 'ones'}`)
  S('sales-products', itemCount)
  S('sales-profit', money(sales.profit))
  S('sales-margin', fmtDec(sales.margin) + '%')
  const profitEl = document.getElementById('sales-profit')
  const marginEl = document.getElementById('sales-margin')
  if (profitEl) profitEl.style.color = sales.profit >= 0 ? 'var(--green)' : 'var(--red)'
  if (marginEl) marginEl.style.color = sales.margin >= 25 ? 'var(--green)' : sales.margin >= 0 ? 'var(--yel)' : 'var(--red)'
  const table = document.getElementById('sales-tb')
  if (table) {
    table.innerHTML = !rows.length
      ? '<tr><td colspan="7"><div class="empty"><div class="empty-i">·</div>Todavía no hay ventas registradas</div></td></tr>'
      : rows.map(row => {
        const total = Number(row.total) || 0
        const cost = Number(row.costo_total) || 0
        const hasCost = cost > 0
        const profit = hasCost ? (Number(row.ganancia) || (total - cost)) : null
        const margin = hasCost ? (Number(row.margen_pct) || (total > 0 ? (profit / total) * 100 : 0)) : null
        return `<tr>
          <td>${escapeHTML(saleDate(row))}</td>
          <td><strong>${escapeHTML(row.cliente || 'Cliente no informado')}</strong></td>
          <td>${money(total)}</td>
          <td>${cost > 0 ? money(cost) : 'Sin dato'}</td>
          <td style="color:${profit === null ? 'var(--yel)' : profit >= 0 ? 'var(--green)' : 'var(--red)'};font-weight:700">${profit === null ? 'No calculado' : money(profit)}</td>
          <td>${margin === null ? '<span class="badge by">No calculado</span>' : `<span class="badge ${margin >= 25 ? 'bg' : margin >= 0 ? 'by' : 'br'}">${fmtDec(margin)}%</span>`}</td>
          <td><span class="badge bb">${escapeHTML(row.origen || 'manual')}</span><span class="product-sub">${escapeHTML(row.medio_pago || 'Medio sin informar')}</span></td>
        </tr>`
      }).join('')
  }
  const purchaseWords = /compra|proveedor|reposici|mercader|insumo|stock/i
  const purchases = (finance.recent || [])
    .filter(item => item.tipo === 'egreso' && purchaseWords.test(`${item.descripcion || ''} ${item.categoria || ''}`))
    .slice(0, 5)
  const purchasesEl = document.getElementById('sales-purchases')
  if (purchasesEl) {
    purchasesEl.innerHTML = purchases.length
      ? purchases.map(item => `<div class="compact-row"><span class="dot warn"></span><div><strong>${escapeHTML(item.descripcion || 'Compra registrada')}</strong><small>${escapeHTML(financeDateKey(item) || 'Sin fecha')} · ${money(item.monto)}</small></div></div>`).join('')
      : '<div class="empty" style="padding:14px"><div class="empty-i">·</div>No se detectaron compras o reposiciones en los movimientos recientes</div>'
  }
  const rankingEl = document.getElementById('sales-ranking')
  if (rankingEl) {
    const productTotals = new Map()
    saleItems.forEach(item => {
      const key = item.producto_texto || 'Producto sin nombre'
      const current = productTotals.get(key) || { qty: 0, total: 0 }
      current.qty += Number(item.cantidad) || 0
      current.total += Number(item.subtotal) || 0
      productTotals.set(key, current)
    })
    const channelTotals = new Map()
    rows.forEach(row => {
      const key = row.origen || 'manual'
      const current = channelTotals.get(key) || { count: 0, total: 0 }
      current.count += 1
      current.total += Number(row.total) || 0
      channelTotals.set(key, current)
    })
    const topProducts = [...productTotals.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 3)
    const topChannels = [...channelTotals.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 3)
    rankingEl.innerHTML = rows.length
      ? `<div class="compact-section-title">Productos más vendidos</div>${topProducts.map(([name, data]) => `<div class="compact-row"><span class="dot ok"></span><div><strong>${escapeHTML(name)}</strong><small>${data.qty} unidades · ${money(data.total)}</small></div></div>`).join('') || '<div class="empty" style="padding:10px">Sin detalle de productos</div>'}
         <div class="compact-section-title">Canales principales</div>${topChannels.map(([name, data]) => `<div class="compact-row"><span class="dot"></span><div><strong>${escapeHTML(name)}</strong><small>${data.count} ventas · ${money(data.total)}</small></div></div>`).join('')}`
      : '<div class="empty" style="padding:14px"><div class="empty-i">·</div>Sin ventas suficientes</div>'
  }
  const diagnosis = document.getElementById('sales-diagnosis')
  if (diagnosis) {
    diagnosis.textContent = !sales.count
      ? 'Aún no hay ventas confirmadas para analizar. Registre ventas para calcular ganancia, margen y productos vendidos.'
      : sales.margin >= 25
        ? `La operación comercial muestra margen saludable: ${fmtDec(sales.margin)}% sobre ${money(sales.marginBase || sales.total)} con costo conocido. Mantenga actualizados costos y compras para sostener este dato.`
        : `El margen comercial requiere revisión: ${fmtDec(sales.margin)}% sobre ${money(sales.marginBase || sales.total)} con costo conocido. Revise precios, costos y reposición antes de escalar ventas.`
  }
}

async function addTx() {
  const d = V('tx-d').trim(), mo = parseFloat(V('tx-m')) || 0
  if (!d) { toastErr('Ingrese una descripci\u00f3n'); return }
  if (mo <= 0) { toastErr('El monto debe ser mayor a 0'); return }
  const { error } = await window.KairosFinanceService.addManualMovement({
    tipo: V('tx-t'),
    descripcion: d,
    categoria: V('tx-c') || 'sin_categoria',
    monto: mo,
    fecha: V('tx-f') || today()
  })
  if (typeof error === 'string') { toastErr(error); return }
  if (handleSupaError(error, 'addTx')) return
  document.getElementById('tx-d').value = ''; document.getElementById('tx-m').value = ''
  await Promise.all([renderFin(), renderDash(), loadImportedData()]); toast('Movimiento registrado')
}

async function delTx(id) {
  if (!confirm('\u00bfEliminar este movimiento?')) return
  const { error } = await window.KairosFinanceService.deleteMovement('transacciones', id)
  if (handleSupaError(error, 'delTx')) return
  await renderFin(); await renderDash()
}

async function deleteUnifiedMovement(sourceTable, id) {
  const sourceLabel = sourceTable === 'transacciones' ? 'hist\u00f3rico' : 'operativo'
  if (!confirm(`\u00bfEliminar este movimiento ${sourceLabel}?`)) return
  const { error } = await window.KairosFinanceService.deleteMovement(sourceTable, id)
  if (handleSupaError(error, 'deleteUnifiedMovement')) return
  await Promise.all([renderFin(), renderDash(), loadImportedData()])
  toast('Movimiento eliminado')
}

async function addGF() {
  const n = V('gf-n').trim(), m = parseFloat(V('gf-m')) || 0
  if (!n) { toastErr('Ingrese un nombre'); return }
  if (m <= 0) { toastErr('El monto debe ser mayor a 0'); return }
  const { error } = await sb.from('gastos_fijos').insert({ user_id: CU.id, nom: n, mon: m })
  if (handleSupaError(error, 'addGF')) return
  document.getElementById('gf-n').value = ''; document.getElementById('gf-m').value = ''
  await renderFin(); await renderDash(); toast('Gasto fijo agregado')
}

async function delGF(id) {
  if (!confirm('¿Eliminar?')) return
  const { error } = await sb.from('gastos_fijos').delete().eq('id', id).eq('user_id', CU.id)
  if (handleSupaError(error, 'delGF')) return
  await renderFin(); await renderDash()
}

async function renderFin() {
  const { m, y } = getMes()
  const monthStart = `${y}-${String(m).padStart(2, '0')}-01`
  const monthEnd = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  const [finance, sales, fixedResult, teamPaymentsResult] = await Promise.all([
    loadUnifiedFinances(),
    loadSalesSummary(),
    sb.from('gastos_fijos').select('*').eq('user_id', CU.id),
    sb.from('team_payments').select('tipo,monto').eq('user_id', CU.id).gte('fecha', monthStart).lt('fecha', monthEnd)
  ])
  if (fixedResult.error) console.error('[Kairós] renderFin gastos fijos:', fixedResult.error)
  if (teamPaymentsResult.error && !isTeamSchemaMissing(teamPaymentsResult.error)) console.error('[Kairós] renderFin pagos equipo:', teamPaymentsResult.error)
  const all = finance.month
  const allGF = fixedResult.data || []
  const teamPaid = (teamPaymentsResult.data || [])
    .filter(payment => !['retiro_duenio', 'distribucion_utilidad'].includes(payment.tipo))
    .reduce((sum, payment) => sum + (Number(payment.monto) || 0), 0)
  const { ingresos: ing, egresos: egr, balance: gan } = finance.totals
  const mar = ing > 0 ? Math.round((gan / ing) * 100) : 0
  const tf = allGF.reduce((a, b) => a + (Number(b.mon) || 0), 0)
  S('f-ing', '$' + fmt(ing)); S('f-ing-n', all.filter(t => t.tipo === 'ingreso' && movementHasAmount(t)).length + ' registros con monto')
  S('f-egr', '$' + fmt(egr)); S('f-egr-n', all.filter(t => t.tipo === 'egreso' && movementHasAmount(t)).length + ' registros con monto')
  S('f-gan', '$' + fmt(gan)); document.getElementById('f-gan').style.color = gan >= 0 ? 'var(--green)' : 'var(--red)'
  S('f-mar', 'Sobre ingresos: ' + mar + '%'); S('f-eq', '$' + fmt(tf))
  S('f-sales-profit', money(sales.profit))
  S('f-sales-count', `${sales.count} venta${sales.count === 1 ? '' : 's'} · ${money(sales.total)} vendido`)
  S('f-sales-margin', fmtDec(sales.margin) + '%')
  document.getElementById('f-sales-profit').style.color = sales.profit >= 0 ? 'var(--green)' : 'var(--red)'
  document.getElementById('f-sales-margin').style.color = sales.margin >= 25 ? 'var(--green)' : sales.margin >= 0 ? 'var(--yel)' : 'var(--red)'
  const pct = tf > 0 ? Math.min(100, Math.round((ing / tf) * 100)) : 0
  const bar = document.getElementById('f-eq-b'); bar.style.width = pct + '%'; bar.style.background = pct >= 100 ? 'var(--green)' : pct >= 60 ? 'var(--yel)' : 'var(--red)'
  setFinanceOverview({ ing, egr, gan, tf, sales, teamPaid })
  document.getElementById('tx-tb').innerHTML = !finance.recent.length
    ? '<tr><td colspan="7"><div class="empty"><div class="empty-i">·</div>Sin movimientos</div></td></tr>'
    : finance.recent.map(t => `<tr>
        <td>${escapeHTML(t.descripcion)}</td>
        <td>${escapeHTML(t.categoria || 'sin_categoria')}</td>
        <td><span class="badge ${t.tipo === 'ingreso' ? 'bg' : 'br'}">${escapeHTML(t.tipo)}</span></td>
        <td style="font-weight:600;color:${movementHasAmount(t) ? (t.tipo === 'ingreso' ? 'var(--green)' : 'var(--red)') : 'var(--yel)'}">${movementHasAmount(t) ? '$' + fmt(t.monto) : 'Sin monto'}</td>
        <td style="color:var(--txt3)">${escapeHTML(financeDateKey(t) || '—')}</td>
        <td><span class="badge bb">${escapeHTML(t.fuente)}</span></td>
        <td><button class="btn btn-del" onclick="deleteUnifiedMovement('${t.sourceTable}','${t.id}')">✕</button></td>
      </tr>`).join('')
  document.getElementById('gf-lista').innerHTML = !allGF.length
    ? '<div class="empty" style="padding:20px"><div class="empty-i">·</div>Sin gastos fijos</div>'
    : allGF.map(g => `<div class="mrow"><div class="mlbl">${escapeHTML(g.nom)}</div><div style="display:flex;align-items:center;gap:10px"><div class="mval" style="color:var(--red)">$${fmt(g.mon)}</div><button class="btn btn-del" onclick="delGF('${g.id}')">✕</button></div></div>`).join('')
  S('gf-tot', '$' + fmt(tf))
}

// ══════════════════════════════════════
// EQUIPO Y REMUNERACIONES
// ══════════════════════════════════════
let teamData = { members: [], payments: [], settings: { reserva_minima: 0, max_pago_duenio_pct: 50 }, available: true }

function updatePeopleCanvas({ activeCount = 0, totalTarget = 0, totalPaid = 0, cashResult = 0, reserve = 0, ownerSuggested = 0, ownerGap = 0 } = {}) {
  S('people-team-count', activeCount)
  S('people-team-target', money(totalTarget))
  S('people-team-paid', money(totalPaid))
  S('people-cash-result', money(cashResult))
  S('people-reserve-view', money(reserve))
  S('people-owner-suggested', money(ownerSuggested))
  S('people-org-summary', activeCount ? `${activeCount} activo${activeCount === 1 ? '' : 's'}` : 'Ver')
  const paidEl = document.getElementById('people-team-paid')
  const cashEl = document.getElementById('people-cash-result')
  const ownerEl = document.getElementById('people-owner-suggested')
  if (paidEl) paidEl.style.color = totalPaid > 0 ? 'var(--red)' : 'var(--txt2)'
  if (cashEl) cashEl.style.color = cashResult >= 0 ? 'var(--green)' : 'var(--red)'
  if (ownerEl) ownerEl.style.color = ownerSuggested > 0 ? 'var(--gold)' : 'var(--txt2)'
  const diagnosis = document.getElementById('people-team-diagnosis')
  if (diagnosis) {
    diagnosis.textContent = !activeCount
      ? 'Todavía no hay integrantes activos. Agregue responsables para ordenar roles, costos y pagos del equipo.'
      : ownerGap > 0
        ? `Hay ${activeCount} integrante${activeCount === 1 ? '' : 's'} activo${activeCount === 1 ? '' : 's'} y ${money(ownerGap)} de trabajo del dueño pendiente. Revise caja disponible antes de registrar pagos adicionales.`
        : `El equipo tiene ${activeCount} integrante${activeCount === 1 ? '' : 's'} activo${activeCount === 1 ? '' : 's'} y ${money(totalPaid)} pagados este mes. Mantenga actualizada la agenda para evitar tareas sin responsable.`
  }
  const next = document.getElementById('people-next-step')
  if (next) {
    next.textContent = !activeCount
      ? 'Agregue al menos un integrante para calcular costo objetivo, pagos y responsables.'
      : totalPaid <= 0
        ? 'Registre los pagos del mes para comparar trabajo planificado contra trabajo pagado.'
        : 'Revise tareas y vencimientos para distribuir responsabilidades del equipo.'
  }
}

function teamTypeLabel(type) {
  const labels = { duenio: 'Dueño/a', socio: 'Socio/a', empleado: 'Empleado/a', colaborador: 'Colaborador/a' }
  return labels[type] || type || '—'
}

function teamPaymentLabel(type) {
  const labels = {
    sueldo: 'Sueldo',
    honorario: 'Honorario',
    bono: 'Bono',
    comision: 'Comisión',
    retiro_duenio: 'Retiro del dueño',
    distribucion_utilidad: 'Distribución de utilidad',
    otro: 'Otro'
  }
  return labels[type] || type || '—'
}

function syncTeamPaymentTypes() {
  const select = document.getElementById('team-payment-type')
  if (!select) return
  const member = teamData.members.find(item => item.id === V('team-payment-member'))
  const isOwner = member && ['duenio', 'socio'].includes(member.tipo)
  const current = select.value
  const options = [
    ['sueldo', 'Sueldo'],
    ['honorario', 'Honorario'],
    ['bono', 'Bono'],
    ['comision', 'Comisión'],
    ['otro', 'Otro']
  ]
  if (isOwner) {
    options.push(['retiro_duenio', 'Retiro del dueño'])
    options.push(['distribucion_utilidad', 'Distribución de utilidad'])
  }
  select.innerHTML = options.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')
  if (options.some(([value]) => value === current)) select.value = current
}

function isTeamSchemaMissing(error) {
  const message = String(error?.message || '')
  return error?.code === 'PGRST205' || message.includes('team_members') || message.includes('team_payments') || message.includes('team_settings')
}

function setTeamControlsDisabled(disabled) {
  document.querySelectorAll('#fin-tab-team input, #fin-tab-team select, #fin-tab-team button:not(.info-dot)')
    .forEach(control => { control.disabled = disabled })
}

function teamWorkPayments(memberId) {
  return teamData.payments
    .filter(p => p.team_member_id === memberId && !['retiro_duenio', 'distribucion_utilidad'].includes(p.tipo))
    .reduce((sum, p) => sum + (Number(p.monto) || 0), 0)
}

function teamMemberWorkTarget(member, salesTotal = 0) {
  const target = Number(member.remuneracion_objetivo) || 0
  const commission = Math.max(0, Number(salesTotal) || 0) * ((Number(member.comision_pct) || 0) / 100)
  return target + commission
}

function teamMemberEstimatedCost(member, salesTotal = 0) {
  return teamMemberWorkTarget(member, salesTotal) * (1 + (Number(member.cargas_pct) || 0) / 100)
}

async function loadTeamData() {
  if (!CU) return
  const state = document.getElementById('team-state')
  if (state) state.innerHTML = '<div class="empty" style="padding:14px">Cargando equipo...</div>'
  const { m, y } = getMes()
  const monthStart = `${y}-${String(m).padStart(2, '0')}-01`
  const monthEnd = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  const [membersResult, paymentsResult, settingsResult] = await Promise.all([
    sb.from('team_members').select('*').eq('user_id', CU.id).order('activo', { ascending: false }).order('created_at', { ascending: true }),
    sb.from('team_payments').select('*').eq('user_id', CU.id).gte('fecha', monthStart).lt('fecha', monthEnd).order('fecha', { ascending: false }).limit(200),
    sb.from('team_settings').select('*').eq('user_id', CU.id).maybeSingle()
  ])
  const firstError = membersResult.error || paymentsResult.error || settingsResult.error
  if (firstError) {
    teamData.available = false
    setTeamControlsDisabled(true)
    if (state) {
      state.innerHTML = `<div class="concept"><div class="ci">⚠</div><div><div class="clbl">Equipo todavía no está activado en esta base</div><div class="ctxt">${isTeamSchemaMissing(firstError) ? 'Los controles están bloqueados para no perder datos. Aplique <strong>supabase/migrations/004_team_compensation.sql</strong> en Supabase SQL Editor; después vuelva a esta pestaña y seleccione Reintentar.' : escapeHTML(firstError.message || 'No se pudo cargar el equipo.')}</div><button class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="loadTeamData()">Reintentar</button></div></div>`
    }
    if (isTeamSchemaMissing(firstError)) console.warn('[Kairós] Equipo pendiente de migración 004')
    else console.error('[Kairós] loadTeamData:', firstError)
    updatePeopleCanvas()
    return
  }
  teamData.available = true
  setTeamControlsDisabled(false)
  teamData.members = membersResult.data || []
  teamData.payments = paymentsResult.data || []
  teamData.settings = settingsResult.data || { reserva_minima: 0, max_pago_duenio_pct: 50 }
  if (state) state.innerHTML = ''
  await renderTeamData()
}

async function renderTeamData() {
  const active = teamData.members.filter(m => m.activo)
  const [finance, sales] = await Promise.all([loadUnifiedFinances(), loadSalesSummary()])
  const totalTarget = active.reduce((sum, member) => sum + teamMemberEstimatedCost(member, sales.total), 0)
  const totalPaid = teamData.payments
    .filter(payment => !['retiro_duenio', 'distribucion_utilidad'].includes(payment.tipo))
    .reduce((sum, payment) => sum + (Number(payment.monto) || 0), 0)
  const owners = active.filter(member => member.tipo === 'duenio')
  const ownerGap = owners.reduce((sum, owner) => {
    const pending = Math.max(0, teamMemberWorkTarget(owner, sales.total) - teamWorkPayments(owner.id))
    return sum + pending
  }, 0)
  const cashResult = finance.totals.balance
  const reserve = Number(teamData.settings.reserva_minima) || 0
  const cap = (Number(teamData.settings.max_pago_duenio_pct) || 0) / 100
  const cashAvailable = Math.max(0, cashResult - reserve)
  const ownerSuggested = Math.min(ownerGap, cashAvailable * cap)
  updatePeopleCanvas({ activeCount: active.length, totalTarget, totalPaid, cashResult, reserve, ownerSuggested, ownerGap })

  S('team-count', active.length)
  S('team-target', money(totalTarget))
  S('team-paid', money(totalPaid))
  S('team-owner-gap', money(ownerGap))
  S('team-cash-result', money(cashResult))
  S('team-reserve-view', money(reserve))
  S('team-owner-suggested', money(ownerSuggested))
  document.getElementById('team-cash-result').style.color = cashResult >= 0 ? 'var(--green)' : 'var(--red)'
  document.getElementById('team-reserve').value = reserve
  document.getElementById('team-owner-cap').value = Number(teamData.settings.max_pago_duenio_pct) || 0

  const memberSelect = document.getElementById('team-payment-member')
  memberSelect.innerHTML = '<option value="">Seleccione...</option>' + active.map(member => `<option value="${member.id}">${escapeHTML(member.nombre)} · ${escapeHTML(teamTypeLabel(member.tipo))}</option>`).join('')
  syncTeamPaymentTypes()

  const membersTable = document.getElementById('team-members-tb')
  membersTable.innerHTML = !teamData.members.length
    ? '<tr><td colspan="11"><div class="empty"><div class="empty-i">·</div>Sin integrantes</div></td></tr>'
    : teamData.members.map(member => {
      const paid = teamWorkPayments(member.id)
      const target = teamMemberWorkTarget(member, sales.total)
      const pending = Math.max(0, target - paid)
      return `<tr style="${member.activo ? '' : 'opacity:.5'}">
        <td><strong>${escapeHTML(member.nombre)}</strong></td>
        <td>${escapeHTML(teamTypeLabel(member.tipo))}</td>
        <td>${escapeHTML(member.rol || '—')}</td>
        <td>${fmtDec(Number(member.horas_semanales) || 0)}</td>
        <td>${fmtDec(Number(member.comision_pct) || 0)}%</td>
        <td>${fmtDec(Number(member.participacion_pct) || 0)}%</td>
        <td>${money(target)}</td>
        <td>${money(teamMemberEstimatedCost(member, sales.total))}</td>
        <td>${money(paid)}</td>
        <td style="color:${pending > 0 ? 'var(--yel)' : 'var(--green)'}">${money(pending)}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="toggleTeamMember('${member.id}',${member.activo ? 'false' : 'true'})">${member.activo ? 'Desactivar' : 'Activar'}</button></td>
      </tr>`
    }).join('')

  const memberById = new Map(teamData.members.map(member => [member.id, member]))
  document.getElementById('team-payments-tb').innerHTML = !teamData.payments.length
    ? '<tr><td colspan="6"><div class="empty"><div class="empty-i">·</div>Sin pagos registrados</div></td></tr>'
    : teamData.payments.map(payment => `<tr>
        <td>${escapeHTML(payment.fecha || '—')}</td>
        <td>${escapeHTML(memberById.get(payment.team_member_id)?.nombre || '—')}</td>
        <td>${escapeHTML(teamPaymentLabel(payment.tipo))}</td>
        <td style="color:var(--red);font-weight:600">${money(payment.monto)}</td>
        <td>${escapeHTML(payment.medio_pago || '—')}</td>
        <td>${escapeHTML(payment.notas || '—')}</td>
      </tr>`).join('')
}

async function addTeamMember() {
  const nombre = V('team-name').trim()
  if (!nombre) { toastErr('Ingrese el nombre del integrante'); return }
  const payload = {
    user_id: CU.id,
    nombre,
    tipo: V('team-type'),
    rol: V('team-role').trim() || null,
    horas_semanales: numOrDefault('team-hours'),
    remuneracion_objetivo: numOrDefault('team-target-input'),
    cargas_pct: numOrDefault('team-loads'),
    comision_pct: numOrDefault('team-commission'),
    participacion_pct: numOrDefault('team-ownership')
  }
  if ([payload.horas_semanales, payload.remuneracion_objetivo, payload.cargas_pct, payload.comision_pct, payload.participacion_pct].some(value => value < 0)) {
    toastErr('Los valores no pueden ser negativos')
    return
  }
  if (payload.comision_pct > 100) {
    toastErr('La comisión no puede superar 100%')
    return
  }
  const currentOwnership = teamData.members.reduce((sum, member) => sum + (Number(member.participacion_pct) || 0), 0)
  if (currentOwnership + payload.participacion_pct > 100) {
    toastErr(`La participación societaria total no puede superar 100%. Ya cargaste ${fmtDec(currentOwnership)}%.`)
    return
  }
  const { error } = await sb.from('team_members').insert(payload)
  if (handleSupaError(error, 'addTeamMember')) return
  ;['team-name', 'team-role', 'team-hours', 'team-target-input', 'team-loads', 'team-commission', 'team-ownership'].forEach(id => { document.getElementById(id).value = '' })
  await loadTeamData()
  toast('Integrante agregado')
}

async function toggleTeamMember(id, activo) {
  const { error } = await sb.from('team_members').update({ activo }).eq('id', id).eq('user_id', CU.id)
  if (handleSupaError(error, 'toggleTeamMember')) return
  await loadTeamData()
  toast(activo ? 'Integrante activado' : 'Integrante desactivado')
}

async function saveTeamSettings() {
  const reserva = numOrDefault('team-reserve')
  const cap = numOrDefault('team-owner-cap', 50)
  if (reserva < 0 || cap < 0 || cap > 100) { toastErr('Revise la reserva y el porcentaje máximo'); return }
  const { error } = await sb.from('team_settings').upsert({
    user_id: CU.id,
    reserva_minima: reserva,
    max_pago_duenio_pct: cap
  }, { onConflict: 'user_id' })
  if (handleSupaError(error, 'saveTeamSettings')) return
  await loadTeamData()
  toast('Configuración guardada')
}

async function recordTeamPayment() {
  const memberId = V('team-payment-member')
  const amount = numOrDefault('team-payment-amount')
  if (!memberId) { toastErr('Seleccione una persona'); return }
  if (amount <= 0) { toastErr('El monto debe ser mayor a cero'); return }
  const { data, error } = await sb.rpc('record_team_payment', {
    member_id: memberId,
    payment_amount: amount,
    payment_type: V('team-payment-type'),
    payment_date: V('team-payment-date') || today(),
    payment_method: V('team-payment-method').trim() || null,
    payment_notes: V('team-payment-notes').trim() || null
  })
  if (handleSupaError(error, 'recordTeamPayment')) return
  if (!data?.ok) { toastErr(data?.error || 'No se pudo registrar el pago'); return }
  document.getElementById('team-payment-amount').value = ''
  document.getElementById('team-payment-method').value = ''
  document.getElementById('team-payment-notes').value = ''
  invalidateUnifiedFinances()
  await Promise.all([loadTeamData(), renderDash(), renderFin(), renderMet(), loadImportedData()])
  switchFinanceTab('team')
  toast('Pago registrado como egreso')
}

// ══════════════════════════════════════
// ORGANIZACIÓN Y CALENDARIO
// ══════════════════════════════════════
let organizationData = []
let organizationAvailable = true

function isOrganizationSchemaMissing(error) {
  const message = String(error?.message || '')
  return error?.code === 'PGRST205' || message.includes('organization_items')
}

function setOrganizationControlsDisabled(disabled) {
  ;['org-title', 'org-type', 'org-date', 'org-priority', 'org-owner', 'org-amount-input', 'org-notes', 'org-add-btn']
    .forEach(id => { const control = document.getElementById(id); if (control) control.disabled = disabled })
}

async function loadOrganizationData() {
  if (!CU) return
  const state = document.getElementById('org-state')
  if (state) state.innerHTML = '<div class="empty" style="padding:14px">Cargando organización...</div>'
  const { data, error } = await sb.from('organization_items').select('*').eq('user_id', CU.id).order('fecha', { ascending: true }).order('created_at', { ascending: true }).limit(1000)
  if (error) {
    organizationAvailable = false
    organizationData = []
    setOrganizationControlsDisabled(true)
    if (state) {
      state.innerHTML = `<div class="concept"><div class="ci">!</div><div><div class="clbl">Calendario pendiente de activar</div><div class="ctxt">${isOrganizationSchemaMissing(error) ? 'Aplique <strong>supabase/migrations/007_organization_calendar.sql</strong> en Supabase SQL Editor. Hasta entonces esta pantalla queda en modo seguro y no intenta guardar.' : escapeHTML(error.message || 'No se pudo cargar Gestión.')}</div><button class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="loadOrganizationData()">Reintentar</button></div></div>`
    }
    if (!isOrganizationSchemaMissing(error)) console.error('[Kairós] loadOrganizationData:', error)
    renderOrganization()
    return
  }
  organizationAvailable = true
  organizationData = data || []
  setOrganizationControlsDisabled(false)
  if (state) state.innerHTML = ''
  renderOrganization()
}

function organizationDateParts(date) {
  if (!date) return { day: '—', month: 'Sin fecha' }
  const value = new Date(`${date}T12:00:00`)
  return {
    day: String(value.getDate()).padStart(2, '0'),
    month: value.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')
  }
}

function organizationTypeLabel(type) {
  return ({ tarea: 'Tarea', pedido: 'Pedido', entrega: 'Entrega', vencimiento: 'Vencimiento', cobro: 'Cobro', pago: 'Pago', recordatorio: 'Recordatorio' })[type] || type
}

function renderOrganization() {
  const todayKey = today()
  const weekEnd = new Date()
  weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndKey = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, '0')}-${String(weekEnd.getDate()).padStart(2, '0')}`
  const pending = organizationData.filter(item => !['completado', 'cancelado'].includes(item.estado))
  const dueToday = pending.filter(item => item.fecha <= todayKey)
  const nextWeek = pending.filter(item => item.fecha > todayKey && item.fecha <= weekEndKey)
  const amount = pending.filter(item => ['cobro', 'pago'].includes(item.tipo)).reduce((sum, item) => sum + (Number(item.monto) || 0), 0)
  S('org-today', dueToday.length)
  S('org-week', nextWeek.length)
  S('org-pending', pending.length)
  S('org-amount', money(amount))

  const selectedMonth = V('org-month') || todayKey.slice(0, 7)
  const statusFilter = V('org-status-filter') || 'pending'
  const rows = organizationData.filter(item => {
    const monthMatches = String(item.fecha || '').slice(0, 7) === selectedMonth
    const statusMatches = statusFilter === 'all'
      || (statusFilter === 'pending' && !['completado', 'cancelado'].includes(item.estado))
      || (statusFilter === 'done' && item.estado === 'completado')
    return monthMatches && statusMatches
  })
  const list = document.getElementById('org-list')
  if (!list) return
  list.innerHTML = !rows.length
    ? '<div class="empty"><div class="empty-i">OK</div>Sin elementos para este período</div>'
    : rows.map(item => {
      const date = organizationDateParts(item.fecha)
      const done = item.estado === 'completado'
      const late = !done && item.fecha < todayKey
      const priorityBadge = item.prioridad === 'urgente' || late ? 'br' : item.prioridad === 'alta' ? 'by' : 'bb'
      return `<div class="org-item ${done ? 'done' : ''}">
        <div class="org-date"><strong>${date.day}</strong><span>${escapeHTML(date.month)}</span></div>
        <div class="org-copy">
          <strong>${escapeHTML(item.titulo)}</strong>
          <span>${escapeHTML(organizationTypeLabel(item.tipo))} · <span class="badge ${priorityBadge}">${late ? 'vencido' : escapeHTML(item.prioridad)}</span>${item.responsable ? ` · ${escapeHTML(item.responsable)}` : ''}${Number(item.monto) > 0 ? ` · ${money(item.monto)}` : ''}</span>
          ${item.notas ? `<span>${escapeHTML(item.notas)}</span>` : ''}
        </div>
        <div class="org-item-actions" style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onclick="toggleOrganizationItem('${item.id}',${done ? 'false' : 'true'})">${done ? 'Reabrir' : 'Completar'}</button>
          <button class="btn btn-del" onclick="deleteOrganizationItem('${item.id}')">Eliminar</button>
        </div>
      </div>`
    }).join('')
}

function setOrganizationCurrentMonth() {
  const month = document.getElementById('org-month')
  if (month) month.value = today().slice(0, 7)
  renderOrganization()
}

async function addOrganizationItem() {
  if (!organizationAvailable) { toastErr('Primero active la migración 007 de Gestión'); return }
  const title = V('org-title').trim()
  const date = V('org-date')
  const amount = numOrDefault('org-amount-input')
  if (!title) { toastErr('Indique qué se debe hacer'); return }
  if (!date) { toastErr('Seleccione una fecha'); return }
  if (amount < 0) { toastErr('El monto no puede ser negativo'); return }
  const { error } = await sb.from('organization_items').insert({
    user_id: CU.id,
    titulo: title,
    tipo: V('org-type'),
    prioridad: V('org-priority'),
    fecha: date,
    responsable: V('org-owner').trim() || null,
    monto: amount,
    notas: V('org-notes').trim() || null
  })
  if (handleSupaError(error, 'addOrganizationItem')) return
  ;['org-title', 'org-owner', 'org-amount-input', 'org-notes'].forEach(id => { document.getElementById(id).value = '' })
  document.getElementById('org-month').value = date.slice(0, 7)
  await loadOrganizationData()
  toast('Agregado al calendario')
}

async function toggleOrganizationItem(id, completed) {
  const { error } = await sb.from('organization_items').update({ estado: completed ? 'completado' : 'pendiente' }).eq('id', id).eq('user_id', CU.id)
  if (handleSupaError(error, 'toggleOrganizationItem')) return
  await loadOrganizationData()
  toast(completed ? 'Marcado como completado' : 'Pendiente reabierto')
}

async function deleteOrganizationItem(id) {
  if (!confirm('¿Eliminar este elemento del calendario?')) return
  const { error } = await sb.from('organization_items').delete().eq('id', id).eq('user_id', CU.id)
  if (handleSupaError(error, 'deleteOrganizationItem')) return
  await loadOrganizationData()
  toast('Elemento eliminado')
}

// ══════════════════════════════════════
// PRODUCTOS
// ══════════════════════════════════════
function cleanImageUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  try {
    const url = new URL(raw)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}

function productImageUrl(item) {
  const direct = cleanImageUrl(item?.imagen_url || item?.image_url)
  if (direct) return direct
  const match = String(item?.notas || '').match(/(?:^|\n)Imagen:\s*(https?:\/\/\S+)/i)
  return cleanImageUrl(match?.[1])
}

function notesWithProductImage(notes, imageUrl) {
  const cleanNotes = String(notes || '').replace(/(?:^|\n)Imagen:\s*https?:\/\/\S+\s*/i, '\n').trim()
  const cleanUrl = cleanImageUrl(imageUrl)
  return [cleanUrl ? `Imagen: ${cleanUrl}` : '', cleanNotes].filter(Boolean).join('\n')
}

async function addProd() {
  const n = V('p-n').trim(); if (!n) { toastErr('Ingrese el nombre'); return }
  const co = numOrDefault('p-co')
  if (co < 0) { toastErr('El costo no puede ser negativo'); return }
  const calc = calcCosto()
  if (co > 0 && !calc) { toastErr('Revise los costos antes de guardar el producto'); return }
  const precioFinalRaw = V('p-pr').trim()
  const pr = precioFinalRaw === '' && calc ? calc.pv : numOrDefault('p-pr')
  if (pr < 0) { toastErr('El precio no puede ser negativo'); return }
  const duplicate = await findInventoryDuplicate(n)
  if (duplicate.exists) { toastErr('Ese producto ya existe. Use reposición para sumar stock.'); return }
  const stock = Math.max(0, Math.trunc(numOrDefault('p-st')))
  const stockMin = Math.max(0, Math.trunc(numOrDefault('p-min')))
  const costoTotal = calc ? Number(calc.costoBase) : co
  const costoExtra = Math.max(0, costoTotal - co)
  const { data, error } = await sb.rpc('create_inventory_item', {
    product_name: n,
    product_category: V('p-c').trim() || null,
    product_notes: notesWithProductImage(V('p-d'), V('p-img')) || null,
    current_stock: stock,
    minimum_stock: stockMin,
    unit_cost: co,
    extra_cost: costoExtra,
    local_price: pr,
    web_price: 0,
    source_name: 'manual'
  })
  if (handleSupaError(error, 'addProd')) return
  if (!data?.ok) { toastErr(data?.error || 'No se pudo crear el producto'); return }
  if (calc && data.inventory_item_id) {
    const { error: marginError } = await sb.from('inventario_items').update({
      ganancia_local: calc.ganancia,
      margen_local_pct: calc.margenReal
    }).eq('id', data.inventory_item_id).eq('user_id', CU.id)
    if (handleSupaError(marginError, 'addProdMargin')) return
  }
  ;['p-n', 'p-c', 'p-img', 'p-d', 'p-co', 'p-pkg', 'p-env', 'p-cplat', 'p-cpago', 'p-imp', 'p-desc', 'p-mar', 'p-pr', 'p-st', 'p-min'].forEach(id => { const e = document.getElementById(id); if (e) e.value = '' })
  document.getElementById('p-cost-result').style.display = 'none'
  document.getElementById('p-cost-alert').style.display = 'none'
  await loadImportedData()
  await renderDash()
  switchProductTab('inv')
  renderImportedInventory()
  toast('Producto agregado al inventario')
}

async function delProd(id) {
  if (!confirm('¿Eliminar?')) return
  const { error } = await sb.from('productos').delete().eq('id', id).eq('user_id', CU.id)
  if (handleSupaError(error, 'delProd')) return
  await renderProds()
}

async function renderProds() {
  const { data: ps, error } = await sb.from('productos').select('*').eq('user_id', CU.id).order('created_at', { ascending: false })
  if (error) { console.error('[Kairós] renderProds:', error); return }
  const legacyCard = document.getElementById('legacy-prod-card')
  if (legacyCard) legacyCard.style.display = ps?.length ? 'block' : 'none'
  const eBadge = { activo: 'bg', pausado: 'by', sin_stock: 'br' }
  const eLabel = { activo: 'Activo', pausado: 'Pausado', sin_stock: 'Sin stock' }
  document.getElementById('p-tb').innerHTML = !(ps?.length)
    ? '<tr><td colspan="8"><div class="empty"><div class="empty-i">·</div>Sin productos</div></td></tr>'
    : ps.map(p => {
        const m = p.margen_real_pct || 0
        return `<tr>
          <td><strong>${escapeHTML(p.nom)}</strong>${p.descripcion ? `<div style="font-size:11px;color:var(--txt3)">${escapeHTML(p.descripcion.slice(0, 55))}${p.descripcion.length > 55 ? '...' : ''}</div>` : ''}</td>
          <td style="color:var(--txt3)">${escapeHTML(p.cat || '—')}</td>
          <td>${p.costo_producto > 0 ? '$' + fmt(p.costo_producto) : '—'}</td>
          <td style="font-weight:600">${p.precio_venta > 0 ? '$' + fmt(p.precio_venta) : '—'}</td>
          <td><span style="color:${m > 15 ? 'var(--green)' : m > 0 ? 'var(--yel)' : 'var(--red)'}">${fmtDec(m)}%</span></td>
          <td>${p.stock}</td>
          <td><span class="badge ${eBadge[p.estado] || 'bb'}">${eLabel[p.estado] || escapeHTML(p.estado)}</span></td>
          <td><button class="btn btn-del" onclick="delProd('${p.id}')">✕</button></td>
        </tr>`
      }).join('')
}

async function aiDescProd() {
  const n = V('p-n').trim(); if (!n) { toastErr('Ingrese el nombre primero'); return }
  openAI()
  document.getElementById('ai-inp').value = `Genere una descripción de producto atractiva (máximo 3 oraciones) para: "${n}"${V('p-c') ? ' categoría ' + V('p-c') : ''}. Solo la descripción, sin título ni formato.`
  await sendAI()
}

// ══════════════════════════════════════
// LEADS
// ══════════════════════════════════════
async function addLead() {
  const n = V('le-n').trim(); if (!n) { toastErr('Ingrese el nombre'); return }
  const val = parseFloat(V('le-v')) || 0
  if (val < 0) { toastErr('El valor no puede ser negativo'); return }
  const { error } = await sb.from('leads').insert({ user_id: CU.id, nom: n, contacto: V('le-c'), valor: val, nota: V('le-no'), estado: 'lead' })
  if (handleSupaError(error, 'addLead')) return
  ;['le-n', 'le-c', 'le-v', 'le-no'].forEach(id => { const e = document.getElementById(id); if (e) e.value = '' })
  await renderLeads(); await renderDash(); toast('Oportunidad agregada')
}

async function moveLead(id, estado) {
  const { error } = await sb.from('leads').update({ estado }).eq('id', id).eq('user_id', CU.id)
  if (handleSupaError(error, 'moveLead')) return
  await renderLeads(); await renderDash()
}

async function delLead(id) {
  if (!confirm('¿Eliminar?')) return
  const { error } = await sb.from('leads').delete().eq('id', id).eq('user_id', CU.id)
  if (handleSupaError(error, 'delLead')) return
  await renderLeads(); await renderDash()
}

async function renderLeads() {
  const { data: ls, error } = await sb.from('leads').select('*').eq('user_id', CU.id).order('created_at', { ascending: false })
  if (error) { console.error('[Kairós] renderLeads:', error); return }
  const next = { lead: 'contactado', contactado: 'propuesta', propuesta: 'cliente', cliente: null }
  const nextL = { lead: 'Contactar →', contactado: 'Propuesta →', propuesta: 'Cerrar →', cliente: null }
  ;['lead', 'contactado', 'propuesta', 'cliente'].forEach(est => {
    const col = document.getElementById('col-' + est)
    const items = (ls || []).filter(l => l.estado === est)
    if (!items.length) { col.innerHTML = '<div style="color:var(--txt3);font-size:12px;text-align:center;padding:16px 0">—</div>'; return }
    col.innerHTML = items.map(l => `
      <div class="kcard">
        <div class="kcard-n">${escapeHTML(l.nom)}</div>
        <div class="kcard-i">${escapeHTML(l.contacto || 'Sin contacto')}</div>
        ${l.valor > 0 ? `<div style="font-size:12px;color:var(--gold);margin-top:3px">$${fmt(l.valor)}</div>` : ''}
        ${l.nota ? `<div class="kcard-i" style="margin-top:4px;font-style:italic">${escapeHTML(l.nota)}</div>` : ''}
        <div class="kcard-a">
          ${next[est] ? `<button class="btn btn-ghost btn-sm" onclick="moveLead('${l.id}','${next[est]}')">${nextL[est]}</button>` : ''}
          ${(l.contacto && /^[\d+]/.test(l.contacto)) ? `<a href="https://wa.me/${l.contacto.replace(/\D/g, '')}" target="_blank" class="btn btn-ghost btn-sm">💬 WA</a>` : ''}
          <button class="btn btn-del" onclick="delLead('${l.id}')">✕</button>
        </div>
      </div>`).join('')
  })
}

// ══════════════════════════════════════
// PUBLICIDAD
// ══════════════════════════════════════
async function addCamp() {
  const n = V('ca-n').trim(); if (!n) { toastErr('Ingrese el nombre'); return }
  const inv = parseFloat(V('ca-inv')) || 0; if (inv <= 0) { toastErr('La inversión debe ser mayor a 0'); return }
  const cli = parseInt(V('ca-cli')) || 0, ing = parseFloat(V('ca-ing')) || 0
  const { error } = await sb.from('campanas').insert({ user_id: CU.id, plat: V('ca-pl'), nom: n, inv, cli, ing, roas: inv > 0 && ing > 0 ? (ing / inv).toFixed(2) : null, cac: cli > 0 ? (inv / cli).toFixed(0) : null })
  if (handleSupaError(error, 'addCamp')) return
  ;['ca-n', 'ca-inv', 'ca-cli', 'ca-ing'].forEach(id => { const e = document.getElementById(id); if (e) e.value = '' })
  await renderPub(); await renderMet(); toast('Campaña registrada')
}

async function delCamp(id) {
  if (!confirm('¿Eliminar?')) return
  const { error } = await sb.from('campanas').delete().eq('id', id).eq('user_id', CU.id)
  if (handleSupaError(error, 'delCamp')) return
  await renderPub(); await renderMet()
}

async function renderPub() {
  const { data: camps, error } = await sb.from('campanas').select('*').eq('user_id', CU.id).order('created_at', { ascending: false })
  if (error) { console.error('[Kairós] renderPub:', error); return }
  const cs = camps || []
  const ti = cs.reduce((a, b) => a + (Number(b.inv) || 0), 0)
  const tc = cs.reduce((a, b) => a + (Number(b.cli) || 0), 0)
  const tig = cs.reduce((a, b) => a + (Number(b.ing) || 0), 0)
  S('pu-inv', '$' + fmt(ti)); S('pu-cli', tc)
  S('pu-cac', tc > 0 ? '$' + fmt(ti / tc) : '—')
  S('pu-roas', ti > 0 && tig > 0 ? (tig / ti).toFixed(2) + 'x' : '—')
  document.getElementById('ca-tb').innerHTML = !cs.length
    ? '<tr><td colspan="5"><div class="empty"><div class="empty-i">·</div>Sin campañas</div></td></tr>'
    : cs.map(c => { const r = parseFloat(c.roas), rc = r >= 4 ? 'var(--green)' : r >= 2 ? 'var(--yel)' : 'var(--red)'; return `<tr><td><strong>${escapeHTML(c.plat)}</strong><div style="font-size:11px;color:var(--txt3)">${escapeHTML(c.nom)}</div></td><td>$${fmt(c.inv)}</td><td>${c.cli}</td><td style="font-weight:600;color:${c.roas ? rc : 'var(--txt3)'}">${c.roas ? c.roas + 'x' : '—'}</td><td><button class="btn btn-del" onclick="delCamp('${c.id}')">✕</button></td></tr>` }).join('')
}

// ══════════════════════════════════════
// CONTENIDO
// ══════════════════════════════════════
async function addCont() {
  const t = V('ct-t').trim(); if (!t) { toastErr('Ingrese el título'); return }
  const { error } = await sb.from('contenido').insert({ user_id: CU.id, tit: t, tipo: V('ct-tp'), plat: V('ct-pl'), fecha: V('ct-f') || null, estado: V('ct-es') })
  if (handleSupaError(error, 'addCont')) return
  document.getElementById('ct-t').value = ''
  await renderCont(); toast('Contenido agregado')
}

async function delCont(id) {
  const { error } = await sb.from('contenido').delete().eq('id', id).eq('user_id', CU.id)
  if (handleSupaError(error, 'delCont')) return
  await renderCont()
}

async function addRef() {
  const n = V('re-n').trim(), w = V('re-w').trim(); if (!n) return
  const { error } = await sb.from('referentes').insert({ user_id: CU.id, nom: n, why: w })
  if (handleSupaError(error, 'addRef')) return
  document.getElementById('re-n').value = ''; document.getElementById('re-w').value = ''
  await renderRefs()
}

async function delRef(id) {
  const { error } = await sb.from('referentes').delete().eq('id', id).eq('user_id', CU.id)
  if (handleSupaError(error, 'delRef')) return
  await renderRefs()
}

let angTimer = null
async function saveAng() {
  clearTimeout(angTimer)
  angTimer = setTimeout(async () => {
    const { error } = await sb.from('angulos').upsert({ user_id: CU.id, p: V('an-p'), t: V('an-t'), s: V('an-s'), n: V('an-n') }, { onConflict: 'user_id' })
    if (handleSupaError(error, 'saveAng')) return
  }, 1500)
}

async function loadAng() {
  const { data: a, error } = await sb.from('angulos').select('*').eq('user_id', CU.id).single()
  if (error && error.code !== 'PGRST116') { console.error('[Kairós] loadAng:', error); return }
  if (!a) return
  ;[['an-p', 'p'], ['an-t', 't'], ['an-s', 's'], ['an-n', 'n']].forEach(([id, k]) => { const e = document.getElementById(id); if (e) e.value = a[k] || '' })
}

async function renderCont() {
  const { data: cts, error } = await sb.from('contenido').select('*').eq('user_id', CU.id).order('fecha', { ascending: true, nullsFirst: false })
  if (error) { console.error('[Kairós] renderCont:', error); return }
  const el = document.getElementById('ct-lista')
  if (!(cts?.length)) { el.innerHTML = '<div class="empty"><div class="empty-i">·</div>Sin contenido</div>'; return }
  const ti = { educativo: 'Educativo', venta: 'Venta', conexion: 'Conexión' }
  const eb = { idea: 'by', produccion: 'bb', publicado: 'bg' }
  const el2 = { idea: 'Idea', produccion: 'Producción', publicado: 'Publicado' }
  el.innerHTML = cts.map(c => `
    <div style="background:var(--sur2);border:1px solid var(--bor);border-radius:10px;padding:12px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div><div style="font-size:13px;font-weight:500">${escapeHTML(c.tit)}</div><div style="font-size:11px;color:var(--txt2);margin-top:3px">${escapeHTML(ti[c.tipo] || c.tipo || 'Contenido')}</div>
        <div style="font-size:11px;color:var(--txt3);margin-top:3px">${escapeHTML(c.plat)}${c.fecha ? ' · ' + c.fecha : ''}</div></div>
        <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
          <span class="badge ${eb[c.estado]}">${el2[c.estado]}</span>
          <button class="btn btn-del" onclick="delCont('${c.id}')">✕</button>
        </div>
      </div>
    </div>`).join('')
}

async function renderRefs() {
  const { data: rs, error } = await sb.from('referentes').select('*').eq('user_id', CU.id)
  if (error) { console.error('[Kairós] renderRefs:', error); return }
  document.getElementById('ref-lista').innerHTML = !(rs?.length)
    ? '<div class="empty" style="padding:20px"><div class="empty-i">·</div>Sin referentes</div>'
    : rs.map(r => `<div class="mrow"><div><div style="font-size:13px;font-weight:500">${escapeHTML(r.nom)}</div><div style="font-size:11px;color:var(--txt3)">${escapeHTML(r.why)}</div></div><button class="btn btn-del" onclick="delRef('${r.id}')">✕</button></div>`).join('')
}

async function aiIdeas() {
  const biz = await getBiz(); openAI()
  document.getElementById('ai-inp').value = `Genere 5 ideas de contenido para ${biz?.rub || 'el negocio'} (cliente: ${biz?.cli || 'general'}). Para cada una: tipo (educativo/venta/conexión), plataforma y ángulo en una línea.`
  await sendAI()
}

// ══════════════════════════════════════
// MÉTRICAS
// ══════════════════════════════════════
function calcEng() {
  const se = parseFloat(V('en-se')) || 0, inte = parseFloat(V('en-in')) || 0
  if (!se) { toastErr('Ingrese la cantidad de seguidores'); return }
  const e = ((inte / se) * 100).toFixed(2)
  let ev, cl
  if (e < 1) { ev = 'Bajo - revise el contenido'; cl = 'var(--red)' }
  else if (e < 3) { ev = 'Normal - hay margen de mejora'; cl = 'var(--yel)' }
  else if (e < 6) { ev = 'Bueno'; cl = 'var(--green)' }
  else { ev = 'Excelente'; cl = 'var(--green)' }
  document.getElementById('en-res').innerHTML = `<div style="background:var(--sur2);border:1px solid var(--bor);border-radius:10px;padding:14px"><div style="font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:700;color:${cl}">${e}%</div><div style="font-size:12px;color:var(--txt2);margin-top:4px">${ev}</div></div>`
}

function calcCierre() {
  const le = parseFloat(V('ci-le')) || 0, ve = parseFloat(V('ci-ve')) || 0
  if (!le) { toastErr('Ingrese la cantidad de oportunidades'); return }
  if (ve > le) { toastErr('Las ventas no pueden superar las oportunidades'); return }
  const t = ((ve / le) * 100).toFixed(1)
  let ev, cl
  if (t < 10) { ev = 'Bajo - revise el proceso de ventas'; cl = 'var(--red)' }
  else if (t < 25) { ev = 'Normal'; cl = 'var(--yel)' }
  else if (t < 50) { ev = 'Bueno'; cl = 'var(--green)' }
  else { ev = 'Excelente'; cl = 'var(--green)' }
  document.getElementById('ci-res').innerHTML = `<div style="background:var(--sur2);border:1px solid var(--bor);border-radius:10px;padding:14px"><div style="font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:700;color:${cl}">${t}%</div><div style="font-size:12px;color:var(--txt2);margin-top:4px">${ev}</div></div>`
}

async function renderMet() {
  const { m, y } = getMes()
  const mesStart = `${y}-${String(m).padStart(2, '0')}-01`
  const mesEnd = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  const [finance, campResult, salesSummary] = await Promise.all([
    loadUnifiedFinances(),
    sb.from('campanas').select('*').eq('user_id', CU.id),
    loadSalesSummary()
  ])
  if (campResult.error) console.error('[Kairós] renderMet campañas:', campResult.error)
  const all = finance.month
  const cs = campResult.data || []
  const { ingresos: ing, egresos: egr, balance: gan } = finance.totals
  const mar = ing > 0 ? Math.round((gan / ing) * 100) : 0
  const iT = all.filter(t => t.tipo === 'ingreso')
  S('m-cli', salesSummary.count); S('m-tick', salesSummary.count > 0 ? '$' + fmt(Math.round(salesSummary.total / salesSummary.count)) : '$0')
  const cats = {}; iT.forEach(t => {
    const category = t.categoria || 'sin_categoria'
    cats[category] = (cats[category] || 0) + Number(t.monto || 0)
  })
  const bc = Object.entries(cats).sort((a, b) => b[1] - a[1])[0]
  S('m-bcat', bc ? bc[0] : '—')
  const mEl = document.getElementById('m-mar'); mEl.textContent = mar + '%'; mEl.style.color = mar > 20 ? 'var(--green)' : mar > 0 ? 'var(--yel)' : 'var(--red)'
  S('m-rat', egr > 0 ? (ing / egr).toFixed(2) + 'x' : '—')
  let est, badge
  if (!ing && !egr) { est = 'Sin datos'; badge = 'by' } else if (gan > 0 && mar > 20) { est = 'Rentable'; badge = 'bg' } else if (gan > 0) { est = 'Positivo'; badge = 'by' } else { est = 'En pérdida'; badge = 'br' }
  document.getElementById('m-est').innerHTML = `<span class="badge ${badge}">${est}</span>`
  const ti = cs.reduce((a, b) => a + (Number(b.inv) || 0), 0)
  const tc = cs.reduce((a, b) => a + (Number(b.cli) || 0), 0)
  const tig = cs.reduce((a, b) => a + (Number(b.ing) || 0), 0)
  S('m-roas', ti > 0 && tig > 0 ? (tig / ti).toFixed(2) + 'x' : '—'); S('m-cac', tc > 0 ? '$' + fmt(ti / tc) : '—')
  const can = {}; cs.forEach(c => { can[c.plat] = (can[c.plat] || 0) + c.ing })
  const mc = Object.entries(can).sort((a, b) => b[1] - a[1])[0]; S('m-can', mc ? mc[0] : '—')
}

// ══════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════
async function renderDash() {
  /*
   * Metricas del negocio:
   * - Ingresos y egresos unifican transacciones históricas y movimientos
   *   operativos, usando fecha o created_at cuando la fecha falta.
   * - Resultado de caja = ingresos cobrados - egresos pagados.
   * - Ganancia de ventas = importe vendido - costo de los productos vendidos.
   * - Gastos fijos a cubrir usa la suma de gastos_fijos.mon y se compara con
   *   los ingresos del mes. No se presenta como punto de equilibrio contable.
   * - La pestaña Carga inteligente mantiene el desglose por fuente.
   * - Leads activos son los contactos que todavía no llegaron a cliente.
   * - El bloque importado cuenta como alertas los inventario_items en rojo.
   */
  const [finance, sales, leadResult, prodResult, inventoryResult, fixedResult, biz] = await Promise.all([
    loadUnifiedFinances(),
    loadSalesSummary(),
    sb.from('leads').select('*').eq('user_id', CU.id),
    sb.from('productos').select('id').eq('user_id', CU.id),
    sb.from('inventario_items').select('id,estado_stock,costo_total,precio_venta_local,margen_local_pct').eq('user_id', CU.id),
    sb.from('gastos_fijos').select('mon').eq('user_id', CU.id),
    getBiz()
  ])
  ;[
    ['leads', leadResult.error],
    ['productos', prodResult.error],
    ['inventario_items', inventoryResult.error],
    ['gastos_fijos', fixedResult.error]
  ].forEach(([source, error]) => { if (error) console.error(`[Kairós] renderDash ${source}:`, error) })
  const leads = leadResult.data
  const prods = prodResult.data
  const inventory = inventoryResult.data || []
  const fixedCosts = fixedResult.data
  const b = biz
  S('home-business-name', b?.nom || 'Mi negocio')
  const all = finance.month, ls = leads || []
  const { ingresos: ing, egresos: egr, balance: gan } = finance.totals
  const mar = ing > 0 ? Math.round((gan / ing) * 100) : 0
  const breakEven = (fixedCosts || []).reduce((sum, item) => sum + (Number(item.mon) || 0), 0)
  const activeLeads = ls.filter(l => l.estado !== 'cliente').length
  const redCount = inventory.filter(item => item.estado_stock === 'rojo').length
  S('d-ing', '$' + fmt(ing)); S('d-ing-n', all.filter(t => t.tipo === 'ingreso' && movementHasAmount(t)).length + ' registros con monto')
  S('d-egr', '$' + fmt(egr)); S('d-egr-n', all.filter(t => t.tipo === 'egreso' && movementHasAmount(t)).length + ' registros con monto')
  const gEl = document.getElementById('d-gan'); gEl.textContent = '$' + fmt(gan); gEl.style.color = gan >= 0 ? 'var(--gold)' : 'var(--red)'
  S('d-mar', 'Sobre ingresos: ' + mar + '%')
  S('d-sales-profit', money(sales.profit))
  S('d-sales-count', `${sales.count} venta${sales.count === 1 ? '' : 's'} · ${money(sales.total)} vendido`)
  S('d-sales-margin', fmtDec(sales.margin) + '%')
  document.getElementById('d-sales-profit').style.color = sales.profit >= 0 ? 'var(--green)' : 'var(--red)'
  document.getElementById('d-sales-margin').style.color = sales.margin >= 25 ? 'var(--green)' : sales.margin >= 0 ? 'var(--yel)' : 'var(--red)'
  S('d-leads', activeLeads)
  S('d-cli', ls.filter(l => l.estado === 'cliente').length + ' clientes confirmados')
  S('d-eq', '$' + fmt(breakEven))
  S('d-eq-note', breakEven <= 0 ? 'Sin gastos fijos cargados' : ing >= breakEven ? `Superado por $${fmt(ing - breakEven)}` : `Faltan $${fmt(breakEven - ing)}`)
  const lossProducts = inventory.filter(item => Number(item.precio_venta_local) > 0 && Number(item.margen_local_pct) < 0).length
  const incompleteProducts = inventory.filter(item => Number(item.costo_total) <= 0 || Number(item.precio_venta_local) <= 0).length
  const zeroMovements = all.filter(item => !movementHasAmount(item)).length
  const alertParts = []
  if (gan < 0) alertParts.push('caja negativa')
  if (breakEven > 0 && ing < breakEven) alertParts.push('gastos fijos sin cubrir')
  if (redCount) alertParts.push(`${redCount} stock crítico`)
  if (lossProducts) alertParts.push(`${lossProducts} con pérdida`)
  if (incompleteProducts) alertParts.push(`${incompleteProducts} incompletos`)
  if (zeroMovements) alertParts.push(`${zeroMovements} sin monto`)
  const alertCount = (gan < 0 ? 1 : 0) + (breakEven > 0 && ing < breakEven ? 1 : 0) + redCount + lossProducts + incompleteProducts + zeroMovements
  S('d-alerts', alertCount)
  const alertNote = alertParts.length
    ? alertParts.slice(0, 3).join(' · ') + (alertParts.length > 3 ? ` · +${alertParts.length - 3} más` : '')
    : 'Sin alertas críticas'
  S('d-alerts-note', alertNote)
  const homeAlerts = [
    { tone: redCount ? 'bad' : incompleteProducts ? 'warn' : 'good', title: 'Productos con inventario bajo', detail: redCount ? `${redCount} producto${redCount === 1 ? '' : 's'} requieren reposición.` : 'Sin faltantes críticos detectados.' },
    { tone: incompleteProducts ? 'warn' : 'good', title: 'Productos sin rotación detectados', detail: incompleteProducts ? `${incompleteProducts} producto${incompleteProducts === 1 ? '' : 's'} necesitan datos completos para analizar rotación.` : 'No hay señales relevantes con los datos actuales.' },
    { tone: breakEven > 0 && ing < breakEven ? 'warn' : 'good', title: 'Incremento de gastos fijos esta semana', detail: breakEven > 0 ? `Referencia mensual: ${money(breakEven)}.` : 'Sin gastos fijos cargados.' },
  ]
  const homeAlertsEl = document.getElementById('home-alerts')
  if (homeAlertsEl) homeAlertsEl.innerHTML = homeAlerts.map(item => `<div class="alert-item"><span class="dot ${item.tone}"></span><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.detail)}</small></div>`).join('')
  const lastTx = finance.recent.slice(0, 5)
  document.getElementById('d-tx').innerHTML = !lastTx.length
    ? '<div class="empty"><div class="empty-i">·</div>Sin movimientos. Registre el primer ingreso en Dinero.</div>'
    : lastTx.map(t => `<div class="mrow"><div><div style="font-size:13px">${escapeHTML(t.descripcion)}</div><div style="font-size:11px;color:var(--txt3)">${escapeHTML(t.categoria)} · ${escapeHTML(financeDateKey(t) || '—')} · ${escapeHTML(t.fuente)}</div></div><div style="font-weight:600;color:${movementHasAmount(t) ? (t.tipo === 'ingreso' ? 'var(--green)' : 'var(--red)') : 'var(--yel)'}">${movementAmountText(t)}</div></div>`).join('')
  const homeMovementsEl = document.getElementById('home-movements')
  if (homeMovementsEl) {
    const labels = ['Venta registrada', 'Gasto registrado', 'Inventario actualizado', 'Producto creado']
    homeMovementsEl.innerHTML = lastTx.length
      ? lastTx.slice(0, 4).map((t, index) => `<button class="movement-item" onclick="goFinanceDetail('movements')"><span class="module-icon">${iconSvg(t.tipo === 'ingreso' ? 'sale' : 'expense')}</span><div><strong>${escapeHTML(t.descripcion || labels[index] || 'Movimiento registrado')}</strong><small>${escapeHTML(movementAmountText(t))} · ${escapeHTML(financeDateKey(t) || 'Sin fecha')}</small></div></button>`).join('')
      : labels.map((label, index) => `<div class="movement-item"><span class="module-icon">${iconSvg(['sale', 'expense', 'inventory', 'box'][index])}</span><div><strong>${label}</strong><small>Pendiente de registros recientes.</small></div></div>`).join('')
  }
  const operationalProducts = inventory.length
  const legacyProducts = prods?.length || 0
  const items = [
    { ok: !!b?.nom, ico: b?.nom ? 'OK' : '!', txt: b?.nom ? `Negocio: ${escapeHTML(b.nom)}` : 'Complete los datos del negocio', p: 'neg' },
    { ok: !!ing || !!egr, ico: ing || egr ? 'OK' : '!', txt: ing || egr ? `Dinero: $${fmt(ing)} ingresados este mes` : 'Registre el primer movimiento', p: 'fin' },
    { ok: ls.length > 0, ico: ls.length ? 'OK' : '!', txt: ls.length ? `${ls.length} contacto(s) en seguimiento` : 'Agregue la primera oportunidad', p: 'leads' },
    { ok: operationalProducts + legacyProducts > 0, ico: operationalProducts + legacyProducts ? 'OK' : '!', txt: operationalProducts ? `${operationalProducts} producto(s) en inventario` : legacyProducts ? `${legacyProducts} producto(s) históricos` : 'Cargue productos', p: 'prod' },
  ]
  document.getElementById('d-est').innerHTML = items.map(i => `<div class="mrow" style="${!i.ok ? 'cursor:pointer' : ''}" ${!i.ok ? `onclick="goPage('${i.p}')"` : ''}><div style="display:flex;align-items:center;gap:10px"><span style="font-size:16px">${i.ico}</span><span style="font-size:13px;color:${i.ok ? 'var(--txt2)' : 'var(--txt)'}">${i.txt}</span></div>${!i.ok ? '<span style="color:var(--gold);font-size:12px">→</span>' : ''}</div>`).join('')
  S('home-cash-answer', !ing && !egr ? 'No hay movimientos con monto válido.' : gan >= 0 ? 'Este mes entró más dinero del que salió.' : 'Este mes salió más dinero del que entró.')
  S('home-cash-number', `Entró ${money(ing)} · Salió ${money(egr)} · Resultado ${money(gan)}`)
  S('home-sales-answer', !sales.count ? 'No hay ventas confirmadas para calcularlo.' : sales.profit >= 0 ? 'Las ventas dejan ganancia.' : 'Las ventas están dejando pérdida.')
  S('home-sales-number', sales.count ? `${money(sales.profit)} de ganancia · De cada $100 vendidos quedan $${fmtDec(sales.margin)}` : 'Registre ventas para conocer este dato.')
  const attentionCount = redCount + lossProducts + incompleteProducts
  S('home-alert-answer', attentionCount ? `${attentionCount} producto${attentionCount === 1 ? '' : 's'} necesita${attentionCount === 1 ? '' : 'n'} atención.` : 'No hay alertas críticas de productos.')
  S('home-alert-number', redCount ? `${redCount} con stock crítico` : incompleteProducts ? `${incompleteProducts} con datos incompletos` : 'Inventario sin alertas críticas')
  S('home-next-answer', gan < 0 ? 'Revise los egresos antes de asumir un gasto nuevo.' : redCount ? 'Priorice reponer los productos con stock crítico.' : !sales.count ? 'Registre una venta para empezar a medir rentabilidad.' : 'Revise las alertas y continúe registrando movimientos.')
  const setCommandMeter = (id, value, state) => {
    const meter = document.getElementById(id)
    if (!meter) return
    meter.className = `resource-meter ${state || ''}`.trim()
    const fill = meter.querySelector('span')
    if (fill) fill.style.width = `${Math.max(0, Math.min(100, value))}%`
  }
  const cashHealth = !ing && !egr ? 0 : ing > 0 ? Math.max(0, Math.min(100, (gan / ing + 1) * 50)) : 0
  const salesHealth = sales.count ? Math.max(0, Math.min(100, sales.margin * 2)) : 0
  const healthyStock = inventory.filter(item => item.estado_stock === 'verde').length
  const stockHealth = inventory.length ? healthyStock / inventory.length * 100 : 0
  setCommandMeter('home-cash-meter', cashHealth, gan < 0 ? 'bad' : gan === 0 ? 'warn' : 'good')
  setCommandMeter('home-sales-meter', salesHealth, !sales.count || sales.margin < 0 ? 'bad' : sales.margin < 25 ? 'warn' : 'good')
  setCommandMeter('home-stock-meter', stockHealth, redCount ? 'bad' : incompleteProducts ? 'warn' : 'good')
  S('command-cash-value', money(gan))
  const cashTrend = document.getElementById('command-cash-trend')
  if (cashTrend) {
    cashTrend.textContent = !ing && !egr ? 'Sin movimientos con monto registrado' : `Entró ${money(ing)} · Salió ${money(egr)}`
    cashTrend.className = `console-trend ${gan > 0 ? 'good' : gan < 0 ? 'bad' : ''}`.trim()
  }
  const setConsoleState = (prefix, percent, label, state) => {
    S(`${prefix}-percent`, `${Math.round(Math.max(0, Math.min(100, percent)))}%`)
    S(`${prefix}-state`, label)
    const stateNode = document.getElementById(`${prefix}-state`)
    const percentNode = document.getElementById(`${prefix}-percent`)
    if (stateNode) stateNode.className = `console-state ${state}`
    if (percentNode) percentNode.className = `console-percent ${state}`
  }
  setConsoleState('cash', cashHealth, !ing && !egr ? 'Sin datos' : gan < 0 ? 'Atención' : 'Sano', gan < 0 ? 'bad' : gan === 0 ? 'warn' : 'good')
  setConsoleState('stock', stockHealth, !inventory.length ? 'Sin inventario' : redCount ? 'Atención' : incompleteProducts ? 'Revisar datos' : 'Sano', redCount ? 'bad' : incompleteProducts ? 'warn' : 'good')
  setConsoleState('sales', salesHealth, !sales.count ? 'Sin ventas' : sales.margin < 0 ? 'Con pérdida' : sales.margin < 25 ? 'Margen bajo' : 'Bien', !sales.count || sales.margin < 0 ? 'bad' : sales.margin < 25 ? 'warn' : 'good')
  S('console-sales-profit', money(sales.profit))
  S('console-sales-margin', sales.count ? money(sales.margin) : '$0')
  const coverage = breakEven > 0 ? Math.min(100, ing / breakEven * 100) : 0
  S('coverage-percent', `${Math.round(coverage)}%`)
  S('coverage-copy', breakEven > 0 ? `${money(Math.min(ing, breakEven))} de ${money(breakEven)} cubiertos este mes` : 'Cargue gastos fijos para medir este dato.')
  setCommandMeter('coverage-meter', coverage, breakEven <= 0 ? 'warn' : coverage >= 100 ? 'good' : coverage >= 60 ? 'warn' : 'bad')
  const stateEl = document.getElementById('command-state')
  const critical = gan < 0 || redCount > 0 || lossProducts > 0
  const attention = !critical && (incompleteProducts > 0 || !sales.count || (breakEven > 0 && ing < breakEven))
  if (stateEl) stateEl.className = `command-state ${critical ? 'critical' : attention ? 'attention' : 'stable'}`
  S('command-status', critical ? 'Requiere atención' : attention ? 'En observación' : 'Operación estable')
  S('command-status-copy', critical
    ? 'Hay puntos importantes para revisar antes de tomar nuevas decisiones.'
    : attention
      ? 'Kairós detectó datos pendientes o tareas que conviene revisar hoy.'
      : 'Los registros principales no muestran alertas críticas por el momento.')
  const missions = []
  if (redCount) missions.push({ mark: '!', title: `Reponer ${redCount} producto${redCount === 1 ? '' : 's'} con stock crítico`, detail: 'Abra el inventario filtrado para decidir qué comprar.', action: "goPage('prod');showProductQuestion('inv','low')", tag: 'Urgente' })
  if (gan < 0) missions.push({ mark: '$', title: 'Revisar los egresos del mes', detail: `La caja está ${money(Math.abs(gan))} por debajo de los ingresos.`, action: "goFinanceDetail('summary')", tag: 'Caja' })
  if (breakEven > 0 && ing < breakEven) missions.push({ mark: 'GF', title: 'Cubrir los gastos fijos', detail: `Faltan ${money(breakEven - ing)} de ingresos para cubrir la referencia mensual.`, action: "goFinanceDetail('fixed')", tag: 'Meta' })
  if (!sales.count) missions.push({ mark: '+', title: 'Registrar la primera venta', detail: 'Esto habilita el cálculo real de ganancia y margen.', action: "startDashboardAction('venta')", tag: 'Inicio' })
  if (incompleteProducts) missions.push({ mark: '?', title: `Completar ${incompleteProducts} producto${incompleteProducts === 1 ? '' : 's'}`, detail: 'Falta costo o precio para poder calcular rentabilidad.', action: "goPage('prod');showProductQuestion('inv','pricing')", tag: 'Datos' })
  if (!missions.length) missions.push({ mark: 'OK', title: 'Mantener los registros al día', detail: 'No hay alertas críticas. Registre ventas y gastos cuando ocurran.', action: "openAIWithBusinessSummary()", tag: 'Estable' })
  const visibleMissions = missions.slice(0, 3)
  S('mission-count', `${visibleMissions.length} prioridad${visibleMissions.length === 1 ? '' : 'es'}`)
  S('home-mobile-priority-title', `${visibleMissions.length} prioridad${visibleMissions.length === 1 ? '' : 'es'}`)
  S('home-mobile-priority-detail', visibleMissions[0]?.title || 'Revise alertas y movimientos recientes.')
  document.getElementById('home-missions').innerHTML = visibleMissions.map(m => `<button class="mission-row" onclick="${m.action}"><span class="mission-mark">${m.mark}</span><span><strong>${m.title}</strong><small>${m.detail}</small></span><span class="mission-xp">${m.tag}</span></button>`).join('')
  renderAnnualSummary(finance.all)
}

function renderAnnualSummary(financeRows = null) {
  const rows = financeRows || window.KairosFinanceService.getUnifiedFinanceCache()?.all || []
  const selector = document.getElementById('annual-year')
  const currentYear = new Date().getFullYear()
  const years = [...new Set(rows.map(financeDateKey).filter(Boolean).map(date => Number(String(date).slice(0, 4))).filter(Boolean).concat(currentYear))].sort((a, b) => b - a)
  const previous = Number(selector?.value) || currentYear
  if (selector) {
    selector.innerHTML = years.map(year => `<option value="${year}">${year}</option>`).join('')
    selector.value = String(years.includes(previous) ? previous : currentYear)
  }
  const selectedYear = Number(selector?.value) || currentYear
  const months = Array.from({ length: 12 }, (_, index) => ({ index, ingresos: 0, egresos: 0, balance: 0 }))
  rows.forEach(row => {
    const key = financeDateKey(row)
    if (!key || Number(String(key).slice(0, 4)) !== selectedYear || !movementHasAmount(row)) return
    const monthIndex = Number(String(key).slice(5, 7)) - 1
    if (monthIndex < 0 || monthIndex > 11) return
    if (row.tipo === 'ingreso') months[monthIndex].ingresos += Number(row.monto) || 0
    if (row.tipo === 'egreso') months[monthIndex].egresos += Number(row.monto) || 0
  })
  months.forEach(month => { month.balance = month.ingresos - month.egresos })
  const income = months.reduce((sum, month) => sum + month.ingresos, 0)
  const expense = months.reduce((sum, month) => sum + month.egresos, 0)
  const balance = income - expense
  const activeMonths = months.filter(month => month.ingresos || month.egresos)
  const best = activeMonths.sort((a, b) => b.balance - a.balance)[0]
  const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  S('annual-income', money(income))
  S('annual-expense', money(expense))
  S('annual-balance', money(balance))
  S('annual-best', best ? `${names[best.index]} · ${money(best.balance)}` : 'Sin datos')
  const balanceEl = document.getElementById('annual-balance')
  if (balanceEl) balanceEl.style.color = balance >= 0 ? 'var(--green)' : 'var(--red)'
  const maxValue = Math.max(1, ...months.flatMap(month => [month.ingresos, month.egresos]))
  const grid = document.getElementById('annual-grid')
  if (grid) {
    grid.innerHTML = months.map(month => `<div class="annual-month" title="${names[month.index]}: ingresos ${money(month.ingresos)}, egresos ${money(month.egresos)}, resultado ${money(month.balance)}">
      <div class="annual-bars"><div class="annual-bar" style="height:${Math.max(2, month.ingresos / maxValue * 100)}%;background:var(--green)"></div><div class="annual-bar" style="height:${Math.max(2, month.egresos / maxValue * 100)}%;background:var(--red)"></div></div>
      <div class="annual-label">${names[month.index]}</div>
    </div>`).join('')
  }
}

// ══════════════════════════════════════
// DATOS IMPORTADOS / CARGA INTELIGENTE
// ══════════════════════════════════════
let importedData = { movements: [], movementsMonth: [], inventory: [], inventoryLatest: [], batches: [], loading: false, error: null }
importedData.botActions = []
importedData.inventorySaleIds = new Set()
let importedLoadPromise = null
let inventoryViewFilter = 'all'

function money(n) { return '$' + fmt(Number(n) || 0) }
function importDate(v) { return v ? String(v).slice(0, 10) : '—' }
function stockTotals(items) {
  const list = items || []
  return {
    count: list.length,
    costo: list.reduce((a, p) => a + ((Number(p.stock_actual) || 0) * (Number(p.costo_total ?? p.costo_unitario) || 0)), 0),
    venta: list.reduce((a, p) => a + ((Number(p.stock_actual) || 0) * (Number(p.precio_venta_local || p.precio_venta_web) || 0)), 0),
    rojo: list.filter(p => p.estado_stock === 'rojo').length,
    amarillo: list.filter(p => p.estado_stock === 'amarillo').length,
    verde: list.filter(p => p.estado_stock === 'verde').length
  }
}

function inventoryNeedsReorder(item) {
  const stock = Number(item.stock_actual)
  const minimum = Number(item.stock_minimo)
  return Number.isFinite(stock) && Number.isFinite(minimum) && (item.estado_stock === 'rojo' || item.estado_stock === 'amarillo' || stock <= minimum)
}

function inventoryHasPricingAlert(item) {
  return Number(item.costo_total ?? item.costo_unitario) <= 0 || Number(item.precio_venta_local || item.precio_venta_web) <= 0 || Number(item.margen_local_pct) < 25
}

function inventoryReorderCost(item) {
  const missing = Math.max(0, (Number(item.stock_minimo) || 0) - (Number(item.stock_actual) || 0))
  return missing * (Number(item.costo_total ?? item.costo_unitario) || 0)
}
function setImportedState(id, msg, mode = 'info') {
  const el = document.getElementById(id)
  if (!el) return
  if (!msg) { el.innerHTML = ''; return }
  const color = mode === 'error' ? 'var(--red)' : 'var(--txt3)'
  el.innerHTML = `<div class="empty" style="padding:18px;color:${color}">${escapeHTML(msg)}</div>`
}
function renderImportedStates() {
  const ids = ['imp-dash-state', 'imp-fin-state', 'imp-prod-state', 'imp-import-state']
  if (importedData.loading) ids.forEach(id => setImportedState(id, 'Cargando datos importados...'))
  else if (importedData.error) ids.forEach(id => setImportedState(id, 'Error al cargar datos importados', 'error'))
  else {
    const hasAny = importedData.movements.length || importedData.inventory.length || importedData.batches.length
    ids.forEach(id => setImportedState(id, hasAny ? '' : 'Sin datos importados todavía'))
  }
}

async function loadImportedData() {
  if (!CU) return
  if (importedLoadPromise) return importedLoadPromise
  importedData.loading = true
  importedData.error = null
  renderImportedStates()
  importedLoadPromise = (async () => {
    try {
      await Promise.all([loadImportedMovements(), loadImportedInventory(), loadImportBatches(), loadBotActions(), loadInventorySaleLinks()])
      importedData.error = null
    } catch (e) {
      importedData.error = e
      console.error('[Kairós] loadImportedData:', e)
    } finally {
      importedData.loading = false
      importedLoadPromise = null
      renderImportedDashboard()
      renderImportedMovements()
      renderImportedInventory()
      renderRecentImports()
      renderBotActionsHistory()
      renderSystemState()
    }
  })()
  return importedLoadPromise
}

async function loadImportedMovements() {
  const { m, y } = getMes()
  const mesStart = `${y}-${String(m).padStart(2, '0')}-01`
  const mesEnd = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  const latest = await sb.from('movimientos_financieros').select('*').eq('user_id', CU.id).order('created_at', { ascending: false }).limit(50)
  const recent = await sb.from('movimientos_financieros').select('*').eq('user_id', CU.id).order('created_at', { ascending: false }).limit(1000)
  if (latest.error) throw latest.error
  if (recent.error) throw recent.error
  importedData.movements = latest.data || []
  importedData.movementsMonth = (recent.data || []).filter(mov => {
    const dateKey = mov.fecha || (mov.created_at ? String(mov.created_at).slice(0, 10) : null)
    return dateKey >= mesStart && dateKey < mesEnd
  })
}

async function loadImportedInventory() {
  const { data, error } = await sb.from('inventario_items').select('*').eq('user_id', CU.id).order('created_at', { ascending: false }).limit(1000)
  if (error) throw error
  importedData.inventory = data || []
  importedData.inventoryLatest = (data || []).slice(0, 50)
}

async function loadImportBatches() {
  const { data, error } = await sb.from('import_batches').select('*').eq('user_id', CU.id).order('created_at', { ascending: false }).limit(25)
  if (error) throw error
  importedData.batches = data || []
}

async function loadBotActions() {
  const { data, error } = await sb.from('bot_actions').select('*').eq('user_id', CU.id).order('created_at', { ascending: false }).limit(30)
  if (error) throw error
  importedData.botActions = data || []
}

async function loadInventorySaleLinks() {
  const { data, error } = await sb.from('venta_items').select('inventory_item_id').eq('user_id', CU.id).limit(1000)
  if (error) throw error
  importedData.inventorySaleIds = new Set((data || []).map(v => v.inventory_item_id).filter(Boolean))
}

function renderImportedDashboard() {
  renderImportedStates()
  const mt = movementTotals(importedData.movementsMonth)
  const st = stockTotals(importedData.inventory)
  S('id-ing', money(mt.ingresos)); S('id-egr', money(mt.egresos)); S('id-bal', money(mt.balance)); S('id-movs', mt.count + ' movimientos del mes')
  S('id-prod', st.count); S('id-stock-costo', money(st.costo)); S('id-stock-venta', money(st.venta))
  S('id-stock-est', `Stock: ${st.rojo} / ${st.amarillo} / ${st.verde}`)
  const br = document.getElementById('id-stock-breakdown')
  if (br) {
    br.innerHTML = st.count
      ? `<div class="mrow"><div class="mlbl">Rojo</div><div class="mval" style="color:var(--red)">${st.rojo}</div></div><div class="mrow"><div class="mlbl">Amarillo</div><div class="mval" style="color:var(--yel)">${st.amarillo}</div></div><div class="mrow"><div class="mlbl">Verde</div><div class="mval" style="color:var(--green)">${st.verde}</div></div>`
      : '<div class="empty" style="padding:20px"><div class="empty-i">·</div>Sin inventario importado</div>'
  }
}

function renderImportedMovements() {
  const rows = importedData.movements || []
  const totals = movementTotals(importedData.movementsMonth)
  S('if-ing', money(totals.ingresos)); S('if-egr', money(totals.egresos)); S('if-bal', money(totals.balance)); S('if-cant', totals.count)
  const tb = document.getElementById('imp-mov-tb')
  if (!tb) return
  tb.innerHTML = !rows.length
    ? '<tr><td colspan="8"><div class="empty"><div class="empty-i">·</div>Sin movimientos importados</div></td></tr>'
    : rows.map(m => `<tr>
        <td style="color:var(--txt3)">${escapeHTML(financeDateKey(m) || '—')}</td>
        <td>${escapeHTML(m.descripcion || '—')}</td>
        <td><span class="badge ${m.tipo === 'ingreso' ? 'bg' : 'br'}">${escapeHTML(m.tipo || '—')}</span></td>
        <td style="font-weight:600;color:${m.tipo === 'ingreso' ? 'var(--green)' : 'var(--red)'}">${money(m.monto)}</td>
        <td>${escapeHTML(m.medio_pago || '—')}</td>
        <td>${escapeHTML(m.categoria || 'sin_categoria')}</td>
        <td>${escapeHTML(m.origen || 'manual')}</td>
        <td><button class="btn btn-del" onclick="deleteImportedMovement('${m.id}')">Eliminar</button></td>
      </tr>`).join('')
}

function renderImportedInventory() {
  const allRows = importedData.inventory || []
  updateProductCategoryFilter(allRows)
  updateProductSummary(allRows)
  const text = V('product-search').trim().toLowerCase()
  const category = V('product-category-filter')
  const state = V('product-state-filter')
  const profit = V('product-profit-filter')
  const uiFiltered = allRows.filter(item => {
    const haystack = [item.producto, item.sku, item.categoria, item.variante, item.color, item.medida].filter(Boolean).join(' ').toLowerCase()
    const margin = productMargin(item)
    const matchesText = !text || haystack.includes(text)
    const matchesCategory = !category || item.categoria === category
    const matchesState = !state || item.estado_stock === state
    const matchesProfit = !profit
      || (profit === 'missing' && margin === null)
      || (profit === 'low' && margin !== null && margin < 20)
      || (profit === 'ok' && margin !== null && margin >= 20)
    return matchesText && matchesCategory && matchesState && matchesProfit
  })
  const filtered = inventoryViewFilter === 'low'
    ? uiFiltered.filter(inventoryNeedsReorder)
    : inventoryViewFilter === 'pricing'
      ? uiFiltered.filter(inventoryHasPricingAlert)
      : uiFiltered
  const rows = filtered.slice(0, 50)
  const totals = stockTotals(allRows)
  S('ip-cant', totals.count); S('ip-costo', money(totals.costo)); S('ip-venta', money(totals.venta)); S('ip-est', `${totals.rojo} / ${totals.amarillo} / ${totals.verde}`)
  const reorderItems = allRows.filter(inventoryNeedsReorder)
  const reorderCost = reorderItems.reduce((sum, item) => sum + inventoryReorderCost(item), 0)
  S('ip-reorder-cost', money(reorderCost))
  S('ip-reorder-note', reorderItems.length ? `${reorderItems.length} producto${reorderItems.length === 1 ? '' : 's'} por debajo o cerca del mínimo` : 'Sin faltantes calculables')
  const filterNote = document.getElementById('inventory-filter-note')
  const filterText = document.getElementById('inventory-filter-text')
  if (filterNote && filterText) {
    const labels = {
      low: `Mostrando ${rows.length} producto${rows.length === 1 ? '' : 's'} con stock bajo o agotado. Están marcados en amarillo.`,
      pricing: `Mostrando ${rows.length} producto${rows.length === 1 ? '' : 's'} con precio, costo o margen para revisar.`
    }
    filterNote.classList.toggle('on', inventoryViewFilter !== 'all')
    filterText.textContent = labels[inventoryViewFilter] || ''
  }
  const badge = { rojo: 'br', amarillo: 'by', verde: 'bg', sin_datos: 'bb' }
  const tb = document.getElementById('imp-inv-tb')
  if (!tb) return
  tb.innerHTML = !allRows.length
    ? `<tr><td colspan="9"><div class="product-empty"><strong>Todavía no hay productos registrados</strong><p>Cree el primer producto para comenzar a gestionar precios, costos, inventario y rentabilidad.</p><button class="btn btn-gold" onclick="showProductQuestion('carga')">Crear producto</button></div></td></tr>`
    : !rows.length
      ? `<tr><td colspan="9"><div class="empty"><div class="empty-i">·</div>No hay productos que coincidan con este filtro</div></td></tr>`
    : rows.map(p => {
      const hasSales = importedData.inventorySaleIds?.has(p.id)
      const highlighted = inventoryViewFilter === 'low' ? inventoryNeedsReorder(p) : inventoryViewFilter === 'pricing' ? inventoryHasPricingAlert(p) : false
      const cost = Number(p.costo_total || p.costo_unitario) || 0
      const price = Number(p.precio_venta_local || p.precio_venta_web) || 0
      const margin = productMargin(p)
      const status = productStateLabel(p)
      const image = productImageUrl(p)
      return `<tr class="${highlighted ? 'attention-row' : ''}">
        <td><div class="product-name-cell">${image ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(p.producto || 'Producto')}">` : `<span>${escapeHTML((p.producto || 'P').slice(0, 1).toUpperCase())}</span>`}<div><strong>${escapeHTML(p.producto || '—')}</strong>${[p.variante, p.color, p.medida].filter(Boolean).length ? `<div class="product-sub">${escapeHTML([p.variante, p.color, p.medida].filter(Boolean).join(' · '))}</div>` : ''}</div></div></td>
        <td><span class="product-sub">${escapeHTML(p.sku || '—')}</span></td>
        <td>${escapeHTML(p.categoria || '—')}</td>
        <td>${cost > 0 ? money(cost) : '<span class="product-muted">Sin dato</span>'}</td>
        <td>${price > 0 ? money(price) : '<span class="product-muted">Sin dato</span>'}</td>
        <td style="color:${margin === null ? 'var(--yel)' : margin >= 25 ? 'var(--green)' : margin >= 0 ? 'var(--yel)' : 'var(--red)'}">${margin === null ? 'No calculado' : fmtDec(margin) + '%'}</td>
        <td>${p.stock_actual ?? '—'}</td>
        <td><span class="badge ${status.cls}">${escapeHTML(status.label)}</span></td>
        <td><div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onclick="editImportedInventoryItem('${p.id}')">Editar</button>
          ${hasSales ? `<button class="btn btn-ghost btn-sm" onclick="archiveImportedInventoryItem('${p.id}')">Archivar</button>` : `<button class="btn btn-del" onclick="deleteImportedInventoryItem('${p.id}')">Eliminar</button>`}
        </div></td>
      </tr>`
    }).join('')
}

function switchProductTab(tab) {
  const inv = document.getElementById('prod-tab-inv-pane')
  const carga = document.getElementById('prod-tab-carga-pane')
  const invBtn = document.getElementById('prod-tab-inv')
  const cargaBtn = document.getElementById('prod-tab-carga')
  if (!inv || !carga) return
  const showCarga = tab === 'carga'
  inv.style.display = showCarga ? 'none' : 'block'
  carga.style.display = showCarga ? 'block' : 'none'
  document.getElementById('prod-advanced')?.classList.toggle('on', showCarga)
  if (invBtn) invBtn.className = 'btn btn-sm ' + (showCarga ? 'btn-ghost' : 'btn-gold')
  if (cargaBtn) cargaBtn.className = 'btn btn-sm ' + (showCarga ? 'btn-gold' : 'btn-ghost')
}

function importedInventoryDerived(stock, stockMin, costo, extra, precioLocal, precioWeb) {
  const costoTotal = costo + extra
  const ganLocal = precioLocal - costoTotal
  const marLocal = precioLocal > 0 ? (ganLocal / precioLocal) * 100 : 0
  const ganWeb = precioWeb - costoTotal
  const marWeb = precioWeb > 0 ? (ganWeb / precioWeb) * 100 : 0
  const estado = stock <= 0 ? 'rojo' : stock <= stockMin ? 'amarillo' : 'verde'
  return {
    costo_total: costoTotal,
    ganancia_local: ganLocal,
    margen_local_pct: marLocal,
    ganancia_web: ganWeb,
    margen_web_pct: marWeb,
    estado_stock: estado,
    accion_recomendada: inventoryAction(stock, stockMin, costoTotal, precioLocal)
  }
}

let editingInventoryId = null

function setEditField(id, value) {
  const el = document.getElementById(id)
  if (el) el.value = value ?? ''
}

function editFieldText(id, label, required = false) {
  const clean = V(id).trim()
  if (required && !clean) throw new Error(`${label} es obligatorio`)
  return clean || null
}

function editFieldNumber(id, label, integer = false) {
  const raw = V(id).trim()
  const parsed = parseNumberValue(raw === '' ? 0 : raw)
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} debe ser un numero mayor o igual a 0`)
  return integer ? Math.trunc(parsed) : parsed
}

function closeImportedInventoryModal() {
  editingInventoryId = null
  const modal = document.getElementById('inv-edit-ov')
  if (modal) modal.classList.remove('on')
}

function editImportedInventoryItem(id) {
  const item = (importedData.inventory || []).find(p => p.id === id) || (importedData.inventoryLatest || []).find(p => p.id === id)
  if (!item) { toastErr('No se encontro el item para editar'); return }
  editingInventoryId = id
  setEditField('ie-producto', item.producto)
  setEditField('ie-categoria', item.categoria)
  setEditField('ie-color', item.color)
  setEditField('ie-medida', item.medida)
  setEditField('ie-stock', item.stock_actual ?? 0)
  setEditField('ie-stock-min', item.stock_minimo ?? 0)
  setEditField('ie-costo', item.costo_unitario ?? 0)
  setEditField('ie-extra', item.costo_extra ?? 0)
  setEditField('ie-precio-local', item.precio_venta_local ?? 0)
  setEditField('ie-precio-web', item.precio_venta_web ?? 0)
  setEditField('ie-proveedor', item.proveedor)
  setEditField('ie-imagen', productImageUrl(item))
  setEditField('ie-notas', String(item.notas || '').replace(/(?:^|\n)Imagen:\s*https?:\/\/\S+\s*/i, '').trim())
  const modal = document.getElementById('inv-edit-ov')
  if (modal) modal.classList.add('on')
}

async function saveImportedInventoryEdit() {
  if (!editingInventoryId) { toastErr('No hay producto para guardar'); return }
  const btn = document.getElementById('ie-save')
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...' }
  try {
    const producto = editFieldText('ie-producto', 'Producto', true)
    const categoria = editFieldText('ie-categoria', 'Categoria')
    const color = editFieldText('ie-color', 'Color')
    const medida = editFieldText('ie-medida', 'Medida')
    const stock = editFieldNumber('ie-stock', 'Stock actual', true)
    const stockMin = editFieldNumber('ie-stock-min', 'Stock minimo', true)
    const costo = editFieldNumber('ie-costo', 'Costo unitario')
    const extra = editFieldNumber('ie-extra', 'Costo extra')
    const precioLocal = editFieldNumber('ie-precio-local', 'Precio venta local')
    const precioWeb = editFieldNumber('ie-precio-web', 'Precio venta web')
    const proveedor = editFieldText('ie-proveedor', 'Proveedor')
    const notas = notesWithProductImage(editFieldText('ie-notas', 'Notas'), V('ie-imagen'))
    const derived = importedInventoryDerived(stock, stockMin, costo, extra, precioLocal, precioWeb)
    const payload = {
      producto, categoria, color, medida,
      stock_actual: stock,
      stock_minimo: stockMin,
      costo_unitario: costo,
      costo_extra: extra,
      precio_venta_local: precioLocal,
      precio_venta_web: precioWeb,
      proveedor,
      notas,
      ...derived
    }
    const { error } = await sb.from('inventario_items').update(payload).eq('id', editingInventoryId).eq('user_id', CU.id)
    if (handleSupaError(error, 'editImportedInventoryItem')) return
    await loadImportedData()
    closeImportedInventoryModal()
    toast('Producto actualizado')
  } catch (e) {
    toastErr(e.message || 'No se pudo actualizar el producto')
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar cambios' }
  }
}

function renderRecentImports() {
  const movs = (importedData.movements || []).slice(0, 8)
  const invs = (importedData.inventoryLatest || []).slice(0, 8)
  const batches = importedData.batches || []
  const mtb = document.getElementById('imp-recent-movs')
  if (mtb) mtb.innerHTML = !movs.length
    ? '<tr><td colspan="4"><div class="empty"><div class="empty-i">·</div>Sin movimientos importados</div></td></tr>'
    : movs.map(m => `<tr><td>${importDate(m.fecha)}</td><td>${escapeHTML(m.descripcion || '—')}</td><td><span class="badge ${m.tipo === 'ingreso' ? 'bg' : 'br'}">${escapeHTML(m.tipo || '—')}</span></td><td>${money(m.monto)}</td></tr>`).join('')
  const itb = document.getElementById('imp-recent-inv')
  if (itb) itb.innerHTML = !invs.length
    ? '<tr><td colspan="4"><div class="empty"><div class="empty-i">·</div>Sin inventario importado</div></td></tr>'
    : invs.map(p => `<tr><td>${escapeHTML(p.producto || '—')}</td><td>${p.stock_actual ?? '—'}</td><td>${money(p.costo_unitario)}</td><td>${money(p.precio_venta_local)}</td></tr>`).join('')
  const btb = document.getElementById('imp-batches-tb')
  if (btb) btb.innerHTML = !batches.length
    ? '<tr><td colspan="7"><div class="empty"><div class="empty-i">📥</div>Sin historial de importaciones</div></td></tr>'
    : batches.map(b => `<tr><td>${importDate(b.created_at)}</td><td>${escapeHTML(b.source || '—')}</td><td>${escapeHTML(b.target || '—')}</td><td><span class="badge ${b.status === 'confirmed' ? 'bg' : b.status === 'failed' ? 'br' : 'by'}">${escapeHTML(b.status || '—')}</span></td><td>${b.total_filas ?? 0}</td><td>${b.filas_validas ?? 0}</td><td>${b.filas_con_error ?? 0}</td></tr>`).join('')
}

function summarizeBotResult(data) {
  const r = data || {}
  if (r.venta_id) return `Venta ${money(r.total)}. Stock ${r.stock_antes ?? '—'} -> ${r.stock_despues ?? '—'}`
  if (r.movimiento_id && r.stock_despues !== undefined) return `Stock ${r.stock_antes ?? '—'} -> ${r.stock_despues ?? '—'}`
  if (r.movimiento_id) return 'Movimiento registrado'
  if (r.inventory_item_id && r.stock_actual !== undefined) return `Producto creado. Stock ${r.stock_actual}`
  if (r.inventory_item_id) return `Stock ${r.stock_antes ?? '—'} -> ${r.stock_despues ?? '—'}`
  return '—'
}

function botActionLabel(type) {
  const labels = { crear_producto: 'Crear producto', venta_stock: 'Venta', gasto: 'Gasto', reposicion: 'Reposición', ajuste_stock: 'Ajuste stock' }
  return labels[type] || type || '—'
}

function botStatusLabel(status) {
  const labels = { preview: 'pendiente', confirmed: 'confirmada', failed: 'fallida', cancelled: 'cancelada' }
  return labels[status] || status || '—'
}

function friendlyBotError(err) {
  const msg = String(err?.message || err || '')
  const t = normalizeText(msg)
  if (t.includes('stock cambio') || t.includes('el stock cambio')) return 'El stock cambió antes de confirmar. Intente nuevamente.'
  if (t.includes('producto no encontrado')) return 'No encontré ese producto. Revise el nombre o créelo primero.'
  if (t.includes('producto ya existe') || t.includes('duplic')) return 'Ese producto ya existe. Use reposición para sumar stock.'
  if (t.includes('falta precio') || t.includes('precio invalido')) return 'Falta el precio de venta. Ejemplo: venta 2 toalla azul a 10000 cada una.'
  if (t.includes('stock insuficiente')) return 'No hay stock suficiente para confirmar esa venta. Revise el inventario.'
  if (t.includes('cantidad invalida')) return 'La cantidad no es válida. Revise el número e intente nuevamente.'
  return msg || 'No se pudo completar la acción.'
}

function renderBotActionsHistory() {
  const rows = importedData.botActions || []
  const tb = document.getElementById('bot-actions-tb')
  const badge = { preview: 'by', confirmed: 'bg', failed: 'br', cancelled: 'bb' }
  if (tb) {
    tb.innerHTML = !rows.length
      ? '<tr><td colspan="7"><div class="empty"><div class="empty-i">IA</div>Sin acciones del Asesor IA</div></td></tr>'
      : rows.map(a => `<tr>
        <td style="color:var(--txt3)">${importDate(a.created_at)}</td>
        <td>${escapeHTML(botActionLabel(a.action_type))}</td>
        <td>${escapeHTML((a.input_text || '—').slice(0, 90))}</td>
        <td><span class="badge ${badge[a.status] || 'bb'}">${escapeHTML(botStatusLabel(a.status))}</span></td>
        <td style="color:${a.error ? 'var(--red)' : 'var(--txt3)'}">${escapeHTML(a.error || '—')}</td>
        <td>${importDate(a.confirmed_at)}</td>
        <td>${escapeHTML(summarizeBotResult(a.result_data))}</td>
      </tr>`).join('')
  }
  renderAIRecentActions()
}

function renderAIRecentActions() {
  const el = document.getElementById('ai-recent-actions')
  if (!el) return
  const rows = (importedData.botActions || []).filter(a => a.status !== 'preview').slice(0, 4)
  if (!rows.length) {
    el.innerHTML = '<div style="font-size:11px;color:var(--txt3)">No hay acciones confirmadas por el momento.</div>'
    return
  }
  const badge = { confirmed: 'bg', failed: 'br', cancelled: 'bb' }
  el.innerHTML = rows.map(a => `
    <button class="ai-history-item" type="button" onclick="showBotActionDetail('${a.id}')">
      <span>${escapeHTML(botActionLabel(a.action_type))}</span>
      <span class="badge ${badge[a.status] || 'by'}">${escapeHTML(botStatusLabel(a.status))}</span>
      <small>${escapeHTML((a.input_text || '—').slice(0, 54))}</small>
      <small>${escapeHTML(importDate(a.confirmed_at || a.created_at))}</small>
    </button>`).join('')
}

function showBotActionDetail(id) {
  const action = (importedData.botActions || []).find(a => a.id === id)
  if (!action) return
  const detail = action.error
    ? `${botActionLabel(action.action_type)}: ${action.error}`
    : `${botActionLabel(action.action_type)}: ${summarizeBotResult(action.result_data)}`
  appendAIMessage(detail, action.status === 'failed' ? 'think' : 'bot')
}

function renderSystemState() {
  const el = document.getElementById('system-state-list')
  if (!el) return
  const actions = importedData.botActions || []
  const last = actions[0]
  const recentLimit = Date.now() - (7 * 24 * 60 * 60 * 1000)
  const recentErrors = actions.filter(a => a.status === 'failed' && new Date(a.created_at || 0).getTime() >= recentLimit).length
  const advisorBlocked = !!last && last.status === 'failed' && /todavia no ejecuta|todavía no ejecuta|could not find the function public\.confirm_bot_action/i.test(String(last.error || ''))
  const items = [
    { ok: !importedData.error, label: 'Supabase conectado', value: importedData.error ? 'Error al cargar datos' : 'OK' },
    { ok: !advisorBlocked, label: 'Asesor IA operativo', value: advisorBlocked ? 'Confirmación RPC pendiente o desactualizada' : 'Preview y confirmación activos' },
    { ok: importedData.inventory.length > 0, label: 'Inventario cargado', value: `${importedData.inventory.length} item(s)` },
    { ok: importedData.movements.length > 0, label: 'Movimientos cargados', value: `${importedData.movements.length} movimiento(s)` },
    { ok: !!last, label: 'Última acción del bot', value: last ? `${botActionLabel(last.action_type)} · ${last.status}` : 'Sin acciones' },
    { ok: recentErrors === 0, label: 'Errores recientes del bot', value: String(recentErrors) }
  ]
  el.innerHTML = items.map(i => `<div class="mrow"><div class="mlbl">${i.ok ? 'OK' : '!'} ${escapeHTML(i.label)}</div><div class="mval" style="font-size:13px;color:${i.ok ? 'var(--txt2)' : 'var(--yel)'}">${escapeHTML(i.value)}</div></div>`).join('')
}

async function deleteImportedMovement(id) {
  if (!confirm('\u00bfEliminar este movimiento importado?')) return
  const { error } = await window.KairosFinanceService.deleteMovement('movimientos_financieros', id)
  if (handleSupaError(error, 'deleteImportedMovement')) return
  await Promise.all([loadImportedData(), renderDash(), renderFin(), renderMet()])
  toast('Movimiento importado eliminado')
}

async function deleteImportedInventoryItem(id) {
  if (!confirm('¿Eliminar este item de inventario importado y sus alias/movimientos de stock?')) return
  const { data: saleRows, error: saleErr } = await sb.from('venta_items').select('id').eq('inventory_item_id', id).eq('user_id', CU.id).limit(1)
  if (handleSupaError(saleErr, 'checkInventorySales')) return
  if ((saleRows || []).length) {
    toastErr('No se puede eliminar porque ya tiene ventas asociadas. Más adelante se podrá archivar.')
    return
  }
  const { error: aliasErr } = await sb.from('inventory_aliases').delete().eq('inventory_item_id', id).eq('user_id', CU.id)
  if (handleSupaError(aliasErr, 'deleteInventoryAliases')) return
  const { error: stockErr } = await sb.from('stock_movements').delete().eq('inventory_item_id', id).eq('user_id', CU.id)
  if (handleSupaError(stockErr, 'deleteInventoryStockMovements')) return
  const { error } = await sb.from('inventario_items').delete().eq('id', id).eq('user_id', CU.id)
  if (handleSupaError(error, 'deleteImportedInventoryItem')) return
  await loadImportedData()
  toast('Item eliminado correctamente')
}

// ══════════════════════════════════════
// CARGA INTELIGENTE
// ══════════════════════════════════════
async function archiveImportedInventoryItem(id) {
  const item = (importedData.inventory || []).find(p => p.id === id) || (importedData.inventoryLatest || []).find(p => p.id === id)
  const hasSales = importedData.inventorySaleIds?.has(id)
  if (!hasSales) { toastErr('Este producto no tiene ventas asociadas. Puede eliminarlo si es una carga de prueba.'); return }
  if (!confirm('¿Archivar este producto con ventas asociadas?')) return
  const payload = {}
  if (item && Object.prototype.hasOwnProperty.call(item, 'archivado')) payload.archivado = true
  else if (item && Object.prototype.hasOwnProperty.call(item, 'activo')) payload.activo = false
  else {
    toastErr('Este producto tiene ventas. Por ahora no se puede borrar; más adelante se archivará.')
    return
  }
  const { error } = await sb.from('inventario_items').update(payload).eq('id', id).eq('user_id', CU.id)
  if (handleSupaError(error, 'archiveImportedInventoryItem')) return
  await loadImportedData()
  toast('Producto archivado')
}

let importRows = []
let importSource = 'manual'
let botActionPreview = null
let botActionSurface = 'import'

function toggleManualImport() {
  const isInv = V('im-man-type') === 'inventario'
  document.getElementById('im-man-fin').style.display = isInv ? 'none' : 'block'
  document.getElementById('im-man-inv').style.display = isInv ? 'block' : 'none'
}

function normalizeText(v) {
  return String(v || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normalizeKey(k) {
  return normalizeText(k).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function rowMap(raw) {
  const out = {}
  Object.entries(raw || {}).forEach(([k, v]) => { out[normalizeKey(k)] = v })
  return out
}

function pick(raw, aliases) {
  const r = rowMap(raw)
  for (const a of aliases) {
    const v = r[normalizeKey(a)]
    if (v !== undefined && v !== null && String(v).trim() !== '') return v
  }
  return ''
}

function parseNumberValue(v) {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN
  let s = String(v).trim().replace(/[^\d,.-]/g, '')
  if (!s) return null
  const hasComma = s.includes(','), hasDot = s.includes('.')
  if (hasComma && hasDot && s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.')
  else if (hasComma && !hasDot) s = s.replace(',', '.')
  else if (hasDot && !hasComma && /\.\d{3}$/.test(s)) s = s.replace(/\./g, '')
  else s = s.replace(/,/g, '')
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

function parseMoneyPhrase(v) {
  if (v === null || v === undefined || v === '') return null
  const text = normalizeText(v)
  const base = parseNumberValue(text)
  if (!Number.isFinite(base)) return base
  if (/\b(mil|k)\b/.test(text)) return base * 1000
  if (/\b(millon|millones|m)\b/.test(text)) return base * 1000000
  return base
}

function stripActionPrefix(text) {
  return String(text || '')
    .replace(/^\s*(registrar|registra|anotar|anota)\s+venta\s*:?\s*/i, '')
    .replace(/^\s*venta\s*:?\s*/i, 'venta ')
    .trim()
}

function normalizeBotInputForParsing(text) {
  return String(text || '')
    .replace(/\b(vndi|vnd[ií]|vendii|bendi|vendy)\b/gi, 'vendi')
    .replace(/\b(x|xq)\s+(mp|mercado pago|efectivo|transferencia|debito|d[eé]bito|credito|cr[eé]dito)\b/gi, 'por $2')
    .replace(/\bwsp\b/gi, 'whatsapp')
    .replace(/\bporfa\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatDateValue(v) {
  if (!v) return null
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10)
  const s = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const dmy = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/)
  if (dmy) {
    const y = dmy[3].length === 2 ? '20' + dmy[3] : dmy[3]
    return `${y}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`
  }
  return s
}

function detectTipo(v) {
  const t = normalizeText(v)
  if (/(venta|ventas|ingreso|entrada|vendi|vendí|cobre|cobro)/.test(t)) return 'ingreso'
  if (/(gasto|gastos|egreso|salida|compra|alquiler|pague|pago)/.test(t)) return 'egreso'
  return ''
}

function detectMedio(v) {
  const t = normalizeText(v)
  if (t.includes('mercado pago') || t.includes('mercado_pago') || /\bmp\b/.test(t)) return 'mercado_pago'
  if (t.includes('transferencia')) return 'transferencia'
  if (t.includes('efectivo')) return 'efectivo'
  if (t.includes('debito')) return 'debito'
  if (t.includes('credito')) return 'credito'
  return ''
}

function detectRowTarget(raw, forced = 'auto') {
  if (forced === 'inventario') return 'inventario_items'
  if (forced === 'movimientos' || forced === 'movimientos_financieros' || forced === 'ingreso' || forced === 'egreso') return 'movimientos_financieros'
  const t = normalizeText(Object.entries(raw || {}).map(([k, v]) => `${k} ${v}`).join(' '))
  if (/(producto|sku|stock|costo|precio|inventario|tengo)/.test(t) && !/(alquiler|gasto alquiler|transferencia)/.test(t)) return 'inventario_items'
  if (/(monto|importe|total|valor|venta|ventas|ingreso|entrada|gasto|egreso|salida|alquiler|compra|vendi|vendí)/.test(t)) return 'movimientos_financieros'
  if (detectMedio(t) || /(^|\s)\$?\s*\d{3,}(?:[.,]\d+)?(\s|$)/.test(t)) return 'movimientos_financieros'
  return 'unknown'
}

function normalizeAliasText(v) {
  return normalizeText(v)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(word => !['un', 'una', 'unos', 'unas', 'el', 'la', 'los', 'las', 'de', 'del'].includes(word))
    .map(word => word.length > 4 && word.endsWith('es') ? word.slice(0, -2) : word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word)
    .join(' ')
}

function oneEditApart(a, b) {
  if (!a || !b || Math.abs(a.length - b.length) > 1) return false
  if (a === b) return true
  let i = 0, j = 0, edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    edits++
    if (edits > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else { i++; j++ }
  }
  return edits + (i < a.length || j < b.length ? 1 : 0) <= 1
}

function textHasApproxToken(text, token) {
  if (!token) return true
  if (text.includes(token)) return true
  if (token.length < 4) return false
  return text.split(' ').some(word => oneEditApart(word, token))
}

function stripBotProductNoise(v) {
  return String(v || '')
    .replace(/\b(?:en|por)\s+(instagram|whatsapp|shopify|web|mercado libre|tiendanube|local|mostrador)\b.*$/gi, ' ')
    .replace(/\b(?:se\s+)?acreditaron?\s+\$?\s*[\d.,]+(?:\s*pesos?)?/gi, ' ')
    .replace(/\b(stock|costo|precio|a|por)\s+\$?\s*[\d.,]+(?:\s*cada\s+una)?/gi, ' ')
    .replace(/\b(stock\s+m[ií]nimo)\s+\$?\s*[\d.,]+/gi, ' ')
    .replace(/\b(en)\s+(efectivo|transferencia|debito|d[eé]bito|credito|cr[eé]dito|mercado pago|mercado_pago)\b/gi, ' ')
    .replace(/\b(efectivo|transferencia|debito|d[eé]bito|credito|cr[eé]dito|mercado pago|mercado_pago)\b/gi, ' ')
    .replace(/\b(cada\s+una|unidad|unidades)\b/gi, ' ')
    .replace(/\bmp\b/gi, ' ')
    .replace(/\b(?:en|por|de)\s*$/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const BOT_QTY_WORDS = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10
}

function readLeadingQuantity(text) {
  let value = String(text || '').trim()
  const numeric = value.match(/^\s*([\d.,]+)\s+/)
  if (numeric) {
    return {
      cantidad: Math.max(1, Math.trunc(parseNumberValue(numeric[1]) || 1)),
      text: value.replace(/^\s*[\d.,]+\s+/, '')
    }
  }
  const word = normalizeText(value).split(/\s+/)[0]
  if (Object.prototype.hasOwnProperty.call(BOT_QTY_WORDS, word)) {
    return {
      cantidad: BOT_QTY_WORDS[word],
      text: value.replace(/^\s*\S+\s+/, '')
    }
  }
  return { cantidad: 1, text: value }
}

function parseStockAdditionCommand(text) {
  const t = normalizeText(text)
  const patterns = [
    /^(?:suma|agrega)\s+([\d.,]+)\s+(?:de\s+)?stock\s+(?:a|al|para)\s+(.+)$/,
    /^(?:suma|agrega)\s+stock\s+([\d.,]+)\s+(?:a|al|para)\s+(.+)$/,
    /^(?:aumenta|incrementa)\s+(?:el\s+)?stock\s+de\s+(.+?)\s+en\s+([\d.,]+)$/,
    /^(?:repone|reponer)\s+([\d.,]+)\s+(.+)$/
  ]
  for (const p of patterns) {
    const m = t.match(p)
    if (!m) continue
    const amountFirst = !p.source.includes('(.+?)\\s+en')
    const cantidad = parseNumberValue(amountFirst ? m[1] : m[2])
    const producto = stripBotProductNoise(amountFirst ? m[2] : m[1])
    return { action_type: 'reposicion', input_text: text, producto, cantidad, costo_unitario: null, medio_pago: detectMedio(text) }
  }
  return null
}

function looksOperationalIntent(text) {
  const t = normalizeText(normalizeBotInputForParsing(stripActionPrefix(text)))
  const stockIntent = /\bstock\b/.test(t) && /(aumenta|aumentar|modifica|modificar|suma|agrega|agregar|repone|reponer|ajusta|ajustar|compra|compre|\d)/.test(t)
  const actionAtStart = /^(vendi|vender|vendimos|venta|registra(?:r)? venta|anota(?:r)? venta|gasto|anota(?:r)? gasto|registra(?:r)? gasto|compre|compra|repone|reponer|agrega(?:r)? producto|crear producto|crea producto|editar producto|edita producto)\b/.test(t)
  return stockIntent || actionAtStart
}

function parseSaleItemText(part) {
  let text = String(part || '').trim()
  if (!text) return null
  const qty = readLeadingQuantity(text)
  const cantidad = qty.cantidad
  text = qty.text
  const priceMatch = text.match(/\b(?:a|por)\s+\$?\s*([\d.,]+(?:\s*(?:mil|k|millon|millones|m))?)/i)
  const precio = priceMatch ? parseMoneyPhrase(priceMatch[1]) : null
  text = text
    .replace(/\b(?:a|por)\s+\$?\s*[\d.,]+(?:\s*(?:mil|k|millon|millones|m))?(?:\s*pesos?)?/gi, ' ')
    .replace(/\b(unidades?|u)\b/gi, ' ')
  const producto = stripBotProductNoise(text)
  return producto ? { producto, cantidad, precio_unitario: precio } : null
}

function parseSaleCommand(text) {
  const clean = stripActionPrefix(text)
  const t = normalizeText(clean)
  if (!/^(vendi|vender|vendimos|venta)\b/.test(t)) return null
  let body = clean.replace(/^\s*(vend[íi]|vendi|vender|vendimos|venta)\s+/i, '')
  const medio = detectMedio(clean)
  body = body.replace(/\s+(?:en|por)\s+(efectivo|transferencia|debito|d[eé]bito|credito|cr[eé]dito|mercado pago|mercado_pago|mp)\b.*$/i, '')
  const parts = body.split(/\s*,\s*|\s+y\s+/i).map(parseSaleItemText).filter(Boolean)
  if (!parts.length) return null
  if (parts.length === 1) return { action_type: 'venta_stock', input_text: text, producto: parts[0].producto, cantidad: parts[0].cantidad, precio_unitario: parts[0].precio_unitario, medio_pago: medio }
  return { action_type: 'venta_multi', input_text: text, items: parts, medio_pago: medio }
}

function parseSaleCommandClean(text) {
  const clean = stripActionPrefix(text)
  const t = normalizeText(clean)
  if (!/^(vendi|vender|vendimos|venta)\b/.test(t)) return null
  const medio = detectMedio(clean)
  const receivedMatch = clean.match(/\bacreditaron?\s+\$?\s*([\d.,]+(?:\s*(?:mil|k|millon|millones|m))?)/i)
  const monto_recibido = receivedMatch ? parseMoneyPhrase(receivedMatch[1]) : null
  const body = clean
    .replace(/^\s*(vend(?:i|í)|vender|vendimos|venta)\s+/i, '')
    .replace(/\b(?:en\s+)?mercado pago\s+se\s+acreditaron?\s+\$?\s*[\d.,]+(?:\s*(?:mil|k|millon|millones|m))?/i, ' ')
    .replace(/\b(?:se\s+)?acreditaron?\s+\$?\s*[\d.,]+(?:\s*(?:mil|k|millon|millones|m))?/i, ' ')
    .replace(/\s+(?:en|por)\s+(efectivo|transferencia|debito|credito|mercado pago|mercado_pago|mp)\b.*$/i, '')
  const parts = body.split(/\s*,\s*|\s+y\s+/i).map(parseSaleItemText).filter(Boolean)
  if (!parts.length) return null
  if (parts.length === 1) {
    return { action_type: 'venta_stock', input_text: text, producto: parts[0].producto, cantidad: parts[0].cantidad, precio_unitario: parts[0].precio_unitario, medio_pago: medio, monto_recibido }
  }
  return { action_type: 'venta_multi', input_text: text, items: parts, medio_pago: medio, monto_recibido }
}

function parseBotCommand(text) {
  const clean = normalizeBotInputForParsing(stripActionPrefix(text))
  const sale = parseSaleCommandClean(clean)
  if (sale) return { ...sale, input_text: text }
  const t = normalizeText(clean)
  const medio = detectMedio(clean)
  const stockAdd = parseStockAdditionCommand(clean)
  if (stockAdd) return stockAdd
  if (/^(agrega|agreg[áa]|crear|crea)\b/.test(t) && /\bproducto\b/.test(t)) {
    let producto = text.replace(/^.*?\bproducto\s+/i, '')
    producto = stripBotProductNoise(producto)
    return {
      action_type: 'crear_producto',
      input_text: text,
      producto,
      stock: parseNumberValue((text.match(/\bstock\s+([\d.,]+)/i) || [])[1]),
      costo: parseNumberValue((text.match(/\bcosto\s+([\d.,]+)/i) || [])[1]),
      precio: parseNumberValue((text.match(/\bprecio\s+([\d.,]+)/i) || [])[1])
    }
  }
  if (/^(vendi|vend[íi]|venta)\b/.test(t)) {
    const qtyMatch = text.match(/^(?:vend[íi]|vendi|venta)\s+([\d.,]+)\s+/i)
    const qty = qtyMatch ? parseNumberValue(qtyMatch[1]) : 1
    const unitMatch = text.match(/\ba\s+\$?\s*([\d.,]+)(?:\s*cada\s+una)?/i)
    const totalMatch = text.match(/\bpor\s+\$?\s*([\d.,]+)/i)
    const precio = unitMatch ? parseNumberValue(unitMatch[1]) : totalMatch ? parseNumberValue(totalMatch[1]) : null
    let producto = text.replace(/^(?:vend[íi]|vendi|venta)\s+/i, '')
    if (qtyMatch) producto = producto.replace(/^[\d.,]+\s+/, '')
    producto = stripBotProductNoise(producto)
    return { action_type: 'venta_stock', input_text: text, producto, cantidad: qty, precio_unitario: precio, medio_pago: medio }
  }
  if (/^(gasto|pague|pagu[ée])\b/.test(t)) {
    const montoMatch = text.match(/\$?\s*([\d.,]+)/i)
    let descripcion = text
      .replace(/^(gasto|pague|pagu[ée])\s+/i, '')
      .replace(/\$?\s*[\d.,]+/i, ' ')
      .replace(/\s+(?:en|por)?\s*(efectivo|transferencia|debito|d[eé]bito|credito|cr[eé]dito|mercado pago|mercado_pago|mp)\b/i, ' ')
      .replace(/\b(?:en|por|de)\s*$/i, ' ')
      .trim()
    return { action_type: 'gasto', input_text: text, descripcion, monto: parseNumberValue(montoMatch ? montoMatch[1] : ''), medio_pago: medio }
  }
  if (/^(compre|compr[ée])\b/.test(t)) {
    const qtyMatch = text.match(/^(?:compr[ée]|compre)\s+([\d.,]+)\s+/i)
    let producto = text.replace(/^(?:compr[ée]|compre)\s+/i, '')
    if (qtyMatch) producto = producto.replace(/^[\d.,]+\s+/, '')
    producto = stripBotProductNoise(producto)
    const costoMatch = text.match(/\bcosto\s+\$?\s*([\d.,]+)/i) || text.match(/\ba\s+\$?\s*([\d.,]+)/i)
    return { action_type: 'reposicion', input_text: text, producto, cantidad: parseNumberValue(qtyMatch ? qtyMatch[1] : ''), costo_unitario: parseNumberValue(costoMatch ? costoMatch[1] : ''), medio_pago: medio }
  }
  if (/^ajusta\s+stock\b/.test(t)) {
    const m = text.match(/stock\s+de\s+(.+?)\s+a\s+([\d.,]+)/i)
    return { action_type: 'ajuste_stock', input_text: text, producto: m ? m[1].trim() : '', stock_final: parseNumberValue(m ? m[2] : '') }
  }
  return null
}

async function findInventoryMatch(productText) {
  const query = normalizeAliasText(productText)
  if (!query) return { status: 'none', matches: [] }
  const invRes = await sb.from('inventario_items').select('id,producto,categoria,color,medida,stock_actual,stock_minimo,costo_unitario,costo_extra,costo_total,precio_venta_local,precio_venta_web').eq('user_id', CU.id).order('created_at', { ascending: false }).limit(1000)
  if (invRes.error) throw invRes.error
  const aliasRes = await sb.from('inventory_aliases').select('inventory_item_id,alias,normalized_alias').eq('user_id', CU.id).limit(1000)
  if (aliasRes.error) throw aliasRes.error
  const aliasesByItem = {}
  ;(aliasRes.data || []).forEach(a => {
    aliasesByItem[a.inventory_item_id] = aliasesByItem[a.inventory_item_id] || []
    aliasesByItem[a.inventory_item_id].push(a)
  })
  const scored = (invRes.data || []).map(item => {
    const productNorm = normalizeAliasText([item.producto, item.categoria, item.color, item.medida].filter(Boolean).join(' '))
    const aliasNorms = (aliasesByItem[item.id] || []).map(a => normalizeAliasText(a.normalized_alias || a.alias))
    const all = [productNorm, ...aliasNorms].filter(Boolean)
    let score = 0
    if (all.some(v => v === query)) score = 100
    else if (all.some(v => v.includes(query) || query.includes(v))) score = 70
    else {
      const qTokens = query.split(' ').filter(Boolean)
      if (qTokens.length && all.some(v => qTokens.every(tok => v.includes(tok)))) score = 60
      else if (qTokens.length && all.some(v => qTokens.every(tok => textHasApproxToken(v, tok)))) score = 55
    }
    return { item, score }
  }).filter(m => m.score > 0).sort((a, b) =>
    b.score - a.score ||
    (Number(b.item.stock_actual) || 0) - (Number(a.item.stock_actual) || 0) ||
    saleItemPrice(b.item) - saleItemPrice(a.item)
  )
  const top = scored.filter(m => m.score === scored[0]?.score)
  if (!top.length) return { status: 'none', matches: [] }
  if (top.length > 1) return { status: 'ambiguous', item: top[0].item, matches: top.map(m => m.item) }
  return { status: 'match', item: top[0].item, matches: [top[0].item] }
}

async function findInventoryDuplicate(productText) {
  const match = await findInventoryMatch(productText)
  if (match.status === 'match') return { exists: true, item: match.item, ambiguous: false }
  if (match.status === 'ambiguous') return { exists: true, matches: match.matches, ambiguous: true }
  return { exists: false, item: null, ambiguous: false }
}

async function resolveSalePreviewItems(command, preview) {
  const rawItems = command.action_type === 'venta_multi'
    ? command.items
    : [{ producto: command.producto, cantidad: command.cantidad, precio_unitario: command.precio_unitario }]
  const resolved = []
  for (const raw of rawItems) {
    const cantidad = raw.cantidad === null ? 1 : Math.max(1, Math.trunc(Number(raw.cantidad) || 1))
    if (!raw.producto) {
      preview.errors.push('Falta producto')
      continue
    }
    const match = await findInventoryMatch(raw.producto)
    if (match.status === 'ambiguous' && match.item) {
      preview.warnings.push(`Interprete "${raw.producto}" como "${saleItemLabel(match.item)}". Revise y confirme si es correcto.`)
      match.status = 'match'
    }
    if (match.status === 'ambiguous') {
      preview.warnings.push(`Hay más de un producto parecido para "${raw.producto}".`)
      preview.canConfirm = false
      continue
    }
    const item = match.item
    if (match.status === 'none') preview.warnings.push(`"${raw.producto}" no esta en inventario. Se registrara como venta manual sin descontar inventario.`)
    const price = Number.isFinite(raw.precio_unitario) && raw.precio_unitario > 0
      ? raw.precio_unitario
      : item ? saleItemPrice(item) : 0
    if (!price) preview.errors.push(`Falta precio para "${raw.producto}".`)
    if (item && cantidad > (Number(item.stock_actual) || 0)) {
      preview.warnings.push(`Inventario insuficiente para "${saleItemLabel(item)}".`)
      preview.canConfirm = false
    }
    resolved.push({
      inventory_item_id: item?.id || null,
      producto_texto: item ? saleItemLabel(item) : raw.producto,
      cantidad,
      precio_unitario: price,
      costo_unitario: item ? saleItemCost(item) : 0
    })
  }
  return resolved
}

function stockState(stock, min) {
  if (stock === null || stock === undefined || !Number.isFinite(Number(stock))) return 'sin_datos'
  const s = Number(stock), m = Number(min) || 0
  return s <= 0 ? 'rojo' : s <= m ? 'amarillo' : 'verde'
}

function inventoryAction(stock, min, costo, precio) {
  const estado = stockState(stock, min)
  if (estado === 'rojo') return 'Reponer urgente / pausar publicacion'
  if (estado === 'amarillo') return 'Reponer / vender con cuidado'
  if (!Number.isFinite(Number(costo)) || !Number.isFinite(Number(precio)) || Number(precio) <= 0) return 'Completar datos para calcular margen'
  const margen = ((Number(precio) - Number(costo)) / Number(precio)) * 100
  return margen >= 25 ? 'Publicar fuerte' : 'Revisar precio o liquidar'
}

async function buildBotActionPreview(command) {
  const preview = { ...command, errors: [], warnings: [], rows: [], match: null, canConfirm: true }
  const addRow = (detail, qty, amount, expected) => {
    preview.rows = [{ action: command.action_type, detail, qty, amount, expected }]
  }
  if (command.action_type === 'crear_producto') {
    if (!command.producto) preview.errors.push('Falta producto')
    else {
      const duplicate = await findInventoryDuplicate(command.producto)
      if (duplicate.exists) preview.errors.push('Ese producto ya existe. Use reposición para sumar stock.')
    }
    ;[['stock', command.stock], ['costo', command.costo], ['precio', command.precio]].forEach(([lbl, val]) => {
      if (val === null) preview.errors.push(`Falta ${lbl}`)
      else if (!Number.isFinite(val) || val < 0) preview.errors.push(`${lbl} invalido`)
    })
    addRow(command.producto || 'Sin producto', Number.isFinite(command.stock) ? command.stock : '—', Number.isFinite(command.precio) ? '$' + fmt(command.precio) : '—', 'Crear inventario, alias y stock inicial')
  } else if (['venta_stock', 'venta_multi'].includes(command.action_type)) {
    const saleItems = await resolveSalePreviewItems(command, preview)
    preview.sale_items = saleItems
    const total = saleItems.reduce((sum, item) => sum + item.cantidad * item.precio_unitario, 0)
    const cost = saleItems.reduce((sum, item) => sum + item.cantidad * item.costo_unitario, 0)
    preview.total = total
    preview.ganancia = total - cost
    preview.monto_recibido = Number(command.monto_recibido) > 0 ? Number(command.monto_recibido) : null
    preview.rows = saleItems.map(item => ({
      action: command.action_type,
      detail: item.producto_texto,
      qty: item.cantidad,
      amount: money(item.cantidad * item.precio_unitario),
      expected: item.inventory_item_id ? 'Registrar venta, ingreso y salida de inventario' : 'Registrar venta con advertencia'
    }))
  } else if (['reposicion', 'ajuste_stock'].includes(command.action_type)) {
    const match = await findInventoryMatch(command.producto)
    preview.match = match
    if (match.status === 'none') preview.errors.push('No encontré ese producto. Revise el nombre o créelo primero.')
    if (match.status === 'ambiguous') { preview.warnings.push('Hay más de un producto parecido'); preview.canConfirm = false }
    const item = match.item
    if (command.action_type === 'venta_stock') {
      if (command.cantidad === null) command.cantidad = 1
      if (!Number.isFinite(command.cantidad) || command.cantidad <= 0) preview.errors.push('Cantidad invalida')
      if (command.precio_unitario === null) preview.errors.push('Falta el precio de venta. Ejemplo: venta 2 toalla azul a 10000 cada una.')
      else if (!Number.isFinite(command.precio_unitario) || command.precio_unitario < 0) preview.errors.push('Falta el precio de venta. Ejemplo: venta 2 toalla azul a 10000 cada una.')
      if (item && Number(item.stock_actual || 0) < command.cantidad) { preview.warnings.push('Stock insuficiente: revisar antes de vender'); preview.canConfirm = false }
      addRow(item?.producto || command.producto || 'Sin producto', command.cantidad || '—', Number.isFinite(command.precio_unitario) ? '$' + fmt(command.precio_unitario * (command.cantidad || 1)) : '—', 'Registrar venta, ingreso y salida de stock')
    }
    if (command.action_type === 'reposicion') {
      if (!Number.isFinite(command.cantidad) || command.cantidad <= 0) preview.errors.push('Cantidad invalida')
      if (command.costo_unitario === null) preview.warnings.push('No se registrara egreso porque falta costo')
      else if (!Number.isFinite(command.costo_unitario) || command.costo_unitario < 0) preview.errors.push('Costo invalido')
      const before = item ? Math.trunc(Number(item.stock_actual) || 0) : null
      const after = item && Number.isFinite(command.cantidad) ? before + Math.trunc(Number(command.cantidad)) : null
      const actionText = after !== null
        ? `Stock: ${before} -> ${after}. ${command.costo_unitario === null ? 'Sin egreso financiero porque falta costo' : 'Subir stock y registrar compra'}`
        : command.costo_unitario === null ? 'Subir stock sin egreso financiero porque falta costo' : 'Subir stock y registrar compra'
      addRow(item?.producto || command.producto || 'Sin producto', command.cantidad || '—', Number.isFinite(command.costo_unitario) ? '$' + fmt(command.costo_unitario * command.cantidad) : '—', actionText)
    }
    if (command.action_type === 'ajuste_stock') {
      if (!Number.isFinite(command.stock_final) || command.stock_final < 0) preview.errors.push('Stock final invalido')
      if (item && Number(item.stock_actual || 0) === Number(command.stock_final)) preview.errors.push('El stock ya esta en ese valor')
      addRow(item?.producto || command.producto || 'Sin producto', Number.isFinite(command.stock_final) ? command.stock_final : '—', '—', 'Ajustar stock al valor indicado')
    }
  } else if (command.action_type === 'gasto') {
    if (!command.descripcion) preview.errors.push('Falta descripcion')
    if (command.monto === null) preview.errors.push('Falta monto')
    else if (!Number.isFinite(command.monto) || command.monto <= 0) preview.errors.push('Monto invalido')
    addRow(command.descripcion || 'Sin descripcion', '—', Number.isFinite(command.monto) ? '$' + fmt(command.monto) : '—', 'Registrar egreso')
  }
  if (preview.errors.length) preview.canConfirm = false
  preview.status = preview.errors.length ? 'error' : preview.warnings.length ? 'revisar' : 'listo'
  return preview
}

function botActionPage(actionType) {
  if (['crear_producto', 'reposicion', 'ajuste_stock'].includes(actionType)) return 'prod'
  if (actionType === 'gasto') return 'fin'
  if (['venta_stock', 'venta_multi'].includes(actionType)) return 'sales'
  return 'dash'
}

function botActionTitle(actionType) {
  const map = { crear_producto: 'Crear producto', venta_stock: 'Registrar venta', venta_multi: 'Registrar venta', gasto: 'Registrar gasto', reposicion: 'Reponer stock', ajuste_stock: 'Ajustar stock' }
  return map[actionType] || 'Acción operativa'
}

function botActionNotes(preview) {
  const notes = [...(preview?.errors || []), ...(preview?.warnings || [])]
  return notes.length ? notes.map(escapeHTML).join('<br>') : 'Listo para confirmar.'
}

function parseNaturalMessage(text, forced = 'auto') {
  const t = normalizeText(text)
  const target = detectRowTarget({ texto: text }, forced)
  if (target === 'movimientos_financieros') {
    const explicitMonto = text.match(/\b(?:por|monto|total|de)\s+\$?\s*([\d.,]+)/i)
    const montoMatch = explicitMonto || text.match(/\$?\s*([\d.,]+)/i)
    const tipo = forced === 'ingreso' ? 'ingreso' : forced === 'egreso' ? 'egreso' : detectTipo(text)
    let descripcion = text
      .replace(/^\s*(vendi|vendí|venta|ingreso|entrada|gasto|egreso|salida|compra)\s+/i, '')
      .replace(/\s+por\s+\$?\s*[\d.,]+/i, '')
      .replace(new RegExp(`\\s*\\$?\\s*${montoMatch ? montoMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : ''}\\s*`, 'i'), ' ')
      .replace(/\s+(en|por)\s+(efectivo|transferencia|debito|débito|credito|crédito|mercado pago|mercado_pago)/i, '')
      .replace(/\s+(efectivo|transferencia|debito|débito|credito|crédito|mercado pago|mercado_pago)$/i, '')
      .trim()
    return { target, raw: { descripcion, monto: montoMatch ? montoMatch[1] : '', tipo, medio_pago: detectMedio(text), categoria: tipo === 'egreso' ? 'gastos' : tipo === 'ingreso' ? 'ventas' : '' } }
  }
  if (target === 'inventario_items') {
    const stock = text.match(/(?:tengo|stock)\s+([\d.,]+)/i)
    const stockMin = text.match(/stock\s+m[ií]nimo\s+([\d.,]+)/i)
    const costo = text.match(/costo\s+([\d.,]+)/i)
    const precio = text.match(/precio\s+([\d.,]+)/i)
    let producto = text
      .replace(/(?:tengo|stock)\s+[\d.,]+\s*/i, '')
      .replace(/costo\s+[\d.,]+/i, '')
      .replace(/precio\s+[\d.,]+/i, '')
      .replace(/stock\s+m[ií]nimo\s+[\d.,]+/i, '')
      .trim()
    return { target, raw: { producto, stock_actual: stock ? stock[1] : '', stock_minimo: stockMin ? stockMin[1] : '', costo_unitario: costo ? costo[1] : '', precio_venta_local: precio ? precio[1] : '' } }
  }
  return { target: 'unknown', raw: { texto: text } }
}

function buildImportRow(rowNumber, target, raw, source) {
  if (target === 'movimientos_financieros') return normalizeFinancialRow(raw, rowNumber, source)
  if (target === 'inventario_items') return normalizeInventoryRow(raw, rowNumber, source)
  return { rowNumber, target: 'unknown', status: 'error', importStatus: 'error', errors: ['No se pudo detectar el destino'], warnings: [], raw, normalized: null, label: 'Sin destino', metric: '—', action: 'Corregir datos' }
}

function normalizeFinancialRow(raw, rowNumber, source = 'manual') {
  const errors = [], warnings = []
  const descripcion = String(pick(raw, ['descripcion', 'descripción', 'detalle', 'concepto', 'producto', 'texto']) || '').trim()
  const montoRaw = pick(raw, ['monto', 'importe', 'total', 'precio', 'valor'])
  const monto = parseNumberValue(montoRaw)
  let tipo = normalizeText(pick(raw, ['tipo', 'movimiento', 'operacion', 'operación']))
  if (!tipo) tipo = detectTipo([descripcion, pick(raw, ['categoria', 'categoría'])].join(' '))
  if (tipo && tipo !== 'ingreso' && tipo !== 'egreso') tipo = detectTipo(tipo)
  const fecha = formatDateValue(pick(raw, ['fecha', 'date', 'dia', 'día']))
  const categoriaRaw = pick(raw, ['categoria', 'categoría', 'rubro'])
  const categoria = String(categoriaRaw || 'sin_categoria').trim() || 'sin_categoria'
  const medio = String(pick(raw, ['medio_pago', 'medio de pago', 'pago', 'forma_pago']) || detectMedio(JSON.stringify(raw))).trim()

  if (!descripcion) errors.push('Falta descripción')
  if (monto === null) errors.push('Falta monto')
  else if (!Number.isFinite(monto) || monto <= 0) errors.push('Monto inválido')
  if (!tipo) errors.push('Falta tipo: ingreso o egreso')
  if (!fecha) warnings.push('Falta fecha')
  if (!categoriaRaw) warnings.push('Falta categoría')

  const status = errors.length ? 'error' : warnings.length ? 'revisar' : 'listo'
  return {
    rowNumber,
    target: 'movimientos_financieros',
    status,
    importStatus: errors.length ? 'error' : warnings.length ? 'warning' : 'valid',
    errors,
    warnings,
    raw,
    normalized: { user_id: CU.id, fecha, descripcion, monto: Number.isFinite(monto) ? monto : 0, tipo, medio_pago: medio || null, categoria, mes: fecha ? fecha.slice(0, 7) : null, origen: source },
    label: descripcion || 'Sin descripción',
    metric: Number.isFinite(monto) ? '$' + fmt(monto) : '—',
    action: errors.length ? 'Corregir datos' : warnings.length ? 'Confirmar con aviso' : 'Guardar'
  }
}

function normalizeInventoryRow(raw, rowNumber, source = 'manual') {
  const errors = [], warnings = []
  const producto = String(pick(raw, ['producto', 'nombre', 'item', 'descripcion', 'descripción']) || '').trim()
  const stock = parseNumberValue(pick(raw, ['stock_actual', 'stock', 'cantidad', 'unidades']))
  const stockMin = parseNumberValue(pick(raw, ['stock_minimo', 'stock mínimo', 'minimo', 'mínimo']))
  const costo = parseNumberValue(pick(raw, ['costo_unitario', 'costo', 'costo unitario']))
  const extra = parseNumberValue(pick(raw, ['costo_extra', 'extra', 'costo extra']))
  const precioLocal = parseNumberValue(pick(raw, ['precio_venta_local', 'precio_local', 'precio', 'precio venta local']))
  const precioWeb = parseNumberValue(pick(raw, ['precio_venta_web', 'precio_web', 'precio venta web']))

  if (!producto) errors.push('Falta producto')
  ;[['stock', stock], ['costo', costo], ['precio', precioLocal]].forEach(([lbl, n]) => {
    if (n === null) warnings.push(`Falta ${lbl}`)
    else if (!Number.isFinite(n) || n < 0) errors.push(`${lbl} inválido`)
  })
  ;[['stock mínimo', stockMin], ['costo extra', extra], ['precio web', precioWeb]].forEach(([lbl, n]) => {
    if (n !== null && (!Number.isFinite(n) || n < 0)) errors.push(`${lbl} inválido`)
  })

  const stockVal = Number.isFinite(stock) ? Math.trunc(stock) : null
  const minVal = Number.isFinite(stockMin) ? Math.trunc(stockMin) : 0
  const costoVal = Number.isFinite(costo) ? costo : null
  const extraVal = Number.isFinite(extra) ? extra : 0
  const costoTotal = costoVal !== null ? costoVal + extraVal : null
  const localVal = Number.isFinite(precioLocal) ? precioLocal : null
  const webVal = Number.isFinite(precioWeb) ? precioWeb : null
  const ganLocal = localVal !== null && costoTotal !== null ? localVal - costoTotal : 0
  const marLocal = localVal > 0 ? (ganLocal / localVal) * 100 : 0
  const ganWeb = webVal !== null && costoTotal !== null ? webVal - costoTotal : 0
  const marWeb = webVal > 0 ? (ganWeb / webVal) * 100 : 0
  let estado = 'sin_datos'
  if (stockVal !== null) estado = stockVal <= 0 ? 'rojo' : stockVal <= minVal ? 'amarillo' : 'verde'

  let accion = 'Completar datos para calcular margen'
  if (stockVal !== null && stockVal <= 0) accion = 'Reponer urgente / pausar publicación'
  else if (stockVal !== null && stockVal <= minVal) accion = 'Reponer / vender con cuidado'
  else if (costoVal === null || localVal === null) accion = 'Completar datos para calcular margen'
  else if (marLocal < 25) accion = 'Revisar precio o liquidar'
  else accion = 'Publicar fuerte'

  const status = errors.length ? 'error' : warnings.length ? 'revisar' : 'listo'
  return {
    rowNumber,
    target: 'inventario_items',
    status,
    importStatus: errors.length ? 'error' : warnings.length ? 'warning' : 'valid',
    errors,
    warnings,
    raw,
    normalized: {
      user_id: CU.id,
      sku: String(pick(raw, ['sku']) || '').trim() || null,
      categoria: String(pick(raw, ['categoria', 'categoría']) || '').trim() || null,
      producto,
      variante: String(pick(raw, ['variante']) || '').trim() || null,
      medida: String(pick(raw, ['medida', 'talle', 'tamaño']) || '').trim() || null,
      color: String(pick(raw, ['color']) || '').trim() || null,
      stock_actual: stockVal,
      stock_minimo: minVal,
      costo_unitario: costoVal,
      costo_extra: extraVal,
      costo_total: costoTotal,
      precio_venta_local: localVal,
      precio_venta_web: webVal,
      ganancia_local: ganLocal,
      margen_local_pct: marLocal,
      ganancia_web: ganWeb,
      margen_web_pct: marWeb,
      estado_stock: estado,
      accion_recomendada: accion,
      proveedor: String(pick(raw, ['proveedor']) || '').trim() || null,
      notas: String(pick(raw, ['notas', 'nota']) || '').trim() || null,
      origen: source
    },
    label: producto || 'Sin producto',
    metric: stockVal !== null ? String(stockVal) : '—',
    action: errors.length ? 'Corregir datos' : accion
  }
}

async function applyInventoryDuplicateCheck(row) {
  if (row.target !== 'inventario_items' || !row.normalized?.producto) return row
  const duplicate = await findInventoryDuplicate(row.normalized.producto)
  if (!duplicate.exists) return row
  row.errors.push('Producto ya existente: use reposición o edite el existente.')
  row.status = 'error'
  row.importStatus = 'error'
  row.action = 'Corregir datos'
  return row
}

async function analyzeImportRows(rows, source = 'manual', forced = 'auto') {
  try {
    importSource = source
    botActionPreview = null
    document.getElementById('im-bot-preview-card').style.display = 'none'
    importRows = await Promise.all(rows.map(async (raw, i) => {
      const parsed = raw?.target ? raw : { target: detectRowTarget(raw, forced), raw }
      return applyInventoryDuplicateCheck(buildImportRow(i + 1, parsed.target, parsed.raw || raw, source))
    }))
    renderImportPreview()
  } catch (e) {
    handleSupaError(e, 'analyzeImportRows')
  }
}

async function handleSmartMessage() {
  const msg = V('im-msg').trim()
  if (!msg) { toastErr('Escriba un mensaje para analizar'); return }
  const command = parseBotCommand(msg)
  if (command) {
    try {
      botActionPreview = await buildBotActionPreview(command)
      importRows = []
      renderBotActionPreview()
      return
    } catch (e) {
      handleSupaError(e, 'bot_preview')
      return
    }
  }
  const parsed = parseNaturalMessage(msg, V('im-kind'))
  await analyzeImportRows([parsed], 'mensaje', parsed.target === 'unknown' ? 'auto' : parsed.target)
}

async function handleImportFile() {
  const file = document.getElementById('im-file').files[0]
  if (!file) { toastErr('Seleccione un archivo'); return }
  if (!window.XLSX) { toastErr('No se pudo cargar el lector de archivos'); return }
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
  if (!rows.length) { toastErr('El archivo no tiene filas para importar'); return }
  await analyzeImportRows(rows, file.name, V('im-file-kind'))
}

async function handleManualPrepare() {
  if (V('im-man-type') === 'inventario') {
    await analyzeImportRows([{
      producto: V('im-p-prod'), sku: V('im-p-sku'), categoria: V('im-p-cat'), variante: V('im-p-var'), medida: V('im-p-med'), color: V('im-p-col'),
      stock_actual: V('im-p-stock'), stock_minimo: V('im-p-min'), costo_unitario: V('im-p-costo'), costo_extra: V('im-p-extra'),
      precio_venta_local: V('im-p-plocal'), precio_venta_web: V('im-p-pweb'), proveedor: V('im-p-prov'), notas: V('im-p-notas')
    }], 'manual', 'inventario')
  } else {
    await analyzeImportRows([{ fecha: V('im-f-fecha'), descripcion: V('im-f-desc'), monto: V('im-f-monto'), tipo: V('im-f-tipo'), medio_pago: V('im-f-medio'), categoria: V('im-f-cat') }], 'manual', 'auto')
  }
}

function renderBotActionPreview(surface = 'import') {
  botActionSurface = surface
  if (surface === 'ai') { renderAIBotActionPreview(); return }
  document.getElementById('im-summary-card').style.display = 'none'
  document.getElementById('im-preview-card').style.display = 'none'
  const card = document.getElementById('im-bot-preview-card')
  const btn = document.getElementById('im-bot-confirm-btn')
  if (!botActionPreview) {
    card.style.display = 'none'
    return
  }
  card.style.display = 'block'
  if (btn) { btn.disabled = !botActionPreview.canConfirm; btn.textContent = botActionPreview.canConfirm ? 'Confirmar acción' : 'No se puede confirmar' }
  const b = { listo: 'bg', revisar: 'by', error: 'br' }
  const notes = [...botActionPreview.errors, ...botActionPreview.warnings].map(escapeHTML).join('<br>') || '—'
  document.getElementById('im-bot-preview').innerHTML = botActionPreview.rows.map(r => {
    return `<tr><td>${escapeHTML(r.action)}</td><td>${escapeHTML(r.detail)}</td><td>${escapeHTML(r.qty)}</td><td>${escapeHTML(r.amount)}</td><td><span class="badge ${b[botActionPreview.status]}">${botActionPreview.status}</span></td><td style="color:${botActionPreview.errors.length ? 'var(--red)' : botActionPreview.warnings.length ? 'var(--yel)' : 'var(--txt3)'}">${notes}</td><td>${escapeHTML(r.expected)}</td></tr>`
  }).join('')
}

function renderAIBotActionPreview() {
  const box = document.getElementById('ai-msgs')
  if (!box || !botActionPreview) return
  const old = document.getElementById('ai-bot-action-preview')
  if (old) old.remove()
  const rows = botActionPreview.rows.length ? botActionPreview.rows : [{ detail: '—', qty: '—', amount: '—', expected: '—' }]
  const expected = rows.length > 1 ? `Registrar venta con ${rows.length} items, ingreso y salida de inventario` : rows[0].expected
  const detailRows = rows.map((row, index) => `
      <div class="ai-action-row"><div class="ai-action-l">${rows.length > 1 ? `Item ${index + 1}` : 'Detalle'}</div><div class="ai-action-v">${escapeHTML(row.detail)}</div></div>
      <div class="ai-action-row"><div class="ai-action-l">Cantidad</div><div class="ai-action-v">${escapeHTML(row.qty)}</div></div>
      <div class="ai-action-row"><div class="ai-action-l">Monto</div><div class="ai-action-v">${escapeHTML(row.amount)}</div></div>
    `).join('')
  const totalRow = rows.length > 1
    ? `<div class="ai-action-row"><div class="ai-action-l">Total</div><div class="ai-action-v">${money(botActionPreview.total || 0)}</div></div>`
    : ''
  const b = { listo: 'bg', revisar: 'by', error: 'br' }
  const div = document.createElement('div')
  div.className = 'ai-action'
  div.id = 'ai-bot-action-preview'
  div.innerHTML = `
    <div class="ai-action-t">${escapeHTML(botActionTitle(botActionPreview.action_type))}</div>
    <div class="ai-action-grid">
      ${detailRows}
      ${totalRow}
      <div class="ai-action-row"><div class="ai-action-l">Estado</div><div class="ai-action-v"><span class="badge ${b[botActionPreview.status] || 'bb'}">${escapeHTML(botActionPreview.status)}</span></div></div>
    </div>
    <div class="ai-action-note" style="color:${botActionPreview.errors.length ? 'var(--red)' : botActionPreview.warnings.length ? 'var(--yel)' : 'var(--txt2)'}">${botActionNotes(botActionPreview)}</div>
    <div class="ai-action-note">${escapeHTML(expected)}</div>
    <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
      <button class="btn btn-ghost btn-sm" onclick="cancelAIBotAction()">Cancelar</button>
      <button class="btn btn-gold btn-sm" id="ai-bot-confirm-btn" onclick="confirmBotAction('ai')" ${botActionPreview.canConfirm ? '' : 'disabled'}>${botActionPreview.canConfirm ? 'Confirmar acción' : 'No se puede confirmar'}</button>
    </div>
  `
  box.appendChild(div)
  box.scrollTop = box.scrollHeight
}

function renderImportPreview() {
  document.getElementById('im-summary-card').style.display = 'none'
  document.getElementById('im-bot-preview-card').style.display = 'none'
  document.getElementById('im-preview-card').style.display = importRows.length ? 'block' : 'none'
  const btn = document.getElementById('im-confirm-btn')
  const hasValidRows = importRows.some(row => row.status !== 'error')
  if (btn) {
    btn.disabled = !hasValidRows
    btn.textContent = hasValidRows ? 'Confirmar carga' : 'No hay filas válidas'
  }
  const b = { listo: 'bg', revisar: 'by', error: 'br' }
  document.getElementById('im-preview').innerHTML = importRows.map(r => {
    const notes = [...r.errors, ...r.warnings].map(escapeHTML).join('<br>') || '—'
    return `<tr><td>${r.rowNumber}</td><td>${r.target === 'inventario_items' ? 'Producto/stock' : r.target === 'movimientos_financieros' ? 'Movimiento' : 'Sin destino'}</td><td>${escapeHTML(r.label)}</td><td>${escapeHTML(r.metric)}</td><td><span class="badge ${b[r.status]}">${r.status}</span></td><td style="color:${r.errors.length ? 'var(--red)' : r.warnings.length ? 'var(--yel)' : 'var(--txt3)'}">${notes}</td><td>${escapeHTML(r.action)}</td></tr>`
  }).join('')
}

async function confirmImport() {
  if (!importRows.length) { toastErr('No hay preview para confirmar'); return }
  const btn = document.getElementById('im-confirm-btn')
  if (btn.disabled) return
  const validRows = importRows.filter(r => r.status !== 'error')
  if (!validRows.length) { toastErr('No hay filas válidas para guardar'); return }
  btn.disabled = true; btn.textContent = 'Guardando...'
  const targets = [...new Set(importRows.map(r => r.target).filter(t => t !== 'unknown'))]
  const batchTarget = targets.length === 1 ? targets[0] : targets.length > 1 ? 'mixed' : 'unknown'
  let batchId = null
  const failBatch = async () => {
    if (batchId) await sb.from('import_batches').update({ status: 'failed' }).eq('id', batchId).eq('user_id', CU.id)
  }

  const { data: batch, error: bErr } = await sb.from('import_batches').insert({
    user_id: CU.id, source: importSource, target: batchTarget, status: 'preview',
    nombre_archivo: importSource === 'manual' || importSource === 'mensaje' ? null : importSource,
    total_filas: importRows.length,
    filas_validas: validRows.length,
    filas_con_error: importRows.length - validRows.length
  }).select('id').single()
  if (handleSupaError(bErr, 'import_batch')) { btn.disabled = false; btn.textContent = 'Confirmar carga'; return }
  batchId = batch.id

  const importPayload = importRows.map(r => ({
    batch_id: batchId,
    user_id: CU.id,
    row_number: r.rowNumber,
    raw_data: r.raw || {},
    normalized_data: r.normalized,
    errors: [...r.errors, ...r.warnings],
    status: r.importStatus
  }))
  const { error: rowsErr } = await sb.from('import_rows').insert(importPayload)
  if (handleSupaError(rowsErr, 'import_rows')) { await failBatch(); btn.disabled = false; btn.textContent = 'Confirmar carga'; return }

  const { data: rpcResult, error: rpcErr } = await sb.rpc('confirm_import_batch', { batch_id: batchId })
  if (handleSupaError(rpcErr, 'confirm_import_batch')) { await failBatch(); btn.disabled = false; btn.textContent = 'Confirmar carga'; return }
  if (!rpcResult || rpcResult.ok === false || rpcResult.status === 'failed') {
    toastErr(rpcResult?.error || 'No se pudo confirmar la carga')
    btn.disabled = false
    btn.textContent = 'Confirmar carga'
    return
  }

  renderImportSummary(validRows)
  importRows = []
  btn.disabled = true; btn.textContent = 'Carga confirmada'
  invalidateUnifiedFinances()
  await Promise.all([loadImportedData(), renderDash(), renderFin(), renderMet()])
  toast('Carga confirmada')
}

function cancelAIBotAction() {
  botActionPreview = null
  botActionSurface = 'import'
  const old = document.getElementById('ai-bot-action-preview')
  if (old) old.remove()
  const box = document.getElementById('ai-msgs')
  if (box) {
    const div = document.createElement('div')
    div.className = 'ai-msg ai-thnk'
    div.textContent = 'Acción cancelada. No se guardó nada.'
    box.appendChild(div)
    box.scrollTop = box.scrollHeight
  }
}

async function confirmBotAction(surface = botActionSurface) {
  if (!botActionPreview) { toastErr('No hay acción para confirmar'); return }
  if (!botActionPreview.canConfirm) { toastErr('Esta acción necesita corrección antes de guardar'); return }
  const btn = document.getElementById(surface === 'ai' ? 'ai-bot-confirm-btn' : 'im-bot-confirm-btn')
  if (btn.disabled) return
  btn.disabled = true; btn.textContent = 'Ejecutando...'
  const previewData = JSON.parse(JSON.stringify(botActionPreview))
  const actionType = botActionPreview.action_type
  if (['venta_stock', 'venta_multi'].includes(actionType)) {
    try {
      const result = await registerSale({
        fecha: today(),
        medio_pago: botActionPreview.medio_pago || '',
        monto_recibido: botActionPreview.monto_recibido || null,
        origen: 'bot',
        notas: botActionPreview.input_text,
        items: botActionPreview.sale_items || []
      })
      if (result.error) throw result.error
      await sb.from('bot_actions').insert({
        user_id: CU.id,
        input_text: previewData.input_text,
        action_type: actionType,
        status: 'confirmed',
        preview_data: previewData,
        result_data: { sale_id: result.saleId, total: result.total, profit: result.profit }
      })
      botActionPreview = null
      botActionSurface = 'import'
      btn.disabled = true; btn.textContent = 'Accion confirmada'
      await refreshAfterSale()
      if (surface === 'ai') {
        const old = document.getElementById('ai-bot-action-preview')
        if (old) old.remove()
        appendAIMessage(`Venta confirmada por ${money(result.total)}. Se actualizaron ventas, caja e inventario.`, 'bot')
        goPage('sales')
        closeAI()
      } else {
        document.getElementById('im-bot-preview-card').style.display = 'none'
      }
      toast('Venta registrada')
    } catch (e) {
      const friendly = friendlyBotError(e)
      btn.disabled = false; btn.textContent = 'Confirmar acción'
      if (surface === 'ai') appendAIMessage(friendly, 'think')
      toastErr(friendly)
    }
    return
  }
  const { data: action, error: actionErr } = await sb.from('bot_actions').insert({
    user_id: CU.id,
    input_text: botActionPreview.input_text,
    action_type: botActionPreview.action_type,
    status: 'preview',
    preview_data: previewData
  }).select('id').single()
  if (handleSupaError(actionErr, 'bot_actions')) { btn.disabled = false; btn.textContent = 'Confirmar acción'; return }

  try {
    const { data: rpcResult, error: rpcErr } = await sb.rpc('confirm_bot_action', { action_id: action.id })
    if (rpcErr) throw rpcErr
    if (!rpcResult || rpcResult.ok === false || rpcResult.status === 'failed') {
      throw new Error(rpcResult?.error || 'No se pudo confirmar la acción')
    }
    botActionPreview = null
    botActionSurface = 'import'
    btn.disabled = true; btn.textContent = 'Acción confirmada'
    invalidateUnifiedFinances()
    invalidateSalesSummary()
    await Promise.all([loadImportedData(), renderDash(), renderFin(), renderSales(), renderMet()])
    if (surface === 'ai') {
      const old = document.getElementById('ai-bot-action-preview')
      if (old) old.remove()
      appendAIMessage('Acción confirmada. Se actualizaron los datos y se abrirá la sección correspondiente.', 'bot')
      goPage(botActionPage(actionType))
      closeAI()
    } else {
      document.getElementById('im-bot-preview-card').style.display = 'none'
    }
    toast('Acción confirmada')
  } catch (e) {
    const friendly = friendlyBotError(e)
    await sb.from('bot_actions').update({ status: 'failed', error: friendly }).eq('id', action.id).eq('user_id', CU.id)
    btn.disabled = false; btn.textContent = 'Confirmar acción'
    if (surface === 'ai') appendAIMessage(friendly, 'think')
    console.error('[Kairós] confirmBotAction:', e)
    toastErr(friendly)
    await loadImportedData()
  }
}

function renderImportSummary(validRows) {
  const warnings = importRows.filter(r => r.status === 'revisar').length
  const errors = importRows.filter(r => r.status === 'error').length
  const movs = validRows.filter(r => r.target === 'movimientos_financieros').map(r => r.normalized)
  const invs = validRows.filter(r => r.target === 'inventario_items').map(r => r.normalized)
  const ing = movs.filter(m => m.tipo === 'ingreso').reduce((a, b) => a + (b.monto || 0), 0)
  const egr = movs.filter(m => m.tipo === 'egreso').reduce((a, b) => a + (b.monto || 0), 0)
  const stockCosto = invs.reduce((a, p) => a + ((p.stock_actual || 0) * (p.costo_total || 0)), 0)
  const stockVenta = invs.reduce((a, p) => a + ((p.stock_actual || 0) * (p.precio_venta_local || p.precio_venta_web || 0)), 0)
  S('im-s-ok', validRows.length); S('im-s-warn', warnings); S('im-s-err', errors); S('im-s-prod', invs.length)
  S('im-s-ing', '$' + fmt(ing)); S('im-s-egr', '$' + fmt(egr)); S('im-s-costo', '$' + fmt(stockCosto)); S('im-s-venta', '$' + fmt(stockVenta))
  document.getElementById('im-summary-card').style.display = 'block'
}

function resetImport() {
  importRows = []
  botActionPreview = null
  document.getElementById('im-preview-card').style.display = 'none'
  document.getElementById('im-bot-preview-card').style.display = 'none'
  document.getElementById('im-summary-card').style.display = 'none'
  document.getElementById('im-preview').innerHTML = ''
  document.getElementById('im-bot-preview').innerHTML = ''
}

// ══════════════════════════════════════
// AI — SEGURO VIA EDGE FUNCTION
// ══════════════════════════════════════
let aiH = []

function resetAdvisorState() {
  aiH = []
  botActionPreview = null
  botActionSurface = 'import'
  if (importedData) importedData.botActions = []

  const input = document.getElementById('ai-inp')
  if (input) input.value = ''

  const box = document.getElementById('ai-msgs')
  if (box) {
    box.innerHTML = `
      <div class="ai-msg ai-bot">Puede consultar sobre el negocio o preparar una acción para revisar y confirmar.<span class="ai-msg-meta">Asesor · ahora</span></div>
      <div class="ai-quick-actions">
        <button class="ai-quick-action" onclick="seedAIExample('Vendí una remera por Mercado Pago')">Registrar venta</button>
        <button class="ai-quick-action" onclick="seedAIExample('Pagué alquiler 250000 por transferencia')">Anotar gasto</button>
        <button class="ai-quick-action" onclick="seedAIExample('Crear producto buzo oversize stock 10 costo 28000 precio 64000')">Crear producto</button>
        <button class="ai-quick-action" onclick="seedAIExample('Sumar 10 unidades al stock de remera boxy blanca')">Sumar stock</button>
      </div>`
  }

  const recent = document.getElementById('ai-recent-actions')
  if (recent) recent.innerHTML = '<div style="font-size:11px;color:var(--txt3)">No hay acciones confirmadas por el momento.</div>'

  const aiPreview = document.getElementById('ai-bot-action-preview')
  if (aiPreview) aiPreview.remove()

  const importPreview = document.getElementById('im-bot-preview')
  if (importPreview) importPreview.innerHTML = ''

  ;['im-bot-preview-card', 'im-preview-card', 'im-summary-card'].forEach(id => {
    const el = document.getElementById(id)
    if (el) el.style.display = 'none'
  })

  closeAI()
}

function openAI() {
  document.getElementById('ai-panel').classList.add('on')
  document.getElementById('ai-ov').classList.add('on')
  renderAIRecentActions()
  if (CU) loadImportedData()
  setTimeout(() => document.getElementById('ai-inp').focus(), 300)
}
function closeAI() {
  document.getElementById('ai-panel')?.classList.remove('on')
  document.getElementById('ai-ov')?.classList.remove('on')
}

function aiClock() {
  return new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(new Date())
}

function appendAIMessage(text, type = 'bot') {
  const box = document.getElementById('ai-msgs')
  const div = document.createElement('div')
  div.className = type === 'user' ? 'ai-msg ai-usr' : type === 'think' ? 'ai-msg ai-thnk' : 'ai-msg ai-bot'
  if (type === 'bot') div.innerHTML = mdToHtml(String(text))
  else div.textContent = String(text)
  const meta = document.createElement('span')
  meta.className = 'ai-msg-meta'
  meta.textContent = `${type === 'user' ? 'Usuario' : 'Asesor'} · ${aiClock()}`
  div.appendChild(meta)
  box.appendChild(div)
  box.scrollTop = box.scrollHeight
  return div
}

function advisorFallbackReply(message) {
  const text = normalizeText(message)
  const finance = window.KairosFinanceService.getUnifiedFinanceCache()?.totals || { ingresos: 0, egresos: 0, balance: 0 }
  const stock = stockTotals(importedData.inventory || [])
  if (/\bmargen\b/.test(text)) {
    return '**Margen de venta** es el porcentaje del precio que queda después de descontar el costo del producto. Fórmula: `(precio - costo) / precio × 100`. No es lo mismo que caja ni contempla automáticamente todos los gastos fijos.'
  }
  if (/ganancia|rentabilidad/.test(text)) {
    return '**Ganancia de ventas** es lo vendido menos el costo de los productos vendidos. Para saber si el negocio completo es rentable también hay que considerar personal, alquiler, impuestos y otros gastos.'
  }
  if (/punto de equilibrio|gastos fijos/.test(text)) {
    return 'Kairós usa los gastos fijos cargados como referencia mensual de cobertura. Cuando los ingresos superan esa referencia, los gastos fijos están cubiertos; todavía hay que revisar costos variables y costo del equipo.'
  }
  if (/stock|inventario|reponer/.test(text)) {
    return stock.count
      ? `Hay **${stock.count} productos** en el inventario: ${stock.rojo} en rojo, ${stock.amarillo} en amarillo y ${stock.verde} en verde. Abra Productos → “Reposición necesaria” para revisar los que requieren reposición.`
      : 'No hay productos en el inventario nuevo. Puede crear uno desde Productos o escribir: “agregar producto toalla azul stock 10 costo 5000 precio 10000”.'
  }
  if (/como esta|como va|resumen|estado del negocio/.test(text)) {
    return `Este mes entraron **${money(finance.ingresos)}**, salieron **${money(finance.egresos)}** y el resultado de caja es **${money(finance.balance)}**. El inventario tiene ${stock.count} productos y ${stock.rojo + stock.amarillo} requieren atención de stock.`
  }
  return 'El asesor online no respondió; se muestra una respuesta local de respaldo. Puedo explicar margen, ganancia, gastos fijos, stock o resumir el negocio. Las acciones operativas mantienen vista previa y confirmación antes de guardar.'
}

function needsLocalBusinessAdvice(message) {
  const text = normalizeText(message)
  return /(conviene|recomienda|recomendar|que hago|que hacer|deberia|revisar primero|reviso primero|que reviso|q reviso|caja negativa|caja esta mal|como esta|estado del negocio|resumen|reponer|inventario|publicidad|equipo|pagar|invertir|prioridad)/.test(text)
}

async function buildLocalBusinessAdvice(message) {
  const { m, y } = getMes()
  const monthStart = `${y}-${String(m).padStart(2, '0')}-01`
  const monthEnd = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  await loadImportedData()
  const [finance, sales, fixedResult, teamPaymentsResult] = await Promise.all([
    loadUnifiedFinances(true),
    loadSalesSummary(true),
    sb.from('gastos_fijos').select('mon').eq('user_id', CU.id),
    sb.from('team_payments').select('tipo,monto').eq('user_id', CU.id).gte('fecha', monthStart).lt('fecha', monthEnd)
  ])
  const fixedTotal = (fixedResult.data || []).reduce((sum, row) => sum + (Number(row.mon) || 0), 0)
  const teamPaid = (teamPaymentsResult.data || [])
    .filter(payment => !['retiro_duenio', 'distribucion_utilidad'].includes(payment.tipo))
    .reduce((sum, payment) => sum + (Number(payment.monto) || 0), 0)
  const stock = stockTotals(importedData.inventory || [])
  const lowStock = (importedData.inventory || []).filter(inventoryNeedsReorder).slice(0, 4).map(item => item.producto)
  const coverage = fixedTotal > 0 ? Math.min(100, Math.round((finance.totals.ingresos / fixedTotal) * 100)) : 0
  const suggestions = []
  if (lowStock.length) suggestions.push(`Reponer primero: ${lowStock.join(', ')}.`)
  else suggestions.push('Mantener reposición normal: no hay faltantes críticos visibles.')
  if (finance.totals.balance > 0 && coverage >= 100) suggestions.push(`Separar una reserva antes de aumentar publicidad. Caja disponible: ${money(finance.totals.balance)}.`)
  if (sales.margin >= 35 && finance.totals.balance > 0) suggestions.push('Aumentar publicidad de forma gradual puede tener sentido si el inventario alcanza.')
  if (teamPaid > 0) suggestions.push(`El equipo ya registra ${money(teamPaid)} pagados este mes; cualquier pago adicional conviene compararlo contra reserva y tareas pendientes.`)

  return [
    `Con los datos actuales, julio muestra ${money(finance.totals.ingresos)} ingresados, ${money(finance.totals.egresos)} gastados y una caja de ${money(finance.totals.balance)}.`,
    `Ventas: ${sales.count} operaciones, ${money(sales.total)} vendidos, ganancia comercial ${money(sales.profit)} y margen ${fmtDec(sales.margin)}%.`,
    `Gastos fijos: ${money(fixedTotal)} con ${coverage}% cubierto. Inventario: ${stock.count} productos, ${stock.rojo + stock.amarillo} requieren atención.`,
    `Recomendación: ${suggestions.join(' ')}`,
    'Orden sugerido: 1) asegurar inventario de productos con mayor salida, 2) reservar caja para gastos y equipo, 3) aumentar publicidad de forma gradual.'
  ].join('\n\n')
}

async function sendAI() {
  const inp = document.getElementById('ai-inp')
  const msg = inp.value.trim(); if (!msg) return
  inp.value = ''
  const box = document.getElementById('ai-msgs')

  // Crear nodo de mensaje usuario (sin innerHTML con datos del usuario)
  appendAIMessage(msg, 'user')

  const loadDiv = appendAIMessage('Analizando...', 'think')
  loadDiv.textContent = 'Analizando...'

  aiH.push({ role: 'user', content: msg })

  try {
    const command = parseBotCommand(msg)
    if (command) {
      botActionPreview = await buildBotActionPreview(command)
      loadDiv.remove()
      renderBotActionPreview('ai')
      return
    }

    // Llamada segura via Edge Function, sin API key en el frontend.
    if (looksOperationalIntent(msg)) {
      loadDiv.remove()
      appendAIMessage('Para modificar stock necesito producto y cantidad con más claridad. Ejemplo: "sumar 10 de stock a prueba ia azul" o "ajustar stock de prueba ia azul a 20".', 'bot')
      return
    }

    if (needsLocalBusinessAdvice(msg)) {
      const localReply = await buildLocalBusinessAdvice(msg)
      loadDiv.remove()
      aiH.push({ role: 'assistant', content: localReply })
      if (aiH.length > 20) aiH = aiH.slice(-20)
      appendAIMessage(localReply, 'bot')
      return
    }

    const { data, error } = await sb.functions.invoke('ai-advisor', {
      body: { message: msg, history: aiH.slice(-18), style: 'Español neutro, formal y directo. No usar voseo ni regionalismos argentinos.' }
    })

    loadDiv.remove()

    if (error) {
      const fallback = advisorFallbackReply(msg)
      aiH.push({ role: 'assistant', content: fallback })
      if (aiH.length > 20) aiH = aiH.slice(-20)
      appendAIMessage(fallback, 'bot')
      console.warn('[Kairós] ai-advisor no disponible; se usó el modo de respaldo:', error)
      return
    }

    const reply = data?.reply || 'No se pudo procesar la consulta.'
    aiH.push({ role: 'assistant', content: reply })
    if (aiH.length > 20) aiH = aiH.slice(-20)

    appendAIMessage(reply, 'bot')

  } catch (e) {
    loadDiv.remove()
    appendAIMessage(advisorFallbackReply(msg), 'bot')
    console.warn('[Kairós] ai-advisor no disponible; se usó el modo de respaldo:', e)
  }
}

// ── MARKDOWN SIMPLE PARA CHAT IA ──────
function mdToHtml(text) {
  return text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/^#{1,3}\s+(.+)$/gm,'<strong>$1</strong>')
    .replace(/\n/g,'<br>')
}

// ══════════════════════════════════════
// RENDER ALL
// ══════════════════════════════════════
async function renderAll() {
  const biz = await getBiz()
  loadBizForm(biz)
  await Promise.all([loadAng(), renderFin(), renderSales(), renderProds(), renderLeads(), renderPub(), renderCont(), renderRefs(), renderMet(), renderDash(), loadImportedData()])
}

// ══════════════════════════════════════
// RESET PASSWORD
// ══════════════════════════════════════
async function checkRecovery() {
  // Supabase manda el token en el hash de la URL
  const hash = window.location.hash
  if (hash.includes('type=recovery')) {
    // Supabase JS detecta el token del hash automáticamente
    const { data: { session } } = await sb.auth.getSession()
    if (session) {
      // Hay sesión activa por token de recovery — mostrar pantalla de reset
      document.getElementById('loading').classList.add('hide')
      document.getElementById('reset-screen').style.display = 'flex'
      return true
    }
  }
  return false
}

async function doReset() {
  const pass  = document.getElementById('reset-pass').value
  const pass2 = document.getElementById('reset-pass2').value
  const err   = document.getElementById('reset-err')
  const ok    = document.getElementById('reset-ok')
  err.style.display = 'none'; ok.style.display = 'none'

  if (!pass || pass.length < 6) { err.textContent = 'La contraseña debe tener al menos 6 caracteres'; err.style.display = 'block'; return }
  if (pass !== pass2) { err.textContent = 'Las contraseñas no coinciden'; err.style.display = 'block'; return }

  const btn = document.getElementById('reset-btn'); btn.disabled = true; btn.textContent = 'Guardando...'
  const { error } = await sb.auth.updateUser({ password: pass })
  btn.disabled = false; btn.textContent = 'Guardar nueva contraseña'

  if (error) { err.textContent = error.message; err.style.display = 'block'; return }

  ok.textContent = 'Contraseña actualizada. Redirigiendo...'
  ok.style.display = 'block'
  // Limpiar el hash de la URL
  window.history.replaceState(null, '', window.location.pathname)
  setTimeout(async () => {
    document.getElementById('reset-screen').style.display = 'none'
    await sb.auth.signOut()
    document.getElementById('auth-screen').style.display = 'flex'
  }, 2000)
}

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════
Object.assign(window, {
  addPosItem,
  changePosQty,
  clearPosCart,
  confirmPosSale,
  renderSalesCatalog
})

document.addEventListener('DOMContentLoaded', init)

// ══════════════════════════════════════
// CASH SESSION — apertura, movimientos y cierre simple
// ══════════════════════════════════════
let cashSessionState = { session: null, summary: null, loading: false, available: true }

function setCashLoading(loading) {
  cashSessionState.loading = loading
  const btn = document.getElementById('cash-open-btn')
  if (btn) {
    btn.disabled = loading
    btn.textContent = loading ? 'Procesando...' : 'Abrir caja'
  }
}

function renderCashSession() {
  const openPanel = document.getElementById('cash-open-panel')
  const activePanel = document.getElementById('cash-active-panel')
  const unavailable = document.getElementById('cash-unavailable')
  if (!openPanel || !activePanel) return

  unavailable.hidden = cashSessionState.available
  if (!cashSessionState.available) {
    openPanel.hidden = true
    activePanel.hidden = true
    S('cash-status-pill', 'Pendiente')
    S('cash-status-copy', 'El control de caja todavía no está habilitado en la base de datos.')
    return
  }

  const isOpen = Boolean(cashSessionState.session)
  openPanel.hidden = isOpen
  activePanel.hidden = !isOpen
  S('cash-status-pill', isOpen ? 'Caja abierta' : 'Caja cerrada')
  S('cash-status-copy', isOpen
    ? 'Kairós está controlando los movimientos en efectivo de esta sesión.'
    : 'Abrí la caja para controlar automáticamente el efectivo que entra y sale.')

  if (!isOpen) return
  const summary = cashSessionState.summary || {}
  S('cash-opening-view', money(summary.opening_amount || cashSessionState.session.saldo_inicial || 0))
  S('cash-income-view', money(summary.cash_income || 0))
  S('cash-expense-view', money(summary.cash_expense || 0))
  S('cash-expected-view', money(summary.expected_cash || cashSessionState.session.saldo_inicial || 0))
}

async function loadCashSession() {
  if (!CU || cashSessionState.loading) return
  setCashLoading(true)
  try {
    const { data, error } = await sb.from('cash_sessions')
      .select('*')
      .eq('user_id', CU.id)
      .eq('estado', 'abierta')
      .order('abierta_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      if (/cash_sessions|schema cache|does not exist/i.test(error.message || '')) {
        cashSessionState = { session: null, summary: null, loading: false, available: false }
        renderCashSession()
        return
      }
      throw error
    }

    cashSessionState.available = true
    cashSessionState.session = data || null
    cashSessionState.summary = null

    if (data) {
      const result = await sb.rpc('get_cash_session_summary', { session_id: data.id })
      if (result.error) throw result.error
      cashSessionState.summary = result.data || null
    }
    renderCashSession()
  } catch (error) {
    console.error('[Kairós] loadCashSession:', error)
    toast('No pudimos cargar el estado de caja')
  } finally {
    setCashLoading(false)
  }
}

async function openCashSession() {
  if (!CU || cashSessionState.loading) return
  const amount = Number(V('cash-opening-amount') || 0)
  if (!Number.isFinite(amount) || amount < 0) {
    toast('Ingresá un efectivo inicial válido')
    return
  }
  setCashLoading(true)
  const { data, error } = await sb.rpc('open_cash_session', {
    opening_amount: amount,
    opening_notes: V('cash-opening-notes').trim() || null,
    register_id: null,
  })
  setCashLoading(false)
  if (error) {
    toast(error.message || 'No pudimos abrir la caja')
    return
  }
  toast('Caja abierta')
  await loadCashSession()
}

async function recordCashAdjustment() {
  const session = cashSessionState.session
  const amount = Number(V('cash-adjustment-amount'))
  const description = V('cash-adjustment-description').trim()
  if (!session) return
  if (!Number.isFinite(amount) || amount <= 0) {
    toast('Ingresá un monto mayor a cero')
    return
  }
  if (!description) {
    toast('Contanos qué movimiento estás registrando')
    return
  }

  const { error } = await sb.rpc('record_cash_adjustment', {
    session_id: session.id,
    adjustment_type: V('cash-adjustment-type'),
    adjustment_amount: amount,
    adjustment_description: description,
    adjustment_date: today(),
  })
  if (error) {
    toast(error.message || 'No pudimos registrar el movimiento')
    return
  }
  document.getElementById('cash-adjustment-amount').value = ''
  document.getElementById('cash-adjustment-description').value = ''
  toast('Movimiento de caja registrado')
  await Promise.all([loadCashSession(), renderFin(), loadImportedData()])
}

async function closeCashSession() {
  const session = cashSessionState.session
  const counted = Number(V('cash-counted-amount'))
  if (!session) return
  if (!Number.isFinite(counted) || counted < 0) {
    toast('Ingresá el efectivo que contaste')
    return
  }

  const { data, error } = await sb.rpc('close_cash_session', {
    session_id: session.id,
    counted_cash: counted,
    closing_notes: V('cash-closing-notes').trim() || null,
  })
  if (error) {
    toast(error.message || 'No pudimos cerrar la caja')
    return
  }

  const result = document.getElementById('cash-close-result')
  if (result) {
    const difference = Number(data?.difference || 0)
    result.hidden = false
    result.className = 'cash-close-result ' + (difference === 0 ? 'ok' : 'warn')
    result.textContent = difference === 0
      ? 'Caja exacta: el efectivo contado coincide.'
      : `Diferencia de caja: ${money(difference)}.`
  }
  cashSessionState.session = null
  cashSessionState.summary = null
  renderCashSession()
  toast('Caja cerrada')
}
