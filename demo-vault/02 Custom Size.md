# Custom Size

## Width only

Set width in pixels after `|`:

```md
![[basic.html|400]]
```

![[basic.html|400]]

## Width x Height

Set both dimensions with `WIDTHxHEIGHT`:

```md
![[basic.html|600x200]]
```

![[basic.html|600x200]]

## Height only

Leave the width empty to set only the height (keeps the default width):

```md
![[basic.html|x200]]
```

![[basic.html|x200]]

## Auto-fit to content

Use `-` (shorthand for the CSS `fit-content` keyword) to size a dimension to the embedded content instead of a fixed value — no inner scrollbar, no empty gap.

Fit the height, keep the default width:

```md
![[auto-fit.html|-]]
```

![[auto-fit.html|-]]

Fixed width, auto height:

```md
![[auto-fit.html|500x-]]
```

![[auto-fit.html|500x-]]

## Full control with CSS

For finer control, pass CSS declarations. Any of `width`, `height`, `min-width`, `max-width`, `min-height`, `max-height` are accepted, using any CSS length or a content keyword (`max-content`, `min-content`, `fit-content`).

Auto height, clamped so runaway content still scrolls past 300px:

```md
![[auto-fit.html|height: max-content; max-height: 300px]]
```

![[auto-fit.html|height: max-content; max-height: 300px]]

Half width with a minimum:

```md
![[basic.html|width: 50%; min-width: 300px]]
```

![[basic.html|width: 50%; min-width: 300px]]

## Default size settings

When an embed has no size parameter, the plugin falls back to the default width (`100%`) and height (`400px`), plus optional default min/max bounds — all configurable in the plugin settings.

The embed below has no size parameter, so it always renders at the current defaults:

![[basic.html]]

The buttons below change those defaults and re-render this note so the embed above updates live. (Embeds read the defaults when they render, so the button re-renders the preview for you.)

```code-button
---
caption: Default width → 50%
---
await require('/demoSetup.ts').editSettings(app, (settings) => {
  settings.defaultWidth = '50%';
});
```

```code-button
---
caption: Default height → 600px
---
await require('/demoSetup.ts').editSettings(app, (settings) => {
  settings.defaultHeight = '600px';
});
```

```code-button
---
caption: Clamp default width (min 300px, max 800px)
---
await require('/demoSetup.ts').editSettings(app, (settings) => {
  settings.defaultMinWidth = '300px';
  settings.defaultMaxWidth = '800px';
});
```

```code-button
---
caption: Clamp default height (min 200px, max 500px)
---
await require('/demoSetup.ts').editSettings(app, (settings) => {
  settings.defaultMinHeight = '200px';
  settings.defaultMaxHeight = '500px';
});
```

```code-button
---
caption: Reset all settings to defaults
---
await require('/demoSetup.ts').resetSettings(app);
```

The default width and height also accept a content keyword (`max-content`, `min-content`, `fit-content`), so you can make auto-fit the default for every embed.
