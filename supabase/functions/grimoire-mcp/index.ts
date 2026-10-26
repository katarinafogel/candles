// Grimoire agent server: an MCP connector for an assistant to read and change the grimoire by the
// app's own rules. Deploy with JWT verification off (the agent key is checked here instead):
//   supabase functions deploy grimoire-mcp --no-verify-jwt
// Connector URL: https://<project>.functions.supabase.co/grimoire-mcp/<agent key> (not .supabase.co/functions/v1:
// claude.ai probes /.well-known/oauth-protected-resource at the site root, and the main domain answers 401)
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
  // Through a database function: the server has no rights on the tables themselves.
  loadRows: (owner) => rpc<Row[]>('grimoire_rows_as', { p_owner: owner }),
  apply: (owner, changes) => rpc<void>('grimoire_apply_as', { p_owner: owner, p_changes: changes }),
}

Deno.serve((req) => handle(req, storage))
