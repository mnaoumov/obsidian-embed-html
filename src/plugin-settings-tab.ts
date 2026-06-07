import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/plugin/plugin-settings-tab';
import { SettingEx } from 'obsidian-dev-utils/obsidian/setting-ex';

import type { PluginSettings } from './plugin-settings.ts';

export class PluginSettingsTab extends PluginSettingsTabBase<PluginSettings> {
  public override display(): void {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- super.display() calls the PluginSettingsTabBase override; the inherited @deprecated tag on Obsidian's SettingTab.display propagates via TS getJsDocTags.
    super.display();

    new SettingEx(this.containerEl)
      .setName('Default width')
      .setDesc(createFragment((f) => {
        f.appendText('The default width of the embedded HTML file, if not specified.');
      }))
      .addText((text) => {
        this.bind(text, 'defaultWidth');
      });

    new SettingEx(this.containerEl)
      .setName('Default height')
      .setDesc(createFragment((f) => {
        f.appendText('The default height of the embedded HTML file, if not specified.');
      }))
      .addText((text) => {
        this.bind(text, 'defaultHeight');
      });
  }
}
