import { useEffect, useState } from 'react'
import Toolbar from './components/Toolbar'
import FileList from './components/FileList'
import DetailsPanel from './components/DetailsPanel'
import type { ContextMenuTarget, Crumb, FileEntry, ThemeFamily } from '../../shared/types'

export default function App() {
  const [currentPath, setCurrentPath] = useState('')
  const [parentPath, setParentPath] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [items, setItems] = useState<FileEntry[]>([])
  const [selected, setSelected] = useState<FileEntry | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showHidden, setShowHidden] = useState(false)
  const [systemAccent, setSystemAccent] = useState<string | null>(null)
  const [breadcrumbs, setBreadcrumbs] = useState<Crumb[]>([])

  useEffect(() => {
    let active = true

    window.fileApi
      .getAccentColor()
      .then((color) => active && setSystemAccent(color))
      .catch(() => active && setSystemAccent(null))

    const unsubscribe = window.fileApi.onAccentColorChanged(setSystemAccent)
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (systemAccent) {
      root.style.setProperty('--accent-source', systemAccent)
      // The CSS block that maps --accent-source onto the theme tokens is
      // gated on this attribute; a custom property alone is not selectable.
      root.dataset.accentSource = 'true'
    } else {
      root.style.removeProperty('--accent-source')
      delete root.dataset.accentSource
    }
  }, [systemAccent])

  const [themeFamily, setThemeFamily] = useState<ThemeFamily>(() => {
    const saved = localStorage.getItem('fm-theme-family')
    return saved === 'catppuccin' ? 'catppuccin' : 'default'
  })
  // lazy initializer -> runs only once on mount

  useEffect(() => {
    document.documentElement.dataset.themeFamily = themeFamily
    localStorage.setItem('fm-theme-family', themeFamily)
  }, [themeFamily])

  // Starting in home folder
  useEffect(() => {
    window.fileApi.getHomeDir().then(setCurrentPath)
  }, [])

  // Loading folder content whenever path changes
  /* eslint-disable react-hooks/set-state-in-effect -- fetching on path change is a legitimate effect; the cleanup below ignores stale responses */
  useEffect(() => {
    if (!currentPath) return
    let cancelled = false
    setLoading(true)
    setError('')
    setSelected(null)
    setBreadcrumbs([])

    window.fileApi
      .readDir(currentPath, showHidden)
      .then((result) => {
        if (cancelled) return
        setItems(result.items)
        setParentPath(result.parent)
        setBreadcrumbs(result.breadcrumbs)
      })
      .catch(
        (err: unknown) =>
          !cancelled && setError(err instanceof Error ? err.message : 'Unknown error')
      )
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    } // Ignoring results from outdated requests
  }, [currentPath, showHidden])
  /* eslint-enable react-hooks/set-state-in-effect */

  function navigateTo(newPath: string) {
    setHistory((prev) => [...prev, currentPath])
    setCurrentPath(newPath)
  }

  function goBack() {
    if (history.length === 0) return
    setCurrentPath(history[history.length - 1])
    setHistory((prev) => prev.slice(0, -1))
  }

  function handleOpen(item: FileEntry) {
    if (item.isDirectory) navigateTo(item.path)
    else
      window.fileApi
        .openPath(item.path)
        .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unknown error'))
  }

  function handleReveal(filePath: string) {
    window.fileApi
      .showItemInFolder(filePath)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unknown error'))
  }

  function handleShowMenu(target: ContextMenuTarget) {
    window.fileApi
      .showContextMenu(target)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unknown error'))
  }

  return (
    <div className="app">
      <Toolbar
        currentPath={currentPath}
        canGoBack={history.length > 0}
        canGoUp={Boolean(parentPath)}
        onBack={goBack}
        onUp={() => parentPath && navigateTo(parentPath)}
        showHidden={showHidden}
        onToggleHidden={() => setShowHidden((prev) => !prev)}
        themeFamily={themeFamily}
        onToggleTheme={() =>
          setThemeFamily((prev) => (prev === 'default' ? 'catppuccin' : 'default'))
        }
        breadcrumbs={breadcrumbs}
        onNavigate={navigateTo}
      />

      <main className="content">
        <section className="content__main">
          {loading && <p className="state">Loading…</p>}
          {error && (
            <p className="state state--error" role="alert">
              {error}
            </p>
          )}
          {!loading && !error && (
            <FileList
              items={items}
              selected={selected}
              onSelect={setSelected}
              onOpen={handleOpen}
              onShowMenu={handleShowMenu}
            />
          )}
        </section>
        <DetailsPanel item={selected} onReveal={handleReveal} />
      </main>
    </div>
  )
}
