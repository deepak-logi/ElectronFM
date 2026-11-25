import { configureStore } from '@reduxjs/toolkit'
import navigationReducer from '../features/navigationSlice'
import settingsReducer from '../features/settingsSlice'

export const store = configureStore({
  reducer: {
    settings: settingsReducer,
    navigation: navigationReducer
  }
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
