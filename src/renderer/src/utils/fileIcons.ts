import {
  File,
  FileArchive,
  FileCode,
  FileImage,
  FileText,
  Folder,
  type LucideIcon
} from 'lucide-react'
import type { FileEntry } from '../../../shared/types'

const iconByExtension: Record<string, LucideIcon> = {
  '.png': FileImage,
  '.jpg': FileImage,
  '.jpeg': FileImage,
  '.gif': FileImage,
  '.svg': FileImage,
  '.txt': FileText,
  '.md': FileText,
  '.pdf': FileText,
  '.docx': FileText,
  '.js': FileCode,
  '.ts': FileCode,
  '.tsx': FileCode,
  '.json': FileCode,
  '.html': FileCode,
  '.zip': FileArchive,
  '.rar': FileArchive,
  '.7z': FileArchive
}

export function getFileIcon(item: FileEntry): LucideIcon {
  if (item.isDirectory) return Folder
  return iconByExtension[item.extension] ?? File
}
