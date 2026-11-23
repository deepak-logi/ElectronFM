import { contextBridge, ipcRenderer } from 'electron'
import type { DirResult } from '../shared/types'

contextBridge.exposeInMainWorld('fileApi', {
  getHomeDir: () => ipcRenderer.invoke('fs:getHomeDir'),
  readDir: (dirPath: string): Promise<DirResult> => ipcRenderer.invoke('fs:readDir', dirPath),
  openPath: (filePath: string) => ipcRenderer.invoke('shell:openPath', filePath)
})
