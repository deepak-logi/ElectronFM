export default function Toolbar({ currentPath, canGoBack, canGoUp, onBack, onUp }) {
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
