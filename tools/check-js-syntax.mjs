import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const roots = ['assets/app.js', 'assets/js', 'tools', 'personal/app.js', 'personal/domain.js', 'personal/sw.js', 'personal/domain.test.mjs', 'personal/app-quality.test.mjs', 'personal/app-core.js', 'personal/app-views-1.js', 'personal/app-views-2.js', 'personal/app-views-3.js', 'personal/app-views-4.js', 'personal/app-forms.js', 'personal/app-actions-1.js', 'personal/app-features-1.js', 'personal/app-features-2.js', 'personal/app-quality.js']

function collectJs(path) {
  if (!existsSync(path)) return []
  const stat = statSync(path)
  if (stat.isFile()) return ['.js', '.mjs'].includes(extname(path)) ? [path] : []
  return readdirSync(path).flatMap(name => collectJs(join(path, name)))
}

const files = [...new Set(roots.flatMap(collectJs))].sort()
let failed = false

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
  if (result.status !== 0) {
    failed = true
    console.error(`JS syntax failed: ${file}`)
    if (result.stderr) console.error(result.stderr.trim())
    if (result.stdout) console.error(result.stdout.trim())
  }
}

if (failed) process.exit(1)
console.log(`JS syntax ok (${files.length} files)`)

