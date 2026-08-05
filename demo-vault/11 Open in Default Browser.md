# Open in default browser

Sometimes a document is better read in a real browser than inside a note — a large reference document with
many internal anchors, say, where you want tabs, zoom, find, print and your own extensions.

Turn on **Settings → Embed HTML → Behavior → Open in default browser** and every embed stops rendering in
the note. Each one becomes a link instead, and clicking it opens the file in your default browser.

**The embed syntax does not change.** The same `![[document.html#anchor]]` you already wrote keeps working —
this is a second output mode, not a new syntax. The fragment travels with it, so the browser lands on the
same anchor the embed would have scrolled to.

The embed below is an ordinary one. Flip the setting with the buttons and watch it change between the
in-note iframe and the link.

![[sections.html#gamma]]

## Try it

```code-button
---
caption: Open in default browser → on
---
await require('/demoSetup.ts').editSettings(app, (settings) => {
  settings.shouldOpenInSystemBrowser = true;
});
```

```code-button
---
caption: Open in default browser → off (render in the note)
---
await require('/demoSetup.ts').editSettings(app, (settings) => {
  settings.shouldOpenInSystemBrowser = false;
});
```

## What the link shows

The link is labelled with the file name, plus the fragment when the embed names one — so a note that embeds
the same document at several anchors still tells you which part each one points at.

## Desktop only

Opening a file in a browser needs the file's location on disk, and only the desktop app has one. On mobile
the setting has no effect: embeds keep rendering in the note, rather than showing a link that could not
open.
