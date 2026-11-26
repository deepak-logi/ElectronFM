# Architecture

This document explains how the app is split across Electron's processes, what each process is allowed to do, and how a user action travels from React to the file system and back.

## The three processes

| Process      | File                   | Responsibility                                                                  | Can access the file system?                  |
| ------------ | ---------------------- | ------------------------------------------------------------------------------- | -------------------------------------------- |
| **Main**     | `src/main/index.ts`    | Creates windows, owns the app lifecycle, reads folders, opens files with the OS | Yes, through Node                            |
| **Preload**  | `src/preload/index.ts` | Runs before the page loads and exposes a small, explicit API to the renderer    | No direct file access; it forwards IPC calls |
| **Renderer** | `src/renderer/src/**`  | React UI: state, rendering, clicks, and navigation                              | No — it only calls `window.fileApi`          |

The key rule: **the renderer never touches `fs` or `path`.** Everything that needs the operating system goes through the preload bridge to the main process.

## Process responsibilities

### Main process

`src/main/index.ts` does four jobs:

1. **App lifecycle** — `app.whenReady()`, window creation, macOS `activate`, and `window-all-closed`.
2. **File system access** — `fs:getHomeDir` returns the user's home folder, and `fs:readDir` reads a folder and returns plain JSON-safe data.
3. **Shell integration** — `shell:openPath` hands a file to the operating system, which opens it with the default application for that file type.
4. **System integration** — `system:getAccentColor` reports the macOS accent, and notifications push changes to the renderer via `system:accent-changed`.

It also keeps the existing electron-vite behaviour: load the dev server URL in development, or the built `index.html` in production.

### Preload

`src/preload/index.ts` exposes nine functions:

```ts
contextBridge.exposeInMainWorld('fileApi', {
  getHomeDir: (): Promise<string> => ipcRenderer.invoke('fs:getHomeDir'),
  readDir: (dirPath: string, showHidden: boolean): Promise<DirResult> =>
    ipcRenderer.invoke('fs:readDir', dirPath, showHidden),
  openPath: (filePath: string): Promise<void> => ipcRenderer.invoke('shell:openPath', filePath),
  getAccentColor: (): Promise<string | null> => ipcRenderer.invoke('system:getAccentColor'),
  onAccentColorChanged: (callback: (color: string | null) => void): (() => void) => {
    const listener = (_event: unknown, color: string | null) => callback(color)
    ipcRenderer.on('system:accent-changed', listener)
    return () => ipcRenderer.removeListener('system:accent-changed', listener)
  },
  showItemInFolder: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('shell:showItemInFolder', filePath),
  showContextMenu: (target: ContextMenuTarget): Promise<void> =>
    ipcRenderer.invoke('shell:showContextMenu', target),
  createFolder: (parentPath: string, name: string): Promise<string> =>
    ipcRenderer.invoke('fs:createFolder', parentPath, name),
  onNewFolderRequested: (callback: (parentPath: string) => void): (() => void) => {
    const listener = (_event: unknown, parentPath: string) => callback(parentPath)
    ipcRenderer.on('ui:request-new-folder', listener)
    return () => ipcRenderer.removeListener('ui:request-new-folder', listener)
  }
})
```

It never exposes `ipcRenderer` itself. The renderer can only call these nine operations — it cannot invent new IPC channels or reach Node APIs. `onAccentColorChanged` is the one push-based API: it wraps `ipcRenderer.on` and hands back only an unsubscribe function. `src/preload/index.d.ts` declares this shape as `Window.fileApi`, so the renderer gets autocomplete and compile-time checking on the bridge.

### Renderer

The renderer is a normal React app:

- `App.tsx` owns all application state and the data-loading effect.
- `Toolbar`, `FileList`, `FileItem`, and `DetailsPanel` are presentational components with typed prop interfaces that receive props and report events.
- `utils/format.ts` contains pure formatting helpers, and `utils/fileIcons.ts` maps a `FileEntry` to a lucide icon.
- `styles/` holds the SCSS structure; `main.scss` is the only stylesheet React imports. See [`styling.md`](styling.md).
- `Toolbar` hosts Back, Up, hidden-files, and theme-family buttons. All four states stay in `App.tsx`.
- `DetailsPanel` has a "Reveal in file manager" button. `FileItem` handles right-click by invoking `showContextMenu`; the native menu and all OS operations are owned by main. Both paths can surface errors through `App`'s shared error state.

## TypeScript layout

The source is TypeScript end to end. electron-vite transpiles it with esbuild, so the build config needed no changes; checking types is a separate step run with `npm run typecheck`.

| File                        | Role                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `tsconfig.node.json`        | Main + preload + `electron.vite.config.mjs`; Node globals and electron-vite's `?asset` module declarations |
| `tsconfig.web.json`         | Renderer; DOM types, `react-jsx`, and the `@renderer/*` alias                                              |
| `tsconfig.json`             | Solution file with references to both projects                                                             |
| `src/shared/types.ts`       | `FileEntry` and `DirResult`, used by main, preload, and renderer                                           |
| `src/preload/index.d.ts`    | Global declaration for `window.fileApi`                                                                    |
| `src/renderer/src/env.d.ts` | Vite client types                                                                                          |

Each project has an `outDir` under `node_modules/.tmp` because `composite: true` implies emit. Without it, TypeScript would try to write output over source files (the node project keeps `allowJs` so `electron.vite.config.mjs` is included).

`strict` is on and `noImplicitAny` is enabled explicitly in both project configs — the shared `@electron-toolkit/tsconfig` base turns it off, so it has to be repeated per project. IPC handler arguments are typed `unknown`, because they arrive from the renderer and cannot be trusted; the `typeof` and `path.isAbsolute` checks then narrow them.

### Shared types

`src/shared/types.ts` is the IPC contract. It defines `FileEntry` (one row in the list), `Crumb` (one breadcrumb segment: `name` + absolute `path`), `DirResult` (what `fs:readDir` returns, including `breadcrumbs: Crumb[]`), `ContextMenuTarget` (`path` + `isDirectory`, sent by a right-click), and `ThemeFamily` (`'default' | 'catppuccin'`, a renderer-only type shared with `Toolbar`). It is imported by:

- `src/main/index.ts`, which builds the objects and annotates the handler return type.
- `src/preload/index.ts`, which types the bridge functions.
- `src/renderer/src/App.tsx` and the components, which consume the data.

Because all three read the same interface, changing a field in the main process makes the renderer fail to compile instead of failing at runtime. Neither tsconfig owns the file exclusively: both project `include` arrays list `src/shared/**/*`.

## IPC channels

| Channel                  | Direction       | Input                                       | Returns                                             |
| ------------------------ | --------------- | ------------------------------------------- | --------------------------------------------------- |
| `fs:getHomeDir`          | Renderer → Main | none                                        | The user's home folder path                         |
| `fs:readDir`             | Renderer → Main | Absolute folder path + `showHidden` boolean | `{ path, parent, items }`                           |
| `shell:openPath`         | Renderer → Main | Absolute file path                          | Nothing, or an error message                        |
| `system:getAccentColor`  | Renderer → Main | none                                        | `#RRGGBB` or `null` on non-macOS                    |
| `system:accent-changed`  | Main → Renderer | Accent colour or `null`                     | Delivered via `window.fileApi.onAccentColorChanged` |
| `shell:showItemInFolder` | Renderer → Main | Absolute file or folder path                | Nothing, or an error message                        |
| `shell:showContextMenu`  | Renderer → Main | `{ path, isDirectory }`                     | Nothing, or an error message                        |
| `fs:createFolder`        | Renderer → Main | Absolute parent path + folder name          | Created folder's absolute path                      |
| `ui:request-new-folder`  | Main → Renderer | Absolute parent path                        | Delivered via `window.fileApi.onNewFolderRequested` |

`system:getAccentColor` is called once on mount to seed the renderer. Live changes use the one main → renderer channel: on macOS the main process subscribes to `AppleAquaColorVariantChanged`, `AppleColorPreferencesChangedNotification`, and `AppleInterfaceThemeChangedNotification`, then re-reads the accent **100 ms later** (the notification can arrive before macOS has written the new value) and pushes it only if it differs from the last value sent. Electron's `accent-color-changed` event is Windows/Linux only, so it cannot be used on macOS.

`fs:readDir` rejects with `Invalid folder path` if the argument is not a string or is not absolute, and with `Invalid showHidden flag` if the second argument is not a boolean. Hidden entries (names starting with `.`) are filtered out before `fs.stat` when `showHidden` is false. `shell:openPath` rejects with `Invalid file path` for the same path checks, or with the OS error message if the file cannot be opened (for example, no application is associated with the file). `shell:showItemInFolder` checks the same way and rejects with `Invalid file selected`; unlike `openPath`, it returns `void` synchronously, so there is no OS error string to inspect. `shell:showContextMenu` validates the whole target object before building a native `Menu`: the path must be absolute and `isDirectory` must be a boolean. `fs:createFolder` validates both arguments: the parent must be an absolute path and the name must be a non-empty single path component (no `.`/`..` or separators). An existing entry produces `A folder with that name already exists`.

## The item data shape

Each entry returned by `fs:readDir` is a `FileEntry` (defined in `src/shared/types.ts`):

| Field         | Type    | Example                           | Notes                                                |
| ------------- | ------- | --------------------------------- | ---------------------------------------------------- |
| `name`        | string  | `"report.pdf"`                    | Base name only                                       |
| `path`        | string  | `/Users/you/Documents/report.pdf` | Absolute path                                        |
| `isDirectory` | boolean | `false`                           | Uses `stats.isDirectory()`, so symlinks are followed |
| `size`        | number  | `48213`                           | Bytes; not meaningful for directories                |
| `modified`    | number  | `1732300000000`                   | `stats.mtimeMs`, milliseconds since epoch            |
| `extension`   | string  | `".pdf"`                          | Lowercased; empty string when there is no extension  |

Entries are sorted with **folders first**, then by name using `localeCompare`. Entries whose `fs.stat` fails are skipped instead of failing the whole folder.

## Breadcrumbs

`buildBreadcrumbs` in the main process walks upward from the requested folder until it reaches `path.parse(dirPath).root`, collecting `{ name, path }` pairs and reversing them so the root comes first. The user's home folder is labelled `Home`. This belongs in main because the renderer has no `path` module and Windows paths use a different separator and root.

`fs:readDir` returns the segments as part of `DirResult`. The `loadDirectory` thunk's `fulfilled` action stores them in the `navigation` slice; `App` reads them with a selector and passes them to `Toolbar`, which renders every ancestor as a button and the last segment as plain text with `aria-current="page"`. Clicking a button dispatches `navigate`, so breadcrumb navigation goes through the same history logic as Back and Up.

## Walkthrough: double-clicking a folder

1. `FileItem` fires `onDoubleClick` and calls `onOpen(item)`.
2. `App.handleOpen(item)` sees `item.isDirectory === true` and calls `navigateTo(item.path)`.
3. `navigateTo` pushes the current path onto `history` and sets `currentPath` to the new folder.
4. The `useEffect` that depends on `currentPath` and `showHidden` dispatches the `loadDirectory` thunk. Its `pending` action sets `loading`, clears the previous error/selection/items and records the request id.
5. The preload calls `ipcRenderer.invoke('fs:readDir', currentPath, showHidden)`.
6. The main process validates the path and the boolean flag, runs `fs.readdir(..., { withFileTypes: true })`, skips dot-prefixed entries when hidden files are off, calls `fs.stat` for each remaining entry, sorts the results, computes the parent path, builds the breadcrumb segments with `buildBreadcrumbs` (using `path.parse().root`, `path.basename`, and `path.dirname`), and returns `{ path, parent, items, breadcrumbs }`.
7. The thunk's `fulfilled` action stores `items` in the `files` slice; the `navigation` slice stores `parentPath` and `breadcrumbs` from the same payload, and `loading` becomes `false`.
8. `FileList` re-renders the new items. `DetailsPanel` continues to show its empty state, because selection was already cleared by `pending`.

If the user navigates again before the first request finishes, both slices compare `action.meta.requestId` with the id stored on `pending` and ignore the stale response. This replaces the old `cancelled` flag in the effect cleanup.

## Walkthrough: double-clicking a file

1. `FileItem` calls `onOpen(item)`.
2. `App.handleOpen` sees `item.isDirectory === false` and calls `window.fileApi.openPath(item.path)`.
3. The preload invokes `shell:openPath` in the main process.
4. The main process calls `shell.openPath(filePath)`.
5. Electron asks the operating system to open the path "in the desktop's default manner" — the same behaviour as double-clicking the file in Finder/Explorer. The OS picks the application registered for that file type (for example, Word for `.docx`).
6. If the OS returns an error message, the main process throws it and `App` shows the message in the error state.

`shell.openPath` does **not** mean "open Finder". Finder is a file manager, not the default handler for files. To reveal a file in the file manager instead, Electron provides `shell.showItemInFolder`.

## Context menu

Right-clicking a row does not build a menu in React. `FileItem` calls `window.fileApi.showContextMenu({ path, isDirectory })`, and main builds a native `Menu` with these actions:

- **Open** (`Open folder` for directories) → `shell.openPath`
- **New Folder Inside** (directories only) → main sends `ui:request-new-folder` with the folder's path; the renderer navigates there if needed and dispatches `beginCreateFolder` to open the inline input row
- **Reveal in file manager** → `shell.showItemInFolder`
- **Copy path** → `clipboard.writeText`

Keeping the menu in main means `shell` and `clipboard` never enter the renderer, consistent with the rest of the IPC boundary. `ui:request-new-folder` is a main → renderer push, wrapped by preload as `onNewFolderRequested` so `ipcRenderer` is still never exposed. The toolbar's New Folder button and the details-panel Reveal button remain for keyboard users, since a context menu is pointer-only.

### Creating a folder

Whether triggered by the toolbar button or the context menu, the flow is the same. `filesSlice` holds `isCreatingFolder`; `FileList` renders `NewFolderRow` with an inline input. Enter dispatches the `createFolder` thunk, which calls `window.fileApi.createFolder(currentPath, name)`. On success the thunk closes the row, `App` re-dispatches `loadDirectory`, and the new folder appears. Escape or blur cancels; a rejected name keeps the row open and puts the error in the shared error banner.

## Diagram

```mermaid
sequenceDiagram
    participant U as User
    participant R as Renderer (React)
    participant P as Preload (contextBridge)
    participant M as Main (Electron + Node)
    participant OS as Operating System

    U->>R: Double-click folder
    R->>R: handleOpen → navigateTo(path)
    R->>R: useEffect(currentPath) runs
    R->>P: window.fileApi.readDir(path)
    P->>M: ipcRenderer.invoke('fs:readDir', path)
    M->>M: validate path
    M->>OS: fs.readdir + fs.stat
    OS-->>M: entries + metadata
    M->>M: sort, compute parent
    M-->>P: { path, parent, items }
    P-->>R: Promise resolves
    R->>R: setItems / setParentPath
    R-->>U: Updated file list

    U->>R: Double-click file
    R->>P: window.fileApi.openPath(filePath)
    P->>M: ipcRenderer.invoke('shell:openPath', filePath)
    M->>OS: shell.openPath(filePath)
    OS-->>U: Opens default application
```

## State management

Renderer state lives in three Redux Toolkit slices, not in `App.tsx`:

| Slice        | State                                                                    | Actions                                                                                                                |
| ------------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `files`      | `items`, `selected`, `loading`, `error`, `requestId`, `isCreatingFolder` | `selectItem`, `reportError`, `beginCreateFolder`, `cancelCreateFolder`, plus `loadDirectory` and `createFolder` thunks |
| `navigation` | `currentPath`, `parentPath`, `history`, `breadcrumbs`, `requestId`       | `setCurrentPath`, `navigate`, `goBack`                                                                                 |
| `settings`   | `showHidden`, `themeFamily`, `systemAccent`                              | `toggleHidden`, `setThemeFamily`, `setSystemAccent`                                                                    |

`app/store.ts` combines the reducers and exports `RootState`/`AppDispatch`; `app/hooks.ts` exports `useAppSelector` and `useAppDispatch` created with `.withTypes(...)`, so selectors and thunks are fully typed. `App.tsx` has no local state — it reads values with selectors and dispatches actions. Child components remain presentational, receiving props from `App`.

`loadDirectory` is a `createAsyncThunk` that calls `window.fileApi.readDir`. `pending` sets `loading`, clears the previous selection/error/items and records `action.meta.requestId`. Both `files` and `navigation` ignore `fulfilled`/`rejected` results whose `requestId` no longer matches, so an older, slower folder read cannot overwrite a newer one. The `navigation` slice stores `parentPath` and `breadcrumbs` from the same successful result.

DOM and `localStorage` effects (theme attribute, `--accent-source`) stay in `App.tsx` but read their values from the store. IPC side effects stay in thunks or event handlers; reducers remain pure.

## Error handling

- **Invalid IPC input** is rejected in the main process, not trusted from the UI.
- **Unreadable entries** are skipped during `readDir` instead of failing the folder.
- **Folder read failures** (for example, permission denied) reject the promise and appear in the error state.
- **File open failures** (no associated app, missing file) are caught in `App` and shown as an error message. Both `.catch` handlers check `err instanceof Error` before reading `err.message`, with an `Unknown error` fallback for non-`Error` rejections.
- **Stale requests** are ignored by comparing `action.meta.requestId` with the id stored on `pending` in both the `files` and `navigation` slices.
