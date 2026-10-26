// deno test supabase/functions/grimoire-mcp — the MCP server end to end with storage in memory.
import { assert, assertEquals } from 'jsr:@std/assert@1'
import type { RowChange } from './core/grimoire/rows.ts'
import { handle, sha256Hex, type Row, type Storage } from './server.ts'

const KEY = 'gk_' + 'x'.repeat(32)
const OWNER = 'owner-1'

async function memory(): Promise<Storage & { rows: Map<string, Row> }> {
  const hash = await sha256Hex(KEY)
  const rows = new Map<string, Row>()
  rows.set('meta:grimoire', { kind: 'meta', id: 'grimoire', data: { timeZone: 'Europe/Moscow' } })
  rows.set('person:p1', { kind: 'person', id: 'p1', data: { id: 'p1', name: 'Аня' } })
  return {
    rows,
    ownerByKeyHash: (h) => Promise.resolve(h === hash ? OWNER : null),
    loadRows: () => Promise.resolve([...rows.values()]),
    apply: (_o, changes: RowChange[]) => {
      for (const c of changes) {
        if (c.op === 'delete') rows.delete(`${c.kind}:${c.id}`)
        else rows.set(`${c.kind}:${c.id}`, { kind: c.kind, id: c.id, data: c.data })
      }
      return Promise.resolve()
    },
  }
}

const NOW = () => new Date('2026-10-26T06:00:00Z')
const post = (body: unknown, key: string | null = KEY) =>
  new Request(`https://x.supabase.co/functions/v1/grimoire-mcp${key ? `/${key}` : ''}`, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })

Deno.test('refuses without a valid key', async () => {
  const s = await memory()
  assertEquals((await handle(post({ jsonrpc: '2.0', id: 1, method: 'ping' }, null), s, NOW)).status, 401)
  assertEquals((await handle(post({ jsonrpc: '2.0', id: 1, method: 'ping' }, 'gk_' + 'y'.repeat(32)), s, NOW)).status, 401)
})

Deno.test('initialize, list tools, notifications', async () => {
  const s = await memory()
  const init = await (await handle(post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }), s, NOW)).json()
  assertEquals(init.result.protocolVersion, '2025-06-18')
  assert(init.result.instructions.includes('нави'))
  assertEquals((await handle(post({ jsonrpc: '2.0', method: 'notifications/initialized' }), s, NOW)).status, 202)
  const list = await (await handle(post({ jsonrpc: '2.0', id: 2, method: 'tools/list' }), s, NOW)).json()
  assert(list.result.tools.some((t: { name: string }) => t.name === 'grimoire_today'))
})

Deno.test('adds, completes and reads back through storage', async () => {
  const s = await memory()
  const add = await (
    await handle(post({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'grimoire_add_task', arguments: { line: 'зуб ***☠☠☠ +главное' } } }), s, NOW)
  ).json()
  const id = add.result.structuredContent.task.id as string
  assert(s.rows.has(`task:${id}`))
  const done = await (await handle(post({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'grimoire_complete_task', arguments: { id } } }), s, NOW)).json()
  assertEquals(done.result.structuredContent.coins, 75)
  const today = await (await handle(post({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'grimoire_today', arguments: {} } }), s, NOW)).json()
  assertEquals(today.result.structuredContent.day, '2026-10-26')
  assertEquals(today.result.structuredContent.coins.balance, 75)
})

Deno.test('a bad argument is a tool error, not a crash', async () => {
  const s = await memory()
  const r = await (await handle(post({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'grimoire_complete_task', arguments: { id: 'nope' } } }), s, NOW)).json()
  assertEquals(r.result.isError, true)
})
