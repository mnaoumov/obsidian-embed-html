import { evalInObsidian } from 'obsidian-integration-testing';
import { getTempVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  describe,
  expect,
  it
} from 'vitest';

export function registerJsExecutionSuite(platform: string): void {
  describe(`embed JavaScript execution (${platform})`, () => {
    it('should execute inline JavaScript inside the embed iframe', async () => {
      const result = await evalInObsidian({
        fn: async ({ app, lib: { waitUntil } }) => {
          const TIMEOUT_IN_MILLISECONDS = 20_000;
          // The script rewrites the pending marker to the executed marker.
          // A page whose scripts never run (the issue-#9 Android blob-URL symptom)
          // Keeps the pending marker, so the executed-marker assertion fails.
          const PENDING_MARKER = 'JS_PENDING';
          const EXECUTED_MARKER = 'JS_EXECUTED';
          const htmlPath = 'embed-html-js-execution-probe.html';
          const notePath = 'embed-html-js-execution-probe.md';

          await deleteIfExists(htmlPath);
          await deleteIfExists(notePath);

          await app.vault.create(
            htmlPath,
            `<html><body><div id="out" style="height: 100px">${PENDING_MARKER}</div>`
              + `<script>document.getElementById('out').textContent = '${EXECUTED_MARKER}'</script>`
              + '</body></html>'
          );
          const noteFile = await app.vault.create(notePath, `![[${htmlPath}]]`);

          const leaf = app.workspace.getLeaf(true);
          await leaf.openFile(noteFile, { state: { mode: 'preview' } });

          let timedOut = false;
          try {
            await waitUntil({
              message: 'embed iframe did not execute its inline script',
              predicate: () => iframeBodyText().includes(EXECUTED_MARKER),
              timeoutInMilliseconds: TIMEOUT_IN_MILLISECONDS
            });
          } catch {
            timedOut = true;
          }

          const bodyText = iframeBodyText();

          leaf.detach();
          await deleteIfExists(htmlPath);
          await deleteIfExists(notePath);

          return {
            bodyText,
            timedOut
          };

          function iframeBodyText(): string {
            const iframe = leaf.view.containerEl.querySelector<HTMLIFrameElement>('.internal-embed iframe');
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Obsidian mobile's webview exposes a null `document.body` on a blank/still-loading embed iframe, despite the lib.dom non-null type.
            return iframe?.contentDocument?.body?.textContent ?? '';
          }

          async function deleteIfExists(path: string): Promise<void> {
            const existing = app.vault.getAbstractFileByPath(path);
            if (existing) {
              await app.fileManager.trashFile(existing);
            }
          }
        },
        vaultPath: getTempVault().path
      });

      expect(result.timedOut).toBe(false);
      expect(result.bodyText).toContain('JS_EXECUTED');
      expect(result.bodyText).not.toContain('JS_PENDING');
    });
  });
}
