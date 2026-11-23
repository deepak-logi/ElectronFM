import { contextBridge, ipcRenderer } from 'electron'
import type { DirResult } from '../shared/types'

contextBridge.exposeInMainWorld('fileApi', {
  getHomeDir: (): Promise<string> => ipcRenderer.invoke('fs:getHomeDir'),
  readDir: (dirPath: string): Promise<DirResult> => ipcRenderer.invoke('fs:readDir', dirPath),
  openPath: (filePath: string): Promise<void> => ipcRenderer.invoke('shell:openPath', filePath)
})
