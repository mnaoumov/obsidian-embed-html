import type {
  App as AppOriginal,
  PluginManifest
} from 'obsidian';

import { Component } from 'obsidian';
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

vi.mock('obsidian-dev-utils/obsidian/data-handler', () => ({
  PluginDataHandler: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/plugin/plugin-event-source', () => ({
  PluginEventSourceImpl: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/components/plugin-settings-tab-component', () => ({
  // eslint-disable-next-line prefer-arrow-callback, func-names -- mock must be constructable with `new` and return a loadable Component.
  PluginSettingsTabComponent: vi.fn(function (): Component {
    return new Component();
  })
}));

vi.mock('./plugin-settings-component.ts', () => ({
  // eslint-disable-next-line prefer-arrow-callback, func-names -- mock must be constructable with `new` and return a loadable Component.
  PluginSettingsComponent: vi.fn(function (): Component {
    return new Component();
  })
}));

vi.mock('./plugin-settings-tab.ts', () => ({
  PluginSettingsTab: vi.fn()
}));

vi.mock('./html-extensions.ts', () => ({
  HtmlExtensions: vi.fn()
}));

vi.mock('./html-embed-registry-component.ts', () => ({
  // eslint-disable-next-line prefer-arrow-callback, func-names -- mock must be constructable with `new` and return a loadable Component.
  HtmlEmbedRegistryComponent: vi.fn(function (): Component {
    return new Component();
  })
}));

vi.mock('./html-file-view-component.ts', () => ({
  // eslint-disable-next-line prefer-arrow-callback, func-names -- mock must be constructable with `new` and return a loadable Component.
  HtmlFileViewComponent: vi.fn(function (): Component {
    return new Component();
  })
}));

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
import { PluginSettingsComponent } from './plugin-settings-component.ts';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { PluginSettingsTab } from './plugin-settings-tab.ts';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { Plugin } from './plugin.ts';

interface AppGlobal {
  app: AppOriginal;
}

const STRICT_PROXY_TARGET_SYMBOL = Symbol.for('strictProxyTarget');

const manifest = strictProxy<PluginManifest>({
  id: 'embed-html',
  name: 'Embed HTML'
});

let app: AppOriginal;

describe('Plugin', () => {
  it('should construct the settings component with a data handler and event source', async () => {
    await createLoadedPlugin();

    expect(vi.mocked(PluginSettingsComponent)).toHaveBeenCalledOnce();
    const params = vi.mocked(PluginSettingsComponent).mock.calls[0]?.[0];
    expect(params?.dataHandler).toBe(vi.mocked(PluginDataHandler).mock.results[0]?.value);
    expect(params?.pluginEventSource).toBe(vi.mocked(PluginEventSourceImpl).mock.results[0]?.value);
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

  it('should register the embed registry and file view with the shared settings component and extensions', async () => {
    const plugin = await createLoadedPlugin();

    const settingsComponent: unknown = vi.mocked(PluginSettingsComponent).mock.results[0]?.value;
    const htmlExtensions: unknown = vi.mocked(HtmlExtensions).mock.results[0]?.value;

    const embedArgs = vi.mocked(HtmlEmbedRegistryComponent).mock.calls[0];
    expect(embedArgs?.[0]).toBe(app);
    expect(embedArgs?.[1]).toBe(settingsComponent);
    expect(embedArgs?.[2]).toBe(htmlExtensions);

    const fileViewArgs = vi.mocked(HtmlFileViewComponent).mock.calls[0];
    expect(fileViewArgs?.[0]).toBe(app);
    expect(fileViewArgs?.[1]).toBe(plugin);
    expect(fileViewArgs?.[2]).toBe(settingsComponent);
    expect(fileViewArgs?.[3]).toBe(htmlExtensions);
  });
});

beforeEach(() => {
  vi.clearAllMocks();

  const appMock = App.createConfigured__();
  appMock.workspace.onLayoutReady = vi.fn((cb: () => void) => {
    cb();
  });
  app = appMock.asOriginalType__();

  // Seed the obsidianDevUtilsState holder on the raw target behind the strict-proxy App so the real
  // dev-utils universal components can read/write shared state during the real load lifecycle.
  seedOnRawTarget(app, 'obsidianDevUtilsState', {});

  // Expose the app as the global instance so dev-utils helpers that resolve shared state without an
  // explicit app argument read/write the same seeded holder.
  castTo<AppGlobal>(window).app = app;
});

async function createLoadedPlugin(): Promise<Plugin> {
  const plugin = new Plugin(app, manifest);
  // PluginBase.onload is async; driving the real async load path (as the obsidian-dev-utils reference
  // test does) runs every universal component plus onloadImpl.
  await plugin.onload();
  return plugin;
}

function seedOnRawTarget(strictProxiedObject: object, key: string, value: unknown): void {
  const proxyWithTarget = castTo<Partial<Record<symbol, object>>>(strictProxiedObject);
  const rawTarget = proxyWithTarget[STRICT_PROXY_TARGET_SYMBOL] ?? strictProxiedObject;
  castTo<Record<string, unknown>>(rawTarget)[key] = value;
}
