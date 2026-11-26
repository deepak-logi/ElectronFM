import { useState } from 'react'
import { FolderPlus } from 'lucide-react'

interface NewFolderRowProps {
  onCreate: (name: string) => void
  onCancel: () => void
}

export default function NewFolderRow({ onCreate, onCancel }: NewFolderRowProps) {
  const [name, setName] = useState('')

  function commit() {
    const trimmed = name.trim()
    if (trimmed) onCreate(trimmed)
    else onCancel()
  }

  return (
    <li className="new-folder" role="presentation">
      <FolderPlus size={18} aria-hidden />
      <input
        className="new-folder__input"
        value={name}
        autoFocus
        placeholder="Folder name"
        aria-label="New folder name"
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit()
          if (event.key === 'Escape') onCancel()
        }}
        onBlur={onCancel}
      />
    </li>
  )
}
