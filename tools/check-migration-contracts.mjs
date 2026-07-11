import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const migrationDir = 'supabase/migrations'
const files = readdirSync(migrationDir)
  .filter(file => /^\d{3}_.+\.sql$/.test(file))
  .sort()

assert.ok(files.length >= 9, 'Expected migrations 001 through 009')

const numbers = files.map(file => Number(file.slice(0, 3)))
assert.equal(new Set(numbers).size, numbers.length, 'Migration numbers must be unique')
for (let i = 1; i < numbers.length; i += 1) {
  assert.equal(numbers[i], numbers[i - 1] + 1, `Migration gap before ${files[i]}`)
}

const sql = files
  .map(file => readFileSync(join(migrationDir, file), 'utf8'))
  .join('\n')
  .toLowerCase()

const requiredTables = [
  'movimientos_financieros',
  'inventario_items',
  'stock_movements',
  'ventas',
  'venta_items',
  'team_payments',
  'audit_events',
  'cash_registers',
  'cash_sessions',
]
for (const table of requiredTables) {
  assert.match(sql, new RegExp(`create table if not exists public\\.${table}|create table public\\.${table}`), `Missing table contract: ${table}`)
  assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`), `RLS missing: ${table}`)
}

const requiredFunctions = [
  'confirm_bot_action',
  'record_team_payment',
  'confirm_import_batch',
  'create_inventory_item',
  'get_integrity_summary',
  'open_cash_session',
  'record_cash_adjustment',
  'get_cash_session_summary',
  'close_cash_session',
]
for (const fn of requiredFunctions) {
  assert.match(sql, new RegExp(`function public\\.${fn}\\s*\\(`), `Missing RPC: ${fn}`)
}

const bot = readFileSync(join(migrationDir, '003_confirm_bot_action_rpc.sql'), 'utf8').toLowerCase()
for (const contract of [
  /auth\.uid\(\)/,
  /for update/,
  /insert into public\.ventas/,
  /insert into public\.venta_items/,
  /insert into public\.movimientos_financieros/,
  /insert into public\.stock_movements/,
  /stock_actual = v_after/,
  /v_gain := v_total - v_cost/,
]) {
  assert.match(bot, contract, `Sale contract missing: ${contract}`)
}

const team = readFileSync(join(migrationDir, '004_team_compensation.sql'), 'utf8').toLowerCase()
assert.match(team, /payment_amount is null or payment_amount <= 0/, 'Team payment must reject non-positive amounts')
assert.match(team, /insert into public\.movimientos_financieros/, 'Team payment must create a financial movement')
assert.match(team, /insert into public\.team_payments/, 'Team payment must create a payment record')

const hardening = readFileSync(join(migrationDir, '008_integrity_audit_reconciliation.sql'), 'utf8').toLowerCase()
for (const contract of [
  /stock_despues = stock_antes \+ cantidad/,
  /team_payments_movement_user_fk/,
  /create table if not exists public\.audit_events/,
  /with \(security_invoker = true\)/,
  /v_stock_reconciliation/,
  /v_team_payment_reconciliation/,
]) {
  assert.match(hardening, contract, `Integrity contract missing: ${contract}`)
}

const frontendFiles = [
  'index.html',
  'assets/app.js',
  'assets/js/services/financeService.js',
]
for (const file of frontendFiles) {
  const content = readFileSync(file, 'utf8')
  assert.doesNotMatch(content, /service_role/i, `Forbidden service role reference in ${file}`)
  assert.doesNotMatch(content, /sk-[a-z0-9_-]{20,}/i, `Possible secret in ${file}`)
}

console.log(`Migration contracts ok: ${files.length} migrations checked`)


const cash = readFileSync(join(migrationDir, '009_cash_sessions.sql'), 'utf8').toLowerCase()
for (const contract of [
  /uq_open_cash_session_per_business/,
  /cash_session_id/,
  /lower\(coalesce\(new\.medio_pago, ''\)\) = 'efectivo'/,
  /v_expected := v_session\.saldo_inicial \+ v_income - v_expense/,
  /v_difference := counted_cash - v_expected/,
  /adjustment_amount is null or adjustment_amount <= 0/,
  /estado = 'cerrada'/,
]) {
  assert.match(cash, contract, `Cash session contract missing: ${contract}`)
}
