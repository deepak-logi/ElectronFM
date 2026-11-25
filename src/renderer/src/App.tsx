import { useEffect } from 'react'
import Toolbar from './components/Toolbar'
import FileList from './components/FileList'
import DetailsPanel from './components/DetailsPanel'
import type { ContextMenuTarget, FileEntry } from '../../shared/types'
import { useAppDispatch, useAppSelector } from './app/hooks'
import {
  goBack as goBackAction,
  navigate,
  selectCanGoBack,
  selectCanGoUp,
  setCurrentPath
} from './features/navigationSlice'
import { loadDirectory, reportError, selectItem } from './features/filesSlice'
import { setSystemAccent, setThemeFamily, toggleHidden } from './features/settingsSlice'

export default function App() {
  const showHidden = useAppSelector((s) => s.settings.showHidden)
  const themeFamily = useAppSelector((s) => s.settings.themeFamily)
  const systemAccent = useAppSelector((s) => s.settings.systemAccent)

  const currentPath = useAppSelector((s) => s.navigation.currentPath)
  const parentPath = useAppSelector((s) => s.navigation.parentPath)
  const canGoBack = useAppSelector(selectCanGoBack)
  const canGoUp = useAppSelector(selectCanGoUp)
  const breadcrumbs = useAppSelector((s) => s.navigation.breadcrumbs)

  const items = useAppSelector((s) => s.files.items)
  const selected = useAppSelector((s) => s.files.selected)
  const loading = useAppSelector((s) => s.files.loading)
  const error = useAppSelector((s) => s.files.error)

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

  // Loading folder content whenever the path or the hidden-files setting changes.
  // The thunk handles loading, errors and stale responses via requestId.
  useEffect(() => {
    if (!currentPath) return
    dispatch(loadDirectory({ path: currentPath, showHidden }))
  }, [currentPath, showHidden, dispatch])

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
        .catch((err: unknown) =>
          dispatch(reportError(err instanceof Error ? err.message : 'Unknown error'))
        )
  }

  function handleReveal(filePath: string) {
    window.fileApi
      .showItemInFolder(filePath)
      .catch((err: unknown) =>
        dispatch(reportError(err instanceof Error ? err.message : 'Unknown error'))
      )
  }

  function handleShowMenu(target: ContextMenuTarget) {
    window.fileApi
      .showContextMenu(target)
      .catch((err: unknown) =>
        dispatch(reportError(err instanceof Error ? err.message : 'Unknown error'))
      )
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
              onSelect={(item) => dispatch(selectItem(item))}
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
