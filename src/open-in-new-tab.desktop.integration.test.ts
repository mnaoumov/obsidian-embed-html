import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  describe,
  expect,
  it
} from 'vitest';

describe('open-in-new-tab (desktop)', () => {
  it('should open a second html file in a new tab only when the setting is enabled', async () => {
    const result = await evalInObsidian({
      callback: async ({ app, lib: { waitUntil } }) => {
        const SAVE_DELAY_IN_MILLISECONDS = 800;
        /*
         * ONE ceiling SHARED by all three `waitFor` calls below — file A opening, file B landing in a
         * second tab, file A reopening — so what this closure declares is 3 x this number plus the two
         * `SAVE_DELAY_IN_MILLISECONDS` settles, not this number once. At 20_000 that summed to 61_600,
         * twice the transport's ~30_000 per-eval cap: the success path is fast so it passed, but a FAILURE
         * was killed at the cap before its own ceiling was reached and reported as a bare
         * `WebDriverError: script timeout` naming `AppiumTransport.evaluate` instead of the condition that
         * overran. At 6000 the declared worst case is 3 x 6000 + 1600 = 19_600, with real headroom under
         * the cap. Opening a leaf and counting `getLeavesOfType` lands in well under a second, so sizing
         * costs nothing here; a wait that can genuinely run long belongs in Node instead.
         */
        const TIMEOUT_IN_MILLISECONDS = 6000;
        const PLUGIN_ID = 'embed-html';
        const VIEW_TYPE = 'html-file-view';
        const SETTING_NAME = 'Open in new tab';
        const htmlPathA = 'embed-html-new-tab-a.html';
        const htmlPathB = 'embed-html-new-tab-b.html';

        await deleteIfExists(htmlPathA);
        await deleteIfExists(htmlPathB);
        await app.vault.create(htmlPathA, '<html><body><div>A</div></body></html>');
        await app.vault.create(htmlPathB, '<html><body><div>B</div></body></html>');

        // With the setting enabled: open A into the current (empty) leaf, then B — which should land in
        // A new tab, leaving both files open side by side.
        await setOpenInNewTab(true);
        await app.workspace.openLinkText(htmlPathA, '', false);
        await waitFor(() => countHtmlLeaves() >= 1, 'file A did not open as an html view');
        await app.workspace.openLinkText(htmlPathB, '', false);
        await waitFor(() => countHtmlLeaves() >= 2, 'file B did not open in a second tab when enabled');
        const enabledLeafCount = countHtmlLeaves();

        // With the setting disabled: opening another html file reuses the active leaf, so no third tab
        // appears (the count stays at two).
        await setOpenInNewTab(false);
        await app.workspace.openLinkText(htmlPathA, '', false);
        await waitFor(() => app.workspace.getActiveFile()?.path === htmlPathA, 'file A did not reopen when disabled');
        const disabledLeafCount = countHtmlLeaves();

        for (const leaf of app.workspace.getLeavesOfType(VIEW_TYPE)) {
          leaf.detach();
        }
        await deleteIfExists(htmlPathA);
        await deleteIfExists(htmlPathB);

        return {
          disabledLeafCount,
          enabledLeafCount
        };

        async function waitFor(checkCondition: () => boolean, message: string): Promise<void> {
          await waitUntil({
            message,
            predicate: checkCondition,
            timeoutInMilliseconds: TIMEOUT_IN_MILLISECONDS
          });
        }

        function countHtmlLeaves(): number {
          return app.workspace.getLeavesOfType(VIEW_TYPE).length;
        }

        async function setOpenInNewTab(isEnabled: boolean): Promise<void> {
          app.setting.open();
          app.setting.openTabById(PLUGIN_ID);
          const tab = app.setting.pluginTabs.find((pluginTab) => pluginTab.id === PLUGIN_ID);
          if (!tab) {
            throw new Error('embed-html settings tab not found');
          }

          const items = [...tab.containerEl.querySelectorAll<HTMLElement>('.setting-item')];
          const item = items.find((el) => el.querySelector('.setting-item-name')?.textContent === SETTING_NAME);
          if (!item) {
            throw new Error('open-in-new-tab setting item not found');
          }
          const checkbox = item.querySelector<HTMLElement>('.checkbox-container');
          if (!checkbox) {
            throw new Error('open-in-new-tab toggle not found');
          }
          if (checkbox.classList.contains('is-enabled') !== isEnabled) {
            checkbox.click();
            await sleep(SAVE_DELAY_IN_MILLISECONDS);
          }
          app.setting.close();
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

    expect(result.enabledLeafCount).toBe(2);
    expect(result.disabledLeafCount).toBe(2);
  });
});
