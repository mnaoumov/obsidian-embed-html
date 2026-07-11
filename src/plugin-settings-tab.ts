import type { SettingEx } from 'obsidian-dev-utils/obsidian/setting-ex';

import { appendCodeBlock } from 'obsidian-dev-utils/obsidian/html-element';
import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/plugin/plugin-settings-tab';
import { SettingGroupEx } from 'obsidian-dev-utils/obsidian/setting-group-ex';

import type { PluginSettings } from './plugin-settings.ts';

interface AppendClampDescParams {
  readonly axis: 'height' | 'width';
  readonly bound: 'lower' | 'upper';
  readonly f: DocumentFragment;
}

interface PluginSettingsTabBindSizeSettingParams {
  descBuilder(this: void, f: DocumentFragment): void;
  readonly name: string;
  readonly propertyName: keyof PluginSettings;
  readonly setting: SettingEx;
}

export class PluginSettingsTab extends PluginSettingsTabBase<PluginSettings> {
  public override displayLegacy(): void {
    super.displayLegacy();

    new SettingGroupEx(this.containerEl)
      .setHeading('Width')
      .addSettingEx((setting) => {
        this.bindSizeSetting({
          descBuilder: (f) => {
            appendDefaultDesc(f, 'width');
          },
          name: 'Default width',
          propertyName: 'defaultWidth',
          setting
        });
      })
      .addSettingEx((setting) => {
        this.bindSizeSetting({
          descBuilder: (f) => {
            appendClampDesc({ axis: 'width', bound: 'lower', f });
          },
          name: 'Default min width',
          propertyName: 'defaultMinWidth',
          setting
        });
      })
      .addSettingEx((setting) => {
        this.bindSizeSetting({
          descBuilder: (f) => {
            appendClampDesc({ axis: 'width', bound: 'upper', f });
          },
          name: 'Default max width',
          propertyName: 'defaultMaxWidth',
          setting
        });
      });

    new SettingGroupEx(this.containerEl)
      .setHeading('Height')
      .addSettingEx((setting) => {
        this.bindSizeSetting({
          descBuilder: (f) => {
            appendDefaultDesc(f, 'height');
          },
          name: 'Default height',
          propertyName: 'defaultHeight',
          setting
        });
      })
      .addSettingEx((setting) => {
        this.bindSizeSetting({
          descBuilder: (f) => {
            appendClampDesc({ axis: 'height', bound: 'lower', f });
          },
          name: 'Default min height',
          propertyName: 'defaultMinHeight',
          setting
        });
      })
      .addSettingEx((setting) => {
        this.bindSizeSetting({
          descBuilder: (f) => {
            appendClampDesc({ axis: 'height', bound: 'upper', f });
          },
          name: 'Default max height',
          propertyName: 'defaultMaxHeight',
          setting
        });
      });
  }

  private bindSizeSetting(params: PluginSettingsTabBindSizeSettingParams): void {
    const { descBuilder, name, propertyName, setting } = params;
    setting
      .setName(name)
      .setDesc(createFragment(descBuilder))
      .addText((text) => {
        this.bind({ propertyName, valueComponent: text });
      });
  }
}

function appendClampDesc(params: AppendClampDescParams): void {
  const { axis, bound, f } = params;
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
