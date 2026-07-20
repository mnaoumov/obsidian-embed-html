import type { App } from 'obsidian';

import {
  MarkdownView,
  Notice
} from 'obsidian';

/**
 * The Embed HTML plugin settings, mirrored here so the demo buttons get autocomplete and the notes
 * read as `settings.<name>`. The real definition lives in the plugin's `src/plugin-settings.ts`.
 */
interface EmbedHtmlSettings {
  defaultHeight: string;
  defaultMaxHeight: string;
  defaultMaxWidth: string;
  defaultMinHeight: string;
  defaultMinWidth: string;
  defaultWidth: string;
  shouldOpenInNewTab: boolean;
}

type SettingsEditor = (settings: EmbedHtmlSettings) => void;

const DEFAULT_SETTINGS: EmbedHtmlSettings = {
  defaultHeight: '400px',
  defaultMaxHeight: '',
  defaultMaxWidth: '',
  defaultMinHeight: '',
  defaultMinWidth: '',
  defaultWidth: '100%',
  shouldOpenInNewTab: false
};

/** Human-readable labels for each setting, used in the change toast. */
const SETTING_LABELS: Record<keyof EmbedHtmlSettings, string> = {
  defaultHeight: 'Default height',
  defaultMaxHeight: 'Default max height',
  defaultMaxWidth: 'Default max width',
  defaultMinHeight: 'Default min height',
  defaultMinWidth: 'Default min width',
  defaultWidth: 'Default width',
  shouldOpenInNewTab: 'Open in new tab'
};

/**
 * Edits the Embed HTML settings via the plugin's public settings component, then re-renders the
 * active preview. Embeds read the default size at render time and do not subscribe to settings
 * changes, so the re-render is what surfaces a changed default on already-open embeds.
 *
 * A toast reports exactly which settings changed and confirms the re-render, so it's clear which
 * button ran even after the note visibly rebuilds.
 */
export async function editSettings(app: App, editor: SettingsEditor): Promise<void> {
  const plugin = app.plugins.getPlugin('embed-html');
  if (!plugin) {
    new Notice('Enable the Embed HTML plugin first');
    return;
  }
  const before = { ...plugin.settingsComponent.settings } as EmbedHtmlSettings;
  await plugin.settingsComponent.editAndSave(editor);
  const changes = describeChanges(before, plugin.settingsComponent.settings as EmbedHtmlSettings);
  await rerenderActivePreview(app);
  notifyResult(changes);
}

/**
 * Resets every Embed HTML setting back to its default and re-renders the active preview.
 */
export async function resetSettings(app: App): Promise<void> {
  await editSettings(app, (settings) => {
    Object.assign(settings, DEFAULT_SETTINGS);
  });
}

/**
 * Rebuilds the active Markdown view so its embeds are re-instantiated and re-read the current
 * default size. A plain `previewMode.rerender(true)` is NOT enough — Obsidian reuses the cached
 * embed widgets, so their size (computed once at load) never updates; `rebuildView()` re-creates
 * the embeds from scratch.
 */
export async function rerenderActivePreview(app: App): Promise<void> {
  const view = app.workspace.getActiveViewOfType(MarkdownView);
  await view?.leaf.rebuildView();
}

/**
 * Builds a human-readable line per changed setting, e.g. `Default width: 100% → 50%`.
 * Empty strings render as `(unset)` and booleans as `on`/`off` so every change is legible.
 */
function describeChanges(before: EmbedHtmlSettings, after: EmbedHtmlSettings): string[] {
  const keys = Object.keys(SETTING_LABELS) as (keyof EmbedHtmlSettings)[];
  return keys
    .filter((key) => before[key] !== after[key])
    .map((key) => `${SETTING_LABELS[key]}: ${formatValue(before[key])} → ${formatValue(after[key])}`);
}

function formatValue(value: boolean | string): string {
  if (typeof value === 'boolean') {
    return value ? 'on' : 'off';
  }
  return value === '' ? '(unset)' : value;
}

/** Shows a toast summarizing the change(s) and the re-render, so the clicked button is obvious. */
function notifyResult(changes: string[]): void {
  if (changes.length === 0) {
    new Notice('Embed HTML · already at these values, nothing changed · preview re-rendered', 5000);
    return;
  }
  new Notice(`Embed HTML · preview re-rendered\n${changes.join('\n')}`, 5000);
}
