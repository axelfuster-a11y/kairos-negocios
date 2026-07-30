import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const html = readFileSync('index.html', 'utf8')
const app = readFileSync('assets/app.js', 'utf8')
const css = readFileSync('assets/styles.css', 'utf8')

const metricHelp = [...html.matchAll(/class="metric-help"[^>]*>/g)]
assert.ok(metricHelp.length >= 3, 'Expected dashboard help controls')
for (const [index, match] of metricHelp.entries()) {
  assert.match(match[0], /onclick="toggleInfo\(event,this\)"/, `Help control ${index + 1} must stop card navigation`)
  assert.match(match[0], /tabindex="0"/, `Help control ${index + 1} must support keyboard focus`)
}
assert.match(css, /\.metric-help\.on::after/, 'Tapped help must remain visible')
assert.match(app, /\.info-dot\.on,\.metric-help\.on/, 'Help state selector must include metric help')

const firstActionBlock = html.match(/<div class="channel-options" aria-label="Primera acción">[\s\S]*?<\/div>/)?.[0]
assert.ok(firstActionBlock, 'First action selection missing')
const choices = [...firstActionBlock.matchAll(/type="radio"/g)]
assert.equal(choices.length, 4, 'Expected four first action choices')
for (const action of ['Crear productos', 'Registrar una venta', 'Ordenar el dinero', 'Ver el resumen']) {
  assert.match(firstActionBlock, new RegExp(action), `Missing first action: ${action}`)
}
assert.match(app, /input\[name="first_action"\]:checked/, 'Onboarding must route to the selected first action')
assert.match(css, /\.channel-option:has\(\.channel-checkbox:checked\)/, 'Selected action needs visible feedback')
assert.match(css, /appearance:auto!important/, 'Radios must keep native mobile behavior')

console.log('Mobile help and onboarding action contracts ok')
