import { combineReducers, configureStore } from '@reduxjs/toolkit'
import localforage from 'localforage'
import { useDispatch, useSelector } from 'react-redux'
import { FLUSH, PAUSE, PERSIST, persistReducer, persistStore, PURGE, REGISTER, REHYDRATE } from 'redux-persist'
import data, { SCHEMA_VERSION } from './dataSlice'
import local from './localSlice'
import { migrate } from '../lib/migrate'

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
  local: persistReducer({ key: 'local', storage: localforage }, local),
})

export const store = configureStore({
  reducer: root,
  middleware: (gdm) =>
    gdm({
      serializableCheck: { ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER] },
      immutableCheck: { warnAfter: 200 },
    }),
})

export const persistor = persistStore(store)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
export const useData = () => useAppSelector((s) => s.data)

// Handy for debugging in the browser console during development.
if (import.meta.env.DEV) (window as unknown as { store: typeof store }).store = store
