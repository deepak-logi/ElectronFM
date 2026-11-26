// type declaration in .d.ts
// .ts contain implementation

import type { ContextMenuTarget, DirResult } from '../shared/types'

declare global {
  interface Window {
    fileApi: {
      getHomeDir: () => Promise<string>
      readDir: (dirPath: string, showHidden: boolean) => Promise<DirResult>
      openPath: (filePath: string) => Promise<void>
      getAccentColor: () => Promise<string | null>
      onAccentColorChanged: (callback: (color: string | null) => void) => () => void
      showItemInFolder: (filePath: string) => Promise<void>
      showContextMenu: (target: ContextMenuTarget) => Promise<void>
      createFolder: (parentPath: string, name: string) => Promise<string>
      onNewFolderRequested: (callback: (parentPath: string) => void) => () => void
    }
  }
}

export {}
