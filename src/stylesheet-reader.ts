/**
 * Reads a stylesheet's text on behalf of the embed's inlining pass.
 *
 * This runs in Obsidian's own context rather than inside the embedded document, which is what makes the
 * inlining possible at all:
 * - `requestUrl` is Obsidian's own request API and is not CORS-bound, so a remote stylesheet the embedded
 *   document could never fetch itself is still readable.
 * - Everything else the embed can meet — the vault's resource host (`app://` on desktop, `capacitor://` on
 *   mobile), plus `data:` and `blob:` — is readable with a plain `fetch` and is not subject to CORS.
 */

import { requestUrl } from 'obsidian';

const REMOTE_URL_REG_EXP = /^https?:/i;

/**
 * Reads the text of a stylesheet.
 *
 * @param url - The absolute URL of the stylesheet.
 * @returns The stylesheet text, or `null` when it cannot be read. The caller then leaves the author's
 *   `<link>` in place instead of dropping it, so a missing or unreachable stylesheet degrades to today's
 *   behavior rather than to a broken document.
 */
export async function readStylesheetTextAsync(url: string): Promise<null | string> {
  try {
    if (REMOTE_URL_REG_EXP.test(url)) {
      const response = await requestUrl({ url });
      return response.text;
    }

    // `requestUrl` is an HTTP client, so the vault's own resource scheme (`app://` on desktop,
    // `capacitor://` on mobile) and `data:` / `blob:` have to go through the window's `fetch`.
    const response = await activeWindow.fetch(url);
    if (!response.ok) {
      return null;
    }
    return await response.text();
  } catch {
    return null;
  }
}
