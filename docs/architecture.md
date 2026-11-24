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

`src/main/index.ts` does three jobs:

1. **App lifecycle** — `app.whenReady()`, window creation, macOS `activate`, and `window-all-closed`.
2. **File system access** — `fs:getHomeDir` returns the user's home folder, and `fs:readDir` reads a folder and returns plain JSON-safe data.
3. **Shell integration** — `shell:openPath` hands a file to the operating system, which opens it with the default application for that file type.

It also keeps the existing electron-vite behaviour: load the dev server URL in development, or the built `index.html` in production.

### Preload

`src/preload/index.ts` exposes exactly three functions:

```ts
contextBridge.exposeInMainWorld('fileApi', {
  getHomeDir: (): Promise<string> => ipcRenderer.invoke('fs:getHomeDir'),
  readDir: (dirPath: string): Promise<DirResult> => ipcRenderer.invoke('fs:readDir', dirPath),
  openPath: (filePath: string): Promise<void> => ipcRenderer.invoke('shell:openPath', filePath)
})
```

It never exposes `ipcRenderer` itself. The renderer can only call these three operations — it cannot invent new IPC channels or reach Node APIs. `src/preload/index.d.ts` declares this shape as `Window.fileApi`, so the renderer gets autocomplete and compile-time checking on the bridge.

### Renderer

The renderer is a normal React app:

- `App.tsx` owns all application state and the data-loading effect.
- `Toolbar`, `FileList`, `FileItem`, and `DetailsPanel` are presentational components with typed prop interfaces that receive props and report events.
- `utils/format.ts` contains pure formatting helpers, and `utils/fileIcons.ts` maps a `FileEntry` to a lucide icon.
- `styles/` holds the SCSS structure; `main.scss` is the only stylesheet React imports. See [`styling.md`](styling.md).
- `Toolbar` hosts Back, Up, hidden-files, and theme-family buttons. All four states stay in `App.tsx`.

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

`src/shared/types.ts` is the IPC contract. It defines `FileEntry` (one row in the list), `DirResult` (what `fs:readDir` returns), and `ThemeFamily` (`'default' | 'catppuccin'`, a renderer-only type shared with `Toolbar`). It is imported by:

- `src/main/index.ts`, which builds the objects and annotates the handler return type.
- `src/preload/index.ts`, which types the bridge functions.
- `src/renderer/src/App.tsx` and the components, which consume the data.

Because all three read the same interface, changing a field in the main process makes the renderer fail to compile instead of failing at runtime. Neither tsconfig owns the file exclusively: both project `include` arrays list `src/shared/**/*`.

## IPC channels

| Channel          | Direction       | Input                                       | Returns                      |
| ---------------- | --------------- | ------------------------------------------- | ---------------------------- |
| `fs:getHomeDir`  | Renderer → Main | none                                        | The user's home folder path  |
| `fs:readDir`     | Renderer → Main | Absolute folder path + `showHidden` boolean | `{ path, parent, items }`    |
| `shell:openPath` | Renderer → Main | Absolute file path                          | Nothing, or an error message |

`fs:readDir` rejects with `Invalid folder path` if the argument is not a string or is not absolute, and with `Invalid showHidden flag` if the second argument is not a boolean. Hidden entries (names starting with `.`) are filtered out before `fs.stat` when `showHidden` is false. `shell:openPath` rejects with `Invalid file path` for the same path checks, or with the OS error message if the file cannot be opened (for example, no application is associated with the file).

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

## Walkthrough: double-clicking a folder

1. `FileItem` fires `onDoubleClick` and calls `onOpen(item)`.
2. `App.handleOpen(item)` sees `item.isDirectory === true` and calls `navigateTo(item.path)`.
3. `navigateTo` pushes the current path onto `history` and sets `currentPath` to the new folder.
4. The `useEffect` that depends on `currentPath` and `showHidden` runs. It marks the request as not cancelled, sets `loading`, clears the previous error and selection, and calls `window.fileApi.readDir(currentPath, showHidden)`.
5. The preload calls `ipcRenderer.invoke('fs:readDir', currentPath)`.
6. The main process validates the path and the boolean flag, runs `fs.readdir(..., { withFileTypes: true })`, skips dot-prefixed entries when hidden files are off, calls `fs.stat` for each remaining entry, sorts the results, computes the parent path, and returns `{ path, parent, items }`.
7. Back in React, `setItems(result.items)` and `setParentPath(result.parent)` update the UI, and `loading` becomes `false`.
8. `FileList` re-renders the new items. `DetailsPanel` continues to show its empty state, because selection was already cleared in step 4.

If the user navigates again before the first request finishes, the cleanup function sets `cancelled = true`, so the stale response is ignored. This prevents an older, slower folder from overwriting a newer one.

## Walkthrough: double-clicking a file

1. `FileItem` calls `onOpen(item)`.
2. `App.handleOpen` sees `item.isDirectory === false` and calls `window.fileApi.openPath(item.path)`.
3. The preload invokes `shell:openPath` in the main process.
4. The main process calls `shell.openPath(filePath)`.
5. Electron asks the operating system to open the path "in the desktop's default manner" — the same behaviour as double-clicking the file in Finder/Explorer. The OS picks the application registered for that file type (for example, Word for `.docx`).
6. If the OS returns an error message, the main process throws it and `App` shows the message in the error state.

`shell.openPath` does **not** mean "open Finder". Finder is a file manager, not the default handler for files. To reveal a file in the file manager instead, Electron provides `shell.showItemInFolder`.

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

## State ownership

All state lives in `App.tsx`:

| State         | Purpose                                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| `currentPath` | Folder currently displayed                                                                                |
| `parentPath`  | Parent folder, or `null` at the file-system root                                                          |
| `history`     | Array of previously visited paths for the Back button                                                     |
| `items`       | Entries in the current folder                                                                             |
| `selected`    | The selected item object, or `null`                                                                       |
| `loading`     | Whether a folder request is in flight                                                                     |
| `error`       | Error message to display                                                                                  |
| `showHidden`  | Whether dot-prefixed entries are included; also an effect dependency for reloading                        |
| `themeFamily` | `'default'` or `'catppuccin'`, persisted in `localStorage` and written to `data-theme-family` on `<html>` |

Child components are intentionally stateless. This keeps the data flow one-directional and makes it obvious where a bug lives: if the UI is wrong, check the props `App` passed down.

## Error handling

- **Invalid IPC input** is rejected in the main process, not trusted from the UI.
- **Unreadable entries** are skipped during `readDir` instead of failing the folder.
- **Folder read failures** (for example, permission denied) reject the promise and appear in the error state.
- **File open failures** (no associated app, missing file) are caught in `App` and shown as an error message. Both `.catch` handlers check `err instanceof Error` before reading `err.message`, with an `Unknown error` fallback for non-`Error` rejections.
- **Stale requests** are ignored through the `cancelled` flag in the effect cleanup.
