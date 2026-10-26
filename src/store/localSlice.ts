import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface Profile {
  slug: string
  name: string
}

/** Device-only state that never goes into a backup file. */
export interface LocalState {
  persistGranted?: boolean
  /** User whose data is cached on this device. */
  ownerId?: string | null
  email?: string
  profile?: Profile | null
  /** Roles from user_roles (witch opens the grimoire, admin hands out roles). Cached for offline start. */
  roles?: string[]
  sync: {
    pending: number
    syncing: boolean
    error?: string
    loadedAt?: string
  }
}

const slice = createSlice({
  name: 'local',
  initialState: { sync: { pending: 0, syncing: false } } as LocalState,
  reducers: {
    setPersistGranted(s, a: PayloadAction<boolean>) {
      s.persistGranted = a.payload
    },
    setAccount(s, a: PayloadAction<{ ownerId: string | null; email?: string }>) {
      s.ownerId = a.payload.ownerId
      s.email = a.payload.email
    },
    setProfile(s, a: PayloadAction<Profile | null>) {
      s.profile = a.payload
    },
    setRoles(s, a: PayloadAction<string[]>) {
      s.roles = a.payload
    },
    setSync(s, a: PayloadAction<Partial<LocalState['sync']>>) {
      s.sync = { ...(s.sync ?? { pending: 0, syncing: false }), ...a.payload }
    },
  },
})

export const localActions = slice.actions
export default slice.reducer
