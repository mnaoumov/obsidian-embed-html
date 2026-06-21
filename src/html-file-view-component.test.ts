import type {
  App,
  ViewCreator
} from 'obsidian';

import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import { App as AppMock } from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { HtmlExtensions } from './html-extensions.ts';
import type { PluginSettingsComponent } from './plugin-settings-component.ts';
import type { Plugin } from './plugin.ts';

import { HtmlFileViewComponent } from './html-file-view-component.ts';
import { HtmlFileView } from './html-file-view.ts';

const VIEW_TYPE = 'html-file-view';

describe('HtmlFileViewComponent', () => {
  it('should register extensions and the view on load', () => {
    const harness = createHarness();

    harness.component.load();

    expect(harness.registerExtensions).toHaveBeenCalledWith(['html'], VIEW_TYPE);
    expect(harness.registerView).toHaveBeenCalledWith(VIEW_TYPE, expect.any(Function));
  });

  it('should create an HtmlFileView instance from the registered view factory', () => {
    const harness = createHarness();

    harness.component.load();

    const factory = harness.registerView.mock.calls[0]?.[1];
    expect(factory).toBeInstanceOf(Function);

    // The real test-mocks App mints a real WorkspaceLeaf whose `app__` satisfies the real
    // test-mocks FileView/ItemView/View constructor chain that HtmlFileView extends.
    const leaf = AppMock.createConfigured__().workspace.getLeaf();
    const view = factory?.(leaf.asOriginalType3__());

    expect(view).toBeInstanceOf(HtmlFileView);
  });

  it('should unregister extensions when unloaded', () => {
    const harness = createHarness();

    harness.component.load();
    expect(harness.unregisterExtensions).not.toHaveBeenCalled();

    harness.component.unload();

    expect(harness.unregisterExtensions).toHaveBeenCalledWith(['html']);
  });
});

interface Harness {
  readonly component: HtmlFileViewComponent;
  readonly registerExtensions: ReturnType<typeof vi.fn>;
  readonly registerView: ReturnType<typeof vi.fn<(viewType: string, viewCreator: ViewCreator) => void>>;
  readonly unregisterExtensions: ReturnType<typeof vi.fn>;
}

function createHarness(): Harness {
  const registerExtensions = vi.fn();
  const unregisterExtensions = vi.fn();
  const registerView = vi.fn<(viewType: string, viewCreator: ViewCreator) => void>();

  const app = strictProxy<App>({
    viewRegistry: strictProxy<App['viewRegistry']>({
      registerExtensions,
      unregisterExtensions
    })
  });
  const plugin = strictProxy<Plugin>({ registerView });
  const pluginSettingsComponent = strictProxy<PluginSettingsComponent>({});
  const htmlExtensions = strictProxy<HtmlExtensions>({
    list: vi.fn(() => ['html'])
  });

  const component = new HtmlFileViewComponent(app, plugin, pluginSettingsComponent, htmlExtensions);
  return {
    component,
    registerExtensions,
    registerView,
    unregisterExtensions
  };
}
