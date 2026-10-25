import { SCHEMA_VERSION } from '../store/dataSlice'
import type { DataState } from '../types'
import { saveFile, isTouchDevice } from './download'
import { migrate } from './migrate'

export interface BackupFile {
  app: 'candle-tracker'
  schemaVersion: number
  exportedAt: string
  data: DataState
}

export const backupName = (d = new Date()) => `candles-backup-${d.toISOString().slice(0, 10)}.json`

export function makeBackup(data: DataState): BackupFile {
  // The Apps Script token lives in a separate device-only slice, so it never gets here.
  const { _persist, ...clean } = data as DataState & { _persist?: unknown }
  void _persist
  return { app: 'candle-tracker', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data: clean }
}

export async function downloadBackup(data: DataState) {
  const blob = new Blob([JSON.stringify(makeBackup(data), null, 1)], { type: 'application/json' })
  await saveFile(blob, backupName(), isTouchDevice())
}

export interface BackupSummary {
  exportedAt: string
  schemaVersion: number
  candles: number
  holders: number
  materials: number
  molds: number
  reviews: number
}

/** Parses and migrates a backup; throws a human-readable error. */
export function readBackup(text: string): { data: DataState; summary: BackupSummary } {
  let json: Partial<BackupFile>
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('Это не JSON-файл бэкапа')
  }
  if (json.app !== 'candle-tracker' || !json.data) throw new Error('Файл не похож на бэкап мастерской')
  const v = json.schemaVersion ?? json.data.schemaVersion ?? 1
  if (v > SCHEMA_VERSION) throw new Error('Бэкап сделан более новой версией приложения. Обновите приложение и попробуйте снова.')
  const data = migrate({ ...json.data, schemaVersion: v })
  return {
    data,
    summary: {
      exportedAt: json.exportedAt ?? '',
      schemaVersion: v,
      candles: Object.keys(data.candles).length,
      holders: Object.keys(data.holders).length,
      materials: Object.keys(data.materials).length,
      molds: Object.keys(data.molds).length,
      reviews: Object.keys(data.reviews).length,
    },
  }
}
