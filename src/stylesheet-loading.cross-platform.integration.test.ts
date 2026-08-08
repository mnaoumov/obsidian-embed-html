import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  describe,
  expect,
  it
} from 'vitest';

// An embedded document's stylesheets have to survive Obsidian's page CSP
// (`style-src 'unsafe-inline' 'self' https://fonts.googleapis.com`), which the `srcdoc` iframe inherits
// Together with Obsidian's origin. A `<link rel="stylesheet">` at the vault's resource host
// (`app://<per-session-hash>`, which is NOT `'self'`) is fetched with a `200`/`text/css` and then never
// Applied, so the document renders unstyled. The plugin therefore inlines every stylesheet as a `<style>`,
// Which `'unsafe-inline'` permits.
//
// Only the real app can prove this: a jsdom document has no CSP at all, so the whole failure mode — and the
// Fix — is invisible to unit tests. All four cases below are the ones inlining has to get right.

const RED = 'rgb(255, 0, 0)';
const BLUE = 'rgb(0, 0, 255)';
const MAGENTA = 'rgb(255, 0, 255)';

describe('stylesheet loading', () => {
  it('should apply linked, imported and runtime-injected stylesheets, resolving their relative urls', async () => {
    const result = await evalInObsidian({
      callback: async ({ app, lib: { waitUntil } }) => {
        const TIMEOUT_IN_MILLISECONDS = 20_000;
        const directory = 'embed-html-stylesheet-probe';
        const stylesDirectory = `${directory}/styles`;
        const htmlPath = `${directory}/page.html`;
        const notePath = `${directory}/note.md`;

        await cleanup();
        await app.vault.createFolder(directory);
        await app.vault.createFolder(stylesDirectory);

        // The stylesheet lives in its OWN folder, so its relative `@import` and `url()` targets resolve
        // Against a different base than the HTML file — the exact thing inlining must preserve.
        await app.vault.create(
          `${stylesDirectory}/main.css`,
          `@import "imported.css";
h1 { color: rgb(255, 0, 0); }
body { background-image: url("bg.svg"); }
`
        );
        await app.vault.create(`${stylesDirectory}/imported.css`, 'h3 { color: rgb(0, 0, 255); }\n');
        await app.vault.create(`${stylesDirectory}/injected.css`, 'h4 { color: rgb(255, 0, 255); }\n');
        await app.vault.create(
          `${stylesDirectory}/bg.svg`,
          '<svg xmlns="http://www.w3.org/2000/svg" width="7" height="7"><rect width="7" height="7" fill="blue"/></svg>\n'
        );

        await app.vault.create(
          htmlPath,
          `<html>
<head>
  <link rel="stylesheet" href="styles/main.css" />
</head>
<body>
  <h1>linked</h1>
  <h3>imported</h3>
  <h4>runtime-injected</h4>
  <script>
    const linkEl = document.createElement('link');
    linkEl.rel = 'stylesheet';
    linkEl.href = 'styles/injected.css';
    document.head.append(linkEl);
  </script>
</body>
</html>
`
        );
        const noteFile = await app.vault.create(notePath, `![[${htmlPath}]]`);

        const leaf = app.workspace.getLeaf(true);
        await leaf.openFile(noteFile, { state: { mode: 'preview' } });

        await waitUntil({
          message: 'the linked stylesheet never applied',
          predicate: () => getColor('h1') === 'rgb(255, 0, 0)',
          timeoutInMilliseconds: TIMEOUT_IN_MILLISECONDS
        });
        await waitUntil({
          message: 'the stylesheet injected at runtime never applied',
          predicate: () => getColor('h4') === 'rgb(255, 0, 255)',
          timeoutInMilliseconds: TIMEOUT_IN_MILLISECONDS
        });

        const backgroundImage = getBackgroundImage();
        const observation = {
          backgroundImage,
          // The `url()` sat in `styles/main.css`, so it must resolve next to THAT file, not next to the
          // Embedded `page.html`.
          doesBackgroundImageLoad: await checkImageLoadsAsync(backgroundImage),
          importedColor: getColor('h3'),
          injectedColor: getColor('h4'),
          linkedColor: getColor('h1')
        };

        leaf.detach();
        await cleanup();

        return observation;

        function getIframe(): HTMLIFrameElement | null {
          // Reading-view virtualization can keep a detached iframe alongside the live one; only the
          // Laid-out one has resolved styles.
          const iframes = [...leaf.view.containerEl.querySelectorAll<HTMLIFrameElement>(':scope .internal-embed iframe')];
          return iframes.find((iframe) => iframe.offsetParent !== null) ?? null;
        }

        function getColor(selector: string): string {
          const iframe = getIframe();
          const el = iframe?.contentDocument?.querySelector(selector);
          const win = iframe?.contentWindow;
          if (!el || !win) {
            return '';
          }
          return win.getComputedStyle(el).color;
        }

        function getBackgroundImage(): string {
          const iframe = getIframe();
          const bodyEl = iframe?.contentDocument?.body;
          const win = iframe?.contentWindow;
          if (!bodyEl || !win) {
            return '';
          }
          return win.getComputedStyle(bodyEl).backgroundImage;
        }

        async function checkImageLoadsAsync(cssUrlValue: string): Promise<boolean> {
          const match = /url\("?(?<url>[^")]+)"?\)/.exec(cssUrlValue);
          const url = match?.groups?.['url'];
          const iframeDoc = getIframe()?.contentDocument;
          if (!url || !iframeDoc) {
            return false;
          }
          return await new Promise<boolean>((resolve) => {
            const imageEl = iframeDoc.head.createEl('img');
            imageEl.addEventListener('load', () => {
              resolve(true);
            });
            imageEl.addEventListener('error', () => {
              resolve(false);
            });
            imageEl.src = url;
          });
        }

        async function cleanup(): Promise<void> {
          const existing = app.vault.getAbstractFileByPath(directory);
          if (existing) {
            await app.fileManager.trashFile(existing);
          }
        }
      },
      vaultPath: getTemporaryVault().path
    });

    expect(result.linkedColor).toBe(RED);
    expect(result.importedColor).toBe(BLUE);
    expect(result.injectedColor).toBe(MAGENTA);
    // The `url()` came from `styles/main.css`, so it must point next to that file — a naive inline would
    // Have resolved it against the embedded HTML file's folder instead.
    expect(result.backgroundImage).toContain('/styles/bg.svg');
    expect(result.doesBackgroundImageLoad).toBe(true);
  });
});
