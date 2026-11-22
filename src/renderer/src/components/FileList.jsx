import FileItem from './FileItem'

export default function FileList({ items, selected, onSelect, onOpen }) {
  if (items.length === 0) return <p>This folder is empty.</p>

  return (
    <ul className="file-list">
      {items.map((item) => (
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
