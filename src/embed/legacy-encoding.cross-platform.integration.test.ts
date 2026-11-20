import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  describe,
  expect,
  it
} from 'vitest';

describe('embed of an HTML file in a legacy encoding', () => {
  it('should decode a Windows-1251 file by its meta charset, past the first 1024 bytes', async () => {
    const result = await evalInObsidian({
      callback: async ({ app, lib: { waitUntil } }) => {
        const TIMEOUT_IN_MILLISECONDS = 20_000;
        const htmlPath = 'embed-html-legacy-encoding-probe.html';
        const notePath = 'embed-html-legacy-encoding-probe.md';
        // `Привіт` in Windows-1251. Decoded as UTF-8, every byte is invalid and becomes U+FFFD.
        const GREETING_WINDOWS_1251 = [0xCF, 0xF0, 0xE8, 0xE2, 0xB3, 0xF2];

        await deleteIfExists(htmlPath);
        await deleteIfExists(notePath);

        // The court-registry shape the fix was reported on: the Content-Type meta follows dozens of
        // metadata META tags, so it sits well past byte 1024, where Chrome still finds it.
        const head = `<html><head>${'<META NAME="DOCID" CONTENT="53011868">\n'.repeat(60)}`
          + '<meta http-equiv="Content-Type" content="text/html; charset=Windows-1251"></head>'
          + '<body><div id="out" style="height: 100px">';
        const tail = '</div></body></html>';
        const bytes = new Uint8Array([
          ...new TextEncoder().encode(head),
          ...GREETING_WINDOWS_1251,
          ...new TextEncoder().encode(tail)
        ]);
        await app.vault.createBinary(htmlPath, bytes.buffer);
        const noteFile = await app.vault.create(notePath, `![[${htmlPath}]]`);

        const leaf = app.workspace.getLeaf(true);
        await leaf.openFile(noteFile, { state: { mode: 'preview' } });

        let isTimedOut = false;
        try {
          await waitUntil({
            message: 'embed iframe did not render its body',
            predicate: () => iframeBodyText().trim() !== '',
            timeoutInMilliseconds: TIMEOUT_IN_MILLISECONDS
          });
        } catch {
          isTimedOut = true;
        }

        const bodyText = iframeBodyText();

        leaf.detach();
        await deleteIfExists(htmlPath);
        await deleteIfExists(notePath);

        return {
          bodyText,
          timedOut: isTimedOut
        };

        function iframeBodyText(): string {
          const iframe = leaf.view.containerEl.querySelector<HTMLIFrameElement>(':scope .internal-embed iframe');
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
      vaultPath: getTemporaryVault().path
    });

    expect(result.timedOut).toBe(false);
    expect(result.bodyText).toContain('Привіт');
    expect(result.bodyText).not.toContain('�');
  });
});
