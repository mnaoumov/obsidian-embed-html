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
  rerenderActivePreview(app);
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
 * Forces the active Markdown preview to re-render so embeds re-read the current default size.
 */
export function rerenderActivePreview(app: App): void {
  const view = app.workspace.getActiveViewOfType(MarkdownView);
  view?.previewMode.rerender(true);
}
