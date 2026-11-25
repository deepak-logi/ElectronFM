import { createElement } from 'react'
import type { ContextMenuTarget, FileEntry } from '../../../shared/types'
import { getFileIcon } from '../utils/fileIcons'

interface FileItemProps {
  item: FileEntry
  isSelected: boolean
  onSelect: (item: FileEntry) => void
  onOpen: (item: FileEntry) => void
  onShowMenu: (target: ContextMenuTarget) => void
}

export default function FileItem({
  item,
  isSelected,
  onSelect,
  onOpen,
  onShowMenu
}: FileItemProps) {
  // createElement keeps the icon a stable, module-level component instead of a
  // component variable created during render (which react-hooks flags).
  const icon = createElement(getFileIcon(item), {
    size: 18,
    'aria-hidden': true,
    className: `file-item__icon${item.isDirectory ? ' file-item__icon--folder' : ''}`
  })

  return (
    <li
      role="option"
      aria-selected={isSelected}
      tabIndex={0}
      className={`file-item${isSelected ? ' file-item--selected' : ''}`}
      onClick={() => onSelect(item)}
      onDoubleClick={() => onOpen(item)}
      onKeyDown={(event) => event.key === 'Enter' && onOpen(item)}
      onContextMenu={(event) => {
        event.preventDefault()
        onShowMenu({ path: item.path, isDirectory: item.isDirectory })
      }}
    >
      {icon}
      <span className="file-item__name" title={item.name}>
        {item.name}
      </span>
    </li>
  )
}
