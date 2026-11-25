import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { ThemeFamily } from '../../../shared/types'

export interface SettingsState {
  showHidden: boolean
  themeFamily: ThemeFamily
  systemAccent: string | null
}

const saved = localStorage.getItem('fm-theme-family')

const initialState: SettingsState = {
  showHidden: false,
  themeFamily: saved === 'catppuccin' ? 'catppuccin' : 'default',
  systemAccent: null
}

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    toggleHidden(state) {
      state.showHidden = !state.showHidden
    },
    setThemeFamily(state, action: PayloadAction<ThemeFamily>) {
      state.themeFamily = action.payload
    },
    setSystemAccent(state, action: PayloadAction<string | null>) {
      state.systemAccent = action.payload
    }
  }
})

export const { toggleHidden, setThemeFamily, setSystemAccent } = settingsSlice.actions
export default settingsSlice.reducer
