// Copies the grimoire core (the same code the app runs) into the agent's Edge Function, so the
// server applies exactly the app's rules. Supabase deploys a function from its own folder only.
//   node scripts/sync-agent-core.mjs          — write the copies
//   node scripts/sync-agent-core.mjs --check  — fail if they are stale (CI)
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const target = join(root, 'supabase/functions/grimoire-mcp/core')
const files = [
  'grimoire/agent.ts',
  'grimoire/coins.ts',
  'grimoire/days.ts',
  'grimoire/emotions.ts',
  'grimoire/habits.ts',
  'grimoire/parse.ts',
  'grimoire/rows.ts',
  'grimoire/selectors.ts',
  'grimoire/types.ts',
  'grimoire/wheel.ts',
  'store/grimoireSlice.ts',
]
const header = (f) => `// GENERATED from src/${f} by scripts/sync-agent-core.mjs — edit the original, then run: node scripts/sync-agent-core.mjs\n`

const check = process.argv.includes('--check')
const stale = []
for (const f of files) {
  const want = header(f) + readFileSync(join(root, 'src', f), 'utf8')
  const out = join(target, f)
  const have = existsSync(out) ? readFileSync(out, 'utf8') : null
  if (have === want) continue
  if (check) stale.push(f)
  else {
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, want)
  }
}
if (stale.length) {
  console.error(`Agent core is stale: ${stale.join(', ')}\nRun: node scripts/sync-agent-core.mjs`)
  process.exit(1)
}
console.log(check ? 'agent core: up to date' : 'agent core: copied')
