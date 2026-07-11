import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const html = readFileSync('index.html', 'utf8')
const app = readFileSync('assets/app.js', 'utf8')
const css = readFileSync('assets/styles.css', 'utf8')

const ids = [
  'cash-control-card',
  'cash-status-copy',
  'cash-status-pill',
  'cash-open-panel',
  'cash-opening-amount',
  'cash-open-btn',
  'cash-active-panel',
  'cash-opening-view',
  'cash-income-view',
  'cash-expense-view',
  'cash-expected-view',
  'cash-adjustment-type',
  'cash-adjustment-amount',
  'cash-adjustment-description',
  'cash-counted-amount',
  'cash-close-result',
  'cash-unavailable',
]
for (const id of ids) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `Missing cash UI element: ${id}`)
}

for (const fn of [
  'loadCashSession',
  'openCashSession',
  'recordCashAdjustment',
  'closeCashSession',
  'renderCashSession',
]) {
  assert.match(app, new RegExp(`(?:async\\s+)?function\\s+${fn}\\s*\\(`), `Missing cash UI function: ${fn}`)
}

for (const rpc of [
  'open_cash_session',
  'get_cash_session_summary',
  'record_cash_adjustment',
  'close_cash_session',
]) {
  assert.match(app, new RegExp(`sb\\.rpc\\(['"]${rpc}['"]`), `Missing cash RPC connection: ${rpc}`)
}

assert.match(app, /Number\.isFinite\(amount\) \|\| amount < 0/, 'Opening amount validation missing')
assert.match(app, /Number\.isFinite\(counted\) \|\| counted < 0/, 'Counted cash validation missing')
assert.match(app, /cash_sessions\|schema cache\|does not exist/i, 'Missing migration fallback')
assert.match(css, /\.cash-actions-grid/, 'Cash responsive styles missing')
assert.match(css, /@media\(max-width:560px\)/, 'Cash mobile layout missing')

console.log('Cash UI contracts ok')
