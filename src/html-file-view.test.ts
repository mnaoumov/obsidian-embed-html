import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

const addedChildren: unknown[] = [];

const FileViewMock = vi.hoisted(() =>
  class {
    public app: unknown;
    public contentEl = {
      getAttr: vi.fn().mockReturnValue(null),
      setCssProps: vi.fn()
    };

    public leaf: unknown;

    public constructor(leaf: unknown) {
      this.leaf = leaf;
      this.app = (leaf as { app: unknown }).app;
    }

    public addChild(child: unknown): void {
      addedChildren.push(child);
    }

    public async onLoadFile(_file: unknown): Promise<void> {
      // noop
    }

    public setEphemeralState(_state: unknown): void {
      // noop
    }
  }
);

vi.mock('obsidian', () => ({
  Component: class MockComponent {
    public register(): void {
      // noop
    }

    public registerDomEvent(): void {
      // noop
    }
  },
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
import { HtmlFileView } from './html-file-view.ts';

describe('HtmlFileView', () => {
  it('should have correct VIEW_TYPE', () => {
    expect(HtmlFileView.VIEW_TYPE).toBe('html-file-view');
  });

  it('should return VIEW_TYPE from getViewType', () => {
    const mockLeaf = { app: {} };
    const view = new HtmlFileView(mockLeaf as never, {} as never);

    expect(view.getViewType()).toBe('html-file-view');
  });

  it('should create HtmlEmbedComponent and load file on onLoadFile', async () => {
    addedChildren.length = 0;

    globalThis.MutationObserver = class MockMutationObserver {
      public disconnect(): void {
        // noop
      }

      public observe(): void {
        // noop
      }
    } as unknown as typeof MutationObserver;

    const mockApp = {
      vault: {
        getResourcePath: vi.fn().mockReturnValue('app://vault/file.html'),
        read: vi.fn().mockResolvedValue('<html><head></head><body></body></html>')
      }
    };
    const mockLeaf = { app: mockApp };
    const mockPluginSettingsComponent = {
      settings: { defaultHeight: '400px', defaultWidth: '100%' }
    };

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

    const view = new HtmlFileView(mockLeaf as never, mockPluginSettingsComponent as never);

    const mockFile = {};
    view.contentEl.createEl = vi.fn().mockReturnValue({
      addEventListener: vi.fn(),
      src: ''
    });
    view.contentEl.empty = vi.fn();

    await view.onLoadFile(mockFile as never);

    expect(addedChildren).toHaveLength(1);
  });

  it('should delegate setEphemeralState to htmlEmbedComponent', async () => {
    addedChildren.length = 0;

    globalThis.MutationObserver = class MockMutationObserver {
      public disconnect(): void {
        // noop
      }

      public observe(): void {
        // noop
      }
    } as unknown as typeof MutationObserver;

    const mockApp = {
      vault: {
        getResourcePath: vi.fn().mockReturnValue('app://vault/file.html'),
        read: vi.fn().mockResolvedValue('<html><head></head><body></body></html>')
      }
    };
    const mockLeaf = { app: mockApp };
    const mockPluginSettingsComponent = {
      settings: { defaultHeight: '400px', defaultWidth: '100%' }
    };

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

    const view = new HtmlFileView(mockLeaf as never, mockPluginSettingsComponent as never);

    view.contentEl.createEl = vi.fn().mockReturnValue({
      addEventListener: vi.fn(),
      src: ''
    });
    view.contentEl.empty = vi.fn();

    await view.onLoadFile({} as never);

    const mockInvokeAsyncSafely = (await import('obsidian-dev-utils/async')).invokeAsyncSafely as ReturnType<typeof vi.fn>;
    mockInvokeAsyncSafely.mockClear();

    view.setEphemeralState({ subpath: '#test' });

    expect(mockInvokeAsyncSafely).toHaveBeenCalled();
  });

  it('should use empty string when ephemeral state has no subpath', async () => {
    addedChildren.length = 0;

    globalThis.MutationObserver = class MockMutationObserver {
      public disconnect(): void {
        // noop
      }

      public observe(): void {
        // noop
      }
    } as unknown as typeof MutationObserver;

    const mockApp = {
      vault: {
        getResourcePath: vi.fn().mockReturnValue('app://vault/file.html'),
        read: vi.fn().mockResolvedValue('<html><head></head><body></body></html>')
      }
    };
    const mockLeaf = { app: mockApp };
    const mockPluginSettingsComponent = {
      settings: { defaultHeight: '400px', defaultWidth: '100%' }
    };

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

    const view = new HtmlFileView(mockLeaf as never, mockPluginSettingsComponent as never);

    view.contentEl.createEl = vi.fn().mockReturnValue({
      addEventListener: vi.fn(),
      src: ''
    });
    view.contentEl.empty = vi.fn();

    await view.onLoadFile({} as never);

    const mockInvokeAsyncSafely = (await import('obsidian-dev-utils/async')).invokeAsyncSafely as ReturnType<typeof vi.fn>;
    mockInvokeAsyncSafely.mockClear();

    view.setEphemeralState({});

    expect(mockInvokeAsyncSafely).toHaveBeenCalled();
  });

  it('should not crash when setEphemeralState is called before onLoadFile', () => {
    const mockLeaf = { app: {} };
    const view = new HtmlFileView(mockLeaf as never, {} as never);

    expect(() => {
      view.setEphemeralState({ subpath: '#test' });
    }).not.toThrow();
  });
});
