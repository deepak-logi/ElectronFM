// used by all 3

export interface FileEntry {
  // named as FileEntry, since FileItem already exists
  name: string
  path: string
  isDirectory: boolean
  size: number
  modified: number
  extension: string
}

export interface DirResult {
  path: string
  parent: string | null
  items: FileEntry[]
}
