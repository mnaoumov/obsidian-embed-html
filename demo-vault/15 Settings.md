# Settings

Every setting of the plugin, grouped the way **Settings → Embed HTML** groups them, and named by the key it is stored under in the plugin's `data.json`. Use this page when you already know what you want to change; the notes linked from each entry show the setting in action.

Every setting here is a default: a size or style written on an individual embed always wins over it.

## Width

- `defaultWidth`
  - the width of an embed that does not set one. Accepts any CSS length or a content keyword (`min-content`, `max-content`, `fit-content`). Defaults to `100%`. See [02 Custom Size](<./02 Custom Size.md>).
- `defaultMinWidth`
  - the smallest width an embed may shrink to, unless the embed sets its own. Empty (the default) means no lower bound. See [02 Custom Size](<./02 Custom Size.md>).
- `defaultMaxWidth`
  - the largest width an embed may grow to, unless the embed sets its own. Empty (the default) means no upper bound. See [02 Custom Size](<./02 Custom Size.md>).

## Height

- `defaultHeight`
  - the height of an embed that does not set one. Accepts any CSS length or a content keyword (`min-content`, `max-content`, `fit-content`). Defaults to `400px`. See [02 Custom Size](<./02 Custom Size.md>).
- `defaultMinHeight`
  - the smallest height an embed may shrink to, unless the embed sets its own. Empty (the default) means no lower bound. See [02 Custom Size](<./02 Custom Size.md>).
- `defaultMaxHeight`
  - the largest height an embed may grow to, unless the embed sets its own. Empty (the default) means no upper bound. See [02 Custom Size](<./02 Custom Size.md>).

## Appearance

- `border`
  - a border drawn around every embed, as any CSS `border` shorthand. Empty (the default) means no border. See [09 Appearance](<./09 Appearance.md>).
- `borderRadius`
  - the corner rounding of every embed, as any CSS `border-radius` value; a bare number is treated as pixels. Empty (the default) means square corners. See [09 Appearance](<./09 Appearance.md>).
- `background`
  - a background painted behind every embed's content, as any CSS `background` value. Empty (the default) means none. See [09 Appearance](<./09 Appearance.md>).

## Behavior

- `shouldOpenInNewTab`
  - when on, opening an HTML file puts it in a new tab instead of replacing the current one. Off by default. See [08 Direct View](<./08 Direct View.md>).
- `shouldShowOpenInExternalBrowserButton`
  - when on, every embed shows a button that opens the page in your system's default browser. Desktop only. On by default. See [11 Open in External Browser](<./11 Open in External Browser.md>).
