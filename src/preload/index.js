import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('fileApi', {
  getHomeDir: () => ipcRenderer.invoke('fs:getHomeDir'),
  readDir: (dirPath) => ipcRenderer.invoke('fs:readDir', dirPath),
  openPath: (filePath) => ipcRenderer.invoke('shell:openPath', filePath)
})
