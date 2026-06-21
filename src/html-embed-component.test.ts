import type {
  App,
  TFile
} from 'obsidian';

import { noop } from 'obsidian-dev-utils/function';
import { castTo } from 'obsidian-dev-utils/object-utils';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { PluginSettingsComponent } from './plugin-settings-component.ts';

import { HtmlEmbedComponent } from './html-embed-component.ts';

interface MockElement {
  addClass: ReturnType<typeof vi.fn>;
  closest: ReturnType<typeof vi.fn>;
  getBoundingClientRect: ReturnType<typeof vi.fn>;
  parentElement: MockElement | null;
  target?: string;
}

interface MockContainerEl {
  createEl: ReturnType<typeof vi.fn>;
  empty: ReturnType<typeof vi.fn>;
  getAttr: ReturnType<typeof vi.fn>;
  setCssProps: ReturnType<typeof vi.fn>;
}

interface MockIframeEl {
  addEventListener: ReturnType<typeof vi.fn>;
  src: string;
}

const STRICT_PROXY_TARGET_SYMBOL = Symbol.for('strictProxyTarget');

function createMockContainerEl(): MockContainerEl {
  return {
    createEl: vi.fn(),
    empty: vi.fn(),
    getAttr: vi.fn().mockReturnValue(null),
    setCssProps: vi.fn()
  };
}

function asContainerEl(mock: MockContainerEl): HTMLElement {
  // strictProxy<HTMLElement>(mock) cannot be used here because vi.fn() mock function
  // types are structurally incompatible with HTMLElement's overloaded method signatures
  // (e.g. setCssProps, createEl). Last-resort test-only cast per project conventions.

  return mock as unknown as HTMLElement;
}

function createMockPluginSettingsComponent(): PluginSettingsComponent {
  return strictProxy<PluginSettingsComponent>({
    settings: {
      defaultHeight: '400px',
      defaultWidth: '100%'
    }
  });
}

function createMockApp(): App {
  const app = strictProxy<App>({
    vault: strictProxy<App['vault']>({
      getResourcePath: vi.fn().mockReturnValue('app://vault/file.html'),
      read: vi.fn().mockResolvedValue('<html><head></head><body>Hello</body></html>')
    })
  });

  // The real dev-utils helpers (invokeAsyncSafely / debug) read and write a shared state holder on
  // the app. Seed it on the raw target behind the strict-proxy so those helpers can run, and expose
  // the same app as the global instance so helpers that resolve state without an explicit app argument
  // read/write the same holder.
  seedOnRawTarget(app, 'obsidianDevUtilsState', {});
  castTo<{ app: App }>(window).app = app;

  return app;
}

function seedOnRawTarget(strictProxiedObject: object, key: string, value: unknown): void {
  const proxyWithTarget = castTo<Partial<Record<symbol, object>>>(strictProxiedObject);
  const rawTarget = proxyWithTarget[STRICT_PROXY_TARGET_SYMBOL] ?? strictProxiedObject;
  castTo<Record<string, unknown>>(rawTarget)[key] = value;
}

let mockMutationObserverDisconnect: ReturnType<typeof vi.fn>;
let mockMutationObserverCallback: MutationCallback;

describe('HtmlEmbedComponent', () => {
  beforeEach(() => {
    mockMutationObserverDisconnect = vi.fn();

    globalThis.MutationObserver = class MockMutationObserver {
      public constructor(callback: MutationCallback) {
        mockMutationObserverCallback = callback;
      }

      public disconnect = mockMutationObserverDisconnect;

      public observe(): void {
        noop();
      }
    } as unknown as typeof MutationObserver;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should set up MutationObserver that calls updateSize', () => {
      const containerEl = createMockContainerEl();
      const pluginSettingsComponent = createMockPluginSettingsComponent();
      const mockApp = createMockApp();

      new HtmlEmbedComponent({
        app: mockApp,
        containerEl: asContainerEl(containerEl),
        file: strictProxy<TFile>({}),
        pluginSettingsComponent,
        subpath: ''
      });

      mockMutationObserverCallback([], {} as MutationObserver);

      expect(containerEl.setCssProps).toHaveBeenCalled();
    });

    it('should register cleanup that disconnects MutationObserver on unload', () => {
      const containerEl = createMockContainerEl();
      const pluginSettingsComponent = createMockPluginSettingsComponent();
      const mockApp = createMockApp();

      const component = new HtmlEmbedComponent({
        app: mockApp,
        containerEl: asContainerEl(containerEl),
        file: strictProxy<TFile>({}),
        pluginSettingsComponent,
        subpath: ''
      });

      // The real ComponentEx only runs registered cleanups during unload(), and only when the
      // component has been loaded. Drive the real load/unload lifecycle to exercise the cleanup.
      component.load();
      component.unload();

      expect(mockMutationObserverDisconnect).toHaveBeenCalled();
    });
  });

  describe('updateSize via MutationObserver', () => {
    it('should use default settings when no attributes are set', () => {
      const containerEl = createMockContainerEl();
      const pluginSettingsComponent = createMockPluginSettingsComponent();
      const mockApp = createMockApp();

      new HtmlEmbedComponent({
        app: mockApp,
        containerEl: asContainerEl(containerEl),
        file: strictProxy<TFile>({}),
        pluginSettingsComponent,
        subpath: ''
      });

      mockMutationObserverCallback([], {} as MutationObserver);

      expect(containerEl.setCssProps).toHaveBeenCalledWith({
        height: '400px',
        width: '100%'
      });
    });

    it('should use container attributes when set', () => {
      const containerEl = createMockContainerEl();
      containerEl.getAttr.mockImplementation((attr: string) => {
        if (attr === 'width') {
          return '500';
        }
        if (attr === 'height') {
          return '300';
        }
        return null;
      });
      const pluginSettingsComponent = createMockPluginSettingsComponent();
      const mockApp = createMockApp();

      new HtmlEmbedComponent({
        app: mockApp,
        containerEl: asContainerEl(containerEl),
        file: strictProxy<TFile>({}),
        pluginSettingsComponent,
        subpath: ''
      });

      mockMutationObserverCallback([], {} as MutationObserver);

      expect(containerEl.setCssProps).toHaveBeenCalledWith({
        height: '300px',
        width: '500px'
      });
    });

    it('should append px to pure numeric values', () => {
      const containerEl = createMockContainerEl();
      containerEl.getAttr.mockImplementation((attr: string) => {
        if (attr === 'width') {
          return '800';
        }
        return null;
      });
      const pluginSettingsComponent = createMockPluginSettingsComponent();
      const mockApp = createMockApp();

      new HtmlEmbedComponent({
        app: mockApp,
        containerEl: asContainerEl(containerEl),
        file: strictProxy<TFile>({}),
        pluginSettingsComponent,
        subpath: ''
      });

      mockMutationObserverCallback([], {} as MutationObserver);

      expect(containerEl.setCssProps).toHaveBeenCalledWith(
        expect.objectContaining({ width: '800px' })
      );
    });

    it('should not append px to values with units', () => {
      const containerEl = createMockContainerEl();
      containerEl.getAttr.mockImplementation((attr: string) => {
        if (attr === 'width') {
          return '50%';
        }
        return null;
      });
      const pluginSettingsComponent = createMockPluginSettingsComponent();
      const mockApp = createMockApp();

      new HtmlEmbedComponent({
        app: mockApp,
        containerEl: asContainerEl(containerEl),
        file: strictProxy<TFile>({}),
        pluginSettingsComponent,
        subpath: ''
      });

      mockMutationObserverCallback([], {} as MutationObserver);

      expect(containerEl.setCssProps).toHaveBeenCalledWith(
        expect.objectContaining({ width: '50%' })
      );
    });
  });

  describe('loadFile', () => {
    it('should trigger the async load path (empty container and create iframe)', async () => {
      const mockIframeEl: MockIframeEl = {
        addEventListener: vi.fn(),
        src: ''
      };
      const containerEl = createMockContainerEl();
      containerEl.createEl.mockReturnValue(mockIframeEl);
      const pluginSettingsComponent = createMockPluginSettingsComponent();
      const mockApp = createMockApp();

      const mockParsedDoc = {
        documentElement: { outerHTML: '<html></html>' },
        head: { createEl: vi.fn().mockReturnValue({}) },
        querySelector: vi.fn().mockReturnValue({ href: '' })
      };

      globalThis.DOMParser = class MockDOMParser {
        public parseFromString(): unknown {
          return mockParsedDoc;
        }
      } as unknown as typeof DOMParser;

      globalThis.Blob = class MockBlob {} as unknown as typeof Blob;
      globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:url');
      globalThis.URL.revokeObjectURL = vi.fn();
      vi.stubGlobal('location', { origin: 'app://obsidian.md' });

      const component = new HtmlEmbedComponent({
        app: mockApp,
        containerEl: asContainerEl(containerEl),
        file: strictProxy<TFile>({}),
        pluginSettingsComponent,
        subpath: ''
      });

      // loadFile() uses the real fire-and-forget invokeAsyncSafely; observe the effect rather than
      // asserting the helper was called.
      component.loadFile();

      await vi.waitFor(() => {
        expect(containerEl.empty).toHaveBeenCalled();
        expect(containerEl.createEl).toHaveBeenCalledWith('iframe', {
          attr: {
            height: '100%',
            width: '100%'
          }
        });
      });
    });
  });

  describe('loadFileAsync', () => {
    it('should empty the container and create an iframe', async () => {
      const mockIframeEl: MockIframeEl = {
        addEventListener: vi.fn(),
        src: ''
      };
      const containerEl = createMockContainerEl();
      containerEl.createEl.mockReturnValue(mockIframeEl);
      const pluginSettingsComponent = createMockPluginSettingsComponent();
      const mockApp = createMockApp();

      const mockBaseEl = { href: '' };
      const mockScriptEl = {};
      const mockParsedDoc = {
        documentElement: { outerHTML: '<html><head></head><body>Hello</body></html>' },
        head: {
          createEl: vi.fn().mockReturnValue(mockScriptEl)
        },
        querySelector: vi.fn().mockReturnValue(mockBaseEl)
      };

      globalThis.DOMParser = class MockDOMParser {
        public parseFromString(): unknown {
          return mockParsedDoc;
        }
      } as unknown as typeof DOMParser;

      globalThis.Blob = class MockBlob {
        public constructor(
          public parts: unknown[],
          public options: unknown
        ) {}
      } as unknown as typeof Blob;

      globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:test-url');
      globalThis.URL.revokeObjectURL = vi.fn();

      const mockLocation = { origin: 'app://obsidian.md' };
      vi.stubGlobal('location', mockLocation);

      const component = new HtmlEmbedComponent({
        app: mockApp,
        containerEl: asContainerEl(containerEl),
        file: strictProxy<TFile>({}),
        pluginSettingsComponent,
        subpath: ''
      });

      await component.loadFileAsync();

      expect(containerEl.empty).toHaveBeenCalled();
      expect(containerEl.createEl).toHaveBeenCalledWith('iframe', {
        attr: {
          height: '100%',
          width: '100%'
        }
      });
      expect(mockIframeEl.src).toBe('blob:test-url');
    });

    it('should set base href and add enhance script', async () => {
      const mockIframeEl: MockIframeEl = {
        addEventListener: vi.fn(),
        src: ''
      };
      const containerEl = createMockContainerEl();
      containerEl.createEl.mockReturnValue(mockIframeEl);
      const pluginSettingsComponent = createMockPluginSettingsComponent();
      const mockApp = createMockApp();

      const mockBaseEl = { href: '' };
      const mockScriptEl = {};
      const mockParsedDoc = {
        documentElement: { outerHTML: '<html></html>' },
        head: {
          createEl: vi.fn().mockReturnValue(mockScriptEl)
        },
        querySelector: vi.fn().mockReturnValue(mockBaseEl)
      };

      globalThis.DOMParser = class MockDOMParser {
        public parseFromString(): unknown {
          return mockParsedDoc;
        }
      } as unknown as typeof DOMParser;

      globalThis.Blob = class MockBlob {} as unknown as typeof Blob;
      globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:url');
      globalThis.URL.revokeObjectURL = vi.fn();

      const mockLocation = { origin: 'app://obsidian.md' };
      vi.stubGlobal('location', mockLocation);

      const component = new HtmlEmbedComponent({
        app: mockApp,
        containerEl: asContainerEl(containerEl),
        file: strictProxy<TFile>({}),
        pluginSettingsComponent,
        subpath: ''
      });

      await component.loadFileAsync();

      expect(mockBaseEl.href).toBe('app://vault/file.html');
      expect(mockParsedDoc.head.createEl).toHaveBeenCalledWith('script', {
        attr: {
          src: 'app://obsidian.md/enhance.js'
        }
      });
    });

    it('should create base element if none exists', async () => {
      const mockIframeEl: MockIframeEl = {
        addEventListener: vi.fn(),
        src: ''
      };
      const containerEl = createMockContainerEl();
      containerEl.createEl.mockReturnValue(mockIframeEl);
      const pluginSettingsComponent = createMockPluginSettingsComponent();
      const mockApp = createMockApp();

      const mockCreatedBaseEl = { href: '' };
      const mockParsedDoc = {
        documentElement: { outerHTML: '<html></html>' },
        head: {
          createEl: vi.fn().mockReturnValue(mockCreatedBaseEl)
        },
        querySelector: vi.fn().mockReturnValue(null)
      };

      globalThis.DOMParser = class MockDOMParser {
        public parseFromString(): unknown {
          return mockParsedDoc;
        }
      } as unknown as typeof DOMParser;

      globalThis.Blob = class MockBlob {} as unknown as typeof Blob;
      globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:url');
      globalThis.URL.revokeObjectURL = vi.fn();
      vi.stubGlobal('location', { origin: 'app://obsidian.md' });

      const component = new HtmlEmbedComponent({
        app: mockApp,
        containerEl: asContainerEl(containerEl),
        file: strictProxy<TFile>({}),
        pluginSettingsComponent,
        subpath: ''
      });

      await component.loadFileAsync();

      expect(mockParsedDoc.head.createEl).toHaveBeenCalledWith('base');
      expect(mockCreatedBaseEl.href).toBe('app://vault/file.html');
    });

    it('should revoke object URL and init iframe on load', async () => {
      let loadHandler: (() => void) | undefined;
      const clickHandlerSpy = vi.fn();
      const mockContentDocument = {
        addEventListener: vi.fn().mockImplementation((event: string, handler: () => void) => {
          if (event === 'click') {
            clickHandlerSpy.mockImplementation(handler);
          }
        }),
        defaultView: null,
        getElementById: vi.fn().mockReturnValue(null),
        removeEventListener: vi.fn(),
        scrollingElement: null
      };
      const mockIframeEl: { contentDocument: unknown } & MockIframeEl = {
        addEventListener: vi.fn().mockImplementation((event: string, handler: () => void) => {
          if (event === 'load') {
            loadHandler = handler;
          }
        }),
        contentDocument: mockContentDocument,
        src: ''
      };
      const containerEl = createMockContainerEl();
      containerEl.createEl.mockReturnValue(mockIframeEl);
      const pluginSettingsComponent = createMockPluginSettingsComponent();
      const mockApp = createMockApp();

      const mockParsedDoc = {
        documentElement: { outerHTML: '<html></html>' },
        head: { createEl: vi.fn().mockReturnValue({}) },
        querySelector: vi.fn().mockReturnValue({ href: '' })
      };

      globalThis.DOMParser = class MockDOMParser {
        public parseFromString(): unknown {
          return mockParsedDoc;
        }
      } as unknown as typeof DOMParser;

      globalThis.Blob = class MockBlob {} as unknown as typeof Blob;
      globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:test-url');
      globalThis.URL.revokeObjectURL = vi.fn();
      vi.stubGlobal('location', { origin: 'app://obsidian.md' });

      const component = new HtmlEmbedComponent({
        app: mockApp,
        containerEl: asContainerEl(containerEl),
        file: strictProxy<TFile>({}),
        pluginSettingsComponent,
        subpath: ''
      });

      await component.loadFileAsync();

      expect(loadHandler).toBeDefined();
      loadHandler?.();

      expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
      // The real registerDomEvent calls contentDocument.addEventListener('click', handler).
      expect(findClickHandler(mockContentDocument.addEventListener)).toBeDefined();
    });

    it('should return early from load handler when contentDocument is null', async () => {
      let loadHandler: (() => void) | undefined;
      const mockIframeEl: { contentDocument: null } & MockIframeEl = {
        addEventListener: vi.fn().mockImplementation((event: string, handler: () => void) => {
          if (event === 'load') {
            loadHandler = handler;
          }
        }),
        contentDocument: null,
        src: ''
      };
      const containerEl = createMockContainerEl();
      containerEl.createEl.mockReturnValue(mockIframeEl);
      const pluginSettingsComponent = createMockPluginSettingsComponent();
      const mockApp = createMockApp();

      const mockParsedDoc = {
        documentElement: { outerHTML: '<html></html>' },
        head: { createEl: vi.fn().mockReturnValue({}) },
        querySelector: vi.fn().mockReturnValue({ href: '' })
      };

      globalThis.DOMParser = class MockDOMParser {
        public parseFromString(): unknown {
          return mockParsedDoc;
        }
      } as unknown as typeof DOMParser;

      globalThis.Blob = class MockBlob {} as unknown as typeof Blob;
      globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:url');
      globalThis.URL.revokeObjectURL = vi.fn();
      vi.stubGlobal('location', { origin: 'app://obsidian.md' });

      const component = new HtmlEmbedComponent({
        app: mockApp,
        containerEl: asContainerEl(containerEl),
        file: strictProxy<TFile>({}),
        pluginSettingsComponent,
        subpath: ''
      });

      await component.loadFileAsync();
      loadHandler?.();

      expect(globalThis.URL.revokeObjectURL).toHaveBeenCalled();
    });
  });

  describe('setSubpath', () => {
    it('should update subpath and reload the file', async () => {
      const mockIframeEl: MockIframeEl = {
        addEventListener: vi.fn(),
        src: ''
      };
      const containerEl = createMockContainerEl();
      containerEl.createEl.mockReturnValue(mockIframeEl);
      const pluginSettingsComponent = createMockPluginSettingsComponent();
      const mockApp = createMockApp();

      const mockParsedDoc = {
        documentElement: { outerHTML: '<html></html>' },
        head: { createEl: vi.fn().mockReturnValue({}) },
        querySelector: vi.fn().mockReturnValue({ href: '' })
      };

      globalThis.DOMParser = class MockDOMParser {
        public parseFromString(): unknown {
          return mockParsedDoc;
        }
      } as unknown as typeof DOMParser;

      globalThis.Blob = class MockBlob {} as unknown as typeof Blob;
      globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:url');
      globalThis.URL.revokeObjectURL = vi.fn();
      vi.stubGlobal('location', { origin: 'app://obsidian.md' });

      const component = new HtmlEmbedComponent({
        app: mockApp,
        containerEl: asContainerEl(containerEl),
        file: strictProxy<TFile>({}),
        pluginSettingsComponent,
        subpath: ''
      });

      // setSubpath delegates to loadFile, which fires the real async load path.
      component.setSubpath('#myId');

      await vi.waitFor(() => {
        expect(containerEl.createEl).toHaveBeenCalled();
      });
    });
  });

  describe('initIframe - click handler', () => {
    it('should set target=_blank on clicked anchor elements', async () => {
      const mockAnchorEl: MockElement = {
        addClass: vi.fn(),
        closest: vi.fn(),
        getBoundingClientRect: vi.fn(),
        parentElement: null,
        target: ''
      };
      const mockClickTarget: MockElement = {
        addClass: vi.fn(),
        closest: vi.fn().mockReturnValue(mockAnchorEl),
        getBoundingClientRect: vi.fn(),
        parentElement: null
      };

      const MockElement = class {};
      const mockIframeWin = { Element: MockElement };
      Object.setPrototypeOf(mockClickTarget, MockElement.prototype);

      const mockContentDocument = {
        addEventListener: vi.fn(),
        defaultView: mockIframeWin,
        getElementById: vi.fn().mockReturnValue(null),
        removeEventListener: vi.fn()
      };

      let loadHandler: (() => void) | undefined;
      const mockIframeEl = {
        addEventListener: vi.fn().mockImplementation((event: string, handler: () => void) => {
          if (event === 'load') {
            loadHandler = handler;
          }
        }),
        contentDocument: mockContentDocument,
        src: ''
      };

      const containerEl = createMockContainerEl();
      containerEl.createEl.mockReturnValue(mockIframeEl);
      const pluginSettingsComponent = createMockPluginSettingsComponent();
      const mockApp = createMockApp();

      const mockParsedDoc = {
        documentElement: { outerHTML: '<html></html>' },
        head: { createEl: vi.fn().mockReturnValue({}) },
        querySelector: vi.fn().mockReturnValue({ href: '' })
      };

      globalThis.DOMParser = class MockDOMParser {
        public parseFromString(): unknown {
          return mockParsedDoc;
        }
      } as unknown as typeof DOMParser;

      globalThis.Blob = class MockBlob {} as unknown as typeof Blob;
      globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:url');
      globalThis.URL.revokeObjectURL = vi.fn();
      vi.stubGlobal('location', { origin: 'app://obsidian.md' });

      const component = new HtmlEmbedComponent({
        app: mockApp,
        containerEl: asContainerEl(containerEl),
        file: strictProxy<TFile>({}),
        pluginSettingsComponent,
        subpath: ''
      });

      await component.loadFileAsync();
      loadHandler?.();

      const clickHandler = findClickHandler(mockContentDocument.addEventListener);
      expect(clickHandler).toBeDefined();

      clickHandler?.({ target: mockClickTarget });

      expect(mockAnchorEl.target).toBe('_blank');
    });

    it('should not set target when click target is not an instance of iframe Element', async () => {
      const MockElement = class {};
      const mockIframeWin = { Element: MockElement };
      const mockClickTarget = { notAnElement: true };

      const mockContentDocument = {
        addEventListener: vi.fn(),
        defaultView: mockIframeWin,
        getElementById: vi.fn().mockReturnValue(null),
        removeEventListener: vi.fn()
      };

      let loadHandler: (() => void) | undefined;
      const mockIframeEl = {
        addEventListener: vi.fn().mockImplementation((event: string, handler: () => void) => {
          if (event === 'load') {
            loadHandler = handler;
          }
        }),
        contentDocument: mockContentDocument,
        src: ''
      };

      const containerEl = createMockContainerEl();
      containerEl.createEl.mockReturnValue(mockIframeEl);
      const pluginSettingsComponent = createMockPluginSettingsComponent();
      const mockApp = createMockApp();

      const mockParsedDoc = {
        documentElement: { outerHTML: '<html></html>' },
        head: { createEl: vi.fn().mockReturnValue({}) },
        querySelector: vi.fn().mockReturnValue({ href: '' })
      };

      globalThis.DOMParser = class MockDOMParser {
        public parseFromString(): unknown {
          return mockParsedDoc;
        }
      } as unknown as typeof DOMParser;

      globalThis.Blob = class MockBlob {} as unknown as typeof Blob;
      globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:url');
      globalThis.URL.revokeObjectURL = vi.fn();
      vi.stubGlobal('location', { origin: 'app://obsidian.md' });

      const component = new HtmlEmbedComponent({
        app: mockApp,
        containerEl: asContainerEl(containerEl),
        file: strictProxy<TFile>({}),
        pluginSettingsComponent,
        subpath: ''
      });

      await component.loadFileAsync();
      loadHandler?.();

      const clickHandler = findClickHandler(mockContentDocument.addEventListener);
      expect(clickHandler).toBeDefined();

      expect(() => {
        clickHandler?.({ target: mockClickTarget });
      }).not.toThrow();
    });

    it('should not crash when defaultView is null', async () => {
      const mockContentDocument = {
        addEventListener: vi.fn(),
        defaultView: null,
        getElementById: vi.fn().mockReturnValue(null),
        removeEventListener: vi.fn()
      };

      let loadHandler: (() => void) | undefined;
      const mockIframeEl = {
        addEventListener: vi.fn().mockImplementation((event: string, handler: () => void) => {
          if (event === 'load') {
            loadHandler = handler;
          }
        }),
        contentDocument: mockContentDocument,
        src: ''
      };

      const containerEl = createMockContainerEl();
      containerEl.createEl.mockReturnValue(mockIframeEl);
      const pluginSettingsComponent = createMockPluginSettingsComponent();
      const mockApp = createMockApp();

      const mockParsedDoc = {
        documentElement: { outerHTML: '<html></html>' },
        head: { createEl: vi.fn().mockReturnValue({}) },
        querySelector: vi.fn().mockReturnValue({ href: '' })
      };

      globalThis.DOMParser = class MockDOMParser {
        public parseFromString(): unknown {
          return mockParsedDoc;
        }
      } as unknown as typeof DOMParser;

      globalThis.Blob = class MockBlob {} as unknown as typeof Blob;
      globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:url');
      globalThis.URL.revokeObjectURL = vi.fn();
      vi.stubGlobal('location', { origin: 'app://obsidian.md' });

      const component = new HtmlEmbedComponent({
        app: mockApp,
        containerEl: asContainerEl(containerEl),
        file: strictProxy<TFile>({}),
        pluginSettingsComponent,
        subpath: ''
      });

      await component.loadFileAsync();
      loadHandler?.();

      const clickHandler = findClickHandler(mockContentDocument.addEventListener);
      expect(clickHandler).toBeDefined();

      expect(() => {
        clickHandler?.({ target: {} });
      }).not.toThrow();
    });

    it('should not set target when click target is not inside an anchor', async () => {
      const MockElement = class {};
      const mockClickTarget = Object.create(MockElement.prototype) as MockElement;
      mockClickTarget.closest = vi.fn().mockReturnValue(null);

      const mockIframeWin = { Element: MockElement };

      const mockContentDocument = {
        addEventListener: vi.fn(),
        defaultView: mockIframeWin,
        getElementById: vi.fn().mockReturnValue(null),
        removeEventListener: vi.fn()
      };

      let loadHandler: (() => void) | undefined;
      const mockIframeEl = {
        addEventListener: vi.fn().mockImplementation((event: string, handler: () => void) => {
          if (event === 'load') {
            loadHandler = handler;
          }
        }),
        contentDocument: mockContentDocument,
        src: ''
      };

      const containerEl = createMockContainerEl();
      containerEl.createEl.mockReturnValue(mockIframeEl);
      const pluginSettingsComponent = createMockPluginSettingsComponent();
      const mockApp = createMockApp();

      const mockParsedDoc = {
        documentElement: { outerHTML: '<html></html>' },
        head: { createEl: vi.fn().mockReturnValue({}) },
        querySelector: vi.fn().mockReturnValue({ href: '' })
      };

      globalThis.DOMParser = class MockDOMParser {
        public parseFromString(): unknown {
          return mockParsedDoc;
        }
      } as unknown as typeof DOMParser;

      globalThis.Blob = class MockBlob {} as unknown as typeof Blob;
      globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:url');
      globalThis.URL.revokeObjectURL = vi.fn();
      vi.stubGlobal('location', { origin: 'app://obsidian.md' });

      const component = new HtmlEmbedComponent({
        app: mockApp,
        containerEl: asContainerEl(containerEl),
        file: strictProxy<TFile>({}),
        pluginSettingsComponent,
        subpath: ''
      });

      await component.loadFileAsync();
      loadHandler?.();

      const clickHandler = findClickHandler(mockContentDocument.addEventListener);

      expect(() => {
        clickHandler?.({ target: mockClickTarget });
      }).not.toThrow();
    });
  });

  describe('initIframe - extract mode', () => {
    it('should hide all elements except the target and its parents', async () => {
      const grandParentEl: MockElement = {
        addClass: vi.fn(),
        closest: vi.fn(),
        getBoundingClientRect: vi.fn(),
        parentElement: null
      };
      const parentEl: MockElement = {
        addClass: vi.fn(),
        closest: vi.fn(),
        getBoundingClientRect: vi.fn(),
        parentElement: grandParentEl
      };
      const targetEl: MockElement = {
        addClass: vi.fn(),
        closest: vi.fn(),
        getBoundingClientRect: vi.fn(),
        parentElement: parentEl
      };

      const createdStyleEl = {};
      const mockContentDocument = {
        addEventListener: vi.fn(),
        defaultView: { Element: class {} },
        getElementById: vi.fn().mockReturnValue(targetEl),
        head: {
          createEl: vi.fn().mockReturnValue(createdStyleEl)
        },
        removeEventListener: vi.fn()
      };

      let loadHandler: (() => void) | undefined;
      const mockIframeEl = {
        addEventListener: vi.fn().mockImplementation((event: string, handler: () => void) => {
          if (event === 'load') {
            loadHandler = handler;
          }
        }),
        contentDocument: mockContentDocument,
        src: ''
      };

      const containerEl = createMockContainerEl();
      containerEl.createEl.mockReturnValue(mockIframeEl);
      const pluginSettingsComponent = createMockPluginSettingsComponent();
      const mockApp = createMockApp();

      const mockParsedDoc = {
        documentElement: { outerHTML: '<html></html>' },
        head: { createEl: vi.fn().mockReturnValue({}) },
        querySelector: vi.fn().mockReturnValue({ href: '' })
      };

      globalThis.DOMParser = class MockDOMParser {
        public parseFromString(): unknown {
          return mockParsedDoc;
        }
      } as unknown as typeof DOMParser;

      globalThis.Blob = class MockBlob {} as unknown as typeof Blob;
      globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:url');
      globalThis.URL.revokeObjectURL = vi.fn();
      vi.stubGlobal('location', { origin: 'app://obsidian.md' });

      const mockDateNow = 1234567890;
      const mockDateNowStr = String(mockDateNow);
      vi.spyOn(Date, 'now').mockReturnValue(mockDateNow);

      const component = new HtmlEmbedComponent({
        app: mockApp,
        containerEl: asContainerEl(containerEl),
        file: strictProxy<TFile>({}),
        pluginSettingsComponent,
        subpath: '#myId&mode=extract'
      });

      await component.loadFileAsync();
      loadHandler?.();

      expect(targetEl.addClass).toHaveBeenCalledWith(`extracted-${mockDateNowStr}`);
      expect(parentEl.addClass).toHaveBeenCalledWith(`extracted-parent-${mockDateNowStr}`);
      expect(grandParentEl.addClass).toHaveBeenCalledWith(`extracted-parent-${mockDateNowStr}`);
      expect(mockContentDocument.head.createEl).toHaveBeenCalledWith(
        'style',
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Vitest matcher returns `any`.
          text: expect.stringContaining('display:none !important')
        })
      );
    });
  });

  describe('initIframe - scroll mode', () => {
    it('should scroll to the target element', async () => {
      const targetEl: MockElement = {
        addClass: vi.fn(),
        closest: vi.fn(),
        getBoundingClientRect: vi.fn().mockReturnValue({ left: 100, top: 200 }),
        parentElement: null
      };

      const mockScrollingEl = {
        getBoundingClientRect: vi.fn().mockReturnValue({ left: 10, top: 20 }),
        scrollBy: vi.fn()
      };

      const mockContentDocument = {
        addEventListener: vi.fn(),
        defaultView: { Element: class {} },
        documentElement: {},
        getElementById: vi.fn().mockReturnValue(targetEl),
        removeEventListener: vi.fn(),
        scrollingElement: mockScrollingEl
      };

      let loadHandler: (() => void) | undefined;
      const mockIframeEl = {
        addEventListener: vi.fn().mockImplementation((event: string, handler: () => void) => {
          if (event === 'load') {
            loadHandler = handler;
          }
        }),
        contentDocument: mockContentDocument,
        src: ''
      };

      const containerEl = createMockContainerEl();
      containerEl.createEl.mockReturnValue(mockIframeEl);
      const pluginSettingsComponent = createMockPluginSettingsComponent();
      const mockApp = createMockApp();

      const mockParsedDoc = {
        documentElement: { outerHTML: '<html></html>' },
        head: { createEl: vi.fn().mockReturnValue({}) },
        querySelector: vi.fn().mockReturnValue({ href: '' })
      };

      globalThis.DOMParser = class MockDOMParser {
        public parseFromString(): unknown {
          return mockParsedDoc;
        }
      } as unknown as typeof DOMParser;

      globalThis.Blob = class MockBlob {} as unknown as typeof Blob;
      globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:url');
      globalThis.URL.revokeObjectURL = vi.fn();
      vi.stubGlobal('location', { origin: 'app://obsidian.md' });

      const component = new HtmlEmbedComponent({
        app: mockApp,
        containerEl: asContainerEl(containerEl),
        file: strictProxy<TFile>({}),
        pluginSettingsComponent,
        subpath: '#myId'
      });

      await component.loadFileAsync();
      loadHandler?.();

      const EXPECTED_LEFT = 90;
      const EXPECTED_TOP = 180;
      expect(mockScrollingEl.scrollBy).toHaveBeenCalledWith({
        behavior: 'instant',
        left: EXPECTED_LEFT,
        top: EXPECTED_TOP
      });
    });

    it('should fall back to documentElement when scrollingElement is null', async () => {
      const targetEl: MockElement = {
        addClass: vi.fn(),
        closest: vi.fn(),
        getBoundingClientRect: vi.fn().mockReturnValue({ left: 50, top: 100 }),
        parentElement: null
      };

      const mockDocumentElement = {
        getBoundingClientRect: vi.fn().mockReturnValue({ left: 0, top: 0 }),
        scrollBy: vi.fn()
      };

      const mockContentDocument = {
        addEventListener: vi.fn(),
        defaultView: { Element: class {} },
        documentElement: mockDocumentElement,
        getElementById: vi.fn().mockReturnValue(targetEl),
        removeEventListener: vi.fn(),
        scrollingElement: null
      };

      let loadHandler: (() => void) | undefined;
      const mockIframeEl = {
        addEventListener: vi.fn().mockImplementation((event: string, handler: () => void) => {
          if (event === 'load') {
            loadHandler = handler;
          }
        }),
        contentDocument: mockContentDocument,
        src: ''
      };

      const containerEl = createMockContainerEl();
      containerEl.createEl.mockReturnValue(mockIframeEl);
      const pluginSettingsComponent = createMockPluginSettingsComponent();
      const mockApp = createMockApp();

      const mockParsedDoc = {
        documentElement: { outerHTML: '<html></html>' },
        head: { createEl: vi.fn().mockReturnValue({}) },
        querySelector: vi.fn().mockReturnValue({ href: '' })
      };

      globalThis.DOMParser = class MockDOMParser {
        public parseFromString(): unknown {
          return mockParsedDoc;
        }
      } as unknown as typeof DOMParser;

      globalThis.Blob = class MockBlob {} as unknown as typeof Blob;
      globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:url');
      globalThis.URL.revokeObjectURL = vi.fn();
      vi.stubGlobal('location', { origin: 'app://obsidian.md' });

      const component = new HtmlEmbedComponent({
        app: mockApp,
        containerEl: asContainerEl(containerEl),
        file: strictProxy<TFile>({}),
        pluginSettingsComponent,
        subpath: '#scrollTarget'
      });

      await component.loadFileAsync();
      loadHandler?.();

      expect(mockDocumentElement.scrollBy).toHaveBeenCalledWith({
        behavior: 'instant',
        left: 50,
        top: 100
      });
    });

    it('should do nothing when element is not found', async () => {
      const mockContentDocument = {
        addEventListener: vi.fn(),
        defaultView: { Element: class {} },
        getElementById: vi.fn().mockReturnValue(null),
        removeEventListener: vi.fn(),
        scrollingElement: { scrollBy: vi.fn() }
      };

      let loadHandler: (() => void) | undefined;
      const mockIframeEl = {
        addEventListener: vi.fn().mockImplementation((event: string, handler: () => void) => {
          if (event === 'load') {
            loadHandler = handler;
          }
        }),
        contentDocument: mockContentDocument,
        src: ''
      };

      const containerEl = createMockContainerEl();
      containerEl.createEl.mockReturnValue(mockIframeEl);
      const pluginSettingsComponent = createMockPluginSettingsComponent();
      const mockApp = createMockApp();

      const mockParsedDoc = {
        documentElement: { outerHTML: '<html></html>' },
        head: { createEl: vi.fn().mockReturnValue({}) },
        querySelector: vi.fn().mockReturnValue({ href: '' })
      };

      globalThis.DOMParser = class MockDOMParser {
        public parseFromString(): unknown {
          return mockParsedDoc;
        }
      } as unknown as typeof DOMParser;

      globalThis.Blob = class MockBlob {} as unknown as typeof Blob;
      globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:url');
      globalThis.URL.revokeObjectURL = vi.fn();
      vi.stubGlobal('location', { origin: 'app://obsidian.md' });

      const component = new HtmlEmbedComponent({
        app: mockApp,
        containerEl: asContainerEl(containerEl),
        file: strictProxy<TFile>({}),
        pluginSettingsComponent,
        subpath: '#nonexistent'
      });

      await component.loadFileAsync();
      loadHandler?.();

      expect(mockContentDocument.scrollingElement.scrollBy).not.toHaveBeenCalled();
    });
  });

  describe('initIframe - unknown mode (default case)', () => {
    it('should do nothing for unknown mode', async () => {
      const targetEl: MockElement = {
        addClass: vi.fn(),
        closest: vi.fn(),
        getBoundingClientRect: vi.fn(),
        parentElement: null
      };

      const mockScrollingEl = {
        getBoundingClientRect: vi.fn(),
        scrollBy: vi.fn()
      };

      const mockContentDocument = {
        addEventListener: vi.fn(),
        defaultView: { Element: class {} },
        documentElement: {},
        getElementById: vi.fn().mockReturnValue(targetEl),
        head: { createEl: vi.fn() },
        removeEventListener: vi.fn(),
        scrollingElement: mockScrollingEl
      };

      let loadHandler: (() => void) | undefined;
      const mockIframeEl = {
        addEventListener: vi.fn().mockImplementation((event: string, handler: () => void) => {
          if (event === 'load') {
            loadHandler = handler;
          }
        }),
        contentDocument: mockContentDocument,
        src: ''
      };

      const containerEl = createMockContainerEl();
      containerEl.createEl.mockReturnValue(mockIframeEl);
      const pluginSettingsComponent = createMockPluginSettingsComponent();
      const mockApp = createMockApp();

      const mockParsedDoc = {
        documentElement: { outerHTML: '<html></html>' },
        head: { createEl: vi.fn().mockReturnValue({}) },
        querySelector: vi.fn().mockReturnValue({ href: '' })
      };

      globalThis.DOMParser = class MockDOMParser {
        public parseFromString(): unknown {
          return mockParsedDoc;
        }
      } as unknown as typeof DOMParser;

      globalThis.Blob = class MockBlob {} as unknown as typeof Blob;
      globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:url');
      globalThis.URL.revokeObjectURL = vi.fn();
      vi.stubGlobal('location', { origin: 'app://obsidian.md' });

      const component = new HtmlEmbedComponent({
        app: mockApp,
        containerEl: asContainerEl(containerEl),
        file: strictProxy<TFile>({}),
        pluginSettingsComponent,
        subpath: '#myId&mode=invalid'
      });

      await component.loadFileAsync();
      loadHandler?.();

      expect(targetEl.addClass).not.toHaveBeenCalled();
      expect(mockScrollingEl.scrollBy).not.toHaveBeenCalled();
    });
  });

  describe('initIframe - no subpath', () => {
    it('should not try to find element when no subpath id', async () => {
      const mockContentDocument = {
        addEventListener: vi.fn(),
        defaultView: { Element: class {} },
        getElementById: vi.fn(),
        removeEventListener: vi.fn()
      };

      let loadHandler: (() => void) | undefined;
      const mockIframeEl = {
        addEventListener: vi.fn().mockImplementation((event: string, handler: () => void) => {
          if (event === 'load') {
            loadHandler = handler;
          }
        }),
        contentDocument: mockContentDocument,
        src: ''
      };

      const containerEl = createMockContainerEl();
      containerEl.createEl.mockReturnValue(mockIframeEl);
      const pluginSettingsComponent = createMockPluginSettingsComponent();
      const mockApp = createMockApp();

      const mockParsedDoc = {
        documentElement: { outerHTML: '<html></html>' },
        head: { createEl: vi.fn().mockReturnValue({}) },
        querySelector: vi.fn().mockReturnValue({ href: '' })
      };

      globalThis.DOMParser = class MockDOMParser {
        public parseFromString(): unknown {
          return mockParsedDoc;
        }
      } as unknown as typeof DOMParser;

      globalThis.Blob = class MockBlob {} as unknown as typeof Blob;
      globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:url');
      globalThis.URL.revokeObjectURL = vi.fn();
      vi.stubGlobal('location', { origin: 'app://obsidian.md' });

      const component = new HtmlEmbedComponent({
        app: mockApp,
        containerEl: asContainerEl(containerEl),
        file: strictProxy<TFile>({}),
        pluginSettingsComponent,
        subpath: ''
      });

      await component.loadFileAsync();
      loadHandler?.();

      expect(mockContentDocument.getElementById).not.toHaveBeenCalled();
    });
  });
});

function findClickHandler(
  addEventListenerMock: ReturnType<typeof vi.fn>
): ((evt: { target: unknown }) => void) | undefined {
  const clickCall = addEventListenerMock.mock.calls.find((call) => call[0] === 'click');
  return clickCall?.[1] as ((evt: { target: unknown }) => void) | undefined;
}
