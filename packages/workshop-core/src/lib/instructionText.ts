// The instruction's own little markup, so the master writes it as plain text:
//   [[фраза|пояснение]] — a highlighted phrase; the explanation pops up on hover or tap;
//   a line starting with «!» — a separate callout block (why it matters).
// Everything else is a line of text as is.

export interface InstructionPart {
  text: string
  hint?: string
}

export interface InstructionBlock {
  kind: 'line' | 'note'
  parts: InstructionPart[]
}

const marked = /\[\[([^|\]]+)\|([^\]]+)\]\]/g

/** A line's text and highlighted phrases, in order. */
export function parseLine(line: string): InstructionPart[] {
  const parts: InstructionPart[] = []
  let at = 0
  for (const m of line.matchAll(marked)) {
    if (m.index > at) parts.push({ text: line.slice(at, m.index) })
    parts.push({ text: m[1].trim(), hint: m[2].trim() })
    at = m.index + m[0].length
  }
  if (at < line.length) parts.push({ text: line.slice(at) })
  return parts
}

/** The instruction as blocks; empty lines are dropped. */
export function parseInstruction(text: string): InstructionBlock[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (l.startsWith('!') ? { kind: 'note' as const, parts: parseLine(l.slice(1).trim()) } : { kind: 'line' as const, parts: parseLine(l) }))
}

/** The same text without the markup: for previews and places that show plain text. */
export const plainInstruction = (text: string) => text.replace(marked, '$1').replace(/^\s*!\s*/gm, '')
