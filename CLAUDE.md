# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Embed HTML is an Obsidian plugin that adds support for embedding HTML files (`htm`, `html`, `shtml`, `xht`, `xhtml`) in notes and opening them in a dedicated file view. It is built on `obsidian-dev-utils`.

## Commands

| Task              | Command                    |
|-------------------|----------------------------|
| TypeScript check  | `npm run build:compile`    |
| Build             | `npm run build`            |
| Dev (watch)       | `npm run dev`              |
| Lint              | `npm run lint`             |
| Lint (fix)        | `npm run lint:fix`         |
| Format            | `npm run format`           |
| Format (check)    | `npm run format:check`     |
| Spellcheck        | `npm run spellcheck`       |
| Markdown lint     | `npm run lint:md`          |
| Markdown lint fix | `npm run lint:md:fix`      |
| Unit tests        | `npm test`                 |
| Coverage          | `npm run test:coverage`    |
| Integration tests | `npm run test:integration` |
| Commit (wizard)   | `npm run commit`           |

## Architecture

- **Root config files** are thin re-exports — actual logic lives in `scripts/` (`eslint.config.mts` → `scripts/eslint-config.ts`, etc.).
- **`src/`** — plugin source:
  - `main.ts` — Obsidian entry point (default export of `Plugin`)
  - `plugin.ts` — `Plugin` extends `PluginBase`; in `onloadImpl` wires up the settings component, settings tab, the embed registry component, and the file view component
  - `html-extensions.ts` — `HtmlExtensions.list()` returns the supported HTML file extensions
  - `html-embed-component.ts` — `HtmlEmbedComponent` (implements `EmbedComponent`); renders an HTML file into a sandboxed `<iframe>` via `srcdoc` (injected `<base>` + `enhance.js`), and supports `#id` subpath `scroll`/`extract` modes. `srcdoc` (rather than an object-URL `src`) is deliberate: reading-view virtualization detaches and re-attaches each embed's DOM on scroll, and re-attaching an iframe reloads it from its source — a revoked single-use object URL would reload to a blank chrome-error page (covered by `scroll-rerender.desktop.integration.test.ts`). Sizing: `resolveSize()` merges the parsed `alt` token (see `size-spec.ts`), the `width`/`height` attributes, and the settings defaults into six CSS box properties applied via `setCssProps`; content-keyword axes (`min-content`/`max-content`/`fit-content`) are measured live by a `ResizeObserver` (`measure()` — collapses the iframe to `0px` inside a temporarily-expanded container to read true content size; for content-width it injects a `body { width: <keyword> }` style). Color scheme: `applyColorScheme()` sets the iframe element's CSS `color-scheme` to `dark`/`light` from `app.isDarkMode()` (Chromium propagates the embedding element's `color-scheme` into the framed document, so its `prefers-color-scheme` follows Obsidian's base scheme rather than the OS); applied on load and re-applied on the workspace `css-change` event (registered in `onload()`), so live theme switches reach already-rendered embeds. Verified by `color-scheme-shared.integration.test.ts` (desktop + android)
  - `size-spec.ts` — `parseSizeSpec(token)` (pure, deterministic) turns the container's `alt` token into a `SizeSpec`. Obsidian only routes pure-digit `N`/`NxM` tokens into `width`/`height` attributes; every other token lands verbatim in `alt`. Accepts a full CSS-declaration form (`width: …; min-height: …`) and short forms (`WxH`, `W`, `xH`, `-` → `fit-content`). Value validation is deferred to apply-time (browser CSSOM), keeping the parser jsdom/Chromium-agnostic
  - `html-embed-registry-component.ts` — `HtmlEmbedRegistryComponent`; registers/unregisters the HTML extensions with `app.embedRegistry` so `![[file.html]]` embeds work
  - `html-file-view.ts` — `HtmlFileView` extends `FileView`; opens an HTML file in its own leaf, hosting an `HtmlEmbedComponent` and forwarding ephemeral subpath state
  - `html-file-view-component.ts` — `HtmlFileViewComponent`; registers the file extensions and the `HtmlFileView` view type via injected `ExtensionsRegistrar`/`ViewRegistrar`
  - `plugin-settings.ts` — `PluginSettings` data class; six CSS defaults: `defaultWidth`, `defaultHeight`, `defaultMinWidth`, `defaultMaxWidth`, `defaultMinHeight`, `defaultMaxHeight` (min/max default to `''` = unset)
  - `plugin-settings-component.ts` — `PluginSettingsComponent` extends `PluginSettingsComponentBase<PluginSettings>`
  - `plugin-settings-tab.ts` — `PluginSettingsTab` extends `PluginSettingsTabBase<PluginSettings>`; renders the six sizing settings in two `SettingGroupEx` groups (Width / Height). CSS keywords in descriptions use `appendCodeBlock` (dev-utils) so the `obsidianmd/ui/sentence-case` rule does not flag them
- **`main` field** points to `src/main.ts` (Obsidian plugin source entry; built artifact is `dist/build/main.js`, not published to npm).

## Known Issues

None.
