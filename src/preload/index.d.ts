// type declaration in .d.ts
// .ts contain implementation

import type { DirResult } from '../shared/types'

declare global {
  interface Window {
    fileApi: {
      getHomeDir: () => Promise<string>
      readDir: (dirPath: string, showHidden: boolean) => Promise<DirResult>
      openPath: (filePath: string) => Promise<void>
    }
  }
}

export {}
