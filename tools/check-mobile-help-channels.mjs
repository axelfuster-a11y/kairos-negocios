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

const channelBlock = html.match(/<div id="w-canales"[\s\S]*?<\/div>/)?.[0]
assert.ok(channelBlock, 'Channel selection block missing')
const checkboxes = [...channelBlock.matchAll(/type="checkbox"/g)]
assert.ok(checkboxes.length >= 8, 'Expected multiple sales channel choices')
for (const channel of ['Instagram', 'Facebook', 'WhatsApp', 'Shopify', 'Tienda Nube', 'Página web propia']) {
  assert.match(channelBlock, new RegExp(channel), `Missing sales channel: ${channel}`)
}
assert.match(app, /querySelectorAll\('#w-canales input:checked'\)/, 'Onboarding must save every checked channel')
assert.match(css, /\.channel-option:has\(\.channel-checkbox:checked\)/, 'Selected channels need visible feedback')
assert.match(css, /appearance:auto!important/, 'Checkboxes must keep native mobile behavior')

console.log('Mobile help and channel selection contracts ok')
