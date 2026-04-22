import type { RegisterComponentParams } from 'obsidian-dev-utils/obsidian/plugin/plugin';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

const registeredComponents: RegisterComponentParams[] = [];

const PluginBaseMock = vi.hoisted(() =>
  class {
    public app: unknown;
    public manifest: unknown;

    public constructor(app: unknown, manifest: unknown) {
      this.app = app;
      this.manifest = manifest;
    }

    public registerView(_type: string, _factory: unknown): void {
      // noop
    }

    protected registerComponent(params: RegisterComponentParams): unknown {
      registeredComponents.push(params);
      return params.component;
    }
  }
);

vi.mock('obsidian-dev-utils/obsidian/plugin/plugin', () => ({
  PluginBase: PluginBaseMock
}));

vi.mock('obsidian-dev-utils/obsidian/plugin/components/plugin-settings-tab-component', () => ({
  PluginSettingsTabComponent: class MockPluginSettingsTabComponent {
    public constructor(public plugin: unknown, public tab: unknown) {}
  }
}));

vi.mock('obsidian-dev-utils/obsidian/plugin/components/plugin-settings-component', () => ({
  PluginSettingsComponentBase: class MockPluginSettingsComponentBase {}
}));

vi.mock('obsidian-dev-utils/obsidian/plugin/plugin-settings-tab', () => ({
  PluginSettingsTabBase: class MockPluginSettingsTabBase {}
}));

vi.mock('obsidian-dev-utils/obsidian/setting-ex', () => ({
  SettingEx: vi.fn()
}));

vi.mock('obsidian', () => ({
  Component: class MockComponent {
    public register(): void {
      // noop
    }

    public registerDomEvent(): void {
      // noop
    }
  },
  FileView: class MockFileView {},
  TFile: vi.fn(),
  WorkspaceLeaf: vi.fn()
}));

vi.mock('obsidian-dev-utils/async', () => ({
  invokeAsyncSafely: vi.fn()
}));

vi.mock('obsidian-dev-utils/string', () => ({
  trimStart: vi.fn((s: string) => s)
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { Plugin } from './plugin.ts';

describe('Plugin', () => {
  it('should register all four components', () => {
    registeredComponents.length = 0;
    const mockApp = {
      embedRegistry: {
        registerExtensions: vi.fn(),
        unregisterExtensions: vi.fn()
      },
      viewRegistry: {
        registerExtensions: vi.fn(),
        unregisterExtensions: vi.fn()
      }
    };
    const mockManifest = { id: 'embed-html' };

    new Plugin(mockApp as never, mockManifest as never);

    const EXPECTED_COMPONENT_COUNT = 4;
    expect(registeredComponents).toHaveLength(EXPECTED_COMPONENT_COUNT);
  });

  it('should register PluginSettingsComponent with shouldPreload true', () => {
    registeredComponents.length = 0;
    const mockApp = {
      embedRegistry: {
        registerExtensions: vi.fn(),
        unregisterExtensions: vi.fn()
      },
      viewRegistry: {
        registerExtensions: vi.fn(),
        unregisterExtensions: vi.fn()
      }
    };
    const mockManifest = { id: 'embed-html' };

    new Plugin(mockApp as never, mockManifest as never);

    const settingsComponent = registeredComponents.at(0);
    expect(settingsComponent?.shouldPreload).toBe(true);
  });
});
