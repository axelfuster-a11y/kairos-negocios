import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const html = readFileSync('index.html', 'utf8')

const navMatch = html.match(/<nav class="mobile-nav"[\s\S]*?<\/nav>/)
assert.ok(navMatch, 'Mobile navigation not found')
const mobileNav = navMatch[0]
const buttons = [...mobileNav.matchAll(/<button\b/g)]
assert.equal(buttons.length, 5, 'Mobile navigation must have exactly five destinations')

for (const label of ['Hoy', 'Vender', 'Productos', 'Dinero', 'Gestión']) {
  assert.match(mobileNav, new RegExp(`<span>${label}<\\/span>`), `Missing mobile destination: ${label}`)
}

const managementMatch = html.match(/<details class="mobile-more">[\s\S]*?<\/details>/)
assert.ok(managementMatch, 'Mobile management panel not found')
const management = managementMatch[0]
assert.match(management, /<summary>Gestión<\/summary>/, 'Management panel must use the Gestión label')

const configEntries = [...management.matchAll(/<span>Configuración<\/span>/g)]
assert.equal(configEntries.length, 1, 'Management must contain a single Configuración entry')

const desktopLabels = ['Hoy', 'Vender', 'Productos', 'Dinero']
for (const label of desktopLabels) {
  assert.match(html, new RegExp(`<span>${label}<\\/span>`), `Missing desktop destination: ${label}`)
}

assert.match(html, /Lo importante de hoy/, 'Daily dashboard heading missing')
assert.match(html, /Dinero disponible/, 'Plain-language cash label missing')
assert.match(html, /Ganancia del mes/, 'Plain-language profit label missing')

console.log('Daily flow contracts ok')
