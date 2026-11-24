import { useEffect, useState } from 'react'
import Toolbar from './components/Toolbar'
import FileList from './components/FileList'
import DetailsPanel from './components/DetailsPanel'
import type { FileEntry, ThemeFamily } from '../../shared/types'

export default function App() {
  const [currentPath, setCurrentPath] = useState('')
  const [parentPath, setParentPath] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [items, setItems] = useState<FileEntry[]>([])
  const [selected, setSelected] = useState<FileEntry | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showHidden, setShowHidden] = useState(false)

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

    window.fileApi
      .readDir(currentPath, showHidden)
      .then((result) => {
        if (cancelled) return
        setItems(result.items)
        setParentPath(result.parent)
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
            />
          )}
        </section>
        <DetailsPanel item={selected} />
      </main>
    </div>
  )
}
