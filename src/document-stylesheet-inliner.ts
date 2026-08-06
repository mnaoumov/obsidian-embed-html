/**
 * Replaces an embedded document's external stylesheets with inline `<style>` elements.
 *
 * The embed renders into a `srcdoc` iframe, which inherits Obsidian's page CSP
 * (`style-src 'unsafe-inline' 'self' …`) and Obsidian's origin — so a `<link rel="stylesheet">` pointing at
 * the vault's resource host (`app://<per-session-hash>`, not `'self'`) or at any CDN is fetched and then
 * dropped, silently rendering the document unstyled. Inline `<style>` text is permitted, so every stylesheet
 * is read up front and inlined in place. See {@link inlineCssAsync} for what has to be repaired in the CSS
 * text once it leaves its own file.
 *
 * Stylesheets are the ONLY category that needs this: the policy sets no `default-src`, so scripts, images,
 * fonts, media and `fetch` in the embedded document load from any origin on their own.
 */

import type { ReadTextAsyncFunction } from './css-inliner.ts';

import { inlineCssAsync } from './css-inliner.ts';

export interface InlineDocumentStylesheetsAsyncParams {
  /**
   * The URL relative `href`s in the document resolve against — the embedded file's own resource URL.
   */
  readonly baseUrl: string;

  /**
   * The document to rewrite. Either the parsed copy that becomes the iframe's `srcdoc`, or the iframe's live
   * document once scripts in it have added stylesheets of their own.
   */
  readonly doc: Document;

  /**
   * Reads a stylesheet's text. Runs OUTSIDE the embedded document, so it can reach the vault and, via
   * Obsidian's request API, cross-origin URLs the document itself could not fetch.
   */
  readonly readTextAsync: ReadTextAsyncFunction;
}

const STYLE_TAG_NAME = 'style';
const MEDIA_ATTRIBUTE = 'media';
const HREF_ATTRIBUTE = 'href';
const STYLESHEET_REL = 'stylesheet';
const IMPORT_AT_RULE = '@import';

/**
 * Records where an inlined `<style>` came from (as `data-embed-html-inlined-from`), so the origin of the
 * rules stays visible when inspecting the embedded document.
 */
const INLINED_FROM_DATASET_KEY = 'embedHtmlInlinedFrom';

/**
 * Inlines every external stylesheet of a document, and every `@import` reachable from it.
 *
 * Idempotent: an already-inlined `<style>` is not a `<link>` any more, so re-running only picks up
 * stylesheets that appeared since. Unreadable stylesheets are left as they are rather than dropped.
 *
 * @param params - The document, its base URL, and the stylesheet reader.
 */
export async function inlineDocumentStylesheetsAsync(params: InlineDocumentStylesheetsAsyncParams): Promise<void> {
  for (const linkEl of params.doc.querySelectorAll('link')) {
    await inlineLinkAsync(linkEl, params);
  }

  // A `<style>` may pull in more CSS with `@import`, which is a stylesheet fetch like any other and so is
  // Blocked just the same.
  for (const styleEl of params.doc.querySelectorAll(STYLE_TAG_NAME)) {
    await inlineStyleImportsAsync(styleEl, params);
  }
}

function checkIsStylesheetLink(linkEl: HTMLLinkElement): boolean {
  // `rel` is case-insensitive and may carry several tokens (`alternate stylesheet`).
  return (linkEl.getAttribute('rel') ?? '').toLowerCase().split(/\s+/).includes(STYLESHEET_REL);
}

async function inlineLinkAsync(linkEl: HTMLLinkElement, params: InlineDocumentStylesheetsAsyncParams): Promise<void> {
  if (!checkIsStylesheetLink(linkEl)) {
    return;
  }

  const href = linkEl.getAttribute(HREF_ATTRIBUTE) ?? '';
  const url = resolveUrl(href, params.baseUrl);
  if (url === null) {
    return;
  }

  const css = await params.readTextAsync(url);
  if (css === null) {
    return;
  }

  const inlinedCss = await inlineCssAsync({
    css,
    cssUrl: url,
    readTextAsync: params.readTextAsync
  });

  // Created in `head` and then MOVED into the link's exact position by `replaceWith`, so the rules keep
  // Their place in the cascade.
  const styleEl = params.doc.head.createEl(STYLE_TAG_NAME);
  styleEl.dataset[INLINED_FROM_DATASET_KEY] = url;
  // `media` is the one `<link>` attribute that changes WHEN the rules apply, so it has to survive the swap.
  const media = linkEl.getAttribute(MEDIA_ATTRIBUTE);
  if (media !== null) {
    styleEl.setAttribute(MEDIA_ATTRIBUTE, media);
  }
  setCss(styleEl, inlinedCss);
  linkEl.replaceWith(styleEl);
}

async function inlineStyleImportsAsync(styleEl: HTMLStyleElement, params: InlineDocumentStylesheetsAsyncParams): Promise<void> {
  const css = styleEl.textContent;
  if (!css.includes(IMPORT_AT_RULE)) {
    return;
  }

  // The element's own `url()`s already resolve against the document, so passing the document's base URL
  // Leaves them untouched while the IMPORTED text is resolved against its own location.
  setCss(
    styleEl,
    await inlineCssAsync({
      css,
      cssUrl: params.baseUrl,
      readTextAsync: params.readTextAsync
    })
  );
}

function resolveUrl(href: string, baseUrl: string): null | string {
  if (href === '') {
    return null;
  }

  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}

function setCss(styleEl: HTMLStyleElement, css: string): void {
  styleEl.textContent = css;
}
