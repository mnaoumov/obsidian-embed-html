/**
 * Measures how far a `position: sticky` / `position: fixed` header overlays an element that has just
 * been scrolled to the top of its scroll container.
 *
 * Scrolling an anchor target flush against the top of the container puts it exactly where a sticky
 * header stays pinned, so the target ends up hidden or half-hidden underneath it. The overlap only
 * exists once the header is in its stuck position, so this is measured after the scroll rather than
 * predicted before it.
 */

/**
 * How far below the target's top edge to probe, in pixels. One pixel inside the target rather than on
 * its exact boundary, where the hit test could resolve to whatever sits immediately above instead.
 */
const PROBE_OFFSET_IN_PIXELS = 1;

/**
 * The divisor that turns a width into a half-width, for probing at the target's horizontal centre.
 */
const HALF = 2;

/**
 * Measures the overlap between the target element and any sticky or fixed element covering its top edge.
 *
 * @param doc - The document the target lives in.
 * @param el - The element that was scrolled to.
 * @returns The number of pixels of the target that are covered, or `0` when nothing covers it.
 */
export function measureStickyOverlap(doc: Document, el: Element): number {
  const win = doc.defaultView;
  if (!win) {
    return 0;
  }

  // The hit test is the only way to ask what is covering the target, and a runtime without it — jsdom,
  // Which the unit tests run in — has no layout to answer with anyway. Reporting no overlap there leaves
  // The plain scroll in place rather than throwing.

  if (typeof doc.elementsFromPoint !== 'function') {
    return 0;
  }

  const targetRect = el.getBoundingClientRect();
  const probeX = clamp(targetRect.left + targetRect.width / HALF, 0, win.innerWidth - PROBE_OFFSET_IN_PIXELS);
  const probeY = Math.max(targetRect.top, 0) + PROBE_OFFSET_IN_PIXELS;

  let overlap = 0;

  // A hit test at one point rather than a scan of every element: the documents this plugin embeds run to
  // Tens of megabytes, so walking them to look for sticky positioning would cost far more than the jump.
  for (const candidateEl of doc.elementsFromPoint(probeX, probeY)) {
    // An ancestor or descendant of the target is part of it, not something covering it.
    if (candidateEl.contains(el) || el.contains(candidateEl)) {
      continue;
    }

    const { position } = win.getComputedStyle(candidateEl);
    if (position !== 'fixed' && position !== 'sticky') {
      continue;
    }

    overlap = Math.max(overlap, candidateEl.getBoundingClientRect().bottom - targetRect.top);
  }

  return Math.max(overlap, 0);
}

/**
 * Clamps a value into an inclusive range.
 *
 * @param value - The value to clamp.
 * @param min - The lower bound.
 * @param max - The upper bound.
 * @returns The clamped value.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
