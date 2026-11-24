import { ArrowLeft, ArrowUp } from 'lucide-react'

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
      <span className="toolbar__path" title={currentPath}>
        {currentPath || 'Loading…'}
      </span>
    </header>
  )
}
