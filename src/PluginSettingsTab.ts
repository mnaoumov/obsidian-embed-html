import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/plugin/plugin-settings-tab-base';
import { SettingEx } from 'obsidian-dev-utils/obsidian/setting-ex';

import type { PluginTypes } from './PluginTypes.ts';

export class PluginSettingsTab extends PluginSettingsTabBase<PluginTypes> {
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
