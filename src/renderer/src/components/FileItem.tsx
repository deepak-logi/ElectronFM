import type { FileEntry } from '../../../shared/types'

interface FileItemProps {
  item: FileEntry
  isSelected: boolean
  onSelect: (item: FileEntry) => void
  onOpen: (item: FileEntry) => void
}

export default function FileItem({ item, isSelected, onSelect, onOpen }: FileItemProps) {
  return (
    <li
      className={isSelected ? 'file-item selected' : 'file-item'}
      onClick={() => onSelect(item)}
      onDoubleClick={() => onOpen(item)}
    >
      <span>{item.isDirectory ? '📁' : '📄'}</span>
      {item.name}
    </li>
  )
}
