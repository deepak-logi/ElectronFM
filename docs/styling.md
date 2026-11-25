# Styling

## Approach

Global SCSS partials with BEM class names. There are no CSS Modules and no utility framework: the app is small, one stylesheet is imported once, and BEM keeps the component boundaries readable in the JSX.

React imports exactly one file:

```ts
// src/renderer/src/main.tsx
import './styles/main.scss'
```

`main.scss` is the only place that knows the load order.

## Folder structure

```text
styles/
├── abstracts/
│   ├── _index.scss        # @forward the three files below
│   ├── _variables.scss    # spacing map, radii, sizes, font stacks
│   ├── _functions.scss    # space()
│   └── _mixins.scss       # truncate, focus-ring, flex-center
├── base/
│   ├── _reset.scss
│   ├── _theme.scss        # default + Catppuccin token families
│   └── _typography.scss
├── layout/
│   └── _app.scss          # app shell grid
├── components/
│   ├── _toolbar.scss
│   ├── _breadcrumbs.scss
│   ├── _file-list.scss
│   ├── _file-item.scss
│   ├── _details-panel.scss
│   └── _states.scss
└── main.scss
```

Partial files start with `_` so Sass never emits them on their own. `abstracts/_index.scss` means a component can write one line:

```scss
@use '../abstracts' as *;
```

## Tokens

**Colors are CSS custom properties.** They have to survive the Sass build because dark mode flips them at runtime through a media query. Sass variables would be compiled away.

```scss
:root {
  --color-bg: #ffffff;
  --color-text: #1f2328;
  --color-accent: #2563eb;
  /* ... */
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #16181d;
    --color-text: #e6e8eb;
    --color-accent: #4f8cff;
  }
}
```

### Theme families

There are two palettes, selected by a toolbar toggle. The chosen family lives in the `settings` Redux slice; a small effect reads it from the store, stores it in `localStorage` under `fm-theme-family` and applies it as an attribute on `<html>`:

```ts
document.documentElement.dataset.themeFamily = themeFamily
```

That writes `data-theme-family="default"` or `data-theme-family="catppuccin"`. The stylesheet has four token blocks:

```scss
:root {
  /* default light */
}
@media (prefers-color-scheme: dark) {
  :root {
    /* default dark */
  }
}

:root[data-theme-family='catppuccin'] {
  /* Latte */
}
@media (prefers-color-scheme: dark) {
  :root[data-theme-family='catppuccin'] {
    /* Mocha */
  }
}
```

The attribute selector is more specific than `:root`, so it wins in both appearances. The toggle never forces light or dark — the OS media query still decides whether a family renders its light or dark tokens. Catppuccin values come from the official v1.8.0 palette; `--color-danger-bg` is derived with `color-mix()` instead of an off-palette hex.

### System accent

In the **default** family only, the macOS accent colour drives the app-drawn selection and focus colours. The renderer writes a CSS custom property and a matching attribute on `<html>`:

```ts
root.style.setProperty('--accent-source', systemAccent)
root.dataset.accentSource = 'true'
```

The attribute matters: a CSS custom property is not an attribute, so `:root[data-accent-source]` will not match unless the attribute is also set. The stylesheet then maps the source onto two tokens:

```scss
:root[data-accent-source]:not([data-theme-family='catppuccin']) {
  --color-accent: color-mix(in srgb, var(--accent-source) 88%, var(--color-text));
  --color-selected: color-mix(in srgb, var(--accent-source) 18%, var(--color-bg));
}
```

- `--color-accent` is nudged toward the theme's text colour so focus rings stay visible even if macOS reports a very pale or very dark accent.
- `--color-selected` is a subtle tint mixed with the current background, so it adapts to light and dark without separate values.
- `:not([data-theme-family='catppuccin'])` keeps Latte/Mocha on their own blues.
- `::selection` is deliberately not styled — Chromium already follows the macOS accent for text selection.

The main process re-reads the accent 100 ms after macOS posts a change notification (the value can still be stale at the moment the notification arrives) and only pushes it when it actually changed.

**Spacing is a Sass map**, exposed through a function:

```scss
$space-scale: (
  1: 4px,
  2: 8px,
  3: 12px,
  4: 16px,
  6: 24px,
  8: 32px
);

@function space($key) {
  @if not map.has-key($space-scale, $key) {
    @error "Unknown spacing key: #{$key}";
  }
  @return map.get($space-scale, $key);
}
```

`space(9)` fails the build instead of silently producing an invalid value. Layout sizes that are not spacing — `$toolbar-height`, `$details-width` — stay as plain variables because they never change per theme.

Rule of thumb: **if it changes between light and dark, it is a CSS custom property; if it is a fixed design value, it is a Sass variable.**

## Layout

The shell is two nested grids:

```scss
.app {
  display: grid;
  grid-template-rows: $toolbar-height 1fr;
  height: 100vh;
}

.content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) $details-width;
  min-height: 0;
}
```

`minmax(0, 1fr)` rather than `1fr` matters: without it, a long file name can push the list column wider than the window. `min-height: 0` lets the file list scroll instead of stretching the grid. The details panel is the second column, so it sits on the right without absolute positioning.

## Conventions

| Avoid                                                    | Use instead                                   |
| -------------------------------------------------------- | --------------------------------------------- |
| `@import`                                                | `@use` / `@forward`                           |
| Global Sass functions such as `map-get()` or `darken()`  | `sass:map` / `sass:color`, or separate tokens |
| Nesting deeper than three levels                         | BEM (`&__name`, `&--selected`)                |
| `!important`                                             | Fix the selector specificity                  |
| Hard-coded colors or arbitrary pixels in component files | `var(--color-*)` and `space()`                |
| `outline: none`                                          | `@include focus-ring` on `:focus-visible`     |
| Inline `style={{ ... }}` for static styling              | A class                                       |

BEM here is deliberately shallow: block (`file-item`), element (`file-item__name`), modifier (`file-item--selected`). No utility classes. The breadcrumb bar follows the same pattern: `breadcrumbs`, `breadcrumbs__segment`, `breadcrumbs__separator`, `breadcrumbs__link`, `breadcrumbs__link--current`. Its `flex: 1` / `min-width: 0` / `overflow-x: auto` combination keeps long paths scrollable instead of widening the toolbar.

## Adding a component

1. Create `components/_<name>.scss`.
2. Start it with `@use '../abstracts' as *;`.
3. Use `space()` and theme tokens; do not introduce raw colors.
4. Add `@use 'components/<name>';` to `main.scss` in the right order.
5. Use the matching `component`, `component__element` names in the TSX.

## Accessibility

- Every interactive row is keyboard reachable (`tabIndex={0}`) and opens on `Enter`.
- `aria-selected` is paired with `role="listbox"` on the list and `role="option"` on the row, which is required for `aria-selected` to be valid.
- Icon-only toolbar buttons carry `aria-label`; decorative icons use `aria-hidden`.
- The hidden-files and theme toggles also use `aria-pressed`, so assistive tech can report their on/off state.
- Focus is always visible through `:focus-visible`, so `outline` is never removed without a replacement.

## Notes

- Web fonts are not used: the CSP blocks external requests, and the system stack renders instantly.
- Light vs dark is always automatic (`prefers-color-scheme`). The manual toggle switches palette _family_, not brightness.
