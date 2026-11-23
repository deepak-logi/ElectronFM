interface ToolbarProps {
  currentPath: string
  canGoBack: boolean
  canGoUp: boolean
  onBack: () => void
  onUp: () => void
}

export default function Toolbar({ currentPath, canGoBack, canGoUp, onBack, onUp }: ToolbarProps) {
  return (
    <header className="toolbar">
      <button type="button" onClick={onBack} disabled={!canGoBack}>
        ← Back
      </button>
      <button type="button" onClick={onUp} disabled={!canGoUp}>
        ↑ Up
      </button>
      <span className="toolbar-path" title={currentPath}>
        {currentPath || 'Loading…'}
      </span>
    </header>
  )
}
