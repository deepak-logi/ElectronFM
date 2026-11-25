import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { Crumb } from '../../../shared/types'
import { loadDirectory } from './filesSlice'

export interface NavigationState {
  currentPath: string
  parentPath: string | null
  history: string[]
  breadcrumbs: Crumb[]
  requestId: string | null
}

const initialState: NavigationState = {
  currentPath: '',
  parentPath: null,
  history: [],
  breadcrumbs: [],
  requestId: null
}

const navigationSlice = createSlice({
  name: 'navigation',
  initialState,
  reducers: {
    setCurrentPath(state, action: PayloadAction<string>) {
      state.currentPath = action.payload
    },
    navigate(state, action: PayloadAction<string>) {
      if (state.currentPath) state.history.push(state.currentPath)
      state.currentPath = action.payload
    },
    goBack(state) {
      if (state.history.length === 0) return
      state.currentPath = state.history.pop()!
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadDirectory.pending, (state, action) => {
        state.breadcrumbs = []
        state.requestId = action.meta.requestId
      })
      .addCase(loadDirectory.fulfilled, (state, action) => {
        // Match the guard in filesSlice: a stale response must not restore an
        // older folder's parent path or breadcrumbs.
        if (state.requestId !== action.meta.requestId) return
        state.parentPath = action.payload.parent
        state.breadcrumbs = action.payload.breadcrumbs
      })
  }
})

export const { setCurrentPath, navigate, goBack } = navigationSlice.actions

export const selectCanGoBack = (state: { navigation: NavigationState }) =>
  state.navigation.history.length > 0

export const selectCanGoUp = (state: { navigation: NavigationState }) =>
  state.navigation.parentPath !== null

export default navigationSlice.reducer
