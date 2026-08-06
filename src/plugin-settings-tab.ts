import type {
  SettingDefinitionItem,
  SettingDefinitionRender
} from 'obsidian';

import { appendCodeBlock } from 'obsidian-dev-utils/obsidian/html-element';
import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/plugin/plugin-settings-tab';

import type { PluginSettings } from './plugin-settings.ts';

interface AppendClampDescParams {
  readonly axis: 'height' | 'width';
  readonly bound: 'lower' | 'upper';
  readonly f: DocumentFragment;
}

interface PluginSettingsTabSizeSettingExParams {
  descBuilder(this: void, f: DocumentFragment): void;
  readonly name: string;
  readonly propertyName: SizeSettingKey;
}

type SizeSettingKey = StringValuedKeys[keyof PluginSettings];

type StringValuedKeys = {
  [Key in keyof PluginSettings]: PluginSettings[Key] extends string ? Key : never;
};

export class PluginSettingsTab extends PluginSettingsTabBase<PluginSettings> {
  protected override getSettingDefinitionItems(): SettingDefinitionItem[] {
    return [
      this.settingGroupEx({
        heading: 'Width',
        items: [
          this.sizeSettingEx({
            descBuilder: (f) => {
              appendDefaultDesc(f, 'width');
            },
            name: 'Default width',
            propertyName: 'defaultWidth'
          }),
          this.sizeSettingEx({
            descBuilder: (f) => {
              appendClampDesc({ axis: 'width', bound: 'lower', f });
            },
            name: 'Default min width',
            propertyName: 'defaultMinWidth'
          }),
          this.sizeSettingEx({
            descBuilder: (f) => {
              appendClampDesc({ axis: 'width', bound: 'upper', f });
            },
            name: 'Default max width',
            propertyName: 'defaultMaxWidth'
          })
        ]
      }),
      this.settingGroupEx({
        heading: 'Height',
        items: [
          this.sizeSettingEx({
            descBuilder: (f) => {
              appendDefaultDesc(f, 'height');
            },
            name: 'Default height',
            propertyName: 'defaultHeight'
          }),
          this.sizeSettingEx({
            descBuilder: (f) => {
              appendClampDesc({ axis: 'height', bound: 'lower', f });
            },
            name: 'Default min height',
            propertyName: 'defaultMinHeight'
          }),
          this.sizeSettingEx({
            descBuilder: (f) => {
              appendClampDesc({ axis: 'height', bound: 'upper', f });
            },
            name: 'Default max height',
            propertyName: 'defaultMaxHeight'
          })
        ]
      }),
      this.settingGroupEx({
        heading: 'Appearance',
        items: [
          this.sizeSettingEx({
            descBuilder: appendBorderDesc,
            name: 'Border',
            propertyName: 'border'
          }),
          this.sizeSettingEx({
            descBuilder: appendBorderRadiusDesc,
            name: 'Border radius',
            propertyName: 'borderRadius'
          }),
          this.sizeSettingEx({
            descBuilder: appendBackgroundDesc,
            name: 'Background',
            propertyName: 'background'
          })
        ]
      }),
      this.settingGroupEx({
        heading: 'Behavior',
        items: [
          this.settingEx({
            desc: createFragment((f) => {
              f.appendText('When enabled, opening an HTML file puts it in a new tab instead of replacing the current one.');
            }),
            name: 'Open in new tab',
            render: (setting) => {
              setting.addToggle((toggle) => {
                this.bind({ propertyName: 'shouldOpenInNewTab', valueComponent: toggle });
              });
            }
          }),
          this.settingEx({
            desc: createFragment((f) => {
              f.appendText('When enabled, renders a button to open the HTML file in the system\'s default browser. This is only available on desktop platforms.');
            }),
            name: 'Show "Open in external browser" button (Desktop only)',
            render: (setting) => {
              setting.addToggle((toggle) => {
                this.bind({ propertyName: 'shouldShowOpenInExternalBrowserButton', valueComponent: toggle });
              });
            }
          })
        ]
      })
    ];
  }

  private sizeSettingEx(params: PluginSettingsTabSizeSettingExParams): SettingDefinitionRender {
    const { descBuilder, name, propertyName } = params;
    return this.settingEx({
      desc: createFragment(descBuilder),
      name,
      render: (setting) => {
        setting.addText((text) => {
          this.bind({ propertyName, valueComponent: text });
        });
      }
    });
  }
}

function appendBackgroundDesc(f: DocumentFragment): void {
  f.appendText('Optional background for the embed box, applied behind the HTML content. Accepts any CSS ');
  appendCodeBlock(f, 'background');
  f.appendText(' value (e.g. ');
  appendCodeBlock(f, 'var(--background-primary)');
  f.appendText('). Leave empty for none.');
}

function appendBorderDesc(f: DocumentFragment): void {
  f.appendText('Optional border drawn around the embed. Accepts any CSS ');
  appendCodeBlock(f, 'border');
  f.appendText(' shorthand (e.g. ');
  appendCodeBlock(f, '1px solid var(--background-modifier-border)');
  f.appendText('). Leave empty for none.');
}

function appendBorderRadiusDesc(f: DocumentFragment): void {
  f.appendText('Optional corner rounding for the embed. Accepts any CSS ');
  appendCodeBlock(f, 'border-radius');
  f.appendText(' value (e.g. ');
  appendCodeBlock(f, '8px');
  f.appendText('); a bare number is treated as pixels. Leave empty for square corners.');
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
