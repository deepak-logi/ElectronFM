import type { ContextMenuTarget, FileEntry } from '../../../shared/types'
import FileItem from './FileItem'
import NewFolderRow from './NewFolderRow'

interface FileListProps {
  items: FileEntry[]
  selected: FileEntry | null
  isCreating: boolean
  onCreate: (name: string) => void
  onCancel: () => void
  onSelect: (item: FileEntry) => void
  onOpen: (item: FileEntry) => void
  onShowMenu: (target: ContextMenuTarget) => void
}

export default function FileList({
  items,
  selected,
  isCreating,
  onCreate,
  onCancel,
  onSelect,
  onOpen,
  onShowMenu
}: FileListProps) {
  return (
    <ul className="file-list" role="listbox">
      {isCreating && <NewFolderRow onCreate={onCreate} onCancel={onCancel} />}
      {items.length === 0 && !isCreating && <li className="state">This folder is empty.</li>}
      {items.map((item) => (
        <FileItem
          key={item.path}
          item={item}
          isSelected={selected?.path === item.path}
          onSelect={onSelect}
          onOpen={onOpen}
          onShowMenu={onShowMenu}
        />
      ))}
    </ul>
  )
}
