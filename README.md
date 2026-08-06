# Embed HTML

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/mnaoumov)
[![GitHub release](https://img.shields.io/github/v/release/mnaoumov/obsidian-embed-html)](https://github.com/mnaoumov/obsidian-embed-html/releases)
[![GitHub downloads](https://img.shields.io/github/downloads/mnaoumov/obsidian-embed-html/total)](https://github.com/mnaoumov/obsidian-embed-html/releases)
[![Coverage: 100%](https://img.shields.io/badge/coverage-100%25-brightgreen)](https://github.com/mnaoumov/obsidian-email-to-vault)

This is a plugin for [Obsidian](https://obsidian.md/) that adds support for embedding HTML files.

![Screenshot](<./images/screenshot.png>)

## Usage

A demo vault with usage examples ships with every release. You can access it via any of the following:

1. Running the **Embed HTML: Open demo vault** command.
2. Downloading `embed-html-demo-vault-<version>.zip` (`<version>` is the release version) from the [Releases](https://github.com/mnaoumov/obsidian-embed-html/releases).
3. Browsing its source in [`demo-vault/`](./demo-vault/README.md) in this repository.

### Supported extensions

You can embed HTML pages from files with following extension:

- `htm`
- `html`
- `shtml`
- `xht`
- `xhtml`

### Embed HTML with default width, height from plugin settings

```markdown
![[file.html]]
```

### Embed HTML with custom width

```markdown
![[file.html|400]]
```

### Embed HTML with custom width and height

```markdown
![[file.html|400x300]]
```

### Embed HTML with custom height only

```markdown
![[file.html|x300]]
```

### Auto-fit the embed to its content

Use the `-` marker (shorthand for the CSS `fit-content` keyword) to size a dimension to the embedded content instead of a fixed value — no inner scrollbar when the content overflows, and no empty gap when it is shorter:

```markdown
![[file.html|-]]        # default width, height fits the content
![[file.html|600x-]]    # width 600px, height fits the content
![[file.html|-x400]]    # width fits the content, height 400px
![[file.html|-x-]]      # both fit the content
```

The embed updates reactively as the content's size changes (e.g. images finishing loading, expandable sections).

### Full sizing control (CSS declarations)

For finer control — including min/max clamps — pass a list of CSS declarations. Any of `width`, `height`, `min-width`, `max-width`, `min-height`, `max-height` are accepted, with any CSS length/percentage or a content keyword (`max-content`, `min-content`, `fit-content`):

```markdown
![[file.html|height: max-content; min-height: 200px; max-height: 800px]]
![[file.html|width: 50%; min-width: 300px]]
```

Unknown properties and invalid values are ignored, falling back to the defaults from the plugin settings.

### Default sizing settings

The plugin settings provide global defaults for all six properties (`Default width`, `Default height`, `Default min/max width`, `Default min/max height`), grouped by axis. `Default width` and `Default height` also accept a content keyword to make auto-fit the default. Any per-embed token overrides these defaults.

### Border and background

The plugin settings provide global appearance defaults applied to every embed box, under `Settings → Embed HTML → Appearance`:

- `Border` — any CSS `border` shorthand (e.g. `1px solid var(--background-modifier-border)`). Empty for none.
- `Border radius` — any CSS `border-radius` value (e.g. `8px`); a bare number is treated as pixels. When set, the embed's corners are rounded and its content is clipped to the rounded box. Empty for square corners.
- `Background` — any CSS `background` value (e.g. `var(--background-primary)`), painted behind the HTML content. Empty for none.

### Open in new tab

Enable `Settings → Embed HTML → Behavior → Open in new tab` to make opening an HTML file put it in a new tab instead of replacing the content of the current one, without holding a modifier key. When enabled, the first HTML file still reuses an empty tab (so you do not get a blank leftover tab); each subsequent HTML file opens in its own tab. The setting is off by default, preserving Obsidian's standard behavior.

### Open in external browser

Every embed carries an `Open in external browser` button, which hands the file to your system's default browser — useful for a document you would rather read with the tabs, zoom, find and print a real browser brings. The embed itself still renders in the note; the button is an addition, not a replacement.

Turn it off under `Settings → Embed HTML → Behavior → Show "Open in external browser" button (Desktop only)`. The setting is on by default.

> [!WARNING]
>
> **Scroll-to-element and extract-element do not apply in the browser.** The button hands over the file and nothing else, so the embed's `#id` subpath is left behind:
>
> ````markdown
> ![[MyDocument.html#section-3]]
> ![[MyDocument.html#section-3&mode=extract]]
> ````
>
> Both still scroll and extract *in the note*, but the browser opens the whole document from the top. Those two modes are work the plugin does on the embedded document itself — a browser only ever receives the plain file.

It is **desktop only**: Obsidian exposes no way to hand a local file to a browser on mobile, so the button is never rendered there and the setting is inert rather than broken.

### Stylesheets, scripts, images and fonts

An embedded document keeps working with the files next to it. Relative paths resolve against the **HTML file's own location**, so a document that opens correctly in a browser renders the same way in a note:

```html
<html>
  <head>
    <link rel="stylesheet" href="styles/main.css" />
    <script src="scripts/app.js"></script>
  </head>
  <body>
    <img src="images/diagram.svg" />
  </body>
</html>
```

Stylesheets get special treatment. Obsidian's Content-Security-Policy reaches into the embed and blocks every *external* stylesheet — a `<link rel="stylesheet">` is fetched and then silently ignored, leaving the document unstyled. The plugin therefore reads each stylesheet and inlines it as a `<style>` element, which the policy does allow. This covers:

- stylesheets in the vault, wherever they sit relative to the HTML file;
- stylesheets on the web (`https://…`), read through Obsidian's own request API so they are not blocked by CORS;
- `@import`ed stylesheets, followed recursively;
- stylesheets a script in the document adds while it runs.

Relative `url()` targets inside a stylesheet — background images, `@font-face` sources — keep resolving against **that stylesheet's** location, not the note's or the HTML file's, so fonts and images referenced from CSS in a subfolder still load. Scripts, images, fonts and media are not restricted by the policy and load on their own.

### Color scheme

The embedded HTML follows Obsidian's base color scheme (`Settings → Appearance → Base color scheme`), independent of your operating system's theme. The active scheme is propagated into the embed, so `prefers-color-scheme` media queries in your HTML resolve to Obsidian's `Dark`/`Light` setting (and to the OS when set to `Adapt to system`). Switching the base color scheme updates already-rendered embeds live.

### Embed HTML and scroll to the element with id

```markdown
![[file.html#foo]]

or

![[file.html#foo&mode=scroll]]
```

### Embed HTML and extract element with id

```markdown
![[file.html#foo&mode=extract]]
```

## Installation

The plugin is available in [the official Community Plugins repository](https://community.obsidian.md/plugins/embed-html).

### Beta versions

To install the latest beta release of this plugin (regardless if it is available in [the official Community Plugins repository](https://community.obsidian.md) or not), follow these steps:

1. Ensure you have the [BRAT plugin](https://community.obsidian.md/plugins/obsidian42-brat) installed and enabled.
2. Click [Install via BRAT](https://intradeus.github.io/http-protocol-redirector?r=obsidian://brat?plugin=https://github.com/mnaoumov/obsidian-embed-html).
3. An Obsidian pop-up window should appear. In the window, click the `Add plugin` button once and wait a few seconds for the plugin to install.

## Debugging

By default, debug messages for this plugin are hidden.

To show them, run the following command in the `DevTools Console`:

```js
window.DEBUG.enable('embed-html');
```

For more details, refer to the [documentation](https://mnaoumov.dev/obsidian-dev-utils/guides/debugging/).

## Support

<!-- markdownlint-disable MD033 -->

<a href="https://www.buymeacoffee.com/mnaoumov" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="60" width="217"></a>

<!-- markdownlint-enable MD033 -->

## My other Obsidian resources

[See my other Obsidian resources](https://github.com/mnaoumov/obsidian-resources).

## License

© [Michael Naumov](https://github.com/mnaoumov/)
