# Relative and Full Path

You can embed an HTML file that lives in **another folder** than the note — not just a file in the same folder. Reference it by its **full vault path** or by a **relative path**.

## Full vault path

Give the complete path from the vault root. A wikilink works from any note, regardless of which folder the note is in:

```md
![[html/basic.html]]
```

### Result

![[html/basic.html]]

## Relative path

From a note in a subfolder, a Markdown embed can point at the file **relative to the note** using `./` and `../`:

```md
![](../html/basic.html)
```

Relative paths only differ from the full path when the note is not at the vault root, so the live example lives in a note inside a subfolder: [[From Another Folder]].

## Both forms resolve to the same file

Obsidian resolves the link to the target file before the embed renders, so both the relative and the full-path forms show the same HTML page. If the path does not resolve to a file in the vault, Obsidian shows its `'file' could not be found.` placeholder instead.
