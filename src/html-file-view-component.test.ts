import type { App } from 'obsidian';

import { noop } from 'obsidian-dev-utils/function';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { HtmlExtensions } from './html-extensions.ts';
import type { PluginSettingsComponent } from './plugin-settings-component.ts';
import type { Plugin } from './plugin.ts';

const registerCallbacks: (() => void)[] = [];

const ComponentMock = vi.hoisted(() =>
  class {
    public register(cb: () => void): void {
      registerCallbacks.push(cb);
    }

    public onload(): void {
      noop();
    }
  }
);

const FileViewMock = vi.hoisted(() =>
  class {
    public static readonly VIEW_TYPE = 'html-file-view';
  }
);

vi.mock('obsidian', () => ({
  Component: ComponentMock,
  FileView: FileViewMock,
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
import { HtmlFileViewComponent } from './html-file-view-component.ts';

describe('HtmlFileViewComponent', () => {
  it('should register extensions and view on load', () => {
    registerCallbacks.length = 0;
    const mockRegisterExtensions = vi.fn();
    const mockUnregisterExtensions = vi.fn();
    const mockRegisterView = vi.fn();
    const mockApp = strictProxy<App>({
      viewRegistry: strictProxy<App['viewRegistry']>({
        registerExtensions: mockRegisterExtensions,
        unregisterExtensions: mockUnregisterExtensions
      })
    });
    const mockPlugin = strictProxy<Plugin>({
      registerView: mockRegisterView
    });
    const mockPluginSettingsComponent = strictProxy<PluginSettingsComponent>({});
    const mockHtmlExtensions = strictProxy<HtmlExtensions>({
      list: vi.fn().mockReturnValue(['htm', 'html'])
    });

    const component = new HtmlFileViewComponent(
      mockApp,
      mockPlugin,
      mockPluginSettingsComponent,
      mockHtmlExtensions
    );

    component.onload();

    expect(mockRegisterExtensions).toHaveBeenCalledWith(['htm', 'html'], 'html-file-view');
    expect(mockRegisterView).toHaveBeenCalledWith('html-file-view', expect.any(Function));
  });

  it('should register cleanup that unregisters extensions', () => {
    registerCallbacks.length = 0;
    const mockUnregisterExtensions = vi.fn();
    const mockApp = strictProxy<App>({
      viewRegistry: strictProxy<App['viewRegistry']>({
        registerExtensions: vi.fn(),
        unregisterExtensions: mockUnregisterExtensions
      })
    });
    const mockPlugin = strictProxy<Plugin>({
      registerView: vi.fn()
    });
    const mockPluginSettingsComponent = strictProxy<PluginSettingsComponent>({});
    const mockHtmlExtensions = strictProxy<HtmlExtensions>({
      list: vi.fn().mockReturnValue(['htm', 'html'])
    });

    const component = new HtmlFileViewComponent(
      mockApp,
      mockPlugin,
      mockPluginSettingsComponent,
      mockHtmlExtensions
    );

    component.onload();

    expect(registerCallbacks).toHaveLength(1);
    registerCallbacks.at(0)?.();

    expect(mockUnregisterExtensions).toHaveBeenCalledWith(['htm', 'html']);
  });

  it('should create HtmlFileView from view factory', () => {
    registerCallbacks.length = 0;
    const mockRegisterView = vi.fn();
    const mockApp = strictProxy<App>({
      viewRegistry: strictProxy<App['viewRegistry']>({
        registerExtensions: vi.fn(),
        unregisterExtensions: vi.fn()
      })
    });
    const mockPlugin = strictProxy<Plugin>({
      registerView: mockRegisterView
    });
    const mockPluginSettingsComponent = strictProxy<PluginSettingsComponent>({});
    const mockHtmlExtensions = strictProxy<HtmlExtensions>({
      list: vi.fn().mockReturnValue(['html'])
    });

    const component = new HtmlFileViewComponent(
      mockApp,
      mockPlugin,
      mockPluginSettingsComponent,
      mockHtmlExtensions
    );

    component.onload();

    const viewFactory = mockRegisterView.mock.calls.at(0)?.[1] as (leaf: unknown) => unknown;
    const mockLeaf = { app: mockApp };
    const result = viewFactory(mockLeaf);

    expect(result).toBeDefined();
  });
});
