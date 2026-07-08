import type { ExtensionsRegistrar } from 'obsidian-dev-utils/obsidian/extensions-registrar';
import type { ViewRegistrar } from 'obsidian-dev-utils/obsidian/view-registrar';

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

import type { HtmlExtensions } from './html-extensions.ts';
import type { PluginSettingsComponent } from './plugin-settings-component.ts';

import { HtmlFileViewComponent } from './html-file-view-component.ts';
import { HtmlFileView } from './html-file-view.ts';

type RegisterExtensionsParams = Parameters<ExtensionsRegistrar['registerExtensions']>[0];
type RegisterViewParams = Parameters<ViewRegistrar['registerView']>[0];

const EXTENSIONS = ['html'];
const VIEW_TYPE = 'html-file-view';

let extensionsRegistrar: ExtensionsRegistrar;
let viewRegistrar: ViewRegistrar;
let registerExtensions: ReturnType<typeof vi.fn<ExtensionsRegistrar['registerExtensions']>>;
let registerView: ReturnType<typeof vi.fn<ViewRegistrar['registerView']>>;
let pluginSettingsComponent: PluginSettingsComponent;
let htmlExtensions: HtmlExtensions;

describe('HtmlFileViewComponent', () => {
  it('should register the html extensions for the view type on load', () => {
    const component = new HtmlFileViewComponent({
      extensionsRegistrar,
      htmlExtensions,
      pluginSettingsComponent,
      viewRegistrar
    });

    component.load();

    expect(registerExtensions).toHaveBeenCalledWith({
      extensions: EXTENSIONS,
      viewType: VIEW_TYPE
    });
  });

  it('should register the view type with a view creator on load', () => {
    const component = new HtmlFileViewComponent({
      extensionsRegistrar,
      htmlExtensions,
      pluginSettingsComponent,
      viewRegistrar
    });

    component.load();

    expect(registerView).toHaveBeenCalledOnce();
    const params = registerView.mock.calls[0]?.[0];
    expect(params?.type).toBe(VIEW_TYPE);
    expect(params?.viewCreator).toBeInstanceOf(Function);
  });

  it('should build an HtmlFileView instance from the registered view creator', () => {
    const component = new HtmlFileViewComponent({
      extensionsRegistrar,
      htmlExtensions,
      pluginSettingsComponent,
      viewRegistrar
    });
    component.load();

    const params = registerView.mock.calls[0]?.[0];
    const viewCreator = castTo<RegisterViewParams>(params).viewCreator;

    // The real test-mocks App mints a real WorkspaceLeaf whose `app__` satisfies the real
    // Test-mocks FileView/ItemView/View constructor chain that HtmlFileView extends.
    const leaf = App.createConfigured__().workspace.getLeaf();
    const view = viewCreator(leaf.asOriginalType3__());

    expect(view).toBeInstanceOf(HtmlFileView);
  });
});

beforeEach(() => {
  vi.clearAllMocks();

  registerExtensions = vi.fn<ExtensionsRegistrar['registerExtensions']>();
  registerView = vi.fn<ViewRegistrar['registerView']>();

  extensionsRegistrar = strictProxy<ExtensionsRegistrar>({
    registerExtensions: (params: RegisterExtensionsParams) => {
      registerExtensions(params);
    }
  });
  viewRegistrar = strictProxy<ViewRegistrar>({
    registerView: (params: RegisterViewParams) => {
      registerView(params);
    }
  });

  pluginSettingsComponent = strictProxy<PluginSettingsComponent>({});
  htmlExtensions = strictProxy<HtmlExtensions>({
    list: vi.fn(() => EXTENSIONS)
  });
});
