import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

interface MockSettingInstance {
  addText: ReturnType<typeof vi.fn>;
  setDesc: (desc: unknown) => MockSettingInstance;
  setName: (name: string) => MockSettingInstance;
}

const settingInstances: MockSettingInstance[] = [];
const boundKeys: string[] = [];

const hoisted = vi.hoisted(() => {
  const instances: MockSettingInstance[] = [];
  const keys: string[] = [];

  class PluginSettingsTabBaseMock {
    public containerEl = {};

    public bind(_component: unknown, key: string): void {
      keys.push(key);
    }

    public display(): void {
      /* Base implementation */
    }
  }

  return { instances, keys, PluginSettingsTabBaseMock };
});

vi.mock('obsidian-dev-utils/obsidian/setting-ex', () => ({
  SettingEx: class MockSettingEx {
    public addText = vi.fn().mockImplementation(function addTextMock(this: MockSettingInstance, cb: (text: unknown) => void) {
      cb({ mockText: true });
      return this;
    });

    public setDesc = vi.fn().mockReturnThis();
    public setName = vi.fn().mockReturnThis();

    public constructor() {
      settingInstances.push(this as unknown as MockSettingInstance);
    }
  }
}));

vi.mock('obsidian-dev-utils/obsidian/plugin/plugin-settings-tab', () => ({
  PluginSettingsTabBase: hoisted.PluginSettingsTabBaseMock
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { PluginSettingsTab } from './plugin-settings-tab.ts';

describe('PluginSettingsTab', () => {
  it('should create width and height settings on display', () => {
    settingInstances.length = 0;

    globalThis.createFragment = vi.fn((cb?: (f: DocumentFragment) => void) => {
      const fragment = { appendText: vi.fn() } as unknown as DocumentFragment;
      cb?.(fragment);
      return fragment;
    });

    const tab = new PluginSettingsTab({ plugin: {}, pluginSettingsComponent: {} } as never);
    tab.display();

    const EXPECTED_SETTING_COUNT = 2;
    expect(settingInstances).toHaveLength(EXPECTED_SETTING_COUNT);
  });

  it('should set correct names for settings', () => {
    settingInstances.length = 0;

    globalThis.createFragment = vi.fn((cb?: (f: DocumentFragment) => void) => {
      const fragment = { appendText: vi.fn() } as unknown as DocumentFragment;
      cb?.(fragment);
      return fragment;
    });

    const tab = new PluginSettingsTab({ plugin: {}, pluginSettingsComponent: {} } as never);
    tab.display();

    expect(settingInstances.at(0)?.setName).toHaveBeenCalledWith('Default width');
    expect(settingInstances.at(1)?.setName).toHaveBeenCalledWith('Default height');
  });

  it('should bind defaultWidth and defaultHeight via addText callbacks', () => {
    settingInstances.length = 0;
    boundKeys.length = 0;
    hoisted.keys.length = 0;

    globalThis.createFragment = vi.fn((cb?: (f: DocumentFragment) => void) => {
      const fragment = { appendText: vi.fn() } as unknown as DocumentFragment;
      cb?.(fragment);
      return fragment;
    });

    const tab = new PluginSettingsTab({ plugin: {}, pluginSettingsComponent: {} } as never);
    tab.display();

    expect(hoisted.keys).toContain('defaultWidth');
    expect(hoisted.keys).toContain('defaultHeight');
  });
});
