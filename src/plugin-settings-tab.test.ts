import type {
  App as AppOriginal,
  Plugin,
  SettingDefinition,
  SettingGroup
} from 'obsidian';
import type { GenericVoidFunction } from 'obsidian-dev-utils/function';
import type { PluginSettingsComponentBase } from 'obsidian-dev-utils/obsidian/components/plugin-settings-component';

import { noopAsync } from 'obsidian-dev-utils/function';
import { castTo } from 'obsidian-dev-utils/object-utils';
import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/plugin/plugin-settings-tab';
import { SettingEx } from 'obsidian-dev-utils/obsidian/setting-ex';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { PluginSettingsTab } from './plugin-settings-tab.ts';
import { PluginSettings } from './plugin-settings.ts';

let app: AppOriginal;

beforeEach(() => {
  vi.restoreAllMocks();
  app = App.createConfigured__().asOriginalType__();
  // The real `bind` is exercised by `obsidian-dev-utils`'s own tests. Here we only need to observe
  // That the tab wires each text component to the correct setting key, so we stub its return value
  // (an allowed test double): the real test-mocks `TextComponent` is a strict proxy that throws on
  // The `setPlaceholderValue` duck-typing probe inside the real `bind`.
  vi.spyOn(PluginSettingsTabBase.prototype, 'bind').mockImplementation((params) => params.valueComponent);
});

describe('PluginSettingsTab', () => {
  it('should declare a width group, a height group, an appearance group, and a behavior group', () => {
    const tab = createTab();

    const headings = tab.getSettingDefinitions().map((item) => 'heading' in item ? item.heading : '');

    const EXPECTED_GROUP_COUNT = 4;
    expect(headings).toHaveLength(EXPECTED_GROUP_COUNT);
    expect(headings).toContain('Width');
    expect(headings).toContain('Height');
    expect(headings).toContain('Appearance');
    expect(headings).toContain('Behavior');
  });

  it('should set correct names for settings', () => {
    const tab = createTab();

    const names = collectRows(tab).map((row) => 'name' in row ? row.name : '');

    expect(names).toContain('Default width');
    expect(names).toContain('Default min width');
    expect(names).toContain('Default max width');
    expect(names).toContain('Default height');
    expect(names).toContain('Default min height');
    expect(names).toContain('Default max height');
    expect(names).toContain('Border');
    expect(names).toContain('Border radius');
    expect(names).toContain('Background');
    expect(names).toContain('Open in new tab');
  });

  it('should bind every setting via its value component callback', () => {
    const tab = createTab();

    renderRows(tab);

    const boundKeys = vi.mocked(PluginSettingsTabBase.prototype.bind).mock.calls.map((call) => call[0].propertyName);
    expect(boundKeys).toContain('defaultWidth');
    expect(boundKeys).toContain('defaultMinWidth');
    expect(boundKeys).toContain('defaultMaxWidth');
    expect(boundKeys).toContain('defaultHeight');
    expect(boundKeys).toContain('defaultMinHeight');
    expect(boundKeys).toContain('defaultMaxHeight');
    expect(boundKeys).toContain('border');
    expect(boundKeys).toContain('borderRadius');
    expect(boundKeys).toContain('background');
    expect(boundKeys).toContain('shouldOpenInNewTab');
  });
});

type EmptyStringRecord = {
  [Key in keyof PluginSettings]: string;
};

/**
 * Flattens the declared items into the rows they contain, unwrapping the groups.
 *
 * @param tab - The settings tab.
 * @returns The declared rows.
 */
function collectRows(tab: PluginSettingsTab): SettingDefinition[] {
  const rows: SettingDefinition[] = [];
  for (const item of tab.getSettingDefinitions()) {
    if ('items' in item) {
      rows.push(...castTo<SettingDefinition[]>(item.items ?? []));
    } else {
      rows.push(castTo<SettingDefinition>(item));
    }
  }

  return rows;
}

function createMockSettingsComponent(): PluginSettingsComponentBase<PluginSettings> {
  return strictProxy<PluginSettingsComponentBase<PluginSettings>>({
    defaultSettings: new PluginSettings(),
    on: castTo<PluginSettingsComponentBase<PluginSettings>['on']>(vi.fn((_name: string, _callback: GenericVoidFunction) => ({
      asyncEventSource: {
        offref: vi.fn()
      }
    }))),
    revalidate: vi.fn(() => Promise.resolve(emptyStringRecord())),
    saveToFile: vi.fn(() => noopAsync()),
    setProperty: vi.fn(() => Promise.resolve('')),
    settingsState: {
      effectiveValues: new PluginSettings(),
      inputValues: new PluginSettings(),
      validationMessages: emptyStringRecord()
    }
  });
}

function createTab(): PluginSettingsTab {
  const plugin = strictProxy<Plugin>({
    app,
    manifest: { id: 'embed-html' }
  });
  const pluginSettingsComponent = createMockSettingsComponent();
  return new PluginSettingsTab({ plugin, pluginSettingsComponent });
}

function emptyStringRecord(): EmptyStringRecord {
  return {
    background: '',
    border: '',
    borderRadius: '',
    defaultHeight: '',
    defaultMaxHeight: '',
    defaultMaxWidth: '',
    defaultMinHeight: '',
    defaultMinWidth: '',
    defaultWidth: '',
    shouldOpenInNewTab: '',
    shouldOpenInSystemBrowser: ''
  };
}

/**
 * Invokes every declared row's `render` callback the way Obsidian does when the tab is opened, so the
 * bindings are still exercised now that the rows are declarative.
 *
 * @param tab - The settings tab.
 */
function renderRows(tab: PluginSettingsTab): void {
  for (const row of collectRows(tab)) {
    if ('render' in row) {
      row.render(new SettingEx(tab.containerEl), castTo<SettingGroup>(null));
    }
  }
}
