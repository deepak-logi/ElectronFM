import { app, shell, BrowserWindow, ipcMain, systemPreferences } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import path, { join } from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'
import type { Crumb, DirResult, FileEntry } from '../shared/types'

// In development the process is still Electron's binary, so the Dock tooltip
// says "Electron". The packaged app gets its name from Info.plist instead.
if (is.dev && process.platform === 'darwin') {
  app.setName('File Manager')
}

ipcMain.handle('fs:getHomeDir', (): string => os.homedir())

ipcMain.handle(
  'fs:readDir',
  async (_event, dirPath: unknown, showHidden: unknown): Promise<DirResult> => {
    // force returned obj to DirResult type
    if (typeof dirPath !== 'string' || !path.isAbsolute(dirPath)) {
      throw new Error('Invalid folder path')
    }
    if (typeof showHidden !== 'boolean') {
      throw new Error('Invalid showHidden flag')
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true })

    const items = await Promise.all(
      entries.map(async (entry) => {
        // adding hidden file toggle
        if (!showHidden && entry.name.startsWith('.')) return null
        const fullPath = path.join(dirPath, entry.name)
        try {
          const stats = await fs.stat(fullPath) // follows symlinks
          return {
            name: entry.name,
            path: fullPath,
            isDirectory: stats.isDirectory(),
            size: stats.size,
            modified: stats.mtimeMs,
            extension: path.extname(entry.name).toLowerCase()
          }
        } catch {
          return null // Skip files we can't read
        }
      })
    )

    const sorted = items
      .filter((item): item is FileEntry => item !== null) // filter(Boolean) doesnt narrow FileEntry | null to FileEntry in TS
      .sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name)) // converting to Number, since req for arithmetic operation

    const parent = path.dirname(dirPath)
    return {
      path: dirPath,
      parent: parent !== dirPath ? parent : null,
      items: sorted,
      breadcrumbs: buildBreadcrumbs(dirPath)
    }
  }
)

ipcMain.handle('shell:openPath', async (_event, filePath: unknown): Promise<void> => {
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) {
    throw new Error('Invalid file path')
  }
  const errorMessage = await shell.openPath(filePath)
  if (errorMessage) throw new Error(errorMessage)
})

function macAccent(): string | null {
  if (process.platform !== 'darwin') return null
  const rgba = systemPreferences.getAccentColor() // "RRGGBBAA"
  if (!rgba || rgba.length < 6) return null
  return `#${rgba.slice(0, 6)}`
}

ipcMain.handle('system:getAccentColor', (): string | null => macAccent())

ipcMain.handle('shell:showItemInFolder', async (_event, filePath: unknown): Promise<void> => {
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) {
    throw new Error('Invalid file selected')
  }
  shell.showItemInFolder(filePath)
})

function buildBreadcrumbs(dirPath: string): Crumb[] {
  const { root } = path.parse(dirPath)
  const home = os.homedir()
  const crumbs: Crumb[] = []

  let current = dirPath
  while (current !== root) {
    crumbs.push({
      name: current === home ? 'Home' : path.basename(current),
      path: current
    })
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }

  crumbs.push({ name: root, path: root })
  return crumbs.reverse()
}

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

if (is.dev && process.platform === 'darwin') {
  app.setName('File Manager')
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.deepak.filemanager')

  // In development the Dock would otherwise show Electron's default icon.
  // Packaged builds use the icon embedded by electron-builder instead.
  if (is.dev && process.platform === 'darwin') {
    app.dock?.setIcon(icon) // changing to optional call since we changed to TS
  }

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  if (process.platform === 'darwin') {
    // macOS does not emit Electron's `accent-color-changed` event (that one is
    // Windows/Linux only). The accent/tint change is delivered as a distributed
    // notification; subscribe to all relevant names because System Settings
    // does not post the same one for every accent change.
    const accentNotifications = [
      'AppleAquaColorVariantChanged',
      'AppleColorPreferencesChangedNotification',
      'AppleInterfaceThemeChangedNotification'
    ]

    let lastAccent = macAccent()

    const broadcastAccent = () => {
      const color = macAccent()
      if (color === lastAccent) return
      lastAccent = color

      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) win.webContents.send('system:accent-changed', color)
      }
    }

    for (const notification of accentNotifications) {
      systemPreferences.subscribeNotification(notification, () => {
        // The notification can arrive before macOS has written the new value,
        // so read once after a short delay instead of reading immediately.
        setTimeout(broadcastAccent, 100)
      })
    }
  }
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
