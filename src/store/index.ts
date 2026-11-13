import { combineReducers, configureStore } from '@reduxjs/toolkit'
import localforage from 'localforage'
import { useDispatch, useSelector } from 'react-redux'
import { FLUSH, PAUSE, PERSIST, persistReducer, persistStore, PURGE, REGISTER, REHYDRATE } from 'redux-persist'
import data, { SCHEMA_VERSION } from '@workshop-core/store/dataSlice'
import grimoire, { migrateGrimoire, setDayBoundary } from '@grimoire-core/store/grimoireSlice'
import local from './localSlice'
import { APP } from '../lib/apps'
import { migrate } from '@workshop-core/lib/migrate'
import { initSync, syncMiddleware } from '../lib/sync'

// IndexedDB through localforage: localStorage is too small and gets cleared too easily.
// Each app keeps its own copy on the device (they share the site, so the database is named by app).
localforage.config({ name: `candles-${APP}`, storeName: 'state' })

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
export const useIsMaster = () => useAppSelector((s) => !!s.local.roles?.includes('master'))
/** Both apps are open to this person. */
export const useBothApps = () => useAppSelector((s) => !!s.local.roles?.includes('witch') && !!s.local.roles?.includes('master'))
/** The bestiary and the workshop share people: a witch who is also a master and turned it on. */
export const useLinkPeople = () =>
  useAppSelector((s) => !!s.grimoire.meta.linkWorkshopPeople && !!s.local.roles?.includes('witch') && !!s.local.roles?.includes('master'))
export const useIsAdmin = () => useAppSelector((s) => !!s.local.roles?.includes('admin'))

// Handy for debugging in the browser console during development.
if (import.meta.env.DEV) (window as unknown as { store: typeof store }).store = store
