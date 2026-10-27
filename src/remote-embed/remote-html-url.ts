/**
 * Recognition of a REMOTE HTML document named by an embed (`![](https://host/page.html)` or
 * `![[https://host/page.html]]`).
 *
 * Kept as its own pure module so the matching rules are unit-testable without a DOM or an Obsidian.
 */

const REMOTE_PROTOCOLS = new Set(['http:', 'https:']);
const EXTENSION_SEPARATOR = '.';
const PATH_SEPARATOR = '/';
const FRAGMENT_PREFIX_LENGTH = '#'.length;

/**
 * A remote HTML document, split into the address to load and the `#` subpath the embed asked for.
 */
export interface RemoteHtmlUrl {
  /**
   * The document's file name, decoded (e.g. `1.html`).
   */
  readonly fileName: string;

  /**
   * The subpath without its leading `#` (e.g. `section-2`), or `''` when the embed named none.
   */
  readonly subpath: string;

  /**
   * The document's address, without any fragment.
   */
  readonly url: string;
}

/**
 * Recognizes a remote HTML document.
 *
 * @param value - The `src` an embed carries: an image's `src`, or an unresolved internal embed's link text.
 * @param extensions - The supported HTML file extensions, lowercase and without a dot.
 * @returns The parsed document, or `null` when the value is not an `http(s)` URL whose path ends in one of the extensions.
 */
export function parseRemoteHtmlUrl(value: string, extensions: readonly string[]): null | RemoteHtmlUrl {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(value.trim());
  } catch {
    return null;
  }

  if (!REMOTE_PROTOCOLS.has(parsedUrl.protocol)) {
    return null;
  }

  const pathname = parsedUrl.pathname;
  const fileName = pathname.slice(pathname.lastIndexOf(PATH_SEPARATOR) + 1);
  const extensionIndex = fileName.lastIndexOf(EXTENSION_SEPARATOR);
  const extension = extensionIndex === -1 ? '' : fileName.slice(extensionIndex + 1).toLowerCase();
  if (!extensions.includes(extension)) {
    return null;
  }

  // `hash` is either `''` or `#` followed by the fragment, so dropping its first character covers both.
  const subpath = safeDecodeURIComponent(parsedUrl.hash.slice(FRAGMENT_PREFIX_LENGTH));
  parsedUrl.hash = '';
  return {
    fileName: safeDecodeURIComponent(fileName),
    subpath,
    url: parsedUrl.href
  };
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    // A malformed escape (`%zz`) is kept verbatim rather than failing the whole embed.
    return value;
  }
}
