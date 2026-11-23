import type { FileEntry } from '../../../shared/types'
import FileItem from './FileItem'

interface FileListProps {
  items: FileEntry[]
  selected: FileEntry | null
  onSelect: (item: FileEntry) => void
  onOpen: (item: FileEntry) => void
}

export default function FileList({ items, selected, onSelect, onOpen }: FileListProps) {
  if (items.length === 0) return <p>This folder is empty.</p>

  return (
    <ul className="file-list">
      {items.map((item: FileEntry) => (
        <FileItem
          key={item.path}
          item={item}
          isSelected={selected?.path === item.path}
          onSelect={onSelect}
          onOpen={onOpen}
        />
      ))}
    </ul>
  )
}
