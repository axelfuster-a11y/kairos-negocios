import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const handlerAttrs = ['onclick', 'onchange', 'oninput', 'onkeydown']
const html = readFileSync('index.html', 'utf8')
const appFiles = collectJs('assets')
const source = appFiles.map(file => readFileSync(file, 'utf8')).join('\n')

function collectJs(path) {
  if (!existsSync(path)) return []
  const stat = statSync(path)
  if (stat.isFile()) return extname(path) === '.js' ? [path] : []
  return readdirSync(path).flatMap(name => collectJs(join(path, name)))
}

const declared = new Set()
for (const match of source.matchAll(/(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)) declared.add(match[1])
for (const match of source.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=/g)) declared.add(match[1])

const allowed = new Set([
  'alert', 'confirm', 'parseFloat', 'parseInt', 'Number', 'String',
  'Date', 'Math', 'setTimeout', 'clearTimeout',
  'if',
])

const suspicious = []

for (const attr of handlerAttrs) {
  const pattern = new RegExp(`\\b${attr}="([^"]+)"`, 'g')
  for (const match of html.matchAll(pattern)) {
    const expression = match[1]
    const calls = [...expression.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)].map(call => call[1])
    for (const name of calls) {
      if (declared.has(name) || allowed.has(name)) continue
      suspicious.push({ attr, name, expression })
    }
  }
}

if (suspicious.length) {
  console.error('Suspicious inline handler calls found:')
  for (const item of suspicious) {
    console.error(`- ${item.attr}: ${item.name}() in "${item.expression}"`)
  }
  process.exit(1)
}

console.log(`Inline handlers ok (${declared.size} callable names scanned)`)
