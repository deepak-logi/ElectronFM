import { useEffect, useState } from 'react'
import Toolbar from './components/Toolbar'
import FileList from './components/FileList'
import DetailsPanel from './components/DetailsPanel'
import type { FileEntry } from '../../shared/types'

export default function App() {
  const [currentPath, setCurrentPath] = useState('')
  const [parentPath, setParentPath] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [items, setItems] = useState<FileEntry[]>([])
  const [selected, setSelected] = useState<FileEntry | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
      .readDir(currentPath)
      .then((result) => {
        if (cancelled) return
        setItems(result.items)
        setParentPath(result.parent)
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    } // Ignoring results from outdated requests
  }, [currentPath])
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
        .catch((err) => setError(err instanceof Error ? err.message : 'Unknown error'))
  }

  return (
    <div className="app">
      <Toolbar
        currentPath={currentPath}
        canGoBack={history.length > 0}
        canGoUp={Boolean(parentPath)}
        onBack={goBack}
        onUp={() => parentPath && navigateTo(parentPath)}
      />

      <main className="content">
        {loading && <p>Loading</p>}
        {error && <p className="error">{error}</p>}
        {!loading && !error && (
          <FileList items={items} selected={selected} onSelect={setSelected} onOpen={handleOpen} />
        )}
        <DetailsPanel item={selected} />
      </main>
    </div>
  )
}
