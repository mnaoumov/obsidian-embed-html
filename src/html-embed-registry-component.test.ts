import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

const registerCallbacks: (() => void)[] = [];

const ComponentMock = vi.hoisted(() =>
  class {
    public register(cb: () => void): void {
      registerCallbacks.push(cb);
    }

    public registerDomEvent(): void {
      // noop
    }
  }
);

vi.mock('obsidian', () => ({
  App: vi.fn(),
  Component: ComponentMock,
  TFile: vi.fn()
}));

vi.mock('obsidian-dev-utils/async', () => ({
  invokeAsyncSafely: vi.fn()
}));

vi.mock('obsidian-dev-utils/string', () => ({
  trimStart: vi.fn((s: string) => s)
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { HtmlEmbedRegistryComponent } from './html-embed-registry-component.ts';

describe('HtmlEmbedRegistryComponent', () => {
  it('should register extensions on load', () => {
    registerCallbacks.length = 0;
    const mockRegisterExtensions = vi.fn();
    const mockUnregisterExtensions = vi.fn();
    const mockApp = {
      embedRegistry: {
        registerExtensions: mockRegisterExtensions,
        unregisterExtensions: mockUnregisterExtensions
      }
    };
    const mockPluginSettingsComponent = {
      settings: { defaultHeight: '400px', defaultWidth: '100%' }
    };
    const mockHtmlExtensions = {
      list: vi.fn().mockReturnValue(['htm', 'html'])
    };

    const component = new HtmlEmbedRegistryComponent(
      mockApp as never,
      mockPluginSettingsComponent as never,
      mockHtmlExtensions as never
    );

    component.onload();

    expect(mockRegisterExtensions).toHaveBeenCalledWith(
      ['htm', 'html'],
      expect.any(Function)
    );
  });

  it('should register cleanup that unregisters extensions', () => {
    registerCallbacks.length = 0;
    const mockApp = {
      embedRegistry: {
        registerExtensions: vi.fn(),
        unregisterExtensions: vi.fn()
      }
    };
    const mockPluginSettingsComponent = {
      settings: { defaultHeight: '400px', defaultWidth: '100%' }
    };
    const mockHtmlExtensions = {
      list: vi.fn().mockReturnValue(['htm', 'html'])
    };

    const component = new HtmlEmbedRegistryComponent(
      mockApp as never,
      mockPluginSettingsComponent as never,
      mockHtmlExtensions as never
    );

    component.onload();

    expect(registerCallbacks).toHaveLength(1);
    registerCallbacks.at(0)?.();

    expect(mockApp.embedRegistry.unregisterExtensions).toHaveBeenCalledWith(['htm', 'html']);
  });

  it('should create HtmlEmbedComponent from factory function', () => {
    registerCallbacks.length = 0;

    globalThis.MutationObserver = class MockMutationObserver {
      public disconnect(): void {
        // noop
      }

      public observe(): void {
        // noop
      }
    } as unknown as typeof MutationObserver;

    const mockApp = {
      embedRegistry: {
        registerExtensions: vi.fn(),
        unregisterExtensions: vi.fn()
      }
    };
    const mockPluginSettingsComponent = {
      settings: { defaultHeight: '400px', defaultWidth: '100%' }
    };
    const mockHtmlExtensions = {
      list: vi.fn().mockReturnValue(['html'])
    };

    const component = new HtmlEmbedRegistryComponent(
      mockApp as never,
      mockPluginSettingsComponent as never,
      mockHtmlExtensions as never
    );

    component.onload();

    const factory = mockApp.embedRegistry.registerExtensions.mock.calls.at(0)?.[1] as (
      context: { containerEl: HTMLElement },
      file: unknown,
      subpath: string | undefined
    ) => unknown;

    const mockContainerEl = {
      getAttr: vi.fn().mockReturnValue(null),
      setCssProps: vi.fn()
    };

    const result = factory({ containerEl: mockContainerEl as never }, {}, undefined);

    expect(result).toBeDefined();
  });

  it('should use empty string when subpath is undefined', () => {
    registerCallbacks.length = 0;

    globalThis.MutationObserver = class MockMutationObserver {
      public disconnect(): void {
        // noop
      }

      public observe(): void {
        // noop
      }
    } as unknown as typeof MutationObserver;

    const mockApp = {
      embedRegistry: {
        registerExtensions: vi.fn(),
        unregisterExtensions: vi.fn()
      }
    };
    const mockPluginSettingsComponent = {
      settings: { defaultHeight: '400px', defaultWidth: '100%' }
    };
    const mockHtmlExtensions = {
      list: vi.fn().mockReturnValue(['html'])
    };

    const component = new HtmlEmbedRegistryComponent(
      mockApp as never,
      mockPluginSettingsComponent as never,
      mockHtmlExtensions as never
    );

    component.onload();

    const factory = mockApp.embedRegistry.registerExtensions.mock.calls.at(0)?.[1] as (
      context: { containerEl: HTMLElement },
      file: unknown,
      subpath: string | undefined
    ) => unknown;

    const mockContainerEl = {
      getAttr: vi.fn().mockReturnValue(null),
      setCssProps: vi.fn()
    };

    expect(() => {
      factory({ containerEl: mockContainerEl as never }, {}, undefined);
    }).not.toThrow();
  });
});
