import { evalInObsidian } from 'obsidian-integration-testing';
import { getTempVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  describe,
  expect,
  it
} from 'vitest';

describe('open-in-new-tab (desktop)', () => {
  it('should open a second html file in a new tab only when the setting is enabled', async () => {
    const result = await evalInObsidian({
      fn: async ({ app, lib: { waitUntil } }) => {
        const SAVE_DELAY_IN_MILLISECONDS = 800;
        const TIMEOUT_IN_MILLISECONDS = 20_000;
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
        // Appears (the count stays at two).
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

        async function waitFor(predicate: () => boolean, message: string): Promise<void> {
          await waitUntil({
            message,
            predicate,
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

          const items = Array.from(tab.containerEl.querySelectorAll<HTMLElement>('.setting-item'));
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
      vaultPath: getTempVault().path
    });

    expect(result.enabledLeafCount).toBe(2);
    expect(result.disabledLeafCount).toBe(2);
  });
});
