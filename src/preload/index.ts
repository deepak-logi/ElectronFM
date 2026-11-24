import { contextBridge, ipcRenderer } from 'electron'
import type { DirResult } from '../shared/types'

contextBridge.exposeInMainWorld('fileApi', {
  getHomeDir: (): Promise<string> => ipcRenderer.invoke('fs:getHomeDir'),
  readDir: (dirPath: string, showHidden: boolean): Promise<DirResult> =>
    ipcRenderer.invoke('fs:readDir', dirPath, showHidden),
  openPath: (filePath: string): Promise<void> => ipcRenderer.invoke('shell:openPath', filePath)
})
