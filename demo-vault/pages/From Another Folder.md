# From Another Folder

This note lives in the `pages/` folder, while `basic.html` lives in the `html/` folder — a **different** folder than this note. You can still embed it.

## Full vault path

The complete path from the vault root works from any note, in any folder:

```md
![[html/basic.html]]
```

<!-- obsidian-dev-utils-disable-next-line demo-vault-validation/no-wikilinks -- The note teaches Obsidian's embed syntax, so the live example is written the way a reader would write it. -->
![[html/basic.html]]

## Relative path

A Markdown embed can point at the file **relative to this note**. From `pages/`, `../html/basic.html` steps up one folder and into `html/`:

```md
![](../html/basic.html)
```

Both forms resolve to the same file, so the embed above renders even though the HTML file is in another folder than this note.
