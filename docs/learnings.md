# Learnings

A running log of what I learned while building the file manager, the bugs I hit, and the questions I still have. I kept this while building, so the mistakes are the useful part.

The examples below show the code as it was written at the time (plain JavaScript). The source is now TypeScript — `.ts` / `.tsx` — so some snippets are intentionally the "before" version. The TypeScript migration has its own section near the end.

## React

### Props are one object, not separate arguments

I originally wrote:

```jsx
export default function Toolbar(currentPath, canGoBack, canGoUp, onBack, onUp) {
```

React calls a component with a **single** `props` object, so `currentPath` was actually the whole props object and everything else was `undefined`. The correct form is destructuring:

```jsx
export default function Toolbar({ currentPath, canGoBack, canGoUp, onBack, onUp }) {
```

This one mistake caused several symptoms at once: the path never rendered, and clicking a button crashed because `onBack` was `undefined`.

### Event handler parameters shadow props

I wrote `onClick={(canGoBack) => ...}`. That parameter is the click **event**, not the `canGoBack` prop — it shadows the prop and is always truthy. The fix is to use the prop directly:

```jsx
<button onClick={onBack} disabled={!canGoBack}>
  ← Back
</button>
```

### Describe the UI; don't mutate the DOM

I tried to disable buttons imperatively:

```js
buttonBack.disabled = true
```

That referenced an undefined global and fought React's rendering. React wants the UI to be a function of state, so the button should simply say `disabled={!canGoBack}`. When the prop changes, React updates the DOM.

### Functions are not valid JSX children

I wrote:

```jsx
{
  ;() => {
    if (currentPath === '') return <p>Loading ...</p>
    else return <p>currentPath</p>
  }
}
```

That defines a function but never calls it, so React renders nothing (and warns). JSX children must be **expressions that produce elements**, not function declarations:

```jsx
{
  currentPath || 'Loading…'
}
```

I also rendered the literal text `currentPath` instead of `{currentPath}` — an easy mistake when moving between JSX and strings.

### Always handle the empty state first

`DetailsPanel` originally did `item.selected`, but `selected` starts as `null` and is reset on every navigation. That threw `TypeError: Cannot read properties of null`. The fix is an early return:

```jsx
if (!item) return <aside className="details-panel">Select a file to see its details.</aside>
```

The same idea applies to `FileList`: an empty folder needs its own message instead of rendering an empty `<ul>`.

### State lives in the parent

`App` owns `currentPath`, `history`, `items`, `selected`, `loading`, and `error`. The child components only receive props and call callbacks. This made debugging much easier: when the UI was wrong, the question was always "what did `App` pass down?"

### A small bug in a helper breaks the UI

`formatDate` returned `new Date(ms).toLocaleString` without the parentheses, so it returned the function itself. React warned that functions are not valid children, and the Modified row was blank. Calling it (`toLocaleString()`) fixed it.

### Keys belong on the list item

`FileList` uses `key={item.path}` because paths are unique and stable. Using the array index would break selection highlighting if the list order changes.

## Electron

### The three processes have different jobs

- **Main** owns the operating system: windows, `fs`, `shell`.
- **Preload** is the only bridge between the page and the main process.
- **Renderer** is just React and must not touch Node.

Once I understood this split, the IPC code stopped feeling like magic.

### `contextBridge` should expose a small API

Instead of exposing `ipcRenderer`, the preload exposes three named functions. The renderer cannot call arbitrary channels, and the main process validates every path it receives. This is the security boundary the whole app depends on.

### Use async file APIs

`fs/promises` keeps the app responsive. The synchronous versions (`readdirSync`, `statSync`) would block the main process and freeze the window while a large folder loads.

### `shell.openPath` uses the OS's default application

Double-clicking a file opened Ghostty instead of what I expected. That is not a bug in the app: `shell.openPath` behaves exactly like double-clicking the file in Finder. macOS LaunchServices chooses the default app for that file's type. A `.docx` opens in Word; a `.sh` or an extensionless executable opened in my terminal because Ghostty was registered for that type.

The important distinction: **Finder is a file manager, not the default handler for files.** If I want to reveal a file in Finder instead, the API is `shell.showItemInFolder`.

### `Dirent.isDirectory()` does not follow symlinks

`fs.readdir(..., { withFileTypes: true })` returns `Dirent` objects. For a symlink, `entry.isDirectory()` is `false` even when the link points to a folder. Since I already call `fs.stat` (which follows links), using `stats.isDirectory()` makes symlinked folders navigable instead of sending them to `openPath`.

### Not every icon location is the packaged icon

`resources/icon.png` is only the runtime icon (Linux window icon, and the dev Dock icon via `app.dock.setIcon`). The icon Finder shows for the packaged app comes from `build/icon.png`, which electron-builder converts into `Contents/Resources/icon.icns`. Changing only `resources/icon.png` therefore does nothing to the built app. A 1024×1024 `build/icon.png` is the single master; the stale `build/icon.icns` and `build/icon.ico` have to be removed so electron-builder regenerates them.

If Finder still shows the old icon after a rebuild, macOS is caching it. `killall Dock` or forcing LaunchServices to re-read the bundle with `lsregister -f` resolves it.

### Packaging is a separate step from building

- `npm run build` only compiles into `out/`.
- `npm run build:unpack` produces an unpacked `.app`.
- `npm run build:mac` produces the DMG.

I also learned that `package.json`'s `name` must be lowercase and URL-safe (`file-manager`), while `productName` in `electron-builder.yml` can be a display name with spaces.

### `extendInfo` must be a map, not a list

The electron-vite template ships:

```yaml
extendInfo:
  - NSCameraUsageDescription: ...
```

That produced numeric keys (`0`, `1`, `2`, …) in the packaged `Info.plist` instead of real privacy keys. Writing it as a map fixed it:

```yaml
extendInfo:
  NSDocumentsFolderUsageDescription: ...
```

I also removed camera/microphone descriptions (irrelevant for a file manager) and added Desktop, removable volumes, and network volumes.

## CSS and layout

### A scrollbar needs a bounded height

`overflow-y: auto` does nothing if the container's height is `auto`. I had to make the height chain explicit:

```css
html,
body,
#root {
  height: 100%;
}
```

Then the app shell could be `height: 100%`, the content area `flex: 1`, and the list `overflow-y: auto`.

### `min-height: 0` is required for scrolling flex children

Flex items default to `min-height: auto`, which prevents them from shrinking below their content. Without `min-height: 0` on the content area, the list grew past the window and the scrollbar never appeared.

### macOS hides overlay scrollbars

Even with `overflow-y: auto`, macOS may hide the scrollbar until you scroll. Styling `::-webkit-scrollbar` makes it permanent, and `scrollbar-gutter: stable` prevents the content from shifting when it appears.

## Tooling

### Most "many errors" were lint noise

After building `FileList` and `FileItem`, VSCode showed a wall of red. Only two errors were real (missing `Toolbar` and `DetailsPanel` files). The rest were:

- `react/prop-types` — not used in a plain-JS project; turned off. It stayed off after the TypeScript migration because prop interfaces replace runtime PropTypes entirely.
- `prettier/prettier` — formatting; fixed with `npm run format`.
- `react-hooks/set-state-in-effect` — a strict new rule that flags the fetch-on-path-change pattern; disabled for that one effect with a comment.

The lesson: read the rule name and the file before assuming the app is broken.

### Format on save removes a whole class of noise

Adding `editor.formatOnSave` plus Prettier and `source.fixAll.eslint` means formatting and auto-fixable lint issues never accumulate.

### `npm i D <pkg>` installs a package called `D`

A typo for `npm i -D <pkg>` added a real dependency named `D` to `package.json`. It never failed, because a package with that name exists on the registry. The lesson is to read the diff of `package.json` after installing anything — a stray production dependency would also have been bundled into the packaged app.

## TypeScript migration

### Renaming files is not the same as typing them

Renaming `.jsx` to `.tsx` compiled cleanly even though every component still had untyped props. The shared toolkit config sets `strict: true` but also `noImplicitAny: false`, so every unannotated prop and handler parameter silently became `any`. I ran the checker once with `--noImplicitAny` forced on, which found exactly the two remaining untyped functions in `App.tsx`. All four components now have explicit prop interfaces, and `noImplicitAny` is enabled in both project configs.

### IPC input is `unknown`, not whatever the renderer sent

Handler parameters are typed `unknown` and narrowed by validation:

```ts
ipcMain.handle('fs:readDir', async (_event, dirPath: unknown): Promise<DirResult> => {
  if (typeof dirPath !== 'string' || !path.isAbsolute(dirPath)) {
    throw new Error('Invalid folder path')
  }
  // dirPath is string from here on
})
```

Typing the parameter as `string` would document an intention, not a guarantee — the value crosses a process boundary and could be anything. `unknown` forces the validation that was already there to be the thing that produces the type. The same applies to promise rejections: annotating a `.catch` parameter as `Error` is a claim, so I use `err: unknown` plus `err instanceof Error` instead.

### `filter(Boolean)` does not narrow types

`items` was `(FileEntry | null)[]`, and the JS version skipped unreadable entries with `.filter(Boolean)`. TypeScript still considered the result `(FileEntry | null)[]`, so the following `.sort()` compared `FileEntry | null` values. The fix is a type predicate:

```ts
.filter((item): item is FileEntry => item !== null)
```

### Arithmetic on booleans is not allowed

The sort used `b.isDirectory - a.isDirectory` to put folders first, relying on JS coercing `true`/`false` to `1`/`0`. TypeScript rejects arithmetic on booleans. I replaced it with an explicit comparison:

```ts
if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
return a.name.localeCompare(b.name)
```

`Number(b.isDirectory) - Number(a.isDirectory) || ...` would also work, but it makes you read coercion to understand the order.

### `getElementById` can return null

`createRoot(document.getElementById('root'))` failed with `TS2345`: `HTMLElement | null` is not a valid `Container`. I added an explicit check that throws a named error, so a future HTML/script mismatch fails with a useful message rather than a null dereference.

### Electron's `app.dock` is optional in the type system

`app.dock.setIcon(icon)` failed with `TS18048` even though the code was already inside `if (process.platform === 'darwin')`. The type system does not narrow a property from a string comparison, so I used `app.dock?.setIcon(icon)`.

### Two tsconfigs need two different type sets

`tsconfig.node.json` uses `types: ["electron-vite/node", "node"]`. The first entry declares Vite's `?asset` imports, which the main process uses for the icon. The second matters more subtly: writing only `["electron-vite/node"]` **replaces** the toolkit base's `["node"]`, which made `process` and `__dirname` unresolved the moment `src/main/index.ts` existed.

### `allowJs` + `composite` needs an `outDir`

Enabling `allowJs` for a gradual migration caused five `TS5055: Cannot write file ... because it would overwrite input file` errors in VS Code. `composite: true` implies emit, and with no `outDir`, TypeScript would emit `src/main/index.js` on top of the `src/main/index.js` that `allowJs` had marked as an input. Giving each project its own `outDir` under `node_modules/.tmp` fixed it. `npm run typecheck` had not shown this because its scripts pass `--noEmit --composite false` — the editor and the CLI were checking different configurations.

### A wrong annotation can hide for a long time

`formatDate(ms: string)` was wrong: `modified` is an `mtimeMs` number. It compiled because `DetailsPanel`'s untyped `item` was `any`. Once props are typed, a wrong annotation stops being harmless. Likewise, annotating a `.catch` parameter as `Error` is a claim, not a check — I switched to `err instanceof Error ? ... : 'Unknown error'` so a non-`Error` rejection cannot silently set an undefined error message.

### Installing the latest TypeScript broke typescript-eslint

`npm i -D typescript` pulled TypeScript 7, but `typescript-eslint@8.73` supports only `<6.1`. The fix was pinning `typescript@~5.9.3`. Using `--legacy-peer-deps` would have hidden a genuine incompatibility.

### Build and typecheck are different commands

electron-vite transpiles TypeScript through esbuild without checking types, so `npm run build` succeeding says nothing about type correctness. `npm run typecheck` is the gate. Same story for `src/renderer/index.html`: after renaming `main.jsx` to `main.tsx`, the HTML script tag still pointed at the old path, which neither TypeScript nor ESLint sees. Only a real build/dev run catches that.

## SCSS and styling

### `@use` is scoped, `@import` is not

With `@import`, every variable and mixin ended up in one global namespace and the same file could be imported twice. `@use` loads a file once and keeps its names local, so each partial that needs `space()` or a mixin says so explicitly:

```scss
@use '../abstracts' as *;
```

`abstracts/_index.scss` forwards the three abstract files, so components have a single import path. `@import` is deprecated, and mixing the two in one project causes confusing duplicate-output errors.

### Colors must be CSS variables; spacing can stay Sass

This was the least obvious part. A Sass variable is replaced by its value at build time, so it cannot change when the user switches appearance. Theme colors therefore live in `:root` as custom properties and are overridden inside `@media (prefers-color-scheme: dark)`. Spacing, radii, and layout sizes never change at runtime, so they stay as Sass variables exposed through `space()`.

The rule I settled on: **if it changes between light and dark, it is a custom property; if it is a fixed design value, it is a Sass variable.**

### A dynamic icon component tripped a React Hooks lint rule

`FileItem` originally did:

```tsx
const Icon = getFileIcon(item)
return <Icon size={18} />
```

`react-hooks/static-components` flags a component variable created during render, because a new component identity each render can remount the subtree. Here the value is actually a stable module-level lucide component, so the warning is conservative — but rather than disable the rule, I render it with `createElement(getFileIcon(item), props)`. Same output, no component variable in the render path.

Two related details: `lucide-react` tree-shakes correctly (unused icons are absent from the production bundle), and `aria-hidden` on the icon keeps screen readers from announcing decorative SVGs.

### BEM keeps the nesting shallow

Nesting with `&` is convenient but easy to overuse. Limiting it to block, element, and modifier (`file-item`, `&__name`, `&--selected`) means every selector stays at most two classes deep, which keeps specificity flat and makes styles easy to grep from the JSX.

## What I would do differently

1. **Write the props contract before the component.** A small table of prop names, types, and purpose would have prevented the Toolbar signature bug.
2. **Build the static version first.** Render fake data, confirm the layout, then wire props and events.
3. **Test the state matrix.** Default, loading, empty, error, and "nothing selected" — most of my crashes were missing one of these.
4. **Change one thing at a time.** The Toolbar had four bugs at once because I wrote the whole component before running it.
5. **Add tests earlier.** Even a few tests for `formatSize`, `formatDate`, and the IPC validation would have caught the missing parentheses and the path checks.
6. **Keep the bug log while building.** Writing these entries after the fact was harder than it needed to be.
7. **Set up the checker before renaming files.** A green `typecheck` with no TypeScript files in the program is meaningless; I should have verified which files the compiler actually included.
8. **Enable `noImplicitAny` from the start.** It turns "I remembered to annotate everything" into a rule the compiler enforces.

## Questions I still have

- How should I virtualize the file list for folders with thousands of entries?
- Should search run in the renderer or in the main process?
- How do macOS TCC permissions behave for Documents, Desktop, and Downloads in an unsigned build?
- Can I enable `sandbox: true` and still keep the preload simple?
- How do Windows and Linux path handling differ from macOS in practice?
- What is the cleanest way to add code signing and notarization to a CI pipeline?
- What is worth testing first: the IPC handlers, the React components, or both?
- Should hidden files be hidden by default, with a toggle, instead of always shown?
- Should `typecheck` and `lint` run in a pre-commit hook or CI?
- Should the shared `FileEntry` type live in `src/shared` or be generated from the IPC schema?
- Would CSS Modules scale better than global BEM once the component count grows?
- Should breadcrumbs be built in the main process (where `path` is available) or derived in React?
