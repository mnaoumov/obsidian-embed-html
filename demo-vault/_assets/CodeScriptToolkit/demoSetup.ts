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

/**
 * Edits the Embed HTML settings via the plugin's public settings component, then re-renders the
 * active preview. Embeds read the default size at render time and do not subscribe to settings
 * changes, so the re-render is what surfaces a changed default on already-open embeds.
 */
export async function editSettings(app: App, editor: SettingsEditor): Promise<void> {
  const plugin = app.plugins.getPlugin('embed-html');
  if (!plugin) {
    new Notice('Enable the Embed HTML plugin first');
    return;
  }
  await plugin.settingsComponent.editAndSave(editor);
  await rerenderActivePreview(app);
  new Notice('Embed HTML settings updated');
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
