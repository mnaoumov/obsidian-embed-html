import type {
  App,
  EventRef,
  TFile
} from 'obsidian';

import { waitForAllAsyncOperations } from 'obsidian-dev-utils/async';
import { noop } from 'obsidian-dev-utils/function';
import { castTo } from 'obsidian-dev-utils/object-utils';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  ButtonComponent,
  FileSystemAdapter
} from 'obsidian-test-mocks/obsidian';
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

type ClickHandler = ($event: ClickEvent) => void;

interface ComponentWithApplySize {
  applySize(): void;
}

interface ComponentWithIframeEl {
  iframeEl: unknown;
}

interface ContainsCheck {
  contains: ReturnType<typeof vi.fn>;
}

interface DecorationOverrides {
  background?: string;
  border?: string;
  borderRadius?: string;
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

interface MockStylesheetIframeDoc {
  addEventListener: ReturnType<typeof vi.fn>;
  defaultView: unknown;
  getElementById: ReturnType<typeof vi.fn>;
  querySelectorAll: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}

interface MutableOpenInExternalBrowserSetting {
  shouldShowOpenInExternalBrowserButton: boolean;
}

interface OpenInExternalBrowserHarness {
  buttonEls: HTMLButtonElement[];
  containerEl: MockContainerEl;
}

interface OpenInExternalBrowserHarnessParams {
  readonly hasFileSystem: boolean;
  readonly isSettingEnabled: boolean;
}

interface SizingIframeDoc {
  [key: string]: unknown;
  body: MockScrollWidth;
  defaultView: unknown;
  documentElement: MockScrollHeight;
  head: MockHead;
}

interface StylesheetObserverHarness {
  component: HtmlEmbedComponent;
  disconnect: ReturnType<typeof vi.fn>;
  fireMutations(mutations: MutationRecord[]): void;
  iframeDoc: MockStylesheetIframeDoc;
  observe: ReturnType<typeof vi.fn>;
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
      adapter: strictProxy<App['vault']['adapter']>({}),
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

function createMockFile(name = 'file.html'): TFile {
  // `resolveSize` compares `alt` against the file's `name`/`basename`/`path` to detect the file-name
  // Fallback Obsidian writes into `alt` for a numeric-aliased embed, so the mock must expose all three.
  return strictProxy<TFile>({
    basename: name.replace(/\.[^.]+$/, ''),
    name,
    path: name
  });
}

function createMockPluginSettingsComponent(): PluginSettingsComponent {
  return strictProxy<PluginSettingsComponent>({
    settings: {
      background: '',
      border: '',
      borderRadius: '',
      defaultHeight: '400px',
      defaultMaxHeight: '',
      defaultMaxWidth: '',
      defaultMinHeight: '',
      defaultMinWidth: '',
      defaultWidth: '100%',
      shouldShowOpenInExternalBrowserButton: false
    }
  });
}

function seedOnRawTarget(strictProxiedObject: object, key: string, value: unknown): void {
  const proxyWithTarget = castTo<Partial<Record<symbol, object>>>(strictProxiedObject);
  // eslint-disable-next-line unicorn/no-unsafe-property-key -- The well-known strict-proxy target symbol is the key by design; a literal cannot address it.
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
        file: createMockFile(),
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
        file: createMockFile(),
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
        file: createMockFile(),
        pluginSettingsComponent,
        subpath: ''
      });

      mockMutationObserverCallback([], {} as MutationObserver);

      expect(containerEl.setCssProps).toHaveBeenCalledWith({
        'background': '',
        'border': '',
        'border-radius': '',
        'height': '400px',
        'max-height': '',
        'max-width': '',
        'min-height': '',
        'min-width': '',
        'overflow': '',
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
        file: createMockFile(),
        pluginSettingsComponent,
        subpath: ''
      });

      mockMutationObserverCallback([], {} as MutationObserver);

      expect(containerEl.setCssProps).toHaveBeenCalledWith({
        'background': '',
        'border': '',
        'border-radius': '',
        'height': '300px',
        'max-height': '',
        'max-width': '',
        'min-height': '',
        'min-width': '',
        'overflow': '',
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
        file: createMockFile(),
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
        file: createMockFile(),
        pluginSettingsComponent,
        subpath: ''
      });

      mockMutationObserverCallback([], {} as MutationObserver);

      expect(containerEl.setCssProps).toHaveBeenCalledWith(
        expect.objectContaining({ width: '50%' })
      );
    });

    // Regression: for a numeric alias (`![[basic.html|400]]`) Obsidian routes `400` into the `width`
    // Attribute and resets `alt` to the file name `basic.html`. Parsing that file name as a size token
    // Mis-read it as `width: basic.html` (invalid CSS the browser drops), silently clobbering the real
    // `width` attribute so the embed fell back to the default 100% width instead of 400px.
    it('should ignore an alt that is only the file name so the numeric width attribute wins', () => {
      const containerEl = createMockContainerEl();
      containerEl.getAttr.mockImplementation((attr: string) => {
        if (attr === 'alt') {
          return 'basic.html';
        }
        if (attr === 'width') {
          return '400';
        }
        return null;
      });
      const pluginSettingsComponent = createMockPluginSettingsComponent();
      const mockApp = createMockApp();

      new HtmlEmbedComponent({
        app: mockApp,
        containerEl: asContainerEl(containerEl),
        file: createMockFile('basic.html'),
        pluginSettingsComponent,
        subpath: ''
      });

      mockMutationObserverCallback([], {} as MutationObserver);

      expect(containerEl.setCssProps).toHaveBeenCalledWith(
        // Width from the attribute (not the bogus file-name token); height falls back to the default.
        expect.objectContaining({ height: '400px', width: '400px' })
      );
    });

    // Regression: same file-name fallback for a `WxH` alias (`![[basic.html|600x200]]`) — both numeric
    // Attributes must survive the file name being present in `alt`.
    it('should keep both numeric attributes when alt is the file name', () => {
      const containerEl = createMockContainerEl();
      containerEl.getAttr.mockImplementation((attr: string) => {
        if (attr === 'alt') {
          return 'basic.html';
        }
        if (attr === 'width') {
          return '600';
        }
        if (attr === 'height') {
          return '200';
        }
        return null;
      });
      const pluginSettingsComponent = createMockPluginSettingsComponent();
      const mockApp = createMockApp();

      new HtmlEmbedComponent({
        app: mockApp,
        containerEl: asContainerEl(containerEl),
        file: createMockFile('basic.html'),
        pluginSettingsComponent,
        subpath: ''
      });

      mockMutationObserverCallback([], {} as MutationObserver);

      expect(containerEl.setCssProps).toHaveBeenCalledWith(
        expect.objectContaining({ height: '200px', width: '600px' })
      );
    });

    // The guard is narrow: a genuine non-numeric token never equals the file name, so it is still parsed.
    it('should still parse a non-numeric alt token that is not the file name', () => {
      const containerEl = createMockContainerEl();
      containerEl.getAttr.mockImplementation((attr: string) => (attr === 'alt' ? 'width: 50%; min-width: 300px' : null));
      const pluginSettingsComponent = createMockPluginSettingsComponent();
      const mockApp = createMockApp();

      new HtmlEmbedComponent({
        app: mockApp,
        containerEl: asContainerEl(containerEl),
        file: createMockFile('basic.html'),
        pluginSettingsComponent,
        subpath: ''
      });

      mockMutationObserverCallback([], {} as MutationObserver);

      expect(containerEl.setCssProps).toHaveBeenCalledWith(
        expect.objectContaining({ 'min-width': '300px', 'width': '50%' })
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
        querySelector: vi.fn().mockReturnValue({ href: '' }),
        querySelectorAll: vi.fn().mockReturnValue([])
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
        file: createMockFile(),
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
        querySelector: vi.fn().mockReturnValue(mockBaseEl),
        querySelectorAll: vi.fn().mockReturnValue([])
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
        file: createMockFile(),
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
        querySelector: vi.fn().mockReturnValue(mockBaseEl),
        querySelectorAll: vi.fn().mockReturnValue([])
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
        file: createMockFile(),
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
        querySelector: vi.fn().mockReturnValue(null),
        querySelectorAll: vi.fn().mockReturnValue([])
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
        file: createMockFile(),
        pluginSettingsComponent,
        subpath: ''
      });

      await component.loadFileAsync();

      // PREPENDED, not appended: a `<base>` only governs the elements that FOLLOW it, so appending it left
      // Every preceding relative `<link>` / `<script>` / `<img>` resolving against Obsidian's own origin.
      expect(mockParsedDoc.head.createEl).toHaveBeenCalledWith('base', { prepend: true });
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
        querySelectorAll: vi.fn().mockReturnValue([]),
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
        querySelector: vi.fn().mockReturnValue({ href: '' }),
        querySelectorAll: vi.fn().mockReturnValue([])
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
        file: createMockFile(),
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
        querySelector: vi.fn().mockReturnValue({ href: '' }),
        querySelectorAll: vi.fn().mockReturnValue([])
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
        file: createMockFile(),
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
        querySelector: vi.fn().mockReturnValue({ href: '' }),
        querySelectorAll: vi.fn().mockReturnValue([])
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
        file: createMockFile(),
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
        querySelectorAll: vi.fn().mockReturnValue([]),
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
        querySelector: vi.fn().mockReturnValue({ href: '' }),
        querySelectorAll: vi.fn().mockReturnValue([])
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
        file: createMockFile(),
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
        querySelectorAll: vi.fn().mockReturnValue([]),
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
        querySelector: vi.fn().mockReturnValue({ href: '' }),
        querySelectorAll: vi.fn().mockReturnValue([])
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
        file: createMockFile(),
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
        querySelectorAll: vi.fn().mockReturnValue([]),
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
        querySelector: vi.fn().mockReturnValue({ href: '' }),
        querySelectorAll: vi.fn().mockReturnValue([])
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
        file: createMockFile(),
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
        querySelectorAll: vi.fn().mockReturnValue([]),
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
        querySelector: vi.fn().mockReturnValue({ href: '' }),
        querySelectorAll: vi.fn().mockReturnValue([])
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
        file: createMockFile(),
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
        querySelectorAll: vi.fn().mockReturnValue([]),
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
        querySelector: vi.fn().mockReturnValue({ href: '' }),
        querySelectorAll: vi.fn().mockReturnValue([])
      };

      window.DOMParser = castTo<typeof DOMParser>(
        class MockDOMParser {
          public parseFromString(): unknown {
            return mockParsedDoc;
          }
        }
      );

      vi.stubGlobal('location', { origin: 'app://obsidian.md' });

      const mockDateNow = 1_234_567_890;
      const mockDateNowString = String(mockDateNow);
      vi.spyOn(Date, 'now').mockReturnValue(mockDateNow);

      const component = new HtmlEmbedComponent({
        app: mockApp,
        containerEl: asContainerEl(containerEl),
        file: createMockFile(),
        pluginSettingsComponent,
        subpath: '#myId&mode=extract'
      });

      await component.loadFileAsync();
      loadHandler?.();

      expect(targetEl.addClass).toHaveBeenCalledWith(`extracted-${mockDateNowString}`);
      expect(parentEl.addClass).toHaveBeenCalledWith(`extracted-parent-${mockDateNowString}`);
      expect(grandParentEl.addClass).toHaveBeenCalledWith(`extracted-parent-${mockDateNowString}`);
      expect(mockContentDocument.head.createEl).toHaveBeenCalledWith(
        'style',
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Vitest matcher returns `any`.
          text: expect.stringContaining('display:none !important')
        })
      );
    });
  });

  describe('alt token set after the first render', () => {
    it('should re-apply the size without re-rendering the embed', async () => {
      let altValue: null | string = null;

      const containerEl = createMockContainerEl();
      containerEl.getAttr.mockImplementation((attribute: string) => attribute === 'alt' ? altValue : null);
      containerEl.createEl.mockReturnValue({
        addEventListener: vi.fn(),
        setCssStyles: vi.fn(),
        srcdoc: ''
      });

      const mockParsedDoc = {
        documentElement: { outerHTML: '<html></html>' },
        head: { createEl: vi.fn().mockReturnValue({}) },
        querySelector: vi.fn().mockReturnValue({ href: '' }),
        querySelectorAll: vi.fn().mockReturnValue([])
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
        app: createMockApp(),
        containerEl: asContainerEl(containerEl),
        file: createMockFile(),
        pluginSettingsComponent: createMockPluginSettingsComponent(),
        subpath: ''
      });

      // Obsidian can set `alt` only AFTER calling `loadFile`, so the first render never saw the token.
      await component.loadFileAsync();
      expect(containerEl.empty).toHaveBeenCalledOnce();

      altValue = 'width: 600px';
      mockMutationObserverCallback([], {} as MutationObserver);
      await waitForAllAsyncOperations();

      // The late token reaches the box, and re-reading it never costs a re-render (which would reload
      // The document and throw away the iframe's scroll position).
      expect(containerEl.setCssProps).toHaveBeenLastCalledWith(expect.objectContaining({ width: '600px' }));
      expect(containerEl.empty).toHaveBeenCalledOnce();
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
        querySelectorAll: vi.fn().mockReturnValue([]),
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
        querySelector: vi.fn().mockReturnValue({ href: '' }),
        querySelectorAll: vi.fn().mockReturnValue([])
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
        file: createMockFile(),
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

    it('should back off by the height of a sticky header covering the target', async () => {
      const TARGET_TOP = 200;
      const HEADER_BOTTOM = 240;
      const EXPECTED_OVERLAP = HEADER_BOTTOM - TARGET_TOP;

      const targetEl: MockElement = {
        addClass: vi.fn(),
        closest: vi.fn(),
        getBoundingClientRect: vi.fn().mockReturnValue({ left: 100, top: TARGET_TOP, width: 0 }),
        parentElement: null
      };

      // The header sits over the target's top edge once the scroll has pinned it there.
      const stickyHeaderEl = {
        contains: vi.fn().mockReturnValue(false),
        getBoundingClientRect: vi.fn().mockReturnValue({ bottom: HEADER_BOTTOM })
      };

      const mockScrollingEl = {
        getBoundingClientRect: vi.fn().mockReturnValue({ left: 10, top: 20 }),
        scrollBy: vi.fn()
      };

      const mockContentDocument = {
        addEventListener: vi.fn(),
        defaultView: {
          Element: MockIframeElement,
          getComputedStyle: vi.fn().mockReturnValue({ position: 'sticky' }),
          innerWidth: 800
        },
        documentElement: {},
        elementsFromPoint: vi.fn().mockReturnValue([stickyHeaderEl]),
        getElementById: vi.fn().mockReturnValue(targetEl),
        querySelectorAll: vi.fn().mockReturnValue([]),
        removeEventListener: vi.fn(),
        scrollingElement: mockScrollingEl
      };

      // The target is not an ancestor or descendant of the header.
      castTo<ContainsCheck>(targetEl).contains = vi.fn().mockReturnValue(false);

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
        querySelector: vi.fn().mockReturnValue({ href: '' }),
        querySelectorAll: vi.fn().mockReturnValue([])
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
        file: createMockFile(),
        pluginSettingsComponent,
        subpath: '#myId'
      });

      await component.loadFileAsync();
      loadHandler?.();

      expect(mockScrollingEl.scrollBy).toHaveBeenLastCalledWith({
        behavior: 'instant',
        top: -EXPECTED_OVERLAP
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
        querySelectorAll: vi.fn().mockReturnValue([]),
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
        querySelector: vi.fn().mockReturnValue({ href: '' }),
        querySelectorAll: vi.fn().mockReturnValue([])
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
        file: createMockFile(),
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
        querySelectorAll: vi.fn().mockReturnValue([]),
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
        querySelector: vi.fn().mockReturnValue({ href: '' }),
        querySelectorAll: vi.fn().mockReturnValue([])
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
        file: createMockFile(),
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
        querySelectorAll: vi.fn().mockReturnValue([]),
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
        querySelector: vi.fn().mockReturnValue({ href: '' }),
        querySelectorAll: vi.fn().mockReturnValue([])
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
        file: createMockFile(),
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
        querySelectorAll: vi.fn().mockReturnValue([]),
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
        querySelector: vi.fn().mockReturnValue({ href: '' }),
        querySelectorAll: vi.fn().mockReturnValue([])
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
        file: createMockFile(),
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
        file: createMockFile(),
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
        file: createMockFile(),
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
        file: createMockFile(),
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
        querySelector: vi.fn().mockReturnValue({ href: '' }),
        querySelectorAll: vi.fn().mockReturnValue([])
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
      'background': '',
      'border': '',
      'border-radius': '',
      'height': '400px',
      'max-height': '800px',
      'max-width': '',
      'min-height': '',
      'min-width': '100px',
      'overflow': '',
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
      querySelectorAll: vi.fn().mockReturnValue([]),
      removeEventListener: vi.fn()
    };
  }

  function createContentComponent(containerEl: MockContainerEl, iframeEl: unknown): HtmlEmbedComponent {
    const component = new HtmlEmbedComponent({
      app: createMockApp(),
      containerEl: asContainerEl(containerEl),
      file: createMockFile(),
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
      querySelector: vi.fn().mockReturnValue({ href: '' }),
      querySelectorAll: vi.fn().mockReturnValue([])
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

describe('decoration (border/background)', () => {
  function createDecorationSettingsComponent(overrides: DecorationOverrides): PluginSettingsComponent {
    return strictProxy<PluginSettingsComponent>({
      settings: {
        background: overrides.background ?? '',
        border: overrides.border ?? '',
        borderRadius: overrides.borderRadius ?? '',
        defaultHeight: '400px',
        defaultMaxHeight: '',
        defaultMaxWidth: '',
        defaultMinHeight: '',
        defaultMinWidth: '',
        defaultWidth: '100%',
        shouldShowOpenInExternalBrowserButton: false
      }
    });
  }

  function applySizeWithDecoration(overrides: DecorationOverrides): MockContainerEl {
    const containerEl = createMockContainerEl();
    const component = new HtmlEmbedComponent({
      app: createMockApp(),
      containerEl: asContainerEl(containerEl),
      file: createMockFile(),
      pluginSettingsComponent: createDecorationSettingsComponent(overrides),
      subpath: ''
    });
    castTo<ComponentWithApplySize>(component).applySize();
    return containerEl;
  }

  it('should apply border, background and border-radius from settings', () => {
    const containerEl = applySizeWithDecoration({ background: 'var(--background-primary)', border: '1px solid blue', borderRadius: '8px' });

    expect(containerEl.setCssProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        'background': 'var(--background-primary)',
        'border': '1px solid blue',
        'border-radius': '8px',
        'overflow': 'hidden'
      })
    );
  });

  it('should treat a bare numeric border radius as pixels', () => {
    const containerEl = applySizeWithDecoration({ borderRadius: '12' });

    expect(containerEl.setCssProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ 'border-radius': '12px', 'overflow': 'hidden' })
    );
  });

  it('should not clip (overflow) when no border radius is configured', () => {
    const containerEl = applySizeWithDecoration({ background: 'white', border: '2px dashed red' });

    expect(containerEl.setCssProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ 'border-radius': '', 'overflow': '' })
    );
  });
});

function findClickHandler(
  addEventListenerMock: ReturnType<typeof vi.fn>
): ClickHandler | undefined {
  const clickCall = addEventListenerMock.mock.calls.find((call) => call[0] === 'click');
  return clickCall?.[1] as ClickHandler | undefined;
}

/*
 * The optional affordance that hands the embedded file to the system's default browser, where a real
 * browser brings tabs, zoom, find and print. Gated on a `FileSystemAdapter` because that identifies the
 * DESKTOP app — mobile can produce a full path too, but Obsidian exposes no way to hand a local file to a
 * browser there.
 */
describe('open in external browser button', () => {
  beforeEach(() => {
    // This block is top-level, so it installs its own MutationObserver stub rather than relying on the
    // Main describe's beforeEach having run first.
    window.MutationObserver = castTo<typeof MutationObserver>(
      class MockMutationObserver {
        public disconnect = vi.fn();

        public observe(): void {
          noop();
        }
      }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render the button and hand the file URL to the browser when it is clicked', async () => {
    const onClickSpy = vi.spyOn(ButtonComponent.prototype, 'onClick');
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    const harness = await loadWithExternalBrowserButtonAsync({ hasFileSystem: true, isSettingEnabled: true });

    expect(harness.buttonEls).toHaveLength(1);
    expect(harness.buttonEls[0]?.textContent).toBe('Open in external browser');

    // The mocked `ButtonComponent` stores the handler rather than wiring a DOM listener, so the click
    // Is driven through the callback the component registered.
    const clickHandler = onClickSpy.mock.calls[0]?.[0];
    clickHandler?.(new MouseEvent('click'));

    // The `_external` target is what sends the URL to the SYSTEM browser rather than an in-app window.
    expect(openSpy).toHaveBeenCalledWith('file:///C:/Vault/Doc.html', '_external');
  });

  it('should still render the embed itself, so the button is an addition rather than a replacement', async () => {
    const harness = await loadWithExternalBrowserButtonAsync({ hasFileSystem: true, isSettingEnabled: true });

    expect(harness.containerEl.createEl).toHaveBeenCalledWith('iframe', expect.anything());
  });

  it('should not render the button on mobile, where Obsidian cannot launch a browser for a local file', async () => {
    // `createMockApp`'s adapter is not a `FileSystemAdapter`, which is how the component recognizes mobile.
    const harness = await loadWithExternalBrowserButtonAsync({ hasFileSystem: false, isSettingEnabled: true });

    expect(harness.buttonEls).toHaveLength(0);
    expect(harness.containerEl.createEl).toHaveBeenCalledWith('iframe', expect.anything());
  });

  it('should not render the button when the setting is off', async () => {
    const harness = await loadWithExternalBrowserButtonAsync({ hasFileSystem: true, isSettingEnabled: false });

    expect(harness.buttonEls).toHaveLength(0);
  });
});

async function loadWithExternalBrowserButtonAsync(
  params: OpenInExternalBrowserHarnessParams
): Promise<OpenInExternalBrowserHarness> {
  const app = createMockApp();
  if (params.hasFileSystem) {
    const adapter = FileSystemAdapter.create__(String.raw`C:\Vault`);
    seedOnRawTarget(app.vault, 'adapter', adapter.asOriginalType__());
  }

  const pluginSettingsComponent = createMockPluginSettingsComponent();
  castTo<MutableOpenInExternalBrowserSetting>(pluginSettingsComponent.settings).shouldShowOpenInExternalBrowserButton = params.isSettingEnabled;

  // The button and the iframe are both created on the container, so the mock dispatches on the tag name
  // Instead of answering every call with the same element.
  const buttonEls: HTMLButtonElement[] = [];
  const containerEl = createMockContainerEl();
  containerEl.createEl.mockImplementation((tagName: string) => {
    if (tagName === 'button') {
      const buttonEl = createEl('button');
      buttonEls.push(buttonEl);
      return buttonEl;
    }

    return {
      addEventListener: vi.fn(),
      setCssStyles: vi.fn(),
      srcdoc: ''
    };
  });

  const mockParsedDoc = {
    documentElement: { outerHTML: '<html></html>' },
    head: { createEl: vi.fn().mockReturnValue({}) },
    querySelector: vi.fn().mockReturnValue({ href: '' }),
    querySelectorAll: vi.fn().mockReturnValue([])
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
    app,
    containerEl: asContainerEl(containerEl),
    file: createMockFile('Doc.html'),
    pluginSettingsComponent,
    subpath: ''
  });
  component.load();
  await component.loadFileAsync();

  return {
    buttonEls,
    containerEl
  };
}

/*
 * Obsidian's page CSP follows the embed into its `srcdoc` iframe and blocks every external stylesheet, so
 * the plugin inlines them. A script in the embedded document can add a `<link rel="stylesheet">` at any
 * time, which is blocked exactly the same way — hence a `MutationObserver` on the LOADED document, narrowed
 * to `<link>` so the `<style>` elements the pass inserts cannot retrigger it.
 */
describe('stylesheet observer on the loaded document', () => {
  beforeEach(() => {
    // This block is top-level, so it installs its own MutationObserver stub for the CONTAINER observer
    // Rather than relying on the main describe's beforeEach having run first.
    window.MutationObserver = castTo<typeof MutationObserver>(
      class MockMutationObserver {
        public disconnect = vi.fn();

        public observe(): void {
          noop();
        }
      }
    );
  });

  it('should re-inline when a link is added, and ignore every other insertion', async () => {
    const harness = await loadWithStylesheetObserverAsync();
    const passesAfterLoad = harness.iframeDoc.querySelectorAll.mock.calls.length;

    // Inserting a `<style>` is what the pass itself does, so it must not retrigger the pass.
    harness.fireMutations([createAddedNodeMutation('STYLE')]);
    await waitForAllAsyncOperations();

    expect(harness.iframeDoc.querySelectorAll.mock.calls.length).toBe(passesAfterLoad);

    harness.fireMutations([createAddedNodeMutation('LINK')]);
    await waitForAllAsyncOperations();

    expect(harness.iframeDoc.querySelectorAll.mock.calls.length).toBeGreaterThan(passesAfterLoad);
  });

  it('should re-inline when a link changes its href or rel, and ignore other elements', async () => {
    const harness = await loadWithStylesheetObserverAsync();
    const passesAfterLoad = harness.iframeDoc.querySelectorAll.mock.calls.length;

    harness.fireMutations([createAttributeMutation('DIV')]);
    await waitForAllAsyncOperations();

    expect(harness.iframeDoc.querySelectorAll.mock.calls.length).toBe(passesAfterLoad);

    harness.fireMutations([createAttributeMutation('LINK')]);
    await waitForAllAsyncOperations();

    expect(harness.iframeDoc.querySelectorAll.mock.calls.length).toBeGreaterThan(passesAfterLoad);
  });

  it('should watch link additions and href/rel changes anywhere in the document', async () => {
    const harness = await loadWithStylesheetObserverAsync();

    expect(harness.observe).toHaveBeenCalledWith(harness.iframeDoc, {
      attributeFilter: ['href', 'rel'],
      attributes: true,
      childList: true,
      subtree: true
    });
  });

  it('should disconnect the stylesheet observer on unload', async () => {
    const harness = await loadWithStylesheetObserverAsync();

    harness.component.unload();

    expect(harness.disconnect).toHaveBeenCalled();
  });
});

function createAddedNodeMutation(nodeName: string): MutationRecord {
  return castTo<MutationRecord>({
    addedNodes: [{ nodeName }],
    type: 'childList'
  });
}

function createAttributeMutation(nodeName: string): MutationRecord {
  return castTo<MutationRecord>({
    target: { nodeName },
    type: 'attributes'
  });
}

async function loadWithStylesheetObserverAsync(): Promise<StylesheetObserverHarness> {
  const disconnect = vi.fn();
  const observe = vi.fn();
  let fireMutations: (mutations: MutationRecord[]) => void = noop;

  const iframeDoc: MockStylesheetIframeDoc = {
    addEventListener: vi.fn(),
    defaultView: {
      MutationObserver: class MockIframeMutationObserver {
        public disconnect = disconnect;
        public observe = observe;

        public constructor(callback: MutationCallback) {
          fireMutations = (mutations): void => {
            callback(mutations, castTo<MutationObserver>({}));
          };
        }
      }
    },
    getElementById: vi.fn().mockReturnValue(null),
    querySelectorAll: vi.fn().mockReturnValue([]),
    removeEventListener: vi.fn()
  };

  let loadHandler: (() => void) | undefined;
  const mockIframeEl = {
    addEventListener: vi.fn().mockImplementation((event: string, handler: () => void) => {
      if (event === 'load') {
        loadHandler = handler;
      }
    }),
    contentDocument: iframeDoc,
    setCssStyles: vi.fn(),
    srcdoc: ''
  };

  const containerEl = createMockContainerEl();
  containerEl.createEl.mockReturnValue(mockIframeEl);

  const mockParsedDoc = {
    documentElement: { outerHTML: '<html></html>' },
    head: { createEl: vi.fn().mockReturnValue({}) },
    querySelector: vi.fn().mockReturnValue({ href: '' }),
    querySelectorAll: vi.fn().mockReturnValue([])
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
    app: createMockApp(),
    containerEl: asContainerEl(containerEl),
    file: createMockFile(),
    pluginSettingsComponent: createMockPluginSettingsComponent(),
    subpath: ''
  });
  component.load();
  await component.loadFileAsync();
  loadHandler?.();
  await waitForAllAsyncOperations();

  return {
    component,
    disconnect,
    fireMutations: (mutations): void => {
      fireMutations(mutations);
    },
    iframeDoc,
    observe
  };
}
