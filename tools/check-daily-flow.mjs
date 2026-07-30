import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const html = readFileSync('index.html', 'utf8')

const navMatch = html.match(/<nav class="mobile-nav"[\s\S]*?<\/nav>/)
assert.ok(navMatch, 'Mobile navigation not found')
const mobileNav = navMatch[0]
const buttons = [...mobileNav.matchAll(/<button\b/g)]
assert.equal(buttons.length, 5, 'Mobile navigation must have exactly five destinations')

for (const label of ['Hoy', 'Vender', 'Productos', 'Dinero', 'Más']) {
  assert.match(mobileNav, new RegExp(`<span>${label}<\\/span>`), `Missing mobile destination: ${label}`)
}

const managementMatch = html.match(/<details class="mobile-more">[\s\S]*?<\/details>/)
assert.ok(managementMatch, 'Mobile management panel not found')
const management = managementMatch[0]
assert.match(management, /<summary>Más<\/summary>/, 'Secondary panel must use the Más label')

const configEntries = [...management.matchAll(/<span>Configuración<\/span>/g)]
assert.equal(configEntries.length, 1, 'Management must contain a single Configuración entry')

const desktopLabels = ['Hoy', 'Vender', 'Productos', 'Dinero']
for (const label of desktopLabels) {
  assert.match(html, new RegExp(`<span>${label}<\\/span>`), `Missing desktop destination: ${label}`)
}

assert.match(html, /Lo importante de hoy/, 'Daily dashboard heading missing')
assert.match(html, /Vendido este mes/, 'Sold amount label missing')
assert.match(html, /Cobrado este mes/, 'Collected amount label missing')
assert.match(html, /Pendiente de cobro/, 'Pending amount label missing')

console.log('Daily flow contracts ok')
