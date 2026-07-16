import { evalInObsidian } from 'obsidian-integration-testing';
import { getTempVault } from 'obsidian-integration-testing/vitest-global-setup';
import {
  describe,
  expect,
  it
} from 'vitest';

export function registerScrollRerenderSuite(platform: string): void {
  describe(`reading-view scroll re-render (${platform})`, () => {
    it('should not leave an embed blank after scrolling it out of view and back', async () => {
      const result = await evalInObsidian({
        fn: async ({ app, lib: { waitUntil } }) => {
          const TIMEOUT_IN_MILLISECONDS = 20_000;
          const RECOVER_TIMEOUT_IN_MILLISECONDS = 6000;
          const STEP_SETTLE_IN_MILLISECONDS = 150;
          const SCROLL_STEP_COUNT = 40;
          const EMBED_COUNT = 6;
          const FILLER_LINES_PER_EMBED = 120;
          const MARKER_TEXT = 'EMBED_MARKER_CONTENT';
          const CHROME_ERROR_URL_PREFIX = 'chrome-error:';
          const htmlPath = 'embed-html-scroll-probe.html';
          const notePath = 'embed-html-scroll-probe.md';

          await deleteIfExists(htmlPath);
          await deleteIfExists(notePath);

          await app.vault.create(
            htmlPath,
            `<html><body><div style="height: 300px">${MARKER_TEXT}</div></body></html>`
          );

          const parts: string[] = [];
          for (let embedIndex = 0; embedIndex < EMBED_COUNT; embedIndex++) {
            parts.push(`![[${htmlPath}]]`);
            for (let fillerIndex = 0; fillerIndex < FILLER_LINES_PER_EMBED; fillerIndex++) {
              parts.push(`Filler paragraph ${String(embedIndex)}-${String(fillerIndex)} padding text to make the note tall enough to scroll.`);
            }
          }
          const noteFile = await app.vault.create(notePath, parts.join('\n\n'));

          const leaf = app.workspace.getLeaf(true);
          await leaf.openFile(noteFile, { state: { mode: 'preview' } });

          await waitUntil({
            message: 'first embed did not render initially',
            predicate: () => firstEmbedHasMarker(),
            timeoutInMilliseconds: TIMEOUT_IN_MILLISECONDS
          });

          const scroller = leaf.view.containerEl.querySelector<HTMLElement>('.markdown-preview-view');
          if (!scroller) {
            throw new Error('no reading-view scroller');
          }

          // Incrementally scroll to the bottom and back to the top.
          // Reading view lazy-renders and virtualizes sections, detaching and re-attaching
          // Each embed's DOM as it leaves and re-enters the viewport.
          // Real-user-like incremental scrolling drives that; a single scrollTop jump does not.
          await scrollThrough('down');
          await scrollThrough('up');

          // A re-attached iframe reloads from its source. A source that no longer resolves
          // (a revoked object URL) lands on a chrome-error page, leaving the embed blank.
          // Let re-loads settle: a mid-load iframe resolves to its content, whereas a
          // Chrome-error page never recovers, so it stays counted as broken.
          let brokenEmbedCount = 0;
          try {
            await waitUntil({
              message: 'embeds did not all recover after scroll',
              predicate: () => countBrokenEmbeds() === 0,
              timeoutInMilliseconds: RECOVER_TIMEOUT_IN_MILLISECONDS
            });
          } catch {
            brokenEmbedCount = countBrokenEmbeds();
          }
          const renderedEmbedCount = leaf.view.containerEl.querySelectorAll('.internal-embed iframe').length;

          leaf.detach();
          await deleteIfExists(htmlPath);
          await deleteIfExists(notePath);

          return {
            brokenEmbedCount,
            renderedEmbedCount
          };

          function firstEmbedHasMarker(): boolean {
            const iframe = leaf.view.containerEl.querySelector('iframe');
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Obsidian mobile's webview exposes a null `document.body` on a blank/still-loading embed iframe, despite the lib.dom non-null type.
            return (iframe?.contentDocument?.body?.textContent ?? '').includes(MARKER_TEXT);
          }

          function countBrokenEmbeds(): number {
            let broken = 0;
            const iframes = leaf.view.containerEl.querySelectorAll<HTMLIFrameElement>('.internal-embed iframe');
            iframes.forEach((iframe) => {
              const doc = iframe.contentDocument;
              const url = doc?.URL ?? '';
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Obsidian mobile's webview exposes a null `document.body` on a blank/still-loading embed iframe, despite the lib.dom non-null type.
              const text = doc?.body?.textContent ?? '';
              if (url.startsWith(CHROME_ERROR_URL_PREFIX) || (doc === null) || !text.includes(MARKER_TEXT)) {
                broken++;
              }
            });
            return broken;
          }

          async function scrollThrough(direction: 'down' | 'up'): Promise<void> {
            if (!scroller) {
              return;
            }
            for (let step = 0; step < SCROLL_STEP_COUNT; step++) {
              const progress = step / SCROLL_STEP_COUNT;
              const fraction = direction === 'down' ? progress : 1 - progress;
              scroller.scrollTop = Math.round(scroller.scrollHeight * fraction);
              scroller.dispatchEvent(new Event('scroll'));
              await sleep(STEP_SETTLE_IN_MILLISECONDS);
            }
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

      expect(result.renderedEmbedCount).toBeGreaterThan(0);
      expect(result.brokenEmbedCount).toBe(0);
    });
  });
}
