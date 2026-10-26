// MCP over HTTP (Streamable HTTP, JSON responses, no sessions) for the grimoire.
// Separate from index.ts so it can be tested with fake storage (server_test.ts).
import { AgentError, agentInstructions, agentTools, runTool } from './core/grimoire/agent.ts'
import { diffGrimoire, rowsToGrimoire, type RowChange } from './core/grimoire/rows.ts'
import { migrateGrimoire } from './core/store/grimoireSlice.ts'

export interface Row {
  kind: string
  id: string
  data: unknown
}

export interface Storage {
  /** Owner of an active key, or null. */
  ownerByKeyHash(hash: string): Promise<string | null>
  /** The owner's grimoire rows plus workshop people (for names). */
  loadRows(owner: string): Promise<Row[]>
  /** Writes grimoire rows for the owner in one transaction. */
  apply(owner: string, changes: RowChange[]): Promise<void>
}

const SUPPORTED = ['2025-06-18', '2025-03-26', '2024-11-05']
const VERSION = '1.0.0'

interface RpcRequest {
  jsonrpc: '2.0'
  id?: string | number | null
  method: string
  params?: Record<string, unknown>
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, mcp-protocol-version, mcp-session-id, accept',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

export async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** The key: the last path segment (…/grimoire-mcp/<key>, for connectors that take only a URL) or a Bearer header. */
export function keyOf(req: Request): string | null {
  const auth = req.headers.get('authorization')
  const bearer = auth?.match(/^Bearer\s+(gk_[A-Za-z0-9_-]{20,})$/)?.[1]
  if (bearer) return bearer
  const last = new URL(req.url).pathname.split('/').filter(Boolean).pop()
  return last && /^gk_[A-Za-z0-9_-]{20,}$/.test(last) ? last : null
}

const rpcError = (id: RpcRequest['id'], code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })

async function call(msg: RpcRequest, owner: string, storage: Storage, now: () => Date) {
  const { id, method, params = {} } = msg
  switch (method) {
    case 'initialize': {
      const asked = typeof params.protocolVersion === 'string' ? params.protocolVersion : SUPPORTED[0]
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: SUPPORTED.includes(asked) ? asked : SUPPORTED[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'grimoire', title: 'Гримуар дел', version: VERSION },
          instructions: agentInstructions,
        },
      }
    }
    case 'ping':
      return { jsonrpc: '2.0', id, result: {} }
    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: agentTools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
            annotations: { readOnlyHint: !t.writes, destructiveHint: !!t.destructive, idempotentHint: !t.writes, openWorldHint: false },
          })),
        },
      }
    case 'tools/call': {
      const name = String(params.name ?? '')
      const tool = agentTools.find((t) => t.name === name)
      if (!tool) return rpcError(id, -32602, `unknown tool: ${name}`)
      const rows = await storage.loadRows(owner)
      const people = Object.fromEntries(
        rows.filter((r) => r.kind === 'person').map((r) => [r.id, { id: r.id, name: String((r.data as { name?: string })?.name ?? '') }]),
      )
      const state = migrateGrimoire(rowsToGrimoire(rows))
      try {
        const out = runTool(name, (params.arguments ?? {}) as Record<string, unknown>, { state, now: now(), people })
        if (tool.writes) {
          const changes = diffGrimoire(state, out.state)
          if (changes.length) await storage.apply(owner, changes)
        }
        return {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: JSON.stringify(out.result, null, 1) }], structuredContent: wrap(out.result) },
        }
      } catch (e) {
        if (e instanceof AgentError) return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: e.message }], isError: true } }
        throw e
      }
    }
    default:
      return rpcError(id, -32601, `method not found: ${method}`)
  }
}

/** structuredContent must be an object. */
const wrap = (r: unknown) => (r && typeof r === 'object' && !Array.isArray(r) ? r : { result: r })

export async function handle(req: Request, storage: Storage, now: () => Date = () => new Date()): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  // No server-to-client stream: every answer comes back in the POST response.
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: { ...cors, Allow: 'POST, OPTIONS' } })

  const key = keyOf(req)
  const owner = key ? await storage.ownerByKeyHash(await sha256Hex(key)) : null
  if (!owner) return json({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'unauthorized: a valid grimoire agent key is required' } }, 401)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json(rpcError(null, -32700, 'parse error'), 400)
  }
  const batch = Array.isArray(body)
  const messages = (batch ? body : [body]) as RpcRequest[]
  const answers = []
  for (const m of messages) {
    if (!m || m.jsonrpc !== '2.0' || typeof m.method !== 'string') {
      answers.push(rpcError(null, -32600, 'invalid request'))
      continue
    }
    // Notifications (no id) get no answer.
    if (m.id === undefined) continue
    try {
      answers.push(await call(m, owner, storage, now))
    } catch (e) {
      console.error(e)
      answers.push(rpcError(m.id, -32603, 'internal error'))
    }
  }
  if (!answers.length) return new Response(null, { status: 202, headers: cors })
  return json(batch ? answers : answers[0])
}
