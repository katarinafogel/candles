// Grimoire agent server: an MCP connector for an assistant to read and change the grimoire by the
// app's own rules. Deploy with JWT verification off (the agent key is checked here instead):
//   supabase functions deploy grimoire-mcp --no-verify-jwt
// Connector URL: https://<project>.supabase.co/functions/v1/grimoire-mcp/<agent key>
import { grimoireKinds } from './core/grimoire/rows.ts'
import { handle, type Row, type Storage } from './server.ts'

const url = Deno.env.get('SUPABASE_URL')!
// Stays inside the function; the database functions it calls touch grimoire rows only.
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args) })
  if (!res.ok) throw new Error(`${fn}: ${res.status} ${await res.text()}`)
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

const storage: Storage = {
  ownerByKeyHash: (hash) => rpc<string | null>('agent_owner', { p_hash: hash }),
  async loadRows(owner) {
    const kinds = [...grimoireKinds, 'person'].join(',')
    const filter = `owner_id=eq.${owner}&or=(kind.in.(${kinds}),and(kind.eq.meta,id.eq.grimoire))&select=kind,id,data&order=kind,id`
    const rows: Row[] = []
    for (let from = 0; ; from += 1000) {
      const res = await fetch(`${url}/rest/v1/entities?${filter}`, { headers: { ...headers, Range: `${from}-${from + 999}` } })
      if (!res.ok) throw new Error(`load: ${res.status} ${await res.text()}`)
      const page = (await res.json()) as Row[]
      rows.push(...page)
      if (page.length < 1000) break
    }
    return rows
  },
  apply: (owner, changes) => rpc<void>('grimoire_apply_as', { p_owner: owner, p_changes: changes }),
}

Deno.serve((req) => handle(req, storage))
