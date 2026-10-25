import { defaultSettings, initialData, SCHEMA_VERSION } from '../store/dataSlice'
import type { DataState } from '../types'

/** Brings data of any older schema version forward. Throws for files from a newer app. */
export function migrate(input: Partial<DataState> & { schemaVersion?: number }): DataState {
  const v = input.schemaVersion ?? 1
  if (v > SCHEMA_VERSION) throw new Error('newer-schema')
  // v1 is the first version; future migrations go here as `if (v < 2) { ... }`.
  return {
    ...initialData,
    ...input,
    settings: { ...defaultSettings, ...input.settings },
    schemaVersion: SCHEMA_VERSION,
  } as DataState
}
