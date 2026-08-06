/**
 * Prepares a stylesheet's TEXT for being inlined into an embedded document.
 *
 * Obsidian's page carries `Content-Security-Policy: style-src 'unsafe-inline' 'self' …`, and a `srcdoc`
 * iframe inherits its parent's policy container AND its origin — so the embed's document is
 * `app://obsidian.md` and `'self'` means exactly that host. The vault's resource host is a different one
 * (`app://<per-session-hash>`), so an external stylesheet is fetched successfully and then never applied.
 * Inline `<style>` text is allowed by `'unsafe-inline'`, which is why the embed inlines stylesheets instead
 * of linking them.
 *
 * Moving CSS text out of its file and into the document breaks two things, which this module repairs:
 * - **Relative `url()` targets** (background images, `@font-face` sources) resolve against the STYLESHEET's
 *   own location, not the document's — the two differ as soon as the CSS lives in its own folder. They are
 *   rewritten to absolute URLs.
 * - **`@import`** is itself a CSP-blocked stylesheet fetch, so it is inlined recursively, preserving the
 *   `layer()` / `supports()` / media conditions the import carried.
 */

import {
  getMandatoryNamedGroup,
  getOptionalNamedGroup
} from 'obsidian-dev-utils/reg-exp';

/**
 * Reads the text of a stylesheet at an absolute URL.
 *
 * @param url - The absolute URL to read.
 * @returns The stylesheet text, or `null` when it cannot be read (missing file, network error, …).
 */
export type ReadTextAsyncFunction = (url: string) => Promise<null | string>;

interface ImportCondition {
  /**
   * The `layer(…)` name, `''` for an anonymous `layer`, or `null` when the import carries no layer.
   */
  readonly layerName: null | string;

  /**
   * The media query, or `''` when the import carries none.
   */
  readonly media: string;

  /**
   * The `supports(…)` condition, or `''` when the import carries none.
   */
  readonly supports: string;
}

interface InlineCssAsyncParams {
  /**
   * The stylesheet's text.
   */
  readonly css: string;

  /**
   * The absolute URL the text came from. Relative `url()` / `@import` targets resolve against it.
   */
  readonly cssUrl: string;

  /**
   * Reads an imported stylesheet's text.
   */
  readonly readTextAsync: ReadTextAsyncFunction;
}

interface InlineImportParams {
  readonly condition: string;
  readonly cssUrl: string;
  readonly statement: string;
  readonly target: string;
}

interface InlineParams {
  readonly css: string;
  readonly cssUrl: string;
}

interface ParenthesizedArgument {
  readonly argument: string;
  readonly endIndex: number;
}

// `url(…)` accepts a quoted or an unquoted target; an unquoted one cannot contain `)`, and a quoted one is
// Taken verbatim, so a single non-greedy group covers both and `unquote()` sorts out which it was.
const URL_REG_EXP = /url\(\s*(?<value>[^)]*?)\s*\)/g;
// `@import` accepts the same `url(…)` form or a bare string, then an optional condition up to the `;`.
const IMPORT_REG_EXP = /@import\s+(?:url\(\s*(?<urlValue>[^)]*?)\s*\)|(?<stringValue>"[^"]*"|'[^']*'))(?<condition>[^;]*);/g;
const LAYER_REG_EXP = /^layer(?:\((?<layerName>[^)]*)\))?(?=\s|$)/;

const CSS_SUPPORTS_PREFIX = 'supports(';
const OPENING_PARENTHESIS = '(';
const CLOSING_PARENTHESIS = ')';

// A `url()` target that must NOT be resolved against the stylesheet: `#foo` addresses an element of the
// EMBEDDING document (SVG paint servers, filters), and `data:` / `blob:` targets carry their own payload.
const NON_RESOLVABLE_URL_PREFIXES = ['#', 'data:', 'blob:'];

/**
 * Recursion state for one top-level inlining run: the reader, plus the set of URLs already inlined, which is
 * what stops a cycle (`a.css` importing `b.css` importing `a.css`) from recursing forever.
 */
class CssInliner {
  private readonly readTextAsync: ReadTextAsyncFunction;
  private readonly visitedUrls = new Set<string>();

  public constructor(readTextAsync: ReadTextAsyncFunction) {
    this.readTextAsync = readTextAsync;
  }

  public async inlineAsync(params: InlineParams): Promise<string> {
    const withInlinedImports = await this.inlineImportsAsync(params);
    return rewriteUrls(withInlinedImports, params.cssUrl);
  }

  private async inlineImportAsync(params: InlineImportParams): Promise<string> {
    const importUrl = resolveUrl(params.target, params.cssUrl);
    if (importUrl === null) {
      return params.statement;
    }

    if (this.visitedUrls.has(importUrl)) {
      return '';
    }
    this.visitedUrls.add(importUrl);

    const importedCss = await this.readTextAsync(importUrl);
    if (importedCss === null) {
      // Unreadable: keep the import, but with an absolute URL, so the document still states its intent
      // Instead of silently losing the rule.
      return `@import url("${importUrl}")${params.condition};`;
    }

    const inlinedCss = await this.inlineAsync({
      css: importedCss,
      cssUrl: importUrl
    });
    return wrapInCondition(inlinedCss, parseCondition(params.condition));
  }

  private async inlineImportsAsync(params: InlineParams): Promise<string> {
    const matches = [...params.css.matchAll(IMPORT_REG_EXP)];
    if (matches.length === 0) {
      return params.css;
    }

    let result = '';
    let copiedUpTo = 0;
    for (const match of matches) {
      // The pattern's two alternatives are the `url(…)` form and the bare-string form, so exactly one of
      // The groups took part in the match.
      const urlValue = getOptionalNamedGroup(match, 'urlValue');
      const target = urlValue ?? getMandatoryNamedGroup(match, 'stringValue');
      result += params.css.slice(copiedUpTo, match.index);
      result += await this.inlineImportAsync({
        condition: getMandatoryNamedGroup(match, 'condition'),
        cssUrl: params.cssUrl,
        statement: match[0],
        target: unquote(target)
      });
      copiedUpTo = match.index + match[0].length;
    }
    result += params.css.slice(copiedUpTo);
    return result;
  }
}

/**
 * Inlines a stylesheet's `@import`s and absolutizes its relative `url()` targets.
 *
 * @param params - The stylesheet, its URL, and the reader used for its imports.
 * @returns The rewritten CSS, safe to place in an inline `<style>` of the embedded document.
 */
export async function inlineCssAsync(params: InlineCssAsyncParams): Promise<string> {
  const inliner = new CssInliner(params.readTextAsync);
  return await inliner.inlineAsync({
    css: params.css,
    cssUrl: params.cssUrl
  });
}

/**
 * Reads the argument of a `name(` … `)` function starting at `startIndex`, counting nested parentheses.
 *
 * A `supports()` condition legitimately nests them (`supports((display: grid) and (color))`), which a
 * non-greedy regex cannot follow.
 *
 * @returns The argument text and the index just past the closing parenthesis, or `null` when unbalanced.
 */
function extractParenthesized(text: string, startIndex: number): null | ParenthesizedArgument {
  let depth = 0;
  for (let index = startIndex; index < text.length; index++) {
    const character = text[index];
    if (character === OPENING_PARENTHESIS) {
      depth++;
      continue;
    }
    if (character !== CLOSING_PARENTHESIS) {
      continue;
    }
    depth--;
    if (depth === 0) {
      return {
        argument: text.slice(startIndex + 1, index),
        endIndex: index + 1
      };
    }
  }
  return null;
}

/**
 * Splits an `@import` condition into its `layer` / `supports` / media parts, in the order the CSS grammar
 * fixes them (`@import <url> [layer|layer(<name>)] [supports(<condition>)] [<media-query>];`).
 */
function parseCondition(condition: string): ImportCondition {
  let rest = condition.trim();

  let layerName: null | string = null;
  const layerMatch = LAYER_REG_EXP.exec(rest);
  if (layerMatch) {
    layerName = getOptionalNamedGroup(layerMatch, 'layerName') ?? '';
    rest = rest.slice(layerMatch[0].length).trim();
  }

  let supports = '';
  if (rest.startsWith(CSS_SUPPORTS_PREFIX)) {
    const extracted = extractParenthesized(rest, CSS_SUPPORTS_PREFIX.length - 1);
    if (extracted) {
      supports = extracted.argument;
      rest = rest.slice(extracted.endIndex).trim();
    }
  }

  return {
    layerName,
    media: rest,
    supports
  };
}

/**
 * Resolves a possibly-relative URL against the stylesheet's own URL.
 *
 * @returns The absolute URL, or `null` when the target must be left untouched (see
 *   {@link NON_RESOLVABLE_URL_PREFIXES}) or is not a URL at all.
 */
function resolveUrl(target: string, cssUrl: string): null | string {
  if (target === '' || NON_RESOLVABLE_URL_PREFIXES.some((prefix) => target.startsWith(prefix))) {
    return null;
  }

  try {
    return new URL(target, cssUrl).href;
  } catch {
    return null;
  }
}

function rewriteUrls(css: string, cssUrl: string): string {
  let result = '';
  let copiedUpTo = 0;
  for (const match of css.matchAll(URL_REG_EXP)) {
    const resolvedUrl = resolveUrl(unquote(getMandatoryNamedGroup(match, 'value')), cssUrl);
    result += css.slice(copiedUpTo, match.index);
    result += resolvedUrl === null ? match[0] : `url("${resolvedUrl}")`;
    copiedUpTo = match.index + match[0].length;
  }
  result += css.slice(copiedUpTo);
  return result;
}

function unquote(value: string): string {
  const firstCharacter = value.at(0);
  if ((firstCharacter === '"' || firstCharacter === '\'') && value.endsWith(firstCharacter) && value.length > 1) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Re-applies the conditions an inlined `@import` carried, since inlining drops the statement that held them.
 */
function wrapInCondition(css: string, condition: ImportCondition): string {
  let result = css;
  if (condition.layerName !== null) {
    // An anonymous `layer` (no name) stays anonymous: `@layer { … }`.
    const layerHeader = condition.layerName === '' ? '@layer' : `@layer ${condition.layerName}`;
    result = `${layerHeader} {\n${result}\n}`;
  }
  if (condition.supports !== '') {
    result = `@supports ${condition.supports} {\n${result}\n}`;
  }
  if (condition.media !== '') {
    result = `@media ${condition.media} {\n${result}\n}`;
  }
  return result;
}
