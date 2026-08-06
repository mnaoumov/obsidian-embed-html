# Sticky table headers

Jumping to an anchor scrolls the target to the very top of the embed — which is exactly where a
`position: sticky` header stays pinned. Without care the row you asked for ends up underneath the header,
hidden or half-hidden.

The embed below targets row 42 of a fifty-row table whose header row is sticky. The row lands **below** the
header, fully visible, and the header stays pinned as you scroll on.

```md
![[sticky-table.html#row-42]]
```

![[sticky-table.html#row-42]]

## How it works

The plugin scrolls to the target first, then measures what is covering it, then backs off by exactly that
much. The measurement has to happen after the scroll: a sticky header is only in its pinned position once
the container has scrolled, so its height cannot be predicted beforehand.

Nothing about the embed syntax changes — `![[document.html#anchor]]` is all you write. Documents with no
sticky header are unaffected, because there is nothing covering the target to measure.

## Compare

The same table without an anchor starts at the top, where the header covers nothing.

![[sticky-table.html]]
