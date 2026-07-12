import { spawnSync } from 'node:child_process'

const checks = [
  'tools/check-js-syntax.mjs',
  'tools/check-html-ids.mjs',
  'tools/check-inline-handlers.mjs',
  'tools/check-migration-contracts.mjs',
  'tools/check-daily-flow.mjs',
  'tools/check-cash-ui.mjs',
]

for (const check of checks) {
  const result = spawnSync(process.execPath, [check], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status || 1)
}

console.log('Static checks ok')
