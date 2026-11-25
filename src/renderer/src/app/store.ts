import { configureStore } from '@reduxjs/toolkit'
import filesReducer from '../features/filesSlice'
import navigationReducer from '../features/navigationSlice'
import settingsReducer from '../features/settingsSlice'

export const store = configureStore({
  reducer: {
    files: filesReducer,
    navigation: navigationReducer,
    settings: settingsReducer
  }
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
