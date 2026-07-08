import { readFileSync } from 'node:fs'

const html = readFileSync('index.html', 'utf8')
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])
const seen = new Set()
const duplicates = new Set()

for (const id of ids) {
  if (seen.has(id)) duplicates.add(id)
  seen.add(id)
}

if (duplicates.size) {
  console.error('Duplicate HTML ids found:')
  for (const id of duplicates) console.error(`- ${id}`)
  process.exit(1)
}

console.log(`HTML ids ok (${ids.length} ids)`)

