import type {
  EmbedComponent,
  EmbedContext,
  EmbedRegistry
} from '@obsidian-typings/obsidian-public-latest';
import type {
  App as AppOriginal,
  TFile
} from 'obsidian';

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

import { HtmlEmbedComponent } from './html-embed-component.ts';
import { HtmlEmbedRegistryComponent } from './html-embed-registry-component.ts';

interface AppWithEmbedRegistry {
  embedRegistry: EmbedRegistry;
}

type EmbedFactory = (context: EmbedContext, file: TFile, subpath?: string) => EmbedComponent;

const EXTENSIONS = ['html'];

let app: AppOriginal;
let registerExtensions: ReturnType<typeof vi.fn<EmbedRegistry['registerExtensions']>>;
let unregisterExtensions: ReturnType<typeof vi.fn<EmbedRegistry['unregisterExtensions']>>;
let pluginSettingsComponent: PluginSettingsComponent;
let htmlExtensions: HtmlExtensions;

describe('HtmlEmbedRegistryComponent', () => {
  it('should register the html extensions with an embed factory on load', () => {
    const component = new HtmlEmbedRegistryComponent({
      app,
      htmlExtensions,
      pluginSettingsComponent
    });

    component.load();

    expect(registerExtensions).toHaveBeenCalledWith(EXTENSIONS, expect.any(Function));
  });

  it('should unregister the html extensions when the component is unloaded', () => {
    const component = new HtmlEmbedRegistryComponent({
      app,
      htmlExtensions,
      pluginSettingsComponent
    });

    component.load();
    expect(unregisterExtensions).not.toHaveBeenCalled();

    component.unload();

    expect(unregisterExtensions).toHaveBeenCalledWith(EXTENSIONS);
  });

  it('should build an HtmlEmbedComponent from the registered factory with the provided subpath', () => {
    const component = new HtmlEmbedRegistryComponent({
      app,
      htmlExtensions,
      pluginSettingsComponent
    });
    component.load();

    const factory = getRegisteredFactory();
    const embed = factory(strictProxy<EmbedContext>({ containerEl: createDiv() }), strictProxy<TFile>({}), '#sub');

    expect(embed).toBeInstanceOf(HtmlEmbedComponent);
  });

  it('should default the subpath to an empty string when none is provided', () => {
    const component = new HtmlEmbedRegistryComponent({
      app,
      htmlExtensions,
      pluginSettingsComponent
    });
    component.load();

    const factory = getRegisteredFactory();
    const embed = factory(strictProxy<EmbedContext>({ containerEl: createDiv() }), strictProxy<TFile>({}), undefined);

    expect(embed).toBeInstanceOf(HtmlEmbedComponent);
  });
});

beforeEach(() => {
  vi.clearAllMocks();

  // The HtmlEmbedComponent built by the factory constructs a MutationObserver in its constructor, so a
  // Browser-global stub is needed to execute the real factory body.
  window.MutationObserver = class {
    public disconnect(): void {
      // No-op observer for the unit environment.
    }

    public observe(): void {
      // No-op observer for the unit environment.
    }

    public takeRecords(): MutationRecord[] {
      return [];
    }
  };

  registerExtensions = vi.fn<EmbedRegistry['registerExtensions']>();
  unregisterExtensions = vi.fn<EmbedRegistry['unregisterExtensions']>();

  const appMock = App.createConfigured__();
  app = appMock.asOriginalType__();
  // The configured App mock has no embedRegistry; attach a strict-proxy one so the real onload can call
  // The documented registerExtensions / unregisterExtensions API.
  castTo<AppWithEmbedRegistry>(app).embedRegistry = strictProxy<EmbedRegistry>({
    registerExtensions,
    unregisterExtensions
  });

  pluginSettingsComponent = strictProxy<PluginSettingsComponent>({
    settings: { defaultHeight: '400px', defaultWidth: '100%' }
  });
  htmlExtensions = strictProxy<HtmlExtensions>({
    list: vi.fn(() => EXTENSIONS)
  });
});

function getRegisteredFactory(): EmbedFactory {
  const factory = registerExtensions.mock.calls[0]?.[1];
  return castTo<EmbedFactory>(factory);
}
