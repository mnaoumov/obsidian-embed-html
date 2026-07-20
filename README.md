# Embed HTML

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/mnaoumov)
[![GitHub release](https://img.shields.io/github/v/release/mnaoumov/obsidian-embed-html)](https://github.com/mnaoumov/obsidian-embed-html/releases)
[![GitHub downloads](https://img.shields.io/github/downloads/mnaoumov/obsidian-embed-html/total)](https://github.com/mnaoumov/obsidian-embed-html/releases)
[![Coverage: 100%](https://img.shields.io/badge/coverage-100%25-brightgreen)](https://github.com/mnaoumov/obsidian-email-to-vault)

This is a plugin for [Obsidian](https://obsidian.md/) that adds support for embedding HTML files.

![Screenshot](<./images/screenshot.png>)

## Usage

A demo vault with usage examples ships with every release. Run the **Embed HTML: Open demo vault** command from the Command Palette to download and open it, or browse its source in [`demo-vault/`](./demo-vault/README.md) in this repository.

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

### Open in new tab

Enable `Settings → Embed HTML → Behavior → Open in new tab` to make opening an HTML file put it in a new tab instead of replacing the content of the current one, without holding a modifier key. When enabled, the first HTML file still reuses an empty tab (so you do not get a blank leftover tab); each subsequent HTML file opens in its own tab. The setting is off by default, preserving Obsidian's standard behavior.

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
