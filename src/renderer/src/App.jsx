import { useEffect, useState } from "react";
import Toolbar from './components/Toolbar'
import FileList from './components/FileList'
import DetailsPanel from './components/DetailsPanel'

export default function App() {
  const [currentPath, setCurrentPath] = useState('')
  const [parentPath, setParentPath] = useState(null)
  const [history, setHistory] = useState([])
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Starting in home folder
  useEffect(() => {
    window.fileApi.getHomeDir().then(setCurrentPath)
  }, [])

  // Loading folder content whenever path changes
  useEffect(() => {
    if(!currentPath) return
    let cancelled = false
    setLoading(true)
    setError('')
    setSelected(null)

    window.fileApi.readDir(currentPath).then((result) => {
      if(cancelled) return
      setItems(result.items)
      setParentPath(result.parent)
    }).catch((err) => !cancelled && setError(err.message)).finally(() => !cancelled && setLoading(false))

    return () => {cancelled = true} // Ignoring results from outdated requests
  }, [currentPath])


  function navigateTo(newPath){
    setHistory((prev) => [...prev, currentPath])
    setCurrentPath(newPath)
  }

  function goBack() {
    if(history.length === 0) return
    setCurrentPath(history[history.length - 1])
    setHistory((prev) => prev.slice(0, -1))
  }

  function handleOpen(item) {
    if (item.isDirectory) navigateTo(item.path)
    else window.fileApi.openPath(item.path).catch((err) => setError(err.message))
  }

  return (
    <div className="app">
      <Toolbar
        currentPath={currentPath}
        canGoBack={history.length > 0}
        canGoUp={Boolean(parentPath)}
        onBack={goBack}
        onUp={() => navigateTo(parentPath)} 
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