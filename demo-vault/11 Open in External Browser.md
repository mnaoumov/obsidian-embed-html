# Open in external browser

Sometimes a document is better read in a real browser than inside a note — a large reference document with
many internal anchors, say, where you want tabs, zoom, find, print and your own extensions.

Every embed therefore carries an **Open in external browser** button. Clicking it hands the file to your
system's default browser. The embed itself keeps rendering in the note, so the button is an addition rather
than a second output mode:

![[sections.html#gamma]]

**The embed syntax does not change.** The same `![[document.html#anchor]]` you already wrote keeps working.

## Try it

The button is shown by default. These buttons flip the setting and re-render this note, so the embed above
gains and loses its button live.

```code-button
---
caption: Open in external browser button → off
---
await require('/demoSetup.ts').editSettings(app, (settings) => {
  settings.shouldShowOpenInExternalBrowserButton = false;
});
```

```code-button
---
caption: Open in external browser button → on
---
await require('/demoSetup.ts').editSettings(app, (settings) => {
  settings.shouldShowOpenInExternalBrowserButton = true;
});
```

```code-button
---
caption: Reset all settings to defaults
---
await require('/demoSetup.ts').resetSettings(app);
```

## Scroll and extract stay in the note

> [!WARNING]
>
> The button hands over the file and nothing else, so the embed's `#id` subpath is left behind.
> **Scroll to element** and **extract element** therefore have no effect in the browser.

The embed below scrolls to Section Beta in the note, and the one after it shows Section Delta alone — but
the **Open in external browser** button on either one opens the whole document from the top:

```md
![[sections.html#beta]]
```

![[sections.html#beta]]

```md
![[sections.html#delta&mode=extract]]
```

![[sections.html#delta&mode=extract]]

[[03 Scroll to Element]] and [[04 Extract Element]] are work this plugin does on the embedded document
itself. A browser only ever receives the plain file, so neither mode can travel with it.

## Desktop only

Obsidian exposes no way to hand a local file to a browser on mobile, so the button is never rendered
there — the setting is inert rather than showing an affordance that could not work.
