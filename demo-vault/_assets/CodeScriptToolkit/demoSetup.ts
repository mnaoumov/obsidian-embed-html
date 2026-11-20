import type {
  App,
  Plugin
} from 'obsidian';

import {
  asCodeBlock,
  createFragmentWithCodeBlocks
} from '@mnaoumov/obsidian-lib/html-element';
import {
  MarkdownView,
  Notice
} from 'obsidian';

/**
 * The slice of the `Embed HTML` plugin the demo buttons use: its public settings component.
 */
interface EmbedHtmlPlugin extends Plugin {
  readonly pluginSettingsComponent: EmbedHtmlSettingsComponent;
}

/* eslint-disable typescript-dev-toolkit/readonly-interface-members -- The demo buttons' settings editors assign to these fields. */
/**
 * The `Embed HTML` plugin settings, mirrored here so the demo buttons get autocomplete and the notes
 * read as `settings.<name>`. The real definition lives in the plugin's `src/settings/plugin-settings.ts`.
 */
interface EmbedHtmlSettings {
  background: string;
  border: string;
  borderRadius: string;
  defaultHeight: string;
  defaultMaxHeight: string;
  defaultMaxWidth: string;
  defaultMinHeight: string;
  defaultMinWidth: string;
  defaultWidth: string;
  shouldOpenInNewTab: boolean;
  shouldShowOpenInExternalBrowserButton: boolean;
}
/* eslint-enable typescript-dev-toolkit/readonly-interface-members -- The demo buttons' settings editors assign to these fields. */

/**
 * The plugin's settings component, as far as the demo buttons use it.
 */
interface EmbedHtmlSettingsComponent {
  readonly editAndSave: (editor: SettingsEditor) => Promise<void>;
  readonly settings: EmbedHtmlSettings;
}

const PLUGIN_NAME = 'Embed HTML';

/**
 * How long the change toast stays up, in milliseconds.
 */
const NOTICE_DURATION_IN_MILLISECONDS = 5000;

type SettingsEditor = (settings: EmbedHtmlSettings) => void;

const DEFAULT_SETTINGS: EmbedHtmlSettings = {
  background: '',
  border: '',
  borderRadius: '',
  defaultHeight: '400px',
  defaultMaxHeight: '',
  defaultMaxWidth: '',
  defaultMinHeight: '',
  defaultMinWidth: '',
  defaultWidth: '100%',
  shouldOpenInNewTab: false,
  shouldShowOpenInExternalBrowserButton: true
};

/**
 * Human-readable labels for each setting, used in the change toast.
 */
const SETTING_LABELS: Record<keyof EmbedHtmlSettings, string> = {
  background: 'Background',
  border: 'Border',
  borderRadius: 'Border radius',
  defaultHeight: 'Default height',
  defaultMaxHeight: 'Default max height',
  defaultMaxWidth: 'Default max width',
  defaultMinHeight: 'Default min height',
  defaultMinWidth: 'Default min width',
  defaultWidth: 'Default width',
  shouldOpenInNewTab: 'Open in new tab',
  shouldShowOpenInExternalBrowserButton: 'Show open in external browser button'
};

/**
 * Edits the `Embed HTML` settings via the plugin's public settings component, then re-renders the
 * active preview. Embeds read the default size at render time and do not subscribe to settings
 * changes, so the re-render is what surfaces a changed default on already-open embeds.
 *
 * A toast reports exactly which settings changed and confirms the re-render, so it's clear which
 * button ran even after the note visibly rebuilds.
 */
export async function editSettings(app: App, editor: SettingsEditor): Promise<void> {
  const plugin = app.plugins.getPlugin('embed-html') as EmbedHtmlPlugin | null;
  if (!plugin) {
    new Notice(createFragmentWithCodeBlocks(`Enable the ${asCodeBlock(PLUGIN_NAME)} plugin first`));
    return;
  }
  const before = { ...plugin.pluginSettingsComponent.settings };
  await plugin.pluginSettingsComponent.editAndSave(editor);
  const changes = describeChanges(before, plugin.pluginSettingsComponent.settings);
  await rerenderActivePreview(app);
  notifyResult(changes);
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
 * Resets every `Embed HTML` setting back to its default and re-renders the active preview.
 */
export async function resetSettings(app: App): Promise<void> {
  await editSettings(app, (settings) => {
    Object.assign(settings, DEFAULT_SETTINGS);
  });
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

/**
 * Shows a toast summarizing the change(s) and the re-render, so the clicked button is obvious.
 */
function notifyResult(changes: string[]): void {
  if (changes.length === 0) {
    new Notice(
      createFragmentWithCodeBlocks(`${asCodeBlock(PLUGIN_NAME)} · already at these values, nothing changed · preview re-rendered`),
      NOTICE_DURATION_IN_MILLISECONDS
    );
    return;
  }
  new Notice(
    createFragmentWithCodeBlocks(`${asCodeBlock(PLUGIN_NAME)} · preview re-rendered\n${changes.join('\n')}`),
    NOTICE_DURATION_IN_MILLISECONDS
  );
}
