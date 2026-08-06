import { createServer } from 'node:http';
import { evalInObsidian } from 'obsidian-integration-testing';
import { getTempVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  describe,
  expect,
  it
} from 'vitest';

// A REMOTE `<link rel="stylesheet">` is blocked by the same inherited CSP as a vault-local one (only
// `https://fonts.googleapis.com` is allow-listed), so it is inlined the same way. What differs is the read:
// The embedded document could not fetch it itself (cross-origin, no CORS), so the plugin reads it through
// Obsidian's `requestUrl`, which is not CORS-bound.
//
// The stylesheet is served by a throwaway loopback server rather than a real CDN, so the suite neither needs
// The internet nor depends on a third party staying up. It deliberately sends NO
// `Access-Control-Allow-Origin` header: a plain `fetch` from Obsidian's origin would be rejected, which is
// Exactly what makes this a test of the `requestUrl` path.
//
// Desktop-only: the Android emulator does not reach the host's loopback interface.

const RED = 'rgb(255, 0, 0)';
const CSS = 'h1 { color: rgb(255, 0, 0); }';
const ANY_AVAILABLE_PORT = 0;
const LOOPBACK_HOST = '127.0.0.1';
const OK_STATUS = 200;

describe('remote stylesheet loading', () => {
  it('should apply a stylesheet served from a remote origin', async () => {
    const server = createServer((_request, response) => {
      response.writeHead(OK_STATUS, { 'Content-Type': 'text/css' });
      response.end(CSS);
    });

    try {
      await new Promise<void>((resolve) => {
        server.listen(ANY_AVAILABLE_PORT, LOOPBACK_HOST, resolve);
      });
      const address = server.address();
      const port = address !== null && typeof address !== 'string' ? address.port : 0;
      expect(port).toBeGreaterThan(0);

      const result = await evalInObsidian({
        // eslint-disable-next-line unicorn/name-replacements -- `args` is an `obsidian-integration-testing` parameter name.
        args: { cssUrl: `http://${LOOPBACK_HOST}:${String(port)}/remote.css` },
        // eslint-disable-next-line unicorn/name-replacements -- `fn` is an `obsidian-integration-testing` parameter name.
        fn: async ({ app, cssUrl, lib: { waitUntil } }) => {
          const TIMEOUT_IN_MILLISECONDS = 15_000;
          const directory = 'embed-html-remote-stylesheet-probe';
          const htmlPath = `${directory}/page.html`;
          const notePath = `${directory}/note.md`;

          await cleanup();
          await app.vault.createFolder(directory);
          await app.vault.create(
            htmlPath,
            `<html>
<head>
  <link rel="stylesheet" href="${cssUrl}" />
</head>
<body>
  <h1>remote</h1>
</body>
</html>
`
          );
          const noteFile = await app.vault.create(notePath, `![[${htmlPath}]]`);

          const leaf = app.workspace.getLeaf(true);
          await leaf.openFile(noteFile, { state: { mode: 'preview' } });

          await waitUntil({
            message: 'the remote stylesheet never applied',
            predicate: () => getColor() === 'rgb(255, 0, 0)',
            timeoutInMilliseconds: TIMEOUT_IN_MILLISECONDS
          });

          const observation = { color: getColor() };

          leaf.detach();
          await cleanup();

          return observation;

          function getIframe(): HTMLIFrameElement | null {
            const iframes = [...leaf.view.containerEl.querySelectorAll<HTMLIFrameElement>(':scope .internal-embed iframe')];
            return iframes.find((iframe) => iframe.offsetParent !== null) ?? null;
          }

          function getColor(): string {
            const iframe = getIframe();
            const el = iframe?.contentDocument?.querySelector('h1');
            const win = iframe?.contentWindow;
            if (!el || !win) {
              return '';
            }
            return win.getComputedStyle(el).color;
          }

          async function cleanup(): Promise<void> {
            const existing = app.vault.getAbstractFileByPath(directory);
            if (existing) {
              await app.fileManager.trashFile(existing);
            }
          }
        },
        vaultPath: getTempVault().path
      });

      expect(result.color).toBe(RED);
    } finally {
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
    }
  });
});
