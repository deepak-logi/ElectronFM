import { ArrowLeft, ArrowUp, EyeOff, Eye } from 'lucide-react'

interface ToolbarProps {
  currentPath: string
  canGoBack: boolean
  canGoUp: boolean
  onBack: () => void
  onUp: () => void
  showHidden: boolean
  onToggleHidden: () => void
}

export default function Toolbar({
  currentPath,
  canGoBack,
  canGoUp,
  onBack,
  onUp,
  showHidden,
  onToggleHidden
}: ToolbarProps) {
  return (
    <header className="toolbar">
      <button
        type="button"
        className="toolbar__button"
        onClick={onBack}
        disabled={!canGoBack}
        aria-label="Back"
      >
        <ArrowLeft size={18} aria-hidden />
      </button>
      <button
        type="button"
        className="toolbar__button"
        onClick={onUp}
        disabled={!canGoUp}
        aria-label="Up"
      >
        <ArrowUp size={18} aria-hidden />
      </button>
      <button
        type="button"
        className={`toolbar__button${showHidden ? 'toolbar__button--active' : ''}`}
        onClick={onToggleHidden}
        aria-pressed={showHidden}
        aria-label={showHidden ? 'Hide hidden files' : 'Show hidden files'}
        title={showHidden ? 'Hide hidden files' : 'Show hidden files'}
      >
        {showHidden ? <EyeOff size={10} aria-hidden /> : <Eye size={10} aria-hidden />}
      </button>
      <span className="toolbar__path" title={currentPath}>
        {currentPath || 'Loading…'}
      </span>
    </header>
  )
}
