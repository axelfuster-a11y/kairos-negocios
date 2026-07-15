import fs from 'node:fs'
import vm from 'node:vm'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const migration = fs.readFileSync('supabase/migrations/012_sales_payments_core.sql', 'utf8')
assert(migration.includes('create table if not exists public.sale_payments'), 'sale_payments table is missing')
assert(migration.includes("estado_cobro in ('pendiente', 'parcial', 'cobrada')"), 'payment status contract is missing')
assert(migration.includes('v_profit := v_total - v_cost'), 'profit must be based on sale total, not received amount')
assert(migration.includes('coalesce(v_inv.costo_total, v_inv.costo_unitario, 0)'), 'server-side inventory cost lookup is missing')
assert(migration.includes("'Cobro de venta'"), 'financial movement must represent a payment, not the sale itself')
assert(migration.includes('if v_received > 0 then'), 'zero-payment sales must not create cash movements')

const context = { window: {} }
vm.createContext(context)
vm.runInContext(fs.readFileSync('assets/js/domain/sales.js', 'utf8'), context)

const domain = context.window.KairosSalesDomain
assert(domain, 'KairosSalesDomain is not exposed')

const partial = domain.calculateSale([{ quantity: 1, unitPrice: 100, unitCost: 40 }], 60)
assert(partial.total === 100, 'sale total calculation failed')
assert(partial.received === 60, 'received amount calculation failed')
assert(partial.pending === 40, 'pending balance calculation failed')
assert(partial.profit === 60, 'profit must remain total minus cost')
assert(partial.paymentStatus === 'parcial', 'partial payment status failed')

const unpaid = domain.calculateSale([{ quantity: 2, unitPrice: 50, unitCost: 10 }], 0)
assert(unpaid.total === 100 && unpaid.received === 0 && unpaid.pending === 100, 'unpaid sale calculation failed')
assert(unpaid.profit === 80, 'unpaid sale profit must still reflect commercial profit')
assert(unpaid.paymentStatus === 'pendiente', 'pending payment status failed')

const overpaid = domain.calculateSale([{ quantity: 1, unitPrice: 100, unitCost: 20 }], 150)
assert(overpaid.received === 100 && overpaid.pending === 0, 'received amount must be capped at sale total')
assert(overpaid.paymentStatus === 'cobrada', 'paid status failed')

console.log('Core Flow V2 checks ok')
