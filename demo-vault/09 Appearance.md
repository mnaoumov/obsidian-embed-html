# Appearance

Give every embed a **border**, **rounded corners**, or a **background** with three global settings under **Settings → Embed HTML → Appearance**. They apply to every embed on the page; leave any of them empty for no change (the default).

The embed below has no per-embed styling, so it always renders with the current Appearance settings:

<!-- obsidian-dev-utils-disable-next-line demo-vault-validation/no-wikilinks -- The note teaches Obsidian's embed syntax, so the live example is written the way a reader would write it. -->
![[basic.html]]

The buttons below change those settings and re-render this note so the embed above updates live. (Embeds read the settings when they render, so the button re-renders the preview for you.)

## Border

Draw a border around the embed box. Accepts any CSS `border` shorthand.

```code-button
---
caption: Border → 2px solid accent
---
await require('/demoSetup.ts').editSettings(app, (settings) => {
  settings.border = '2px solid var(--interactive-accent)';
});
```

## Rounded corners

Round the embed's corners. Accepts any CSS `border-radius` value; a bare number is treated as pixels. A non-empty radius also clips the embedded page to the rounded box (`overflow: hidden`), so the iframe's square corners never poke out.

```code-button
---
caption: Border radius → 12px
---
await require('/demoSetup.ts').editSettings(app, (settings) => {
  settings.borderRadius = '12px';
});
```

## Background

Paint a background behind the embedded HTML. Accepts any CSS `background` value, including Obsidian theme variables.

```code-button
---
caption: Background → secondary
---
await require('/demoSetup.ts').editSettings(app, (settings) => {
  settings.background = 'var(--background-secondary)';
});
```

## All together

Combine all three for a card-like embed:

```code-button
---
caption: Border + radius + background
---
await require('/demoSetup.ts').editSettings(app, (settings) => {
  settings.border = '2px solid var(--interactive-accent)';
  settings.borderRadius = '12px';
  settings.background = 'var(--background-secondary)';
});
```

```code-button
---
caption: Reset all settings to defaults
---
await require('/demoSetup.ts').resetSettings(app);
```
