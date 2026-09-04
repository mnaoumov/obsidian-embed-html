import type {
  App as AppOriginal,
  PluginManifest
} from 'obsidian';

import { PluginExtensionsRegistrar } from 'obsidian-dev-utils/obsidian/extensions-registrar';
import { PluginViewRegistrar } from 'obsidian-dev-utils/obsidian/view-registrar';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

interface ComponentModule {
  Component: new () => object;
}

// `PluginDataHandler` and `PluginEventSourceImpl` are NOT stubbed: since obsidian-dev-utils 93.2 the base
// Builds its own settings component out of them during `onload`, and that component really calls
// `pluginEventSource.on`, so a bare `vi.fn()` double makes the base throw before `onloadImpl` runs (G49).
vi.mock('obsidian-dev-utils/obsidian/components/plugin-settings-tab-component', async () => {
  const { Component } = await vi.importActual<ComponentModule>('obsidian');
  return {
    // eslint-disable-next-line prefer-arrow-callback -- mock must be constructable with `new` and return a loadable Component.
    PluginSettingsTabComponent: vi.fn(function PluginSettingsTabComponentStub(): object {
      return new Component();
    })
  };
});

vi.mock('./plugin-settings-component.ts', async () => {
  const { Component } = await vi.importActual<ComponentModule>('obsidian');
  return {
    // eslint-disable-next-line prefer-arrow-callback -- mock must be constructable with `new` and return a loadable Component.
    PluginSettingsComponent: vi.fn(function PluginSettingsComponentStub(): object {
      return new Component();
    })
  };
});

vi.mock('./plugin-settings-tab.ts', () => ({
  PluginSettingsTab: vi.fn()
}));

vi.mock('./html-extensions.ts', () => ({
  HtmlExtensions: vi.fn()
}));

vi.mock('./html-embed-registry-component.ts', async () => {
  const { Component } = await vi.importActual<ComponentModule>('obsidian');
  return {
    // eslint-disable-next-line prefer-arrow-callback -- mock must be constructable with `new` and return a loadable Component.
    HtmlEmbedRegistryComponent: vi.fn(function HtmlEmbedRegistryComponentStub(): object {
      return new Component();
    })
  };
});

vi.mock('./html-file-view-component.ts', async () => {
  const { Component } = await vi.importActual<ComponentModule>('obsidian');
  return {
    // eslint-disable-next-line prefer-arrow-callback -- mock must be constructable with `new` and return a loadable Component.
    HtmlFileViewComponent: vi.fn(function HtmlFileViewComponentStub(): object {
      return new Component();
    })
  };
});

vi.mock('./open-in-new-tab-component.ts', async () => {
  const { Component } = await vi.importActual<ComponentModule>('obsidian');
  return {
    // eslint-disable-next-line prefer-arrow-callback -- mock must be constructable with `new` and return a loadable Component.
    OpenInNewTabComponent: vi.fn(function OpenInNewTabComponentStub(): object {
      return new Component();
    })
  };
});

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { CommandHandlerComponent } from 'obsidian-dev-utils/obsidian/command-handlers/command-handler-component';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { OpenDemoVaultCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/open-demo-vault-command-handler';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { PluginSettingsTabComponent } from 'obsidian-dev-utils/obsidian/components/plugin-settings-tab-component';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { PluginDataHandler } from 'obsidian-dev-utils/obsidian/data-handler';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { PluginEventSourceImpl } from 'obsidian-dev-utils/obsidian/plugin/plugin-event-source';

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { HtmlEmbedRegistryComponent } from './html-embed-registry-component.ts';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { HtmlExtensions } from './html-extensions.ts';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { HtmlFileViewComponent } from './html-file-view-component.ts';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { OpenInNewTabComponent } from './open-in-new-tab-component.ts';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { PluginSettingsComponent } from './plugin-settings-component.ts';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { PluginSettingsTab } from './plugin-settings-tab.ts';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { Plugin } from './plugin.ts';

const manifest = strictProxy<PluginManifest>({
  id: 'embed-html',
  name: 'Embed HTML',
  version: '2.2.0'
});

let app: AppOriginal;

describe('Plugin', () => {
  it('should construct the settings component with a data handler and event source', async () => {
    await createLoadedPlugin();

    expect(vi.mocked(PluginSettingsComponent)).toHaveBeenCalledOnce();
    const params = vi.mocked(PluginSettingsComponent).mock.calls[0]?.[0];
    expect(params?.dataHandler).toBeInstanceOf(PluginDataHandler);
    expect(params?.pluginEventSource).toBeInstanceOf(PluginEventSourceImpl);
  });

  it('should register the settings tab wired to the plugin and settings component', async () => {
    const plugin = await createLoadedPlugin();

    const settingsComponent: unknown = vi.mocked(PluginSettingsComponent).mock.results[0]?.value;
    const tabParams = vi.mocked(PluginSettingsTab).mock.calls[0]?.[0];
    expect(tabParams?.plugin).toBe(plugin);
    expect(tabParams?.pluginSettingsComponent).toBe(settingsComponent);

    const tabComponentParams = vi.mocked(PluginSettingsTabComponent).mock.calls[0]?.[0];
    expect(tabComponentParams?.plugin).toBe(plugin);
    expect(tabComponentParams?.pluginSettingsTab).toBe(vi.mocked(PluginSettingsTab).mock.results[0]?.value);
  });

  it('should register the embed registry with the app, extensions, and settings component', async () => {
    await createLoadedPlugin();

    const settingsComponent: unknown = vi.mocked(PluginSettingsComponent).mock.results[0]?.value;
    const htmlExtensions: unknown = vi.mocked(HtmlExtensions).mock.results[0]?.value;

    const embedParams = vi.mocked(HtmlEmbedRegistryComponent).mock.calls[0]?.[0];
    expect(embedParams?.app).toBe(app);
    expect(embedParams?.pluginSettingsComponent).toBe(settingsComponent);
    expect(embedParams?.htmlExtensions).toBe(htmlExtensions);
  });

  it('should register the file view with the extensions, settings component, and registrars', async () => {
    await createLoadedPlugin();

    const settingsComponent: unknown = vi.mocked(PluginSettingsComponent).mock.results[0]?.value;
    const htmlExtensions: unknown = vi.mocked(HtmlExtensions).mock.results[0]?.value;

    const fileViewParams = vi.mocked(HtmlFileViewComponent).mock.calls[0]?.[0];
    expect(fileViewParams?.pluginSettingsComponent).toBe(settingsComponent);
    expect(fileViewParams?.htmlExtensions).toBe(htmlExtensions);
    expect(fileViewParams?.extensionsRegistrar).toBeInstanceOf(PluginExtensionsRegistrar);
    expect(fileViewParams?.viewRegistrar).toBeInstanceOf(PluginViewRegistrar);
  });

  it('should register the open-in-new-tab component with the app, extensions, and settings component', async () => {
    await createLoadedPlugin();

    const settingsComponent: unknown = vi.mocked(PluginSettingsComponent).mock.results[0]?.value;
    const htmlExtensions: unknown = vi.mocked(HtmlExtensions).mock.results[0]?.value;

    const openInNewTabParams = vi.mocked(OpenInNewTabComponent).mock.calls[0]?.[0];
    expect(openInNewTabParams?.app).toBe(app);
    expect(openInNewTabParams?.htmlExtensions).toBe(htmlExtensions);
    expect(openInNewTabParams?.pluginSettingsComponent).toBe(settingsComponent);
  });

  it('should register the open demo vault command handler', async () => {
    const registerCommandHandlersSpy = vi.spyOn(CommandHandlerComponent.prototype, 'registerCommandHandlers');

    await createLoadedPlugin();

    const EXPECTED_COMMAND_HANDLER_COUNT = 1;
    // Since obsidian-dev-utils 89.0.0 the handlers are built lazily by a factory, so build them here.
    const openDemoVaultHandlers = registerCommandHandlersSpy.mock.calls
      .map(([commandHandlerFactory]) => commandHandlerFactory())
      .find((commandHandlers) => commandHandlers.some((commandHandler) => commandHandler instanceof OpenDemoVaultCommandHandler));
    expect(openDemoVaultHandlers).toHaveLength(EXPECTED_COMMAND_HANDLER_COUNT);
  });

  it('should expose the settings component', async () => {
    const plugin = await createLoadedPlugin();

    expect(plugin.pluginSettingsComponent).toBe(vi.mocked(PluginSettingsComponent).mock.results[0]?.value);
  });
});

beforeEach(() => {
  vi.clearAllMocks();

  const appMock = App.createConfigured__();
  appMock.workspace.onLayoutReady = vi.fn((callback: () => void) => {
    callback();
  });
  app = appMock.asOriginalType__();
});

async function createLoadedPlugin(): Promise<Plugin> {
  const plugin = new Plugin(app, manifest);
  // PluginBase.onload is async; driving the real async load path (as the obsidian-dev-utils reference
  // Test does) runs every universal component plus onloadImpl.
  await plugin.onload();
  return plugin;
}
