import type {
  App as AppOriginal,
  Plugin
} from 'obsidian';
import type { GenericVoidFunction } from 'obsidian-dev-utils/function';
import type { PluginSettingsComponentBase } from 'obsidian-dev-utils/obsidian/components/plugin-settings-component';

import { noopAsync } from 'obsidian-dev-utils/function';
import { castTo } from 'obsidian-dev-utils/object-utils';
import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/plugin/plugin-settings-tab';
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
  // that the tab wires each text component to the correct setting key, so we stub its return value
  // (an allowed test double): the real test-mocks `TextComponent` is a strict proxy that throws on
  // the `setPlaceholderValue` duck-typing probe inside the real `bind`.
  vi.spyOn(PluginSettingsTabBase.prototype, 'bind').mockImplementation((params) => params.valueComponent);
});

describe('PluginSettingsTab', () => {
  it('should create width and height settings on display', () => {
    const tab = createTab();

    tab.displayLegacy();

    const EXPECTED_SETTING_COUNT = 2;
    expect(tab.containerEl.children).toHaveLength(EXPECTED_SETTING_COUNT);
  });

  it('should set correct names for settings', () => {
    const tab = createTab();

    tab.displayLegacy();

    expect(tab.containerEl.textContent).toContain('Default width');
    expect(tab.containerEl.textContent).toContain('Default height');
  });

  it('should bind defaultWidth and defaultHeight via addText callbacks', () => {
    const tab = createTab();

    tab.displayLegacy();

    const boundKeys = vi.mocked(PluginSettingsTabBase.prototype.bind).mock.calls.map((call) => call[0].propertyName);
    expect(boundKeys).toContain('defaultWidth');
    expect(boundKeys).toContain('defaultHeight');
  });
});

function createTab(): PluginSettingsTab {
  const plugin = strictProxy<Plugin>({
    app,
    manifest: { id: 'embed-html' }
  });
  const pluginSettingsComponent = createMockSettingsComponent();
  return new PluginSettingsTab({ plugin, pluginSettingsComponent });
}

function createMockSettingsComponent(): PluginSettingsComponentBase<PluginSettings> {
  return strictProxy<PluginSettingsComponentBase<PluginSettings>>({
    defaultSettings: new PluginSettings(),
    on: castTo<PluginSettingsComponentBase<PluginSettings>['on']>(vi.fn((_name: string, _callback: GenericVoidFunction) => ({
      asyncEventSource: {
        offref: vi.fn()
      }
    }))),
    revalidate: vi.fn(() => Promise.resolve({ defaultHeight: '', defaultWidth: '' })),
    saveToFile: vi.fn(() => noopAsync()),
    setProperty: vi.fn(() => Promise.resolve('')),
    settingsState: {
      effectiveValues: new PluginSettings(),
      inputValues: new PluginSettings(),
      validationMessages: { defaultHeight: '', defaultWidth: '' }
    }
  });
}
