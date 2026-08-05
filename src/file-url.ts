/**
 * Builds the `file://` URL handed to the system's default browser when an embed is configured to open
 * externally (issue #14).
 *
 * Kept as its own pure module so the URL construction — which is all the platform-specific detail
 * lives in — is unit-testable without an Obsidian, a filesystem or a browser.
 */

const WINDOWS_PATH_SEPARATOR = '\\';
const POSIX_PATH_SEPARATOR = '/';

/**
 * Converts an absolute filesystem path and an optional subpath into a `file://` URL.
 *
 * @param absolutePath - The file's absolute path, as `FileSystemAdapter.getFullPath` returns it. On
 *   Windows that is a drive-letter path with backslashes (`C:\Vault\Doc.html`).
 * @param subpath - Obsidian's embed subpath, with or without its leading `#` (`#section-3`). Empty when
 *   the embed names no fragment.
 * @returns The URL, e.g. `file:///C:/Vault/Doc.html#section-3`.
 */
export function buildFileUrl(absolutePath: string, subpath: string): string {
  const posixPath = absolutePath.split(WINDOWS_PATH_SEPARATOR).join(POSIX_PATH_SEPARATOR);

  // A Windows path starts at a drive letter, so it needs the extra root slash that a POSIX path
  // (already starting with `/`) brings with it.
  const rootedPath = posixPath.startsWith(POSIX_PATH_SEPARATOR) ? posixPath : `${POSIX_PATH_SEPARATOR}${posixPath}`;

  // `encodeURI` leaves `/` and `:` alone (so the drive letter and separators survive) while escaping
  // Spaces and the other characters a vault path may legitimately contain. `#` is NOT left alone: it
  // Is escaped, which is what keeps a `#` in a FILE NAME from being read as the start of the fragment.
  const encodedPath = encodeURI(rootedPath).replaceAll('#', '%23');

  return `file://${encodedPath}${encodeSubpath(subpath)}`;
}

/**
 * Normalizes an embed subpath into a URL fragment.
 *
 * The subpath is treated as LITERAL text, which is how Obsidian hands it over: `![[Doc.html#My Section]]`
 * arrives as `#My Section`, not as `#My%20Section`. So a `%` in it is a literal percent sign and is
 * escaped like any other character. An already-percent-encoded subpath would therefore be encoded again —
 * deliberately not special-cased, because guessing which of the two a caller meant is not decidable.
 */
function encodeSubpath(subpath: string): string {
  const trimmedSubpath = subpath.trim();
  if (trimmedSubpath === '' || trimmedSubpath === '#') {
    return '';
  }

  const fragment = trimmedSubpath.startsWith('#') ? trimmedSubpath.slice(1) : trimmedSubpath;
  return `#${encodeURI(fragment)}`;
}
