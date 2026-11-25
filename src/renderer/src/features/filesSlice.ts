import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { FileEntry } from '../../../shared/types'

export interface FilesState {
  items: FileEntry[]
  selected: FileEntry | null
  loading: boolean
  error: string
  requestId: string | null
}

const initialState: FilesState = {
  items: [],
  selected: null,
  loading: false,
  error: '',
  requestId: null
}

export const loadDirectory = createAsyncThunk(
  'files/loadDirectory',
  async ({ path, showHidden }: { path: string; showHidden: boolean }) =>
    window.fileApi.readDir(path, showHidden)
)

const filesSlice = createSlice({
  name: 'files',
  initialState,
  reducers: {
    selectItem(state, action: PayloadAction<FileEntry | null>) {
      state.selected = action.payload
    },
    reportError(state, action: PayloadAction<string>) {
      state.error = action.payload
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadDirectory.pending, (state, action) => {
        state.loading = true
        state.error = ''
        state.selected = null
        // Don't show the previous folder's entries while the new one loads.
        state.items = []
        state.requestId = action.meta.requestId
      })
      .addCase(loadDirectory.fulfilled, (state, action) => {
        // Ignore a stale response from an older, slower directory read.
        if (state.requestId !== action.meta.requestId) return
        state.items = action.payload.items
        state.loading = false
      })
      .addCase(loadDirectory.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) return
        state.error = action.error.message ?? 'Unknown error'
        state.loading = false
      })
  }
})

export const { selectItem, reportError } = filesSlice.actions
export default filesSlice.reducer
