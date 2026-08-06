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
 * @returns The URL, e.g. `file:///C:/Vault/Doc.html`.
 */
export function buildFileUrl(absolutePath: string): string {
  const posixPath = absolutePath.split(WINDOWS_PATH_SEPARATOR).join(POSIX_PATH_SEPARATOR);

  // A Windows path starts at a drive letter, so it needs the extra root slash that a POSIX path
  // (already starting with `/`) brings with it.
  const rootedPath = posixPath.startsWith(POSIX_PATH_SEPARATOR) ? posixPath : `${POSIX_PATH_SEPARATOR}${posixPath}`;

  // `encodeURI` leaves `/` and `:` alone (so the drive letter and separators survive) while escaping
  // Spaces and the other characters a vault path may legitimately contain. `#` is NOT left alone: it
  // Is escaped, which is what keeps a `#` in a FILE NAME from being read as the start of the fragment.
  const encodedPath = encodeURI(rootedPath).replaceAll('#', '%23');

  return `file://${encodedPath}`;
}
