import type { FileEntry } from '../../../shared/types'
import FileItem from './FileItem'

interface FileListProps {
  items: FileEntry[]
  selected: FileEntry | null
  onSelect: (item: FileEntry) => void
  onOpen: (item: FileEntry) => void
  onReveal: (path: string) => void
}

export default function FileList({ items, selected, onSelect, onOpen, onReveal }: FileListProps) {
  if (items.length === 0) return <p className="state">This folder is empty.</p>

  return (
    <ul className="file-list" role="listbox">
      {items.map((item) => (
        <FileItem
          key={item.path}
          item={item}
          isSelected={selected?.path === item.path}
          onSelect={onSelect}
          onOpen={onOpen}
          onReveal={onReveal}
        />
      ))}
    </ul>
  )
}
