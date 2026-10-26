import { combineReducers, configureStore } from '@reduxjs/toolkit'
import localforage from 'localforage'
import { useDispatch, useSelector } from 'react-redux'
import { FLUSH, PAUSE, PERSIST, persistReducer, persistStore, PURGE, REGISTER, REHYDRATE } from 'redux-persist'
import data, { SCHEMA_VERSION } from './dataSlice'
import grimoire, { migrateGrimoire, setDayBoundary } from './grimoireSlice'
import local from './localSlice'
import { migrate } from '../lib/migrate'
import { initSync, syncMiddleware } from '../lib/sync'

// IndexedDB through localforage: localStorage is too small and gets cleared too easily.
localforage.config({ name: 'candle-tracker', storeName: 'state' })

const root = combineReducers({
  data: persistReducer(
    {
      key: 'data',
      storage: localforage,
      version: SCHEMA_VERSION,
      migrate: async (state) => (state ? (migrate(state as never) as never) : state),
    },
    data,
  ),
  // The grimoire has its own key: it is cleared on its own when the witch role goes away.
  grimoire: persistReducer(
    {
      key: 'grimoire',
      storage: localforage,
      version: 1,
      migrate: async (state) => (state ? (migrateGrimoire(state as never) as never) : state),
    },
    grimoire,
  ),
  // Sync progress is runtime-only; the account and profile are cached for offline start.
  local: persistReducer({ key: 'local', storage: localforage, blacklist: ['sync'] }, local),
})

export const store = configureStore({
  reducer: root,
  middleware: (gdm) =>
    gdm({
      serializableCheck: { ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER] },
      immutableCheck: { warnAfter: 200 },
    }).concat(syncMiddleware),
})

export const persistor = persistStore(store)
initSync(store)
store.subscribe(() => setDayBoundary(store.getState().grimoire.meta?.dayBoundaryHour ?? 4))

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
export const useData = () => useAppSelector((s) => s.data)
export const useGrimoire = () => useAppSelector((s) => s.grimoire)
export const useIsWitch = () => useAppSelector((s) => !!s.local.roles?.includes('witch'))
export const useIsAdmin = () => useAppSelector((s) => !!s.local.roles?.includes('admin'))

// Handy for debugging in the browser console during development.
if (import.meta.env.DEV) (window as unknown as { store: typeof store }).store = store
