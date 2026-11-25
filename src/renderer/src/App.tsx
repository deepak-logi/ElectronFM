import { useEffect, useState } from 'react'
import Toolbar from './components/Toolbar'
import FileList from './components/FileList'
import DetailsPanel from './components/DetailsPanel'
import type { ContextMenuTarget, FileEntry } from '../../shared/types'
import { useAppDispatch, useAppSelector } from './app/hooks'
import {
  clearFolder,
  goBack as goBackAction,
  navigate,
  selectCanGoBack,
  selectCanGoUp,
  setCurrentPath,
  setFolder
} from './features/navigationSlice'
import { setSystemAccent, setThemeFamily, toggleHidden } from './features/settingsSlice'

export default function App() {
  const [items, setItems] = useState<FileEntry[]>([])
  const [selected, setSelected] = useState<FileEntry | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const showHidden = useAppSelector((s) => s.settings.showHidden)
  const themeFamily = useAppSelector((s) => s.settings.themeFamily)
  const systemAccent = useAppSelector((s) => s.settings.systemAccent)

  const currentPath = useAppSelector((s) => s.navigation.currentPath)
  const parentPath = useAppSelector((s) => s.navigation.parentPath)
  const canGoBack = useAppSelector(selectCanGoBack)
  const canGoUp = useAppSelector(selectCanGoUp)
  const breadcrumbs = useAppSelector((s) => s.navigation.breadcrumbs)

  const dispatch = useAppDispatch()

  useEffect(() => {
    let active = true

    window.fileApi
      .getAccentColor()
      .then((color) => active && dispatch(setSystemAccent(color)))
      .catch(() => active && dispatch(setSystemAccent(null)))

    const unsubscribe = window.fileApi.onAccentColorChanged((color) =>
      dispatch(setSystemAccent(color))
    )
    return () => {
      active = false
      unsubscribe()
    }
  }, [dispatch])

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

  useEffect(() => {
    document.documentElement.dataset.themeFamily = themeFamily
    localStorage.setItem('fm-theme-family', themeFamily)
  }, [themeFamily])

  // Starting in home folder
  useEffect(() => {
    window.fileApi.getHomeDir().then((path) => dispatch(setCurrentPath(path)))
  }, [dispatch])

  // Loading folder content whenever path changes
  /* eslint-disable react-hooks/set-state-in-effect -- fetching on path change is a legitimate effect; the cleanup below ignores stale responses */
  useEffect(() => {
    if (!currentPath) return
    let cancelled = false
    setLoading(true)
    setError('')
    setSelected(null)
    dispatch(clearFolder())

    window.fileApi
      .readDir(currentPath, showHidden)
      .then((result) => {
        if (cancelled) return
        setItems(result.items)
        dispatch(setFolder({ parent: result.parent, breadcrumbs: result.breadcrumbs }))
      })
      .catch(
        (err: unknown) =>
          !cancelled && setError(err instanceof Error ? err.message : 'Unknown error')
      )
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    } // Ignoring results from outdated requests
  }, [currentPath, showHidden, dispatch])
  /* eslint-enable react-hooks/set-state-in-effect */

  function navigateTo(newPath: string) {
    dispatch(navigate(newPath))
  }

  function goBack() {
    dispatch(goBackAction())
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
        canGoBack={canGoBack}
        canGoUp={canGoUp}
        onBack={goBack}
        onUp={() => parentPath && navigateTo(parentPath)}
        showHidden={showHidden}
        onToggleHidden={() => dispatch(toggleHidden())}
        themeFamily={themeFamily}
        onToggleTheme={() =>
          dispatch(setThemeFamily(themeFamily === 'default' ? 'catppuccin' : 'default'))
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
