import type { CommonArguments } from 'obsidian-integration-testing';

import {
  evalInObsidian,
  pollInObsidian
} from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  describe,
  expect,
  it
} from 'vitest';

/*
 * Every phase is its own short eval, with the waiting done from Node. The Android transport kills any single
 * closure that runs past 30s, and the scroll pass alone sleeps 12s, so one closure holding the setup, both waits
 * and the scroll overran that cap on a loaded machine.
 */
const HTML_PATH = 'embed-html-scroll-probe.html';
const NOTE_PATH = 'embed-html-scroll-probe.md';
const MARKER_TEXT = 'EMBED_MARKER_CONTENT';
const INITIAL_RENDER_TIMEOUT_IN_MILLISECONDS = 30_000;
const RECOVER_TIMEOUT_IN_MILLISECONDS = 10_000;

const input = {
  htmlPath: HTML_PATH,
  markerText: MARKER_TEXT,
  notePath: NOTE_PATH
};

interface EmbedStatus {
  readonly brokenEmbedCount: number;
  readonly hasFirstEmbedMarker: boolean;
  readonly renderedEmbedCount: number;
}

type ReadEmbedStatusArguments = CommonArguments & typeof input;

describe('reading-view scroll re-render', () => {
  it('should not leave an embed blank after scrolling it out of view and back', async () => {
    const vaultPath = getTemporaryVault().path;

    await evalInObsidian({
      callback: async ({ app, htmlPath, markerText, notePath }) => {
        const EMBED_COUNT = 6;
        const FILLER_LINES_PER_EMBED = 120;

        for (const path of [htmlPath, notePath]) {
          const existing = app.vault.getAbstractFileByPath(path);
          if (existing) {
            await app.fileManager.trashFile(existing);
          }
        }

        await app.vault.create(htmlPath, `<html><body><div style="height: 300px">${markerText}</div></body></html>`);

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
      },
      input,
      vaultPath
    });

    try {
      await pollInObsidian({
        input,
        poll: readEmbedStatus,
        timeoutInMilliseconds: INITIAL_RENDER_TIMEOUT_IN_MILLISECONDS,
        timeoutMessage: 'first embed did not render initially',
        until: (status) => status.hasFirstEmbedMarker,
        vaultPath
      });

      /*
       * Incrementally scroll to the bottom and back to the top, one direction per eval.
       * Reading view lazy-renders and virtualizes sections, detaching and re-attaching
       * each embed's DOM as it leaves and re-enters the viewport.
       * Real-user-like incremental scrolling drives that; a single scrollTop jump does not.
       */
      for (const direction of ['down', 'up'] as const) {
        await evalInObsidian({
          callback: async ({ app, direction: scrollDirection, notePath }) => {
            const STEP_SETTLE_IN_MILLISECONDS = 150;
            const SCROLL_STEP_COUNT = 40;
            const leaf = app.workspace.getLeavesOfType('markdown').find((candidate) => candidate.getViewState().state?.['file'] === notePath);
            const scroller = leaf?.view.containerEl.querySelector<HTMLElement>(':scope .markdown-preview-view');
            if (!scroller) {
              throw new Error('no reading-view scroller');
            }
            for (let step = 0; step < SCROLL_STEP_COUNT; step++) {
              const progress = step / SCROLL_STEP_COUNT;
              const fraction = scrollDirection === 'down' ? progress : 1 - progress;
              scroller.scrollTop = Math.round(scroller.scrollHeight * fraction);
              scroller.dispatchEvent(new Event('scroll'));
              await sleep(STEP_SETTLE_IN_MILLISECONDS);
            }
          },
          input: { ...input, direction },
          vaultPath
        });
      }

      /*
       * A re-attached iframe reloads from its source. A source that no longer resolves
       * (a revoked object URL) lands on a chrome-error page, leaving the embed blank.
       * Let re-loads settle: a mid-load iframe resolves to its content, whereas a
       * chrome-error page never recovers, so it stays counted as broken.
       */
      let status: EmbedStatus;
      try {
        status = await pollInObsidian({
          input,
          poll: readEmbedStatus,
          timeoutInMilliseconds: RECOVER_TIMEOUT_IN_MILLISECONDS,
          until: (result) => result.brokenEmbedCount === 0,
          vaultPath
        });
      } catch {
        status = await evalInObsidian({
          callback: readEmbedStatus,
          input,
          vaultPath
        });
      }

      expect(status.renderedEmbedCount).toBeGreaterThan(0);
      expect(status.brokenEmbedCount).toBe(0);
    } finally {
      await evalInObsidian({
        callback: async ({ app, htmlPath, notePath }) => {
          for (const leaf of app.workspace.getLeavesOfType('markdown')) {
            if (leaf.getViewState().state?.['file'] === notePath) {
              leaf.detach();
            }
          }
          for (const path of [htmlPath, notePath]) {
            const existing = app.vault.getAbstractFileByPath(path);
            if (existing) {
              await app.fileManager.trashFile(existing);
            }
          }
        },
        input,
        vaultPath
      });
    }
  });
});

function readEmbedStatus({ app, markerText, notePath }: ReadEmbedStatusArguments): EmbedStatus {
  const CHROME_ERROR_URL_PREFIX = 'chrome-error:';
  const leaf = app.workspace.getLeavesOfType('markdown').find((candidate) => candidate.getViewState().state?.['file'] === notePath);
  if (!leaf) {
    return { brokenEmbedCount: 0, hasFirstEmbedMarker: false, renderedEmbedCount: 0 };
  }
  const iframes = [...leaf.view.containerEl.querySelectorAll<HTMLIFrameElement>(':scope .internal-embed iframe')];
  function readText(iframe: HTMLIFrameElement | undefined): string {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Obsidian mobile's webview exposes a null `document.body` on a blank/still-loading embed iframe, despite the lib.dom non-null type.
    return iframe?.contentDocument?.body?.textContent ?? '';
  }
  const firstIframe = leaf.view.containerEl.querySelector('iframe') ?? undefined;
  let brokenEmbedCount = 0;
  for (const iframe of iframes) {
    const doc = iframe.contentDocument;
    const url = doc?.URL ?? '';
    if (url.startsWith(CHROME_ERROR_URL_PREFIX) || doc === null || !readText(iframe).includes(markerText)) {
      brokenEmbedCount++;
    }
  }
  return {
    brokenEmbedCount,
    hasFirstEmbedMarker: readText(firstIframe).includes(markerText),
    renderedEmbedCount: iframes.length
  };
}
