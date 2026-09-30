# Remote HTML pages

An HTML page does not have to live in your vault. A page served from the web, or from a machine on your own network, embeds the same way: point the embed at its address.

The embed below is `https://mnaoumov.dev/index.html`, loaded live:

```md
![Home page](https://mnaoumov.dev/index.html)
```

![Home page](https://mnaoumov.dev/index.html)

Without the plugin, Obsidian treats that line as an image and shows a broken one.

## Both embed syntaxes work

Obsidian's own syntax for external content is `![caption](…)`, and it is the one to prefer. The caption is optional, and it is only a caption: it never changes the size. The wikilink form works too, although without the plugin Obsidian shows it as a note that "could not be found":

```md
![[https://mnaoumov.dev/index.html]]
```

The address has to start with `http://` or `https://` and name a file with one of the [supported extensions](<./07 File Extensions.md>) — `htm`, `html`, `shtml`, `xht` or `xhtml`. A server on your local network works as well as one on the internet:

```md
![Latest report](http://192.168.1.10/reports/latest.html)
```

## Size, appearance and the external-browser button

A remote page takes the same sizes as a vault file, written after a `|` — `![Home page|600x300](https://mnaoumov.dev/index.html)`, `![Home page|50%x300](https://mnaoumov.dev/index.html)`, `![[https://mnaoumov.dev/index.html|50%x300]]`, or the CSS form — and the defaults, border, background and color scheme from the settings. See [02 Custom Size](<./02 Custom Size.md>) and [09 Appearance](<./09 Appearance.md>).

The [Open in external browser](<./11 Open in External Browser.md>) button opens the page's own address in your browser.

## What is different from a vault file

A remote page is shown the way a browser shows one site inside another: as a separate, **isolated** page. That is deliberate. A vault file is rendered as part of Obsidian itself, which is fine for a file you put in your vault; a page from the web must not be able to reach into Obsidian just because a note names it.

The page keeps its own stylesheets, scripts, images and links working with no help, so nothing needs inlining. [Scroll to element](<./03 Scroll to Element.md>) works too, natively: `![Report](https://example.com/page.html#section-2)` opens the page at that element.

The isolation costs two things, because nothing inside the page can be read:

- **Auto-fit sizes** (`fit-content`, `min-content`, `max-content`) cannot measure the page, so that side falls back to the default size.
- **[Extract element](<./04 Extract Element.md>)** (`#id&mode=extract`) cannot hide the rest of the page, so the page is shown whole, scrolled to the element.

> [!NOTE]
>
> A site can forbid being shown inside another page. The embed then shows the browser's refusal instead of the page; its **Open in external browser** button still works.
