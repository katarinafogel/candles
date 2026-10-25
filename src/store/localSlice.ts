import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

/** Device-only state that never goes into a backup file. */
export interface LocalState {
  appsScriptToken: string
  persistGranted?: boolean
}

const slice = createSlice({
  name: 'local',
  initialState: { appsScriptToken: '' } as LocalState,
  reducers: {
    setToken(s, a: PayloadAction<string>) {
      s.appsScriptToken = a.payload
    },
    setPersistGranted(s, a: PayloadAction<boolean>) {
      s.persistGranted = a.payload
    },
  },
})

export const localActions = slice.actions
export default slice.reducer
