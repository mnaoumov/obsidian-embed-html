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
 * Issue #14: an optional mode that opens the embedded HTML file in the system's default browser instead
 * of rendering it in the note, with the fragment identifier preserved.
 *
 * `window.open` is intercepted rather than actually invoked — the assertion is on the URL the plugin
 * asks for, which is the plugin's whole contribution. Letting it through would launch a real browser on
 * the machine running the suite, which a test must not do.
 *
 * Desktop-only: the mode needs the file's absolute path, which only a `FileSystemAdapter` exposes.
 */

const vault = getTempVault();

const NOTE_PATH = 'system-browser-note.md';
const HTML_PATH = 'system-browser-doc.html';
const FRAGMENT = 'section-3';
const SCENARIO_TIMEOUT_IN_MS = 120_000;

beforeAll(() => {
  vault.populate({
    [HTML_PATH]: `<html><body><h1 id="${FRAGMENT}">Section 3</h1><p>Body</p></body></html>`,
    [NOTE_PATH]: `# Note\n\n![[${HTML_PATH}#${FRAGMENT}]]\n`
  });
});

describe('open in default browser (issue #14)', () => {
  it('should render a link and request the file URL with its fragment, without rendering an iframe', async () => {
    const result = await evalInObsidian({
      // eslint-disable-next-line unicorn/name-replacements -- `args` is an `obsidian-integration-testing` parameter name.
      args: { NOTE_PATH },
      // eslint-disable-next-line unicorn/name-replacements -- `fn` is an `obsidian-integration-testing` parameter name.
      async fn({ app, lib: { waitUntil }, NOTE_PATH: notePath }) {
        interface EmbedHtmlSettings {
          shouldOpenInSystemBrowser: boolean;
        }

        interface SettingsCarrier {
          editAndSave(editor: (settings: EmbedHtmlSettings) => void): Promise<void>;
          settings: EmbedHtmlSettings;
        }

        function isEmbedHtmlSettings(value: unknown): value is EmbedHtmlSettings {
          return typeof value === 'object' && value !== null
            && typeof (value as Record<string, unknown>)['shouldOpenInSystemBrowser'] === 'boolean';
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

        const settingsComponent = findSettingsComponent();
        if (!settingsComponent) {
          return { error: 'settings component not found', hasIframe: null, linkText: null, openedUrl: null };
        }

        const isOriginalShouldOpenInSystemBrowser = settingsComponent.settings.shouldOpenInSystemBrowser;
        const originalOpen = window.open.bind(window);
        let openedUrl: null | string = null;
        let openedLeaf: null | ReturnType<typeof app.workspace.getLeaf> = null;

        try {
          await settingsComponent.editAndSave((settings) => {
            settings.shouldOpenInSystemBrowser = true;
          });

          const noteFile = app.vault.getFileByPath(notePath);
          if (!noteFile) {
            return { error: 'note not found', hasIframe: null, linkText: null, openedUrl: null };
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
            message: 'the embed did not render as a link',
            predicate: () => markdownView.containerEl.querySelector('.embed-html-open-in-system-browser') !== null
          });

          const linkEl = markdownView.containerEl.querySelector('.embed-html-open-in-system-browser');
          const hasIframe = markdownView.containerEl.querySelector('iframe') !== null;

          // Intercept rather than let a real browser launch.
          window.open = (url): null => {
            openedUrl = typeof url === 'string' ? url : String(url);
            return null;
          };

          if (linkEl instanceof HTMLElement) {
            linkEl.click();
          }

          return {
            error: null,
            hasIframe,
            linkText: linkEl?.textContent ?? null,
            openedUrl
          };
        } finally {
          // eslint-disable-next-line require-atomic-updates -- restoring a global this test itself stubbed; nothing else runs concurrently in the closure.
          window.open = originalOpen;
          // Leave the workspace as it was found: suites sharing this Obsidian can count leaves.
          openedLeaf?.detach();
          await settingsComponent.editAndSave((settings) => {
            settings.shouldOpenInSystemBrowser = isOriginalShouldOpenInSystemBrowser;
          });
        }
      },
      vaultPath: vault.path
    });

    expect(result.error).toBeNull();
    // The document is shown as a link, not rendered in the note.
    expect(result.hasIframe).toBe(false);
    expect(result.linkText).toBe(`${HTML_PATH}#${FRAGMENT}`);
    // The fragment travels with it — the whole point of the request.
    expect(result.openedUrl).toContain(`/${HTML_PATH}#${FRAGMENT}`);
    expect(result.openedUrl).toMatch(/^file:\/\/\//);
  }, SCENARIO_TIMEOUT_IN_MS);
});
