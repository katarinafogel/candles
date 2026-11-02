// GENERATED from src/grimoire/frog.ts by scripts/sync-agent-core.mjs — edit the original, then run: node scripts/sync-agent-core.mjs
// Frogs: deeds she really does not want to do, or keeps putting off.
import type { Task } from './types.ts'

/** A frog stays one until it is done. */
export const isFrog = (t: Pick<Task, 'frog'>) => t.frog === 'auto' || t.frog === 'manual'
