import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../supabase/functions/ai-advisor/index.ts', import.meta.url), 'utf8')

assert.match(source, /gemini-2\.5-flash/)
assert.match(source, /MAX_OUTPUT_TOKENS = 4096/)
assert.match(source, /finishReason === "MAX_TOKENS"/)
assert.match(source, /content\?\.parts \?\? \[\]/)
assert.match(source, /español neutro latinoamericano/)
assert.match(source, /entre 120 y 250 palabras/)
assert.match(source, /preguntas simples en 1 a 3 oraciones/)
assert.doesNotMatch(source, /español argentino|Hablás|Sos un asesor/)
assert.doesNotMatch(source, /FIN DE LA RESPUESTA/)
assert.doesNotMatch(source, /maxOutputTokens:\s*1024/)

console.log('AI advisor truncation check ok')
