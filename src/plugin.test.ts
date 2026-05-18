import { noop } from 'obsidian-dev-utils/function';
import {
  describe,
  it,
  vi
} from 'vitest';

const PluginBaseMock = vi.hoisted(() =>
  class {
    public app: unknown;
    public manifest: unknown;

    public constructor(app: unknown, manifest: unknown) {
      this.app = app;
      this.manifest = manifest;
    }

    public addChild<T>(child: T): T {
      return child;
    }

    public registerView(_type: string, _factory: unknown): void {
      noop();
    }
  }
);

vi.mock('obsidian-dev-utils/obsidian/plugin/plugin', () => ({
  PluginBase: PluginBaseMock
}));

vi.mock('obsidian-dev-utils/obsidian/components/plugin-settings-tab-component', () => ({
  PluginSettingsTabComponent: class MockPluginSettingsTabComponent {
    public constructor(public plugin: unknown, public tab: unknown) {}
  }
}));

vi.mock('obsidian-dev-utils/obsidian/components/plugin-settings-component', () => ({
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
      noop();
    }

    public registerDomEvent(): void {
      noop();
    }
  },
  FileView: class MockFileView {},
  TFile: vi.fn(),
  WorkspaceLeaf: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/data-handler', () => ({
  PluginDataHandler: class MockPluginDataHandler {}
}));

vi.mock('obsidian-dev-utils/async', () => ({
  invokeAsyncSafely: vi.fn()
}));

vi.mock('obsidian-dev-utils/string', () => ({
  trimStart: vi.fn((s: string) => s)
}));

vi.mock('./html-embed-registry-component.ts', () => ({
  HtmlEmbedRegistryComponent: class MockHtmlEmbedRegistryComponent {}
}));

vi.mock('./html-file-view-component.ts', () => ({
  HtmlFileViewComponent: class MockHtmlFileViewComponent {}
}));

vi.mock('./html-extensions.ts', () => ({
  HtmlExtensions: class MockHtmlExtensions {}
}));

vi.mock('./plugin-settings-component.ts', () => ({
  PluginSettingsComponent: class MockPluginSettingsComponent {}
}));

vi.mock('./plugin-settings-tab.ts', () => ({
  PluginSettingsTab: class MockPluginSettingsTab {}
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { Plugin } from './plugin.ts';

describe('Plugin', () => {
  it('should register all four components', () => {
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
  });

  it('should register PluginSettingsComponent with shouldPreload true', () => {
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
  });
});
