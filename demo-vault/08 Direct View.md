# Direct View

Besides embedding, you can open HTML files directly in Obsidian as a view.

Click any HTML file in the file explorer to open it in a dedicated HTML viewer tab — the same rendering engine used for embeds.

Try opening these files directly:

- `html/basic.html`
- `html/javascript.html`
- `html/sections.html`

## Open in a new tab

By default, opening an HTML file replaces the current tab. The **Open in new tab** setting makes it open in a new tab instead. Toggle it with the buttons below, then open an HTML file from the file explorer to see the difference.

```code-button
---
caption: Open HTML files in a new tab
---
await require('/demoSetup.ts').editSettings(app, (settings) => {
  settings.shouldOpenInNewTab = true;
});
```

```code-button
---
caption: Open HTML files in the current tab
---
await require('/demoSetup.ts').editSettings(app, (settings) => {
  settings.shouldOpenInNewTab = false;
});
```
