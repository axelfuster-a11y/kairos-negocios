import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const html = readFileSync('index.html', 'utf8')
const app = readFileSync('assets/app.js', 'utf8')
const guardStart = app.indexOf('function neutralizeAdvisorReply')
const guardEnd = app.indexOf('function appendAIMessage')
assert.ok(guardStart >= 0 && guardEnd > guardStart, 'Advisor language guard missing')
const appWithoutLanguageGuard = app.slice(0, guardStart) + app.slice(guardEnd)
const visibleCopy = `${html}\n${appWithoutLanguageGuard}`

assert.match(app, /AI_LANGUAGE_INSTRUCTIONS/, 'Advisor language instructions missing')
assert.match(app, /español neutro latinoamericano/i, 'Advisor must request neutral Spanish')
assert.match(app, /No usar voseo, modismos, regionalismos/i, 'Advisor must reject regional language')
assert.match(app, /language:\s*'es-419'/, 'Advisor request must declare the neutral Latin American locale')
assert.match(app, /neutralizeAdvisorReply\(data\?\.reply/, 'Remote advisor replies must pass through the neutral language guard')

for (const regionalism of ['querés', 'preguntale', 'ingresá', 'contaste', 'tenés', 'podés', 'hacé', 'elegí', 'guardá', 'registrá', 'decime', 'contanos', 'administrás']) {
  assert.doesNotMatch(visibleCopy, new RegExp(`\\b${regionalism}\\b`, 'i'), `Regional wording found: ${regionalism}`)
}

console.log('Advisor neutral language contracts ok')
