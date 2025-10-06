# Embed HTML

This is a plugin for [Obsidian](https://obsidian.md/) that adds support for embedding HTML files.

## Usage

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

The plugin is not available in [the official Community Plugins repository](https://obsidian.md/plugins) yet.

### Beta versions

To install the latest beta release of this plugin (regardless if it is available in [the official Community Plugins repository](https://obsidian.md/plugins) or not), follow these steps:

1. Ensure you have the [BRAT plugin](https://obsidian.md/plugins?id=obsidian42-brat) installed and enabled.
2. Click [Install via BRAT](https://intradeus.github.io/http-protocol-redirector?r=obsidian://brat?plugin=https://github.com/mnaoumov/obsidian-embed-html).
3. An Obsidian pop-up window should appear. In the window, click the `Add plugin` button once and wait a few seconds for the plugin to install.

## Debugging

By default, debug messages for this plugin are hidden.

To show them, run the following command in the `DevTools Console`:

```js
window.DEBUG.enable('embed-html');
```

For more details, refer to the [documentation](https://github.com/mnaoumov/obsidian-dev-utils/blob/main/docs/debugging.md).

## Support

<!-- markdownlint-disable MD033 -->
<a href="https://www.buymeacoffee.com/mnaoumov" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="60" width="217"></a>
<!-- markdownlint-enable MD033 -->

## License

© [Michael Naumov](https://github.com/mnaoumov/)
