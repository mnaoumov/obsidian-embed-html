# Basic Embed

Use Obsidian's standard embed syntax to embed an HTML file:

```md
![[basic.html]]
```

## Result

<!-- obsidian-dev-utils-disable-next-line demo-vault-validation/no-wikilinks -- The note teaches Obsidian's embed syntax, so the live example is written the way a reader would write it. -->
![[basic.html]]

## Markdown embed syntax

The Markdown spelling embeds the same file, and everything below works with it too:

```md
![](<./html/basic.html>)
```

<!-- markdownlint-disable-next-line MD045 relative-links -- Obsidian embeds a non-image file with this syntax too, which markdownlint can only read as an image with no alt text and a target that is not one. -->
![](<./html/basic.html>)

Obsidian hands the plugin the same embed either way, so pick whichever reads better in your note. The
wikilink form is what the **Insert attachment** command and drag-and-drop produce, which is why the rest
of this vault uses it.

## Follows your theme

Embeds follow Obsidian's color scheme. Switch between light and dark mode (or toggle the base color scheme in Settings → Appearance) and the embedded page's `prefers-color-scheme` styles update to match.
