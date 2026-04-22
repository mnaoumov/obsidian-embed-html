import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

interface MockElement {
  addClass: ReturnType<typeof vi.fn>;
  closest: ReturnType<typeof vi.fn>;
  getBoundingClientRect: ReturnType<typeof vi.fn>;
  parentElement: MockElement | null;
  target?: string;
}

const invokeAsyncSafelyMock = vi.hoisted(() =>
  vi.fn((fn: () => Promise<void>) => {
    void fn();
  })
);

const trimStartMock = vi.hoisted(() =>
  vi.fn((str: string, prefix: string) => {
    if (str.startsWith(prefix)) {
      return str.slice(prefix.length);
    }
    return str;
  })
);

const registerCallbacks: (() => void)[] = [];
let domEventHandlers: Map<string, (evt: unknown) => void>;

const ComponentMock = vi.hoisted(() =>
  class {
    public register(cb: () => void): void {
      registerCallbacks.push(cb);
    }

    public registerDomEvent(_target: unknown, event: string, handler: (evt: unknown) => void): void {
      domEventHandlers.set(event, handler);
    }
  }
);

vi.mock('obsidian', () => ({
  App: vi.fn(),
  Component: ComponentMock,
  TFile: vi.fn()
}));

vi.mock('obsidian-dev-utils/async', () => ({
  invokeAsyncSafely: invokeAsyncSafelyMock
}));

vi.mock('obsidian-dev-utils/string', () => ({
  trimStart: trimStartMock
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { HtmlEmbedComponent } from './html-embed-component.ts';

interface MockContainerEl {
  addEventListener: ReturnType<typeof vi.fn>;
  createEl: ReturnType<typeof vi.fn>;
  empty: ReturnType<typeof vi.fn>;
  getAttr: ReturnType<typeof vi.fn>;
  setCssProps: ReturnType<typeof vi.fn>;
}

interface MockIframeEl {
  addEventListener: ReturnType<typeof vi.fn>;
  src: string;
}

function createMockContainerEl(): MockContainerEl {
  return {
    addEventListener: vi.fn(),
    createEl: vi.fn(),
    empty: vi.fn(),
    getAttr: vi.fn().mockReturnValue(null),
    setCssProps: vi.fn()
  };
}

interface MockPluginSettingsComponent {
  settings: {
    defaultHeight: string;
    defaultWidth: string;
  };
}

function createMockPluginSettingsComponent(): MockPluginSettingsComponent {
  return {
    settings: {
      defaultHeight: '400px',
      defaultWidth: '100%'
    }
  };
}

interface MockApp {
  vault: {
    getResourcePath: ReturnType<typeof vi.fn>;
    read: ReturnType<typeof vi.fn>;
  };
}

function createMockApp(): MockApp {
  return {
    vault: {
      getResourcePath: vi.fn().mockReturnValue('app://vault/file.html'),
      read: vi.fn().mockResolvedValue('<html><head></head><body>Hello</body></html>')
    }
  };
}

let mockMutationObserverDisconnect: ReturnType<typeof vi.fn>;
let mockMutationObserverCallback: MutationCallback;

describe('HtmlEmbedComponent', () => {
  beforeEach(() => {
    registerCallbacks.length = 0;
    domEventHandlers = new Map();
    mockMutationObserverDisconnect = vi.fn();

    globalThis.MutationObserver = class MockMutationObserver {
      public constructor(callback: MutationCallback) {
        mockMutationObserverCallback = callback;
      }

      public disconnect = mockMutationObserverDisconnect;

      public observe(): void {
        // noop
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
        app: mockApp as never,
        containerEl: containerEl as never,
        file: {} as never,
        pluginSettingsComponent: pluginSettingsComponent as never,
        subpath: ''
      });

      mockMutationObserverCallback([], {} as MutationObserver);

      expect(containerEl.setCssProps).toHaveBeenCalled();
    });

    it('should register cleanup that disconnects MutationObserver', () => {
      const containerEl = createMockContainerEl();
      const pluginSettingsComponent = createMockPluginSettingsComponent();
      const mockApp = createMockApp();

      new HtmlEmbedComponent({
        app: mockApp as never,
        containerEl: containerEl as never,
        file: {} as never,
        pluginSettingsComponent: pluginSettingsComponent as never,
        subpath: ''
      });

      expect(registerCallbacks).toHaveLength(1);
      registerCallbacks.at(0)?.();

      expect(mockMutationObserverDisconnect).toHaveBeenCalled();
    });
  });

  describe('updateSize via MutationObserver', () => {
    it('should use default settings when no attributes are set', () => {
      const containerEl = createMockContainerEl();
      const pluginSettingsComponent = createMockPluginSettingsComponent();
      const mockApp = createMockApp();

      new HtmlEmbedComponent({
        app: mockApp as never,
        containerEl: containerEl as never,
        file: {} as never,
        pluginSettingsComponent: pluginSettingsComponent as never,
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
        app: mockApp as never,
        containerEl: containerEl as never,
        file: {} as never,
        pluginSettingsComponent: pluginSettingsComponent as never,
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
        app: mockApp as never,
        containerEl: containerEl as never,
        file: {} as never,
        pluginSettingsComponent: pluginSettingsComponent as never,
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
        app: mockApp as never,
        containerEl: containerEl as never,
        file: {} as never,
        pluginSettingsComponent: pluginSettingsComponent as never,
        subpath: ''
      });

      mockMutationObserverCallback([], {} as MutationObserver);

      expect(containerEl.setCssProps).toHaveBeenCalledWith(
        expect.objectContaining({ width: '50%' })
      );
    });
  });

  describe('loadFile', () => {
    it('should call invokeAsyncSafely with loadFileAsync', () => {
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
        app: mockApp as never,
        containerEl: containerEl as never,
        file: {} as never,
        pluginSettingsComponent: pluginSettingsComponent as never,
        subpath: ''
      });

      invokeAsyncSafelyMock.mockClear();
      invokeAsyncSafelyMock.mockImplementation((fn: () => Promise<void>) => {
        void fn();
      });
      component.loadFile();

      expect(invokeAsyncSafelyMock).toHaveBeenCalled();
      expect(containerEl.empty).toHaveBeenCalled();
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
        app: mockApp as never,
        containerEl: containerEl as never,
        file: {} as never,
        pluginSettingsComponent: pluginSettingsComponent as never,
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
        app: mockApp as never,
        containerEl: containerEl as never,
        file: {} as never,
        pluginSettingsComponent: pluginSettingsComponent as never,
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
        app: mockApp as never,
        containerEl: containerEl as never,
        file: {} as never,
        pluginSettingsComponent: pluginSettingsComponent as never,
        subpath: ''
      });

      await component.loadFileAsync();

      expect(mockParsedDoc.head.createEl).toHaveBeenCalledWith('base');
      expect(mockCreatedBaseEl.href).toBe('app://vault/file.html');
    });

    it('should revoke object URL and init iframe on load', async () => {
      let loadHandler: (() => void) | undefined;
      const mockContentDocument = {
        defaultView: null,
        getElementById: vi.fn().mockReturnValue(null),
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
        app: mockApp as never,
        containerEl: containerEl as never,
        file: {} as never,
        pluginSettingsComponent: pluginSettingsComponent as never,
        subpath: ''
      });

      await component.loadFileAsync();

      expect(loadHandler).toBeDefined();
      loadHandler?.();

      expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
      expect(domEventHandlers.has('click')).toBe(true);
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
        app: mockApp as never,
        containerEl: containerEl as never,
        file: {} as never,
        pluginSettingsComponent: pluginSettingsComponent as never,
        subpath: ''
      });

      await component.loadFileAsync();
      loadHandler?.();

      expect(globalThis.URL.revokeObjectURL).toHaveBeenCalled();
      expect(domEventHandlers.has('click')).toBe(false);
    });
  });

  describe('setSubpath', () => {
    it('should update subpath and call loadFile', () => {
      const containerEl = createMockContainerEl();
      const pluginSettingsComponent = createMockPluginSettingsComponent();
      const mockApp = createMockApp();

      const component = new HtmlEmbedComponent({
        app: mockApp as never,
        containerEl: containerEl as never,
        file: {} as never,
        pluginSettingsComponent: pluginSettingsComponent as never,
        subpath: ''
      });

      invokeAsyncSafelyMock.mockClear();
      invokeAsyncSafelyMock.mockImplementation(() => {
        // Don't actually invoke the async function in this test
      });
      component.setSubpath('#myId');

      expect(invokeAsyncSafelyMock).toHaveBeenCalled();
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
        defaultView: mockIframeWin,
        getElementById: vi.fn().mockReturnValue(null)
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
        app: mockApp as never,
        containerEl: containerEl as never,
        file: {} as never,
        pluginSettingsComponent: pluginSettingsComponent as never,
        subpath: ''
      });

      await component.loadFileAsync();
      loadHandler?.();

      const clickHandler = domEventHandlers.get('click');
      expect(clickHandler).toBeDefined();

      clickHandler?.({ target: mockClickTarget });

      expect(mockAnchorEl.target).toBe('_blank');
    });

    it('should not set target when click target is not an instance of iframe Element', async () => {
      const MockElement = class {};
      const mockIframeWin = { Element: MockElement };
      const mockClickTarget = { notAnElement: true };

      const mockContentDocument = {
        defaultView: mockIframeWin,
        getElementById: vi.fn().mockReturnValue(null)
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
        app: mockApp as never,
        containerEl: containerEl as never,
        file: {} as never,
        pluginSettingsComponent: pluginSettingsComponent as never,
        subpath: ''
      });

      await component.loadFileAsync();
      loadHandler?.();

      const clickHandler = domEventHandlers.get('click');
      expect(clickHandler).toBeDefined();

      expect(() => {
        clickHandler?.({ target: mockClickTarget });
      }).not.toThrow();
    });

    it('should not crash when defaultView is null', async () => {
      const mockContentDocument = {
        defaultView: null,
        getElementById: vi.fn().mockReturnValue(null)
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
        app: mockApp as never,
        containerEl: containerEl as never,
        file: {} as never,
        pluginSettingsComponent: pluginSettingsComponent as never,
        subpath: ''
      });

      await component.loadFileAsync();
      loadHandler?.();

      const clickHandler = domEventHandlers.get('click');
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
        defaultView: mockIframeWin,
        getElementById: vi.fn().mockReturnValue(null)
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
        app: mockApp as never,
        containerEl: containerEl as never,
        file: {} as never,
        pluginSettingsComponent: pluginSettingsComponent as never,
        subpath: ''
      });

      await component.loadFileAsync();
      loadHandler?.();

      const clickHandler = domEventHandlers.get('click');

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
        defaultView: { Element: class {} },
        getElementById: vi.fn().mockReturnValue(targetEl),
        head: {
          createEl: vi.fn().mockReturnValue(createdStyleEl)
        }
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
        app: mockApp as never,
        containerEl: containerEl as never,
        file: {} as never,
        pluginSettingsComponent: pluginSettingsComponent as never,
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
        defaultView: { Element: class {} },
        documentElement: {},
        getElementById: vi.fn().mockReturnValue(targetEl),
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
        app: mockApp as never,
        containerEl: containerEl as never,
        file: {} as never,
        pluginSettingsComponent: pluginSettingsComponent as never,
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
        defaultView: { Element: class {} },
        documentElement: mockDocumentElement,
        getElementById: vi.fn().mockReturnValue(targetEl),
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
        app: mockApp as never,
        containerEl: containerEl as never,
        file: {} as never,
        pluginSettingsComponent: pluginSettingsComponent as never,
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
        defaultView: { Element: class {} },
        getElementById: vi.fn().mockReturnValue(null),
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
        app: mockApp as never,
        containerEl: containerEl as never,
        file: {} as never,
        pluginSettingsComponent: pluginSettingsComponent as never,
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
        defaultView: { Element: class {} },
        documentElement: {},
        getElementById: vi.fn().mockReturnValue(targetEl),
        head: { createEl: vi.fn() },
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
        app: mockApp as never,
        containerEl: containerEl as never,
        file: {} as never,
        pluginSettingsComponent: pluginSettingsComponent as never,
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
        defaultView: { Element: class {} },
        getElementById: vi.fn()
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
        app: mockApp as never,
        containerEl: containerEl as never,
        file: {} as never,
        pluginSettingsComponent: pluginSettingsComponent as never,
        subpath: ''
      });

      await component.loadFileAsync();
      loadHandler?.();

      expect(mockContentDocument.getElementById).not.toHaveBeenCalled();
    });
  });
});
