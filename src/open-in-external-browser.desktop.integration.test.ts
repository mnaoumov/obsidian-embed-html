import type { MarkdownView } from 'obsidian';

import { evalInObsidian } from 'obsidian-integration-testing';
import { getTempVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  beforeAll,
  describe,
  expect,
  it
} from 'vitest';

/*
 * The "Open in external browser" button: an affordance rendered ALONGSIDE the embed that hands the file's
 * `file://` URL to the system's default browser, where a real browser brings tabs, zoom, find and print.
 *
 * `window.open` is intercepted rather than actually invoked — the assertion is on the URL and target the
 * plugin asks for, which is the plugin's whole contribution. Letting it through would launch a real browser
 * on the machine running the suite, which a test must not do.
 *
 * Desktop-only: not because a full path is unavailable elsewhere (mobile's `CapacitorAdapter` supplies one
 * too), but because Obsidian exposes no way to hand a local file to a browser on mobile.
 */

const vault = getTempVault();

const NOTE_PATH = 'external-browser-note.md';
const HTML_PATH = 'external-browser-doc.html';
const BUTTON_TEXT = 'Open in external browser';
const SCENARIO_TIMEOUT_IN_MILLISECONDS = 120_000;

beforeAll(() => {
  vault.populate({
    [HTML_PATH]: '<html><body><h1>Doc</h1><p>Body</p></body></html>',
    [NOTE_PATH]: `# Note\n\n![[${HTML_PATH}]]\n`
  });
});

describe('open in external browser button', () => {
  it('should render the button next to the embed and hand the file URL to the system browser', async () => {
    const result = await evalInObsidian({
      // eslint-disable-next-line unicorn/name-replacements -- `args` is an `obsidian-integration-testing` parameter name.
      args: { BUTTON_TEXT, NOTE_PATH },
      // eslint-disable-next-line unicorn/name-replacements -- `fn` is an `obsidian-integration-testing` parameter name.
      async fn({ app, BUTTON_TEXT: buttonText, lib: { waitUntil }, NOTE_PATH: notePath }) {
        interface EmbedHtmlSettings {
          shouldShowOpenInExternalBrowserButton: boolean;
        }

        interface SettingsCarrier {
          editAndSave(editor: (settings: EmbedHtmlSettings) => void): Promise<void>;
          settings: EmbedHtmlSettings;
        }

        function isEmbedHtmlSettings(value: unknown): value is EmbedHtmlSettings {
          return typeof value === 'object' && value !== null
            && typeof (value as Record<string, unknown>)['shouldShowOpenInExternalBrowserButton'] === 'boolean';
        }

        // The plugin does not expose its settings publicly; walk its component tree, as the sibling
        // Suites in this repo do.
        function isSettingsCarrier(value: Record<string, unknown>): value is Record<string, unknown> & SettingsCarrier {
          return isEmbedHtmlSettings(value['settings']) && typeof value['editAndSave'] === 'function';
        }

        function findSettingsComponent(): null | SettingsCarrier {
          const block = new Set(['app', 'containerEl', 'dom', 'metadataCache', 'plugins', 'vault', 'workspace']);
          const seen = new Set<unknown>();
          const queue: unknown[] = [app.plugins.getPlugin('embed-html')];
          let budget = 12_000;
          while (queue.length > 0 && budget-- > 0) {
            const current = queue.shift();
            if (current === null || (typeof current !== 'object' && typeof current !== 'function') || seen.has(current)) {
              continue;
            }
            seen.add(current);
            const record = current as Record<string, unknown>;
            if (isSettingsCarrier(record)) {
              return record;
            }
            const values: unknown[] = [];
            if (Array.isArray(current)) {
              values.push(...current);
            } else if (current instanceof Map) {
              values.push(...current.values());
            } else {
              for (const [key, value] of Object.entries(record)) {
                if (!block.has(key)) {
                  values.push(value);
                }
              }
            }
            for (const value of values) {
              if (value !== null && (typeof value === 'object' || typeof value === 'function')) {
                queue.push(value);
              }
            }
          }
          return null;
        }

        function findButton(viewEl: HTMLElement): HTMLButtonElement | null {
          // The button carries no plugin-specific class, so it is found the way a user finds it: by its
          // Label, inside the embed itself.
          const buttonEls = viewEl.querySelectorAll<HTMLButtonElement>(':scope .markdown-preview-view .internal-embed button');
          for (const buttonEl of buttonEls) {
            if (buttonEl.textContent === buttonText) {
              return buttonEl;
            }
          }
          return null;
        }

        const settingsComponent = findSettingsComponent();
        if (!settingsComponent) {
          return { error: 'settings component not found', hasIframe: null, openedTarget: null, openedUrl: null };
        }

        const isOriginalShouldShowOpenInExternalBrowserButton = settingsComponent.settings.shouldShowOpenInExternalBrowserButton;
        const originalOpen = window.open.bind(window);
        let openedUrl: null | string = null;
        let openedTarget: null | string = null;
        let openedLeaf: null | ReturnType<typeof app.workspace.getLeaf> = null;

        try {
          await settingsComponent.editAndSave((settings) => {
            settings.shouldShowOpenInExternalBrowserButton = true;
          });

          const noteFile = app.vault.getFileByPath(notePath);
          if (!noteFile) {
            return { error: 'note not found', hasIframe: null, openedTarget: null, openedUrl: null };
          }

          const leaf = app.workspace.getLeaf(true);
          openedLeaf = leaf;
          await leaf.openFile(noteFile);
          // Reveal before waiting: several suites share one Obsidian, so another may have left the
          // Workspace focused elsewhere and this view would never render.
          await app.workspace.revealLeaf(leaf);
          const markdownView = leaf.view as MarkdownView;
          await markdownView.setState({ mode: 'preview' }, { history: false });

          await waitUntil({
            message: 'the open-in-external-browser button did not render',
            predicate: () => findButton(markdownView.containerEl) !== null
          });

          const buttonEl = findButton(markdownView.containerEl);
          // The button is an ADDITION, not a replacement: the document still renders in the note.
          const hasIframe = markdownView.containerEl.querySelector('iframe') !== null;

          // Intercept rather than let a real browser launch.
          window.open = (url, target): null => {
            openedUrl = typeof url === 'string' ? url : String(url);
            openedTarget = target ?? null;
            return null;
          };

          buttonEl?.click();

          return {
            error: null,
            hasIframe,
            openedTarget,
            openedUrl
          };
        } finally {
          // eslint-disable-next-line require-atomic-updates -- restoring a global this test itself stubbed; nothing else runs concurrently in the closure.
          window.open = originalOpen;
          // Leave the workspace as it was found: suites sharing this Obsidian can count leaves.
          openedLeaf?.detach();
          await settingsComponent.editAndSave((settings) => {
            settings.shouldShowOpenInExternalBrowserButton = isOriginalShouldShowOpenInExternalBrowserButton;
          });
        }
      },
      vaultPath: vault.path
    });

    expect(result.error).toBeNull();
    expect(result.hasIframe).toBe(true);
    expect(result.openedUrl).toMatch(/^file:\/\/\//);
    expect(result.openedUrl).toContain(`/${HTML_PATH}`);
    // Without `_external` the URL would open in an in-app window instead of the system browser.
    expect(result.openedTarget).toBe('_external');
  }, SCENARIO_TIMEOUT_IN_MILLISECONDS);
});
