import type {
  TFile,
  WorkspaceLeaf
} from 'obsidian';

import { Component } from 'obsidian';
import { noopAsync } from 'obsidian-dev-utils/function';
import { castTo } from 'obsidian-dev-utils/object-utils';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { PluginSettingsComponent } from './plugin-settings-component.ts';

interface EmbedStub extends Component {
  loadFileAsync: ReturnType<typeof vi.fn>;
  setSubpath: ReturnType<typeof vi.fn>;
}

vi.mock('./html-embed-component.ts', () => ({
  // eslint-disable-next-line prefer-arrow-callback, func-names -- mock must be constructable with `new` and return a loadable Component.
  HtmlEmbedComponent: vi.fn(function (): Component {
    const component = castTo<EmbedStub>(new Component());
    component.loadFileAsync = vi.fn(noopAsync);
    component.setSubpath = vi.fn();
    return component;
  })
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { HtmlEmbedComponent } from './html-embed-component.ts';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { HtmlFileView } from './html-file-view.ts';

let pluginSettingsComponent: PluginSettingsComponent;
let leaf: WorkspaceLeaf;

describe('HtmlFileView', () => {
  it('should have correct VIEW_TYPE', () => {
    expect(HtmlFileView.VIEW_TYPE).toBe('html-file-view');
  });

  it('should return VIEW_TYPE from getViewType', () => {
    const view = new HtmlFileView(leaf, pluginSettingsComponent);
    expect(view.getViewType()).toBe('html-file-view');
  });

  it('should create HtmlEmbedComponent and load file on onLoadFile', async () => {
    const view = new HtmlFileView(leaf, pluginSettingsComponent);
    const file = strictProxy<TFile>({});
    const addChildSpy = vi.spyOn(view, 'addChild');

    await view.onLoadFile(file);

    expect(vi.mocked(HtmlEmbedComponent)).toHaveBeenCalledOnce();
    const params = vi.mocked(HtmlEmbedComponent).mock.calls[0]?.[0];
    expect(params?.app).toBe(view.app);
    expect(params?.containerEl).toBe(view.contentEl);
    expect(params?.file).toBe(file);
    expect(params?.pluginSettingsComponent).toBe(pluginSettingsComponent);
    expect(params?.subpath).toBe('');

    const embed = embedInstance();
    expect(addChildSpy).toHaveBeenCalledExactlyOnceWith(embed);
    expect(embed.loadFileAsync).toHaveBeenCalledOnce();
  });

  it('should delegate setEphemeralState to htmlEmbedComponent', async () => {
    const view = new HtmlFileView(leaf, pluginSettingsComponent);
    await view.onLoadFile(strictProxy<TFile>({}));

    const embed = embedInstance();
    view.setEphemeralState({ subpath: '#test' });

    expect(embed.setSubpath).toHaveBeenCalledExactlyOnceWith('#test');
  });

  it('should use empty string when ephemeral state has no subpath', async () => {
    const view = new HtmlFileView(leaf, pluginSettingsComponent);
    await view.onLoadFile(strictProxy<TFile>({}));

    const embed = embedInstance();
    view.setEphemeralState({});

    expect(embed.setSubpath).toHaveBeenCalledExactlyOnceWith('');
  });

  it('should not crash when setEphemeralState is called before onLoadFile', () => {
    const view = new HtmlFileView(leaf, pluginSettingsComponent);

    expect(() => {
      view.setEphemeralState({ subpath: '#test' });
    }).not.toThrow();
  });
});

beforeEach(() => {
  vi.clearAllMocks();

  const app = App.createConfigured__();
  leaf = app.workspace.getLeaf().asOriginalType3__();
  pluginSettingsComponent = strictProxy<PluginSettingsComponent>({});
});

function embedInstance(): EmbedStub {
  return castTo<EmbedStub>(vi.mocked(HtmlEmbedComponent).mock.results[0]?.value);
}
