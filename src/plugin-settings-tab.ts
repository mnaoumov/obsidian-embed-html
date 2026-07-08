import type { SettingEx } from 'obsidian-dev-utils/obsidian/setting-ex';

import { appendCodeBlock } from 'obsidian-dev-utils/obsidian/html-element';
import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/plugin/plugin-settings-tab';
import { SettingGroupEx } from 'obsidian-dev-utils/obsidian/setting-group-ex';

import type { PluginSettings } from './plugin-settings.ts';

export class PluginSettingsTab extends PluginSettingsTabBase<PluginSettings> {
  public override displayLegacy(): void {
    super.displayLegacy();

    new SettingGroupEx(this.containerEl)
      .setHeading('Width')
      .addSettingEx((setting) => {
        this.bindSizeSetting(setting, 'Default width', 'defaultWidth', (f) => {
          appendDefaultDesc(f, 'width');
        });
      })
      .addSettingEx((setting) => {
        this.bindSizeSetting(setting, 'Default min width', 'defaultMinWidth', (f) => {
          appendClampDesc(f, 'lower', 'width');
        });
      })
      .addSettingEx((setting) => {
        this.bindSizeSetting(setting, 'Default max width', 'defaultMaxWidth', (f) => {
          appendClampDesc(f, 'upper', 'width');
        });
      });

    new SettingGroupEx(this.containerEl)
      .setHeading('Height')
      .addSettingEx((setting) => {
        this.bindSizeSetting(setting, 'Default height', 'defaultHeight', (f) => {
          appendDefaultDesc(f, 'height');
        });
      })
      .addSettingEx((setting) => {
        this.bindSizeSetting(setting, 'Default min height', 'defaultMinHeight', (f) => {
          appendClampDesc(f, 'lower', 'height');
        });
      })
      .addSettingEx((setting) => {
        this.bindSizeSetting(setting, 'Default max height', 'defaultMaxHeight', (f) => {
          appendClampDesc(f, 'upper', 'height');
        });
      });
  }

  private bindSizeSetting(
    setting: SettingEx,
    name: string,
    propertyName: keyof PluginSettings,
    descBuilder: (f: DocumentFragment) => void
  ): void {
    setting
      .setName(name)
      .setDesc(createFragment(descBuilder))
      .addText((text) => {
        this.bind({ propertyName, valueComponent: text });
      });
  }
}

function appendClampDesc(f: DocumentFragment, bound: 'lower' | 'upper', axis: 'height' | 'width'): void {
  f.appendText(`Optional ${bound} bound for the embed ${axis}, if not specified per embed. Leave empty for none.`);
}

function appendDefaultDesc(f: DocumentFragment, axis: 'height' | 'width'): void {
  f.appendText(`The default ${axis} of the embedded HTML file, if not specified. `);
  f.appendText('Accepts any CSS length (e.g. ');
  appendCodeBlock(f, axis === 'width' ? '100%' : '400px');
  f.appendText(') or a content keyword (');
  appendCodeBlock(f, 'max-content');
  f.appendText(', ');
  appendCodeBlock(f, 'min-content');
  f.appendText(', ');
  appendCodeBlock(f, 'fit-content');
  f.appendText(') to fit the embed to its content.');
}
