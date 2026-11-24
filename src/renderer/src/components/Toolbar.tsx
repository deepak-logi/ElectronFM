import { ArrowLeft, ArrowUp, Eye, EyeOff, Palette } from 'lucide-react'
import type { ThemeFamily } from '../../../shared/types'

interface ToolbarProps {
  currentPath: string
  canGoBack: boolean
  canGoUp: boolean
  onBack: () => void
  onUp: () => void
  showHidden: boolean
  onToggleHidden: () => void
  themeFamily: ThemeFamily
  onToggleTheme: () => void
}

export default function Toolbar({
  currentPath,
  canGoBack,
  canGoUp,
  onBack,
  onUp,
  showHidden,
  onToggleHidden,
  themeFamily,
  onToggleTheme
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
        className={`toolbar__button${showHidden ? ' toolbar__button--active' : ''}`}
        onClick={onToggleHidden}
        aria-pressed={showHidden}
        aria-label={showHidden ? 'Hide hidden files' : 'Show hidden files'}
        title={showHidden ? 'Hide hidden files' : 'Show hidden files'}
      >
        {showHidden ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
      </button>
      <button
        type="button"
        className={`toolbar__button${themeFamily === 'catppuccin' ? ' toolbar__button--active' : ''}`}
        onClick={onToggleTheme}
        aria-pressed={themeFamily === 'catppuccin'}
        aria-label={
          themeFamily === 'default' ? 'Switch to Catppuccin theme' : 'Switch to Default theme'
        }
        title={themeFamily === 'default' ? 'Switch to Catppuccin theme' : 'Switch to Default theme'}
      >
        <Palette size={18} aria-hidden />
      </button>
      <span className="toolbar__path" title={currentPath}>
        {currentPath || 'Loading…'}
      </span>
    </header>
  )
}
