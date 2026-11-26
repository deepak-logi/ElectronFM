import { contextBridge, ipcRenderer } from 'electron'
import type { ContextMenuTarget, DirResult } from '../shared/types'

contextBridge.exposeInMainWorld('fileApi', {
  getHomeDir: (): Promise<string> => ipcRenderer.invoke('fs:getHomeDir'),

  readDir: (dirPath: string, showHidden: boolean): Promise<DirResult> =>
    ipcRenderer.invoke('fs:readDir', dirPath, showHidden),

  openPath: (filePath: string): Promise<void> => ipcRenderer.invoke('shell:openPath', filePath),

  getAccentColor: (): Promise<string | null> => ipcRenderer.invoke('system:getAccentColor'),

  onAccentColorChanged: (callback: (color: string | null) => void): (() => void) => {
    const listener = (_event: unknown, color: string | null) => callback(color)
    ipcRenderer.on('system:accent-changed', listener)
    return () => ipcRenderer.removeListener('system:accent-changed', listener)
  },

  showItemInFolder: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('shell:showItemInFolder', filePath),

  showContextMenu: (target: ContextMenuTarget): Promise<void> =>
    ipcRenderer.invoke('shell:showContextMenu', target),

  createFolder: (parentPath: string, name: string): Promise<string> =>
    ipcRenderer.invoke('fs:createFolder', parentPath, name),

  onNewFolderRequested: (callback: (parentPath: string) => void): (() => void) => {
    const listener = (_event: unknown, parentPath: string) => callback(parentPath)
    ipcRenderer.on('ui:request-new-folder', listener)
    return () => ipcRenderer.removeListener('ui:request-new-folder', listener)
  }
})
