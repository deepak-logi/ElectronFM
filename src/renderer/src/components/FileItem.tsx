export default function FileItem({ item, isSelected, onSelect, onOpen }) {
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
