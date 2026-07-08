import type { AsyncEventRef } from 'obsidian-dev-utils/async-events';
import type { DataHandler } from 'obsidian-dev-utils/obsidian/data-handler';
import type { PluginEventSource } from 'obsidian-dev-utils/obsidian/plugin/plugin-event-source';

import {
  noop,
  noopAsync
} from 'obsidian-dev-utils/function';
import { PluginSettingsComponentBase } from 'obsidian-dev-utils/obsidian/components/plugin-settings-component';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { PluginSettings } from './plugin-settings.ts';

describe('PluginSettingsComponent', () => {
  it('should pass dataHandler, pluginEventSource and the PluginSettings class to the base', () => {
    const dataHandler = strictProxy<DataHandler>({
      loadData: vi.fn(() => Promise.resolve({})),
      saveData: vi.fn(() => noopAsync())
    });

    const component = new PluginSettingsComponent({
      dataHandler,
      pluginEventSource: createMockPluginEventSource()
    });

    // Real base + the PluginSettings class is what produces the default settings shape, so equality
    // Here proves the subclass forwarded `pluginSettingsClass: PluginSettings` to the real base.
    expect(component).toBeInstanceOf(PluginSettingsComponentBase);
    expect(component.defaultSettings).toEqual(new PluginSettings());
    expect(component.settings).toEqual(new PluginSettings());
  });
});

function createMockPluginEventSource(): PluginEventSource {
  const source: PluginEventSource = strictProxy<PluginEventSource>({
    offref: noop,
    on(name: string, callback: () => void, thisArg?: unknown): AsyncEventRef {
      return { asyncEventSource: source, callback, name, thisArg };
    }
  });
  return source;
}
