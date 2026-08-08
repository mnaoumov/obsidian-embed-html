import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  describe,
  expect,
  it
} from 'vitest';

describe('anchor jump under a sticky table header', () => {
  it('should land the target row below the sticky header rather than underneath it', async () => {
    const result = await evalInObsidian({
      callback: async ({ app, lib: { waitUntil } }) => {
        interface Measurement {
          headerBottom: number;
          rowTop: number;
          viewportHeight: number;
        }

        const TIMEOUT_IN_MILLISECONDS = 20_000;
        // Far more rows than the target's position, so the scroll that lands it at the top is nowhere
        // Near the end of the document. A target close to the bottom cannot reproduce this at all: the
        // Browser clamps the scroll at the last screenful, leaving the row well below the pinned header.
        const ROW_COUNT = 400;
        const TARGET_ROW = 42;
        const HEADER_HEIGHT_IN_PIXELS = 40;
        // Sub-pixel layout rounding, not a fudge for a partially covered row: a whole row is ~34px tall.
        const TOLERANCE_IN_PIXELS = 2;
        const htmlPath = 'embed-html-sticky-probe.html';
        const notePath = 'embed-html-sticky-probe.md';
        const targetId = `row-${String(TARGET_ROW)}`;

        await deleteIfExists(htmlPath);
        await deleteIfExists(notePath);

        const rows: string[] = [];
        for (let rowIndex = 1; rowIndex <= ROW_COUNT; rowIndex++) {
          rows.push(`<tr id="row-${String(rowIndex)}"><td>${String(rowIndex)}</td><td>Row ${String(rowIndex)}</td></tr>`);
        }

        await app.vault.create(
          htmlPath,
          [
            '<html><head><style>',
            'table { border-collapse: collapse; width: 100%; }',
            'td, th { padding: 8px; border: 1px solid #888; }',
            `thead th { position: sticky; top: 0; height: ${String(HEADER_HEIGHT_IN_PIXELS)}px; background: #ccc; }`,
            '</style></head><body><table>',
            '<thead><tr><th>Row</th><th>Label</th></tr></thead>',
            `<tbody>${rows.join('')}</tbody>`,
            '</table></body></html>'
          ].join('\n')
        );

        const noteFile = await app.vault.create(notePath, `![[${htmlPath}#${targetId}]]`);

        const leaf = app.workspace.getLeaf(true);
        await leaf.openFile(noteFile, { state: { mode: 'preview' } });
        await app.workspace.revealLeaf(leaf);

        await waitUntil({
          message: 'the embed never scrolled to the target row',
          predicate: () => measure() !== null,
          timeoutInMilliseconds: TIMEOUT_IN_MILLISECONDS
        });

        const measurement = measure();

        leaf.detach();
        await deleteIfExists(htmlPath);
        await deleteIfExists(notePath);

        return {
          measurement,
          toleranceInPixels: TOLERANCE_IN_PIXELS
        };

        function measure(): Measurement | null {
          // Reading view renders the section more than once and only one copy is laid out, so take the
          // Iframe that actually has a box rather than the first in document order — the other reports
          // Zero-size rects for everything inside it and there is nothing to measure there.
          const iframes = [...leaf.view.containerEl.querySelectorAll<HTMLIFrameElement>(':scope .internal-embed iframe')];
          for (const iframe of iframes) {
            if (iframe.getBoundingClientRect().height === 0) {
              continue;
            }

            const doc = iframe.contentDocument;

            if (!doc?.body) {
              continue;
            }

            // eslint-disable-next-line unicorn/prefer-query-selector -- Matches how the plugin resolves the anchor target.
            const rowEl = doc.getElementById(targetId);
            const headerEl = doc.querySelector(':scope thead th');
            if (!rowEl || !headerEl) {
              continue;
            }

            const rowRect = rowEl.getBoundingClientRect();
            const headerRect = headerEl.getBoundingClientRect();
            // The table is not laid out yet, so there is no pinned header to measure against.
            if (rowRect.height === 0 || headerRect.height === 0) {
              continue;
            }

            return {
              headerBottom: headerRect.bottom,
              rowTop: rowRect.top,
              viewportHeight: doc.documentElement.clientHeight
            };
          }

          return null;
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

    const { measurement, toleranceInPixels } = result;
    expect(measurement).not.toBeNull();
    if (!measurement) {
      return;
    }

    // The defect: the row was scrolled flush to the top, so the pinned header sat on top of it and
    // `rowTop` came back well ABOVE `headerBottom`.
    expect(measurement.rowTop).toBeGreaterThanOrEqual(measurement.headerBottom - toleranceInPixels);
    // And it is still on screen — backing off must not push the row out of view entirely.
    expect(measurement.rowTop).toBeLessThan(measurement.viewportHeight);
  });
});
