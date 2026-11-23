import { formatSize, formatDate } from '../utils/format'

export default function DetailsPanel({ item }) {
  if (!item) {
    return <aside className="details-panel">Select a file to see its details.</aside>
  }

  const type = item.isDirectory
    ? 'Folder'
    : item.extension
      ? item.extension.slice(1).toUpperCase()
      : 'File'

  return (
    <aside className="details-panel">
      <h2 className="details-name">{item.name}</h2>
      <dl className="details-list">
        <dt>Type</dt>
        <dd>{type}</dd>

        <dt>Size</dt>
        <dd>{item.isDirectory ? '-' : formatSize(item.size)}</dd>

        <dt>Modified</dt>
        <dd>{formatDate(item.modified)}</dd>

        <dt>Path</dt>
        <dd className="details-path" title={item.path}>
          {item.path}
        </dd>
      </dl>
    </aside>
  )
}
