import { formatSize, formatDate } from '../utils/format'
import type { FileEntry } from '../../../shared/types'

interface DetailsPanelProps {
  item: FileEntry | null
}

export default function DetailsPanel({ item }: DetailsPanelProps) {
  if (!item) {
    return (
      <aside className="details-panel">
        <p className="details-panel__empty">Select a file to see its details.</p>
      </aside>
    )
  }

  const type = item.isDirectory
    ? 'Folder'
    : item.extension
      ? item.extension.slice(1).toUpperCase()
      : 'File'

  return (
    <aside className="details-panel">
      <h2 className="details-panel__name">{item.name}</h2>
      <dl className="details-panel__list">
        <dt>Type</dt>
        <dd>{type}</dd>

        <dt>Size</dt>
        <dd>{item.isDirectory ? '-' : formatSize(item.size)}</dd>

        <dt>Modified</dt>
        <dd>{formatDate(item.modified)}</dd>

        <dt>Path</dt>
        <dd className="details-panel__path" title={item.path}>
          {item.path}
        </dd>
      </dl>
    </aside>
  )
}
