# External stylesheets and assets

An embedded document keeps working with the files next to it — stylesheets, scripts, images and fonts —
with paths resolved against the **HTML file's own location**.

The embed below is `html/external-assets.html`. Everything it looks like comes from other files:

- `html/assets/theme.css`, linked with `<link rel="stylesheet" href="assets/theme.css">`
- `html/assets/typography.css`, pulled in by `@import` from inside `theme.css`
- `html/assets/badge.svg`, referenced by a `url()` inside `theme.css`
- `html/assets/counter.js`, loaded with `<script src="assets/counter.js">`

```md
![[external-assets.html]]
```

![[external-assets.html]]

Click the button — the script is running too.

## Why stylesheets are special

Obsidian's Content-Security-Policy reaches into the embed, and it blocks external stylesheets: a
`<link rel="stylesheet">` is fetched successfully and then silently ignored, leaving the document unstyled.
Inline `<style>` text is allowed, so the plugin reads each stylesheet and inlines it — including stylesheets
on the web, `@import`ed ones, and any a script adds while the page runs.

Relative `url()` targets keep resolving against **their own stylesheet's** folder, which is why the badge
above still loads: `theme.css` asks for `badge.svg`, and that means `html/assets/badge.svg`, not
`html/badge.svg`.

Scripts, images, fonts and media are not restricted by the policy, so they load on their own.
