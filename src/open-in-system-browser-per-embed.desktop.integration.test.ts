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
 * Issue #14, second half: the open-in-default-browser mode is global, but a vault rarely wants EVERY embed
 * to open externally. A single embed overrides the setting either way with an `open-in-default-browser`
 * flag in its token.
 *
 * Both directions are exercised against the setting set to the OPPOSITE value, so a passing assertion can
 * only come from the flag and never from the setting agreeing by accident.
 *
 * Desktop-only, for the same reason as the global-mode suite: the mode needs the file's absolute path,
 * which only a `FileSystemAdapter` exposes.
 */

const vault = getTempVault();

const HTML_PATH = 'per-embed-doc.html';
const FRAGMENT = 'section-3';
const OPT_IN_NOTE_PATH = 'per-embed-opt-in.md';
const OPT_OUT_NOTE_PATH = 'per-embed-opt-out.md';
const SCENARIO_TIMEOUT_IN_MS = 120_000;

beforeAll(() => {
  vault.populate({
    [HTML_PATH]: `<html><body><h1 id="${FRAGMENT}">Section 3</h1><p>Body</p></body></html>`,
    [OPT_IN_NOTE_PATH]: `# Opt in\n\n![[${HTML_PATH}#${FRAGMENT}|open-in-default-browser: true]]\n`,
    [OPT_OUT_NOTE_PATH]: `# Opt out\n\n![[${HTML_PATH}#${FRAGMENT}|open-in-default-browser: false]]\n`
  });
});

describe('per-embed open-in-default-browser override (issue #14)', () => {
  it('should honour the flag over the global setting in both directions', async () => {
    const result = await evalInObsidian({
      // eslint-disable-next-line unicorn/name-replacements -- `args` is an `obsidian-integration-testing` parameter name.
      args: { OPT_IN_NOTE_PATH, OPT_OUT_NOTE_PATH },
      // eslint-disable-next-line unicorn/name-replacements -- `fn` is an `obsidian-integration-testing` parameter name.
      async fn({ app, lib: { waitUntil }, OPT_IN_NOTE_PATH: optInNotePath, OPT_OUT_NOTE_PATH: optOutNotePath }) {
        interface EmbedHtmlSettings {
          shouldOpenInSystemBrowser: boolean;
        }

        interface SettingsCarrier {
          editAndSave(editor: (settings: EmbedHtmlSettings) => void): Promise<void>;
          settings: EmbedHtmlSettings;
        }

        interface Rendering {
          hasIframe: boolean;
          hasLink: boolean;
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
          return { error: 'settings component not found', optIn: null, optOut: null };
        }

        const isOriginalShouldOpenInSystemBrowser = settingsComponent.settings.shouldOpenInSystemBrowser;

        try {
          // The flag says "open externally" while the setting says "render in the note".
          const optIn = await render(optInNotePath, false, '.embed-html-open-in-system-browser');
          // And the other way round.
          const optOut = await render(optOutNotePath, true, 'iframe');

          return { error: null, optIn, optOut };
        } finally {
          await settingsComponent.editAndSave((settings) => {
            settings.shouldOpenInSystemBrowser = isOriginalShouldOpenInSystemBrowser;
          });
        }

        async function render(notePath: string, isShouldOpenInSystemBrowser: boolean, awaitedSelector: string): Promise<Rendering> {
          await settingsComponent?.editAndSave((settings) => {
            settings.shouldOpenInSystemBrowser = isShouldOpenInSystemBrowser;
          });

          const noteFile = app.vault.getFileByPath(notePath);
          if (!noteFile) {
            throw new Error(`note not found: ${notePath}`);
          }

          const leaf = app.workspace.getLeaf(true);
          try {
            await leaf.openFile(noteFile);
            // Reveal before waiting: several suites share one Obsidian, so another may have left the
            // Workspace focused elsewhere and this view would never render.
            await app.workspace.revealLeaf(leaf);
            const markdownView = leaf.view as MarkdownView;
            await markdownView.setState({ mode: 'preview' }, { history: false });

            await waitUntil({
              message: `the embed in ${notePath} never rendered ${awaitedSelector}`,
              predicate: () => markdownView.containerEl.querySelector(awaitedSelector) !== null
            });

            return {
              hasIframe: markdownView.containerEl.querySelector('iframe') !== null,
              hasLink: markdownView.containerEl.querySelector('.embed-html-open-in-system-browser') !== null
            };
          } finally {
            // Leave the workspace as it was found: suites sharing this Obsidian can count leaves.
            leaf.detach();
          }
        }
      },
      vaultPath: vault.path
    });

    expect(result.error).toBeNull();

    // `open-in-default-browser: true` wins over a setting that is off.
    expect(result.optIn?.hasLink).toBe(true);
    expect(result.optIn?.hasIframe).toBe(false);

    // `open-in-default-browser: false` wins over a setting that is on.
    expect(result.optOut?.hasIframe).toBe(true);
    expect(result.optOut?.hasLink).toBe(false);
  }, SCENARIO_TIMEOUT_IN_MS);
});
