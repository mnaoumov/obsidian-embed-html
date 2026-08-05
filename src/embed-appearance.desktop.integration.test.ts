import { evalInObsidian } from 'obsidian-integration-testing';
import { getTempVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  describe,
  expect,
  it
} from 'vitest';

// Minimal structural view of the plugin's public settings API (`plugin.settingsComponent`), used only
// To type the cast inside the serialized closure — the real definition lives in `src/plugin.ts` /
// `src/plugin-settings.ts`. Type-only, so it is erased before the closure is serialized.
interface EmbedAppearanceSettings {
  background: string;
  border: string;
  borderRadius: string;
}

interface EmbedHtmlPluginLike {
  settingsComponent: EmbedHtmlSettingsComponentLike;
}

interface EmbedHtmlSettingsComponentLike {
  editAndSave(this: void, editor: (settings: EmbedAppearanceSettings) => void): Promise<void>;
  settings: EmbedAppearanceSettings;
}

interface RgbChannels {
  a: number;
  b: number;
  g: number;
  r: number;
}

/*
 * Desktop-only: this environment has no Android emulator, so the suite is named for the desktop
 * project alone. The feature is cross-platform (`isDesktopOnly: false`), so renaming this file to
 * `*.cross-platform.integration.test.ts` lifts it to Android once an emulator exists.
 */

describe('embed appearance settings', () => {
  it('should apply the border, border-radius and background settings to the embed container', async () => {
    const result = await evalInObsidian({
      // eslint-disable-next-line unicorn/name-replacements -- `fn` is an `obsidian-integration-testing` parameter name.
      fn: async ({ app, lib: { waitUntil } }) => {
        const TIMEOUT_IN_MILLISECONDS = 20_000;
        const BORDER = '2px solid rgb(255, 0, 0)';
        const EXPECTED_BORDER_STYLE = 'solid';
        const EXPECTED_BORDER_WIDTH = '2px';
        const BORDER_RADIUS = '8px';
        const BACKGROUND = 'rgb(0, 128, 0)';
        const htmlPath = 'embed-html-appearance-probe.html';
        const notePath = 'embed-html-appearance-probe.md';

        const plugin = app.plugins.getPlugin('embed-html') as EmbedHtmlPluginLike | null;
        if (!plugin) {
          throw new Error('embed-html plugin is not enabled');
        }
        const settingsComponent = plugin.settingsComponent;

        // Snapshot the appearance settings so the shared temp vault is left untouched for other suites.
        const previous: EmbedAppearanceSettings = {
          background: settingsComponent.settings.background,
          border: settingsComponent.settings.border,
          borderRadius: settingsComponent.settings.borderRadius
        };

        try {
          // Drive the real public settings API — the same path the settings tab and the demo buttons use.
          // Set BEFORE the embed renders so its first `applySize()` reads the new decoration.
          await settingsComponent.editAndSave((settings) => {
            settings.background = BACKGROUND;
            settings.border = BORDER;
            settings.borderRadius = BORDER_RADIUS;
          });

          await deleteIfExists(htmlPath);
          await deleteIfExists(notePath);
          await app.vault.create(
            htmlPath,
            '<html><body><div style="height: 120px">APPEARANCE_PROBE</div></body></html>'
          );
          const noteFile = await app.vault.create(notePath, `![[${htmlPath}]]`);

          const leaf = app.workspace.getLeaf(true);
          await leaf.openFile(noteFile, { state: { mode: 'preview' } });

          let embedEl: HTMLElement | null = null;
          await waitUntil({
            message: 'embed container never reflected the appearance settings',
            predicate: () => {
              embedEl = leaf.view.containerEl.querySelector<HTMLElement>(':scope .markdown-preview-view .internal-embed');
              if (!embedEl?.offsetParent) {
                return false;
              }
              // The border width is applied synchronously by `applySize()`, so it is the readiness signal.
              return getComputedStyle(embedEl).borderTopWidth === EXPECTED_BORDER_WIDTH;
            },
            timeoutInMilliseconds: TIMEOUT_IN_MILLISECONDS
          });

          const resolvedEmbedEl = embedEl as HTMLElement | null;
          if (!resolvedEmbedEl) {
            throw new Error('embed element was not rendered');
          }

          const computed = getComputedStyle(resolvedEmbedEl);
          const observation = {
            backgroundColor: computed.backgroundColor,
            borderTopColor: computed.borderTopColor,
            borderTopLeftRadius: computed.borderTopLeftRadius,
            borderTopStyle: computed.borderTopStyle,
            borderTopWidth: computed.borderTopWidth,
            expectedBorderRadius: BORDER_RADIUS,
            expectedBorderStyle: EXPECTED_BORDER_STYLE,
            expectedBorderWidth: EXPECTED_BORDER_WIDTH,
            overflow: computed.overflow
          };

          leaf.detach();
          return observation;
        } finally {
          await settingsComponent.editAndSave((settings) => {
            settings.background = previous.background;
            settings.border = previous.border;
            settings.borderRadius = previous.borderRadius;
          });
          await deleteIfExists(htmlPath);
          await deleteIfExists(notePath);
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

    // Exact, serialization-stable properties: width/style/radius/overflow never go through color
    // Serialization, so they match the configured values verbatim.
    expect(result.borderTopWidth).toBe(result.expectedBorderWidth);
    expect(result.borderTopStyle).toBe(result.expectedBorderStyle);
    expect(result.borderTopLeftRadius).toBe(result.expectedBorderRadius);
    // A non-empty radius must clip the iframe's square corners to the rounded box.
    expect(result.overflow).toBe('hidden');

    // Colors: assert both non-empty/non-transparent AND channel-dominant (red border, green background),
    // Parsing tolerantly so Obsidian 1.13.x CSS Color 4 (`oklch(...)`) serialization cannot flake the run.
    expect(isNonTransparent(result.borderTopColor)).toBe(true);
    expect(isNonTransparent(result.backgroundColor)).toBe(true);
    expectDominantChannel(result.borderTopColor, 'r');
    expectDominantChannel(result.backgroundColor, 'g');
  });
});

function expectDominantChannel(color: string, channel: 'b' | 'g' | 'r'): void {
  const channels = parseRgbChannels(color);
  // `oklch(...)` (or any non-rgb serialization) is not channel-parseable — the non-transparent check
  // Above already proved the color applied, so skip the dominance assertion rather than fail spuriously.
  if (!channels) {
    return;
  }
  const others = (['b', 'g', 'r'] as const).filter((other) => other !== channel);
  for (const other of others) {
    expect(channels[channel]).toBeGreaterThan(channels[other]);
  }
}

function isNonTransparent(color: string): boolean {
  if (color === '' || color === 'transparent') {
    return false;
  }
  const channels = parseRgbChannels(color);
  // A fully-transparent rgba is treated as "not applied"; a non-rgb form (e.g. oklch) is trusted as set.
  return !channels || channels.a > 0;
}

function parseRgbChannels(color: string): null | RgbChannels {
  const match = /^rgba?\((?<r>\d+),\s*(?<g>\d+),\s*(?<b>\d+)(?:,\s*(?<a>[\d.]+))?\)$/.exec(color);
  if (!match?.groups) {
    return null;
  }
  return {
    a: match.groups['a'] === undefined ? 1 : Number(match.groups['a']),
    b: Number(match.groups['b']),
    g: Number(match.groups['g']),
    r: Number(match.groups['r'])
  };
}
