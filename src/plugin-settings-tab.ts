import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/plugin/plugin-settings-tab';
import { SettingEx } from 'obsidian-dev-utils/obsidian/setting-ex';

import type { PluginSettings } from './plugin-settings.ts';

export class PluginSettingsTab extends PluginSettingsTabBase<PluginSettings> {
  public override display(): void {
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
