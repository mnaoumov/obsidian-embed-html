import { evalInObsidian } from 'obsidian-integration-testing';
import { getTempVault } from 'obsidian-integration-testing/vitest-global-setup';
import {
  describe,
  expect,
  it
} from 'vitest';

describe('sizing token', () => {
  it('should route the token into the embed alt and auto-fit the height to the content', async () => {
    const result = await evalInObsidian({
      fn: async ({ app, waitUntil }) => {
        const TIMEOUT_IN_MILLISECONDS = 15_000;
        const TALL_CONTENT_HEIGHT_IN_PIXELS = 1234;
        const AUTO_FIT_HEIGHT_THRESHOLD_IN_PIXELS = 1000;
        const EXPECTED_MIN_WIDTH = '123px';
        const htmlPath = 'embed-html-sizing-probe.html';
        const notePath = 'embed-html-sizing-probe.md';
        const token = `min-width: ${EXPECTED_MIN_WIDTH}; height: max-content`;

        await deleteIfExists(htmlPath);
        await deleteIfExists(notePath);
        await app.vault.create(
          htmlPath,
          `<html><body><div style="height: ${String(TALL_CONTENT_HEIGHT_IN_PIXELS)}px">tall</div></body></html>`
        );
        const noteFile = await app.vault.create(notePath, `![[${htmlPath}|${token}]]`);

        const leaf = app.workspace.getLeaf(true);
        await leaf.openFile(noteFile, { state: { mode: 'preview' } });

        let embedEl: HTMLElement | null = null;
        await waitUntil({
          message: 'embed element was not rendered in the reading view',
          predicate: () => {
            embedEl = leaf.view.containerEl.querySelector<HTMLElement>('.markdown-preview-view .internal-embed');
            return embedEl !== null && embedEl.offsetParent !== null;
          },
          timeoutInMilliseconds: TIMEOUT_IN_MILLISECONDS
        });

        const resolvedEmbedEl = embedEl as HTMLElement | null;
        if (!resolvedEmbedEl) {
          throw new Error('embed element was not rendered');
        }

        const alt = resolvedEmbedEl.getAttribute('alt');

        await waitUntil({
          message: 'iframe was not created',
          predicate: () => resolvedEmbedEl.querySelector('iframe') !== null,
          timeoutInMilliseconds: TIMEOUT_IN_MILLISECONDS
        });

        // The content is far taller than the default 400px height, so a successful
        // auto-fit measurement drives the container past the threshold.
        await waitUntil({
          message: 'height was not auto-fit to the content',
          predicate: () => parseInt(resolvedEmbedEl.style.height, 10) > AUTO_FIT_HEIGHT_THRESHOLD_IN_PIXELS,
          timeoutInMilliseconds: TIMEOUT_IN_MILLISECONDS
        });

        const measuredHeightInPixels = parseInt(resolvedEmbedEl.style.height, 10);
        const minWidth = resolvedEmbedEl.style.minWidth;

        leaf.detach();
        await deleteIfExists(htmlPath);
        await deleteIfExists(notePath);

        return {
          alt,
          measuredHeightInPixels,
          minWidth,
          tallContentHeightInPixels: TALL_CONTENT_HEIGHT_IN_PIXELS,
          token
        };

        async function deleteIfExists(path: string): Promise<void> {
          const existing = app.vault.getAbstractFileByPath(path);
          if (existing) {
            await app.vault.delete(existing, true);
          }
        }
      },
      vaultPath: getTempVault().path
    });

    expect(result.alt).toBe(result.token);
    expect(result.minWidth).toBe('123px');
    expect(result.measuredHeightInPixels).toBeGreaterThanOrEqual(result.tallContentHeightInPixels);
  });
});
