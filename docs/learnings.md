# Learnings

A running log of what I learned while building the file manager, the bugs I hit, and the questions I still have. I kept this while building, so the mistakes are the useful part.

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

- `react/prop-types` — not used in a plain-JS project; turned off.
- `prettier/prettier` — formatting; fixed with `npm run format`.
- `react-hooks/set-state-in-effect` — a strict new rule that flags the fetch-on-path-change pattern; disabled for that one effect with a comment.

The lesson: read the rule name and the file before assuming the app is broken.

### Format on save removes a whole class of noise

Adding `editor.formatOnSave` plus Prettier and `source.fixAll.eslint` means formatting and auto-fixable lint issues never accumulate.

## What I would do differently

1. **Write the props contract before the component.** A small table of prop names, types, and purpose would have prevented the Toolbar signature bug.
2. **Build the static version first.** Render fake data, confirm the layout, then wire props and events.
3. **Test the state matrix.** Default, loading, empty, error, and "nothing selected" — most of my crashes were missing one of these.
4. **Change one thing at a time.** The Toolbar had four bugs at once because I wrote the whole component before running it.
5. **Add tests earlier.** Even a few tests for `formatSize`, `formatDate`, and the IPC validation would have caught the missing parentheses and the path checks.
6. **Keep the bug log while building.** Writing these entries after the fact was harder than it needed to be.

## Questions I still have

- How should I virtualize the file list for folders with thousands of entries?
- Should search run in the renderer or in the main process?
- How do macOS TCC permissions behave for Documents, Desktop, and Downloads in an unsigned build?
- Can I enable `sandbox: true` and still keep the preload simple?
- How do Windows and Linux path handling differ from macOS in practice?
- What is the cleanest way to add code signing and notarization to a CI pipeline?
- What is worth testing first: the IPC handlers, the React components, or both?
- Should hidden files be hidden by default, with a toggle, instead of always shown?
