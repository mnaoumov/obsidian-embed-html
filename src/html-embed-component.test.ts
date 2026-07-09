import type {
  App,
  EventRef,
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

interface ClickEvent {
  target: unknown;
}

type ClickHandler = (evt: ClickEvent) => void;

interface ComponentWithApplySize {
  applySize(): void;
}

interface ComponentWithIframeEl {
  iframeEl: unknown;
}

interface LoadedContentComponent {
  component: HtmlEmbedComponent;
  fireLoad(): void;
}

interface MockContainerEl {
  createEl: ReturnType<typeof vi.fn>;
  empty: ReturnType<typeof vi.fn>;
  getAttr: ReturnType<typeof vi.fn>;
  setCssProps: ReturnType<typeof vi.fn>;
  style: MockStyle;
}

interface MockElement {
  addClass: ReturnType<typeof vi.fn>;
  closest: ReturnType<typeof vi.fn>;
  getBoundingClientRect: ReturnType<typeof vi.fn>;
  parentElement: MockElement | null;
  target?: string;
}

interface MockHead {
  createEl: ReturnType<typeof vi.fn>;
}

interface MockIframeEl {
  addEventListener: ReturnType<typeof vi.fn>;
  setCssStyles: ReturnType<typeof vi.fn>;
  srcdoc: string;
}

interface MockIframeElWithContent extends MockIframeEl {
  contentDocument: unknown;
}

interface MockScrollHeight {
  scrollHeight: number;
}

interface MockScrollWidth {
  scrollWidth: number;
}

interface MockStyle {
  height: string;
}

interface SizingIframeDoc {
  [key: string]: unknown;
  body: MockScrollWidth;
  defaultView: unknown;
  documentElement: MockScrollHeight;
  head: MockHead;
}

interface WindowWithApp {
  app: App;
}

class MockIframeElement {
  public readonly isMockIframeElement = true;
}

const STRICT_PROXY_TARGET_SYMBOL = Symbol.for('strictProxyTarget');

function asContainerEl(mock: MockContainerEl): HTMLElement {
  // StrictProxy<HTMLElement>(mock) cannot be used here because vi.fn() mock function
  // Types are structurally incompatible with HTMLElement's overloaded method signatures
  // (e.g. setCssProps, createEl). Last-resort test-only cast per project conventions.

  return castTo<HTMLElement>(mock);
}

function createMockApp(): App {
  const app = strictProxy<App>({
    isDarkMode: vi.fn().mockReturnValue(false),
    vault: strictProxy<App['vault']>({
      getResourcePath: vi.fn().mockReturnValue('app://vault/file.html'),
      read: vi.fn().mockResolvedValue('<html><head></head><body>Hello</body></html>')
    }),
    workspace: strictProxy<App['workspace']>({
      // A plain object (not a strict proxy) so the real Component.unload cleanup can read the absent
      // `e` field via `ref.e?.offref(ref)` without a strict-proxy throw on unknown-property access.
      on: vi.fn().mockReturnValue(castTo<EventRef>({}))
    })
  });

  // The real dev-utils helpers (invokeAsyncSafely / debug) read and write a shared state holder on
  // The app. Seed it on the raw target behind the strict-proxy so those helpers can run, and expose
  // The same app as the global instance so helpers that resolve state without an explicit app argument
  // Read/write the same holder.
  seedOnRawTarget(app, 'obsidianDevUtilsState', {});
  castTo<WindowWithApp>(window).app = app;

  return app;
}

function createMockContainerEl(): MockContainerEl {
  return {
    createEl: vi.fn(),
    empty: vi.fn(),
    getAttr: vi.fn().mockReturnValue(null),
    setCssProps: vi.fn(),
    style: { height: '' }
  };
}

function createMockPluginSettingsComponent(): PluginSettingsComponent {
  return strictProxy<PluginSettingsComponent>({
    settings: {
      defaultHeight: '400px',
      defaultMaxHeight: '',
      defaultMaxWidth: '',
      defaultMinHeight: '',
      defaultMinWidth: '',
      defaultWidth: '100%'
    }
  });
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

    window.MutationObserver = castTo<typeof MutationObserver>(
      class MockMutationObserver {
        public disconnect = mockMutationObserverDisconnect;

        public constructor(callback: MutationCallback) {
          mockMutationObserverCallback = callback;
        }

        public observe(): void {
          noop();
        }
      }
    );
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
      // Component has been loaded. Drive the real load/unload lifecycle to exercise the cleanup.
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
        'height': '400px',
        'max-height': '',
        'max-width': '',
        'min-height': '',
        'min-width': '',
        'width': '100%'
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
        'height': '300px',
        'max-height': '',
        'max-width': '',
        'min-height': '',
        'min-width': '',
        'width': '500px'
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
        setCssStyles: vi.fn(),
        srcdoc: ''
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

      window.DOMParser = castTo<typeof DOMParser>(
        class MockDOMParser {
          public parseFromString(): unknown {
            return mockParsedDoc;
          }
        }
      );

      vi.stubGlobal('location', { origin: 'app://obsidian.md' });

      const component = new HtmlEmbedComponent({
        app: mockApp,
        containerEl: asContainerEl(containerEl),
        file: strictProxy<TFile>({}),
        pluginSettingsComponent,
        subpath: ''
      });

      // LoadFile() uses the real fire-and-forget invokeAsyncSafely; observe the effect rather than
      // Asserting the helper was called.
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
        setCssStyles: vi.fn(),
        srcdoc: ''
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

      window.DOMParser = castTo<typeof DOMParser>(
        class MockDOMParser {
          public parseFromString(): unknown {
            return mockParsedDoc;
          }
        }
      );

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
      expect(mockIframeEl.srcdoc).toBe('<html><head></head><body>Hello</body></html>');
    });

    it('should set base href and add enhance script', async () => {
      const mockIframeEl: MockIframeEl = {
        addEventListener: vi.fn(),
        setCssStyles: vi.fn(),
        srcdoc: ''
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

      window.DOMParser = castTo<typeof DOMParser>(
        class MockDOMParser {
          public parseFromString(): unknown {
            return mockParsedDoc;
          }
        }
      );

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
        setCssStyles: vi.fn(),
        srcdoc: ''
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

      window.DOMParser = castTo<typeof DOMParser>(
        class MockDOMParser {
          public parseFromString(): unknown {
            return mockParsedDoc;
          }
        }
      );

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

    it('should init iframe on load', async () => {
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
      const mockIframeEl: MockIframeElWithContent = {
        addEventListener: vi.fn().mockImplementation((event: string, handler: () => void) => {
          if (event === 'load') {
            loadHandler = handler;
          }
        }),
        contentDocument: mockContentDocument,
        setCssStyles: vi.fn(),
        srcdoc: ''
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

      window.DOMParser = castTo<typeof DOMParser>(
        class MockDOMParser {
          public parseFromString(): unknown {
            return mockParsedDoc;
          }
        }
      );

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

      // The real registerDomEvent calls contentDocument.addEventListener('click', handler).
      expect(findClickHandler(mockContentDocument.addEventListener)).toBeDefined();
    });

    it('should return early from load handler when contentDocument is null', async () => {
      let loadHandler: (() => void) | undefined;
      const mockIframeEl: MockIframeElWithContent = {
        addEventListener: vi.fn().mockImplementation((event: string, handler: () => void) => {
          if (event === 'load') {
            loadHandler = handler;
          }
        }),
        contentDocument: null,
        setCssStyles: vi.fn(),
        srcdoc: ''
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

      window.DOMParser = castTo<typeof DOMParser>(
        class MockDOMParser {
          public parseFromString(): unknown {
            return mockParsedDoc;
          }
        }
      );

      vi.stubGlobal('location', { origin: 'app://obsidian.md' });

      const component = new HtmlEmbedComponent({
        app: mockApp,
        containerEl: asContainerEl(containerEl),
        file: strictProxy<TFile>({}),
        pluginSettingsComponent,
        subpath: ''
      });

      await component.loadFileAsync();
      const setCssPropsCallCountBeforeLoad = containerEl.setCssProps.mock.calls.length;
      loadHandler?.();

      // With a null contentDocument the load handler returns early.
      // It does not re-run applySize (which would otherwise call setCssProps again).
      expect(containerEl.setCssProps.mock.calls.length).toBe(setCssPropsCallCountBeforeLoad);
    });
  });

  describe('setSubpath', () => {
    it('should update subpath and reload the file', async () => {
      const mockIframeEl: MockIframeEl = {
        addEventListener: vi.fn(),
        setCssStyles: vi.fn(),
        srcdoc: ''
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

      window.DOMParser = castTo<typeof DOMParser>(
        class MockDOMParser {
          public parseFromString(): unknown {
            return mockParsedDoc;
          }
        }
      );

      vi.stubGlobal('location', { origin: 'app://obsidian.md' });

      const component = new HtmlEmbedComponent({
        app: mockApp,
        containerEl: asContainerEl(containerEl),
        file: strictProxy<TFile>({}),
        pluginSettingsComponent,
        subpath: ''
      });

      // SetSubpath delegates to loadFile, which fires the real async load path.
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

      const MockElement = MockIframeElement;
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
        setCssStyles: vi.fn(),
        srcdoc: ''
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

      window.DOMParser = castTo<typeof DOMParser>(
        class MockDOMParser {
          public parseFromString(): unknown {
            return mockParsedDoc;
          }
        }
      );

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
      const MockElement = MockIframeElement;
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
        setCssStyles: vi.fn(),
        srcdoc: ''
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

      window.DOMParser = castTo<typeof DOMParser>(
        class MockDOMParser {
          public parseFromString(): unknown {
            return mockParsedDoc;
          }
        }
      );

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
        setCssStyles: vi.fn(),
        srcdoc: ''
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

      window.DOMParser = castTo<typeof DOMParser>(
        class MockDOMParser {
          public parseFromString(): unknown {
            return mockParsedDoc;
          }
        }
      );

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
      const MockElement = MockIframeElement;
      const mockClickTarget = castTo<MockElement>(Object.create(MockElement.prototype));
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
        setCssStyles: vi.fn(),
        srcdoc: ''
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

      window.DOMParser = castTo<typeof DOMParser>(
        class MockDOMParser {
          public parseFromString(): unknown {
            return mockParsedDoc;
          }
        }
      );

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
        defaultView: { Element: MockIframeElement },
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
        setCssStyles: vi.fn(),
        srcdoc: ''
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

      window.DOMParser = castTo<typeof DOMParser>(
        class MockDOMParser {
          public parseFromString(): unknown {
            return mockParsedDoc;
          }
        }
      );

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
        defaultView: { Element: MockIframeElement },
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
        setCssStyles: vi.fn(),
        srcdoc: ''
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

      window.DOMParser = castTo<typeof DOMParser>(
        class MockDOMParser {
          public parseFromString(): unknown {
            return mockParsedDoc;
          }
        }
      );

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
        defaultView: { Element: MockIframeElement },
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
        setCssStyles: vi.fn(),
        srcdoc: ''
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

      window.DOMParser = castTo<typeof DOMParser>(
        class MockDOMParser {
          public parseFromString(): unknown {
            return mockParsedDoc;
          }
        }
      );

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
        defaultView: { Element: MockIframeElement },
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
        setCssStyles: vi.fn(),
        srcdoc: ''
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

      window.DOMParser = castTo<typeof DOMParser>(
        class MockDOMParser {
          public parseFromString(): unknown {
            return mockParsedDoc;
          }
        }
      );

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
        defaultView: { Element: MockIframeElement },
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
        setCssStyles: vi.fn(),
        srcdoc: ''
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

      window.DOMParser = castTo<typeof DOMParser>(
        class MockDOMParser {
          public parseFromString(): unknown {
            return mockParsedDoc;
          }
        }
      );

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
        defaultView: { Element: MockIframeElement },
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
        setCssStyles: vi.fn(),
        srcdoc: ''
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

      window.DOMParser = castTo<typeof DOMParser>(
        class MockDOMParser {
          public parseFromString(): unknown {
            return mockParsedDoc;
          }
        }
      );

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

  describe('color scheme', () => {
    it('should set the iframe color-scheme to dark when the app is in dark mode', async () => {
      const mockIframeEl: MockIframeEl = {
        addEventListener: vi.fn(),
        setCssStyles: vi.fn(),
        srcdoc: ''
      };
      const containerEl = createMockContainerEl();
      containerEl.createEl.mockReturnValue(mockIframeEl);
      const pluginSettingsComponent = createMockPluginSettingsComponent();
      const mockApp = createMockApp();
      vi.mocked(mockApp.isDarkMode).mockReturnValue(true);

      stubLoadGlobals();

      const component = new HtmlEmbedComponent({
        app: mockApp,
        containerEl: asContainerEl(containerEl),
        file: strictProxy<TFile>({}),
        pluginSettingsComponent,
        subpath: ''
      });

      await component.loadFileAsync();

      expect(mockIframeEl.setCssStyles).toHaveBeenCalledWith({ colorScheme: 'dark' });
    });

    it('should set the iframe color-scheme to light when the app is in light mode', async () => {
      const mockIframeEl: MockIframeEl = {
        addEventListener: vi.fn(),
        setCssStyles: vi.fn(),
        srcdoc: ''
      };
      const containerEl = createMockContainerEl();
      containerEl.createEl.mockReturnValue(mockIframeEl);
      const pluginSettingsComponent = createMockPluginSettingsComponent();
      const mockApp = createMockApp();
      vi.mocked(mockApp.isDarkMode).mockReturnValue(false);

      stubLoadGlobals();

      const component = new HtmlEmbedComponent({
        app: mockApp,
        containerEl: asContainerEl(containerEl),
        file: strictProxy<TFile>({}),
        pluginSettingsComponent,
        subpath: ''
      });

      await component.loadFileAsync();

      expect(mockIframeEl.setCssStyles).toHaveBeenCalledWith({ colorScheme: 'light' });
    });

    it('should re-apply the color-scheme when the css-change event fires', async () => {
      const mockIframeEl: MockIframeEl = {
        addEventListener: vi.fn(),
        setCssStyles: vi.fn(),
        srcdoc: ''
      };
      const containerEl = createMockContainerEl();
      containerEl.createEl.mockReturnValue(mockIframeEl);
      const pluginSettingsComponent = createMockPluginSettingsComponent();
      const mockApp = createMockApp();

      stubLoadGlobals();

      const component = new HtmlEmbedComponent({
        app: mockApp,
        containerEl: asContainerEl(containerEl),
        file: strictProxy<TFile>({}),
        pluginSettingsComponent,
        subpath: ''
      });

      // The real ComponentEx only registers the css-change listener in onload() during load(), so the
      // Real lifecycle is driven here to wire the listener.
      component.load();
      await component.loadFileAsync();

      expect(mockIframeEl.setCssStyles).toHaveBeenLastCalledWith({ colorScheme: 'light' });

      // The overloaded `on` signature widens `mock.calls` tuple types, so read them through a simple
      // [event, callback] shape to find the css-change registration.
      const onCalls = castTo<[string, () => void][]>(vi.mocked(mockApp.workspace.on).mock.calls);
      const cssChangeCall = onCalls.find((call) => call[0] === 'css-change');
      expect(cssChangeCall).toBeDefined();

      vi.mocked(mockApp.isDarkMode).mockReturnValue(true);
      cssChangeCall?.[1]();

      expect(mockIframeEl.setCssStyles).toHaveBeenLastCalledWith({ colorScheme: 'dark' });
    });

    function stubLoadGlobals(): void {
      const mockParsedDoc = {
        documentElement: { outerHTML: '<html></html>' },
        head: { createEl: vi.fn().mockReturnValue({}) },
        querySelector: vi.fn().mockReturnValue({ href: '' })
      };

      window.DOMParser = castTo<typeof DOMParser>(
        class MockDOMParser {
          public parseFromString(): unknown {
            return mockParsedDoc;
          }
        }
      );

      vi.stubGlobal('location', { origin: 'app://obsidian.md' });
    }
  });
});

describe('auto-fit sizing', () => {
  const MEASURED_HEIGHT = 250;
  const MEASURED_WIDTH = 480;

  let resizeObserverCallback: (() => void) | undefined;
  let resizeObserverObserve: ReturnType<typeof vi.fn>;
  let resizeObserverDisconnect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resizeObserverCallback = undefined;
    resizeObserverObserve = vi.fn();
    resizeObserverDisconnect = vi.fn();
  });

  it('should apply min/max clamps from the alt token without an iframe', () => {
    const containerEl = createMockContainerEl();
    containerEl.getAttr.mockImplementation((attr: string) => (attr === 'alt' ? 'min-width: 100px; max-height: 800px' : null));
    const component = createContentComponent(containerEl, null);

    castTo<ComponentWithApplySize>(component).applySize();

    expect(containerEl.setCssProps).toHaveBeenLastCalledWith({
      'height': '400px',
      'max-height': '800px',
      'max-width': '',
      'min-height': '',
      'min-width': '100px',
      'width': '100%'
    });
  });

  it('should measure content height when the token requests a content keyword', async () => {
    const containerEl = createMockContainerEl();
    containerEl.getAttr.mockImplementation((attr: string) => (attr === 'alt' ? 'height: max-content' : null));
    const iframeDoc = createSizingIframeDoc();
    const { fireLoad } = await loadContentComponent(containerEl, iframeDoc);

    fireLoad();

    expect(resizeObserverObserve).toHaveBeenCalled();
    expect(containerEl.setCssProps).toHaveBeenCalledWith({ height: `${String(MEASURED_HEIGHT)}px` });
  });

  it('should measure content width by injecting a body width style', async () => {
    const containerEl = createMockContainerEl();
    containerEl.getAttr.mockImplementation((attr: string) => (attr === 'alt' ? 'width: max-content' : null));
    const iframeDoc = createSizingIframeDoc();
    const { fireLoad } = await loadContentComponent(containerEl, iframeDoc);

    fireLoad();

    expect(iframeDoc.head.createEl).toHaveBeenCalledWith(
      'style',
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Vitest matcher returns `any`.
        text: expect.stringContaining('width: max-content')
      })
    );
    expect(containerEl.setCssProps).toHaveBeenCalledWith({ width: `${String(MEASURED_WIDTH)}px` });
  });

  it('should not re-apply an unchanged measurement (guard against feedback loops)', async () => {
    const containerEl = createMockContainerEl();
    containerEl.getAttr.mockImplementation((attr: string) => (attr === 'alt' ? 'height: max-content' : null));
    const iframeDoc = createSizingIframeDoc();
    const { fireLoad } = await loadContentComponent(containerEl, iframeDoc);

    fireLoad();
    const measureCallCount = countHeightOnlyCalls(containerEl);
    resizeObserverCallback?.();

    const measureCallCountAfter = countHeightOnlyCalls(containerEl);
    expect(measureCallCountAfter).toBe(measureCallCount);
  });

  it('should not re-apply an unchanged content width', async () => {
    const containerEl = createMockContainerEl();
    containerEl.getAttr.mockImplementation((attr: string) => (attr === 'alt' ? 'width: max-content' : null));
    const iframeDoc = createSizingIframeDoc();
    const { fireLoad } = await loadContentComponent(containerEl, iframeDoc);

    fireLoad();
    containerEl.setCssProps.mockClear();
    resizeObserverCallback?.();

    expect(containerEl.setCssProps).not.toHaveBeenCalled();
  });

  it('should fall back to the parent window ResizeObserver when the iframe has no defaultView', async () => {
    vi.stubGlobal('ResizeObserver', createMockResizeObserver());
    const containerEl = createMockContainerEl();
    containerEl.getAttr.mockImplementation((attr: string) => (attr === 'alt' ? 'height: max-content' : null));
    const iframeDoc = createSizingIframeDoc();
    iframeDoc.defaultView = null;
    const { fireLoad } = await loadContentComponent(containerEl, iframeDoc);

    fireLoad();

    expect(resizeObserverObserve).toHaveBeenCalled();
  });

  it('should update the existing width style on re-apply instead of creating a new one', async () => {
    const containerEl = createMockContainerEl();
    containerEl.getAttr.mockImplementation((attr: string) => (attr === 'alt' ? 'width: max-content' : null));
    const iframeDoc = createSizingIframeDoc();
    const { component, fireLoad } = await loadContentComponent(containerEl, iframeDoc);

    fireLoad();
    castTo<ComponentWithApplySize>(component).applySize();

    expect(iframeDoc.head.createEl).toHaveBeenCalledTimes(1);
  });

  it('should no-op measurement when the iframe is gone', async () => {
    const containerEl = createMockContainerEl();
    containerEl.getAttr.mockImplementation((attr: string) => (attr === 'alt' ? 'height: max-content' : null));
    const iframeDoc = createSizingIframeDoc();
    const { component, fireLoad } = await loadContentComponent(containerEl, iframeDoc);

    fireLoad();
    castTo<ComponentWithIframeEl>(component).iframeEl = null;
    containerEl.setCssProps.mockClear();
    resizeObserverCallback?.();

    expect(containerEl.setCssProps).not.toHaveBeenCalled();
  });

  it('should disconnect the ResizeObserver on unload', async () => {
    const containerEl = createMockContainerEl();
    containerEl.getAttr.mockImplementation((attr: string) => (attr === 'alt' ? 'height: max-content' : null));
    const iframeDoc = createSizingIframeDoc();
    const { component, fireLoad } = await loadContentComponent(containerEl, iframeDoc);

    fireLoad();
    component.unload();

    expect(resizeObserverDisconnect).toHaveBeenCalled();
  });

  function countHeightOnlyCalls(containerEl: MockContainerEl): number {
    return containerEl.setCssProps.mock.calls.filter((call) => {
      const props = call[0] as Record<string, string>;
      return 'height' in props && Object.keys(props).length === 1;
    }).length;
  }

  function createMockResizeObserver(): typeof ResizeObserver {
    return castTo<typeof ResizeObserver>(
      class MockResizeObserver {
        public disconnect = resizeObserverDisconnect;

        public observe = resizeObserverObserve;

        public constructor(callback: () => void) {
          resizeObserverCallback = callback;
        }

        public unobserve(): void {
          noop();
        }
      }
    );
  }

  function createSizingIframeDoc(): SizingIframeDoc {
    return {
      addEventListener: vi.fn(),
      body: { scrollWidth: MEASURED_WIDTH },
      defaultView: { Element: MockIframeElement, ResizeObserver: createMockResizeObserver() },
      documentElement: { scrollHeight: MEASURED_HEIGHT },
      getElementById: vi.fn().mockReturnValue(null),
      head: { createEl: vi.fn().mockReturnValue({}) },
      removeEventListener: vi.fn()
    };
  }

  function createContentComponent(containerEl: MockContainerEl, iframeEl: unknown): HtmlEmbedComponent {
    const component = new HtmlEmbedComponent({
      app: createMockApp(),
      containerEl: asContainerEl(containerEl),
      file: strictProxy<TFile>({}),
      pluginSettingsComponent: createMockPluginSettingsComponent(),
      subpath: ''
    });
    if (iframeEl) {
      castTo<ComponentWithIframeEl>(component).iframeEl = iframeEl;
    }
    return component;
  }

  async function loadContentComponent(
    containerEl: MockContainerEl,
    iframeDoc: Record<string, unknown>
  ): Promise<LoadedContentComponent> {
    let loadHandler: (() => void) | undefined;
    const iframeEl = {
      addEventListener: vi.fn().mockImplementation((event: string, handler: () => void) => {
        if (event === 'load') {
          loadHandler = handler;
        }
      }),
      contentDocument: iframeDoc,
      setCssStyles: vi.fn(),
      src: '',
      style: { height: '' }
    };
    containerEl.createEl.mockReturnValue(iframeEl);

    const mockParsedDoc = {
      documentElement: { outerHTML: '<html></html>' },
      head: { createEl: vi.fn().mockReturnValue({}) },
      querySelector: vi.fn().mockReturnValue({ href: '' })
    };
    window.DOMParser = castTo<typeof DOMParser>(
      class MockDOMParser {
        public parseFromString(): unknown {
          return mockParsedDoc;
        }
      }
    );
    vi.stubGlobal('location', { origin: 'app://obsidian.md' });

    const component = createContentComponent(containerEl, null);
    component.load();
    await component.loadFileAsync();

    return {
      component,
      fireLoad: () => loadHandler?.()
    };
  }
});

function findClickHandler(
  addEventListenerMock: ReturnType<typeof vi.fn>
): ClickHandler | undefined {
  const clickCall = addEventListenerMock.mock.calls.find((call) => call[0] === 'click');
  return clickCall?.[1] as ClickHandler | undefined;
}
