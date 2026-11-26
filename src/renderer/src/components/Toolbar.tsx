import { ArrowLeft, ArrowUp, Eye, EyeOff, FolderPlus, Palette } from 'lucide-react'
import type { Crumb, ThemeFamily } from '../../../shared/types'

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
  breadcrumbs: Crumb[]
  onNavigate: (path: string) => void
  onNewFolder: () => void
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
  onToggleTheme,
  breadcrumbs,
  onNavigate,
  onNewFolder
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

      <button
        type="button"
        className="toolbar__button"
        onClick={onNewFolder}
        aria-label="New Folder"
        title="New Folder"
      >
        <FolderPlus size={18} aria-hidden />
      </button>

      {breadcrumbs.length === 0 ? (
        <span className="toolbar__path" title={currentPath}>
          {currentPath || 'Loading...'}
        </span>
      ) : (
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, index) => {
            const isCurrent = index === breadcrumbs.length - 1
            return (
              <span className="breadcrumbs__segment" key={crumb.path}>
                {index > 0 && (
                  <span className="breadcrumbs__separator" aria-hidden>
                    ›
                  </span>
                )}
                {isCurrent ? (
                  <span
                    className="breadcrumbs__link breadcrumbs__link--current"
                    aria-current="page"
                  >
                    {crumb.name}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="breadcrumbs__link"
                    onClick={() => onNavigate(crumb.path)}
                    title={crumb.path}
                  >
                    {crumb.name}
                  </button>
                )}
              </span>
            )
          })}
        </nav>
      )}
    </header>
  )
}
