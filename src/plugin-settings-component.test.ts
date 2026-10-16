import type { DataHandler } from '@mnaoumov/obsidian-lib/data-handler';
import type { PluginEventSource } from '@mnaoumov/obsidian-lib/plugin/plugin-event-source';
import type { AsyncEventRef } from '@mnaoumov/typescript-lib/async-events';

import { PluginSettingsComponentBase } from '@mnaoumov/obsidian-lib/components/plugin-settings-component';
import {
  noop,
  noopAsync
} from '@mnaoumov/typescript-lib/function';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
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
    // here proves the subclass forwarded `pluginSettingsClass: PluginSettings` to the real base.
    expect(component).toBeInstanceOf(PluginSettingsComponentBase);
    expect(component.defaultSettings).toEqual(new PluginSettings());
    expect(component.settings).toEqual(new PluginSettings());
  });
});

function createMockPluginEventSource(): PluginEventSource {
  const source: PluginEventSource = strictProxy<PluginEventSource>({
    offref: noop,
    on(name: string, callback: () => void, thisArgument?: unknown): AsyncEventRef {
      return { asyncEventSource: source, callback, name, thisArgument };
    }
  });
  return source;
}
