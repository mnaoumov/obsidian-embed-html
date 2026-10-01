import type { App as AppOriginal } from 'obsidian';

import { noopAsync } from 'obsidian-dev-utils/function';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  App,
  Platform
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

import { OPEN_IN_EXTERNAL_BROWSER_BUTTON_CLASS } from './open-in-external-browser-button.ts';
import { PluginSettings } from './plugin-settings.ts';
import {
  REMOTE_EMBED_CLASS,
  RemoteHtmlEmbedComponent
} from './remote-html-embed-component.ts';

const URL_WITHOUT_FRAGMENT = 'https://example.com/attachments/page.html';

interface CreateParams {
  readonly getSizeToken?: (altValue: string) => string;
  readonly subpath?: string;
}

let app: AppOriginal;
let containerEl: HTMLElement;
let settings: PluginSettings;
let isDarkMode: boolean;
let isOriginalIsDesktopApp: boolean;

describe('RemoteHtmlEmbedComponent', () => {
  it('should render a cross-origin iframe for the URL into the container', () => {
    create().load();

    expect(containerEl.hasClass(REMOTE_EMBED_CLASS)).toBe(true);
    expect(getIframe().getAttr('src')).toBe(URL_WITHOUT_FRAGMENT);
    expect(getIframe().getAttr('srcdoc')).toBeNull();
  });

  it('should replace whatever the container held before', () => {
    containerEl.createSpan({ text: 'could not be found' });

    create().load();

    expect(containerEl.textContent).not.toContain('could not be found');
  });

  it('should carry the subpath id into the URL fragment, encoded', () => {
    create({ subpath: 'my id' }).load();

    expect(getIframe().getAttr('src')).toBe(`${URL_WITHOUT_FRAGMENT}#my%20id`);
  });

  it('should drop the subpath options, which cannot reach a cross-origin document', () => {
    create({ subpath: 'target&mode=extract' }).load();

    expect(getIframe().getAttr('src')).toBe(`${URL_WITHOUT_FRAGMENT}#target`);
  });

  it('should hand the URL to the system browser from the button, without the click reaching the host', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const hostClickSpy = vi.fn();
    containerEl.addEventListener('click', hostClickSpy);

    create({ subpath: 'target' }).load();
    getButton()?.click();

    expect(openSpy).toHaveBeenCalledWith(`${URL_WITHOUT_FRAGMENT}#target`, '_external');
    expect(hostClickSpy).not.toHaveBeenCalled();
  });

  it('should mark the button for CSS snippets', () => {
    create().load();

    expect(getButton()?.hasClass(OPEN_IN_EXTERNAL_BROWSER_BUTTON_CLASS)).toBe(true);
  });

  it('should not render the button when the setting is off', () => {
    settings.shouldShowOpenInExternalBrowserButton = false;

    create().load();

    expect(getButton()).toBeNull();
  });

  it('should not render the button outside the desktop app', () => {
    Platform.isDesktopApp = false;

    create().load();

    expect(getButton()).toBeNull();
  });

  it('should apply the settings defaults when the embed names no size', () => {
    create().load();

    expect(containerEl.style.width).toBe('100%');
    expect(containerEl.style.height).toBe('400px');
  });

  it('should apply the width and height attributes', () => {
    containerEl.setAttr('width', '300');
    containerEl.setAttr('height', '200');

    create().load();

    expect(containerEl.style.width).toBe('300px');
    expect(containerEl.style.height).toBe('200px');
  });

  it('should apply a size token from alt', () => {
    containerEl.setAttr('alt', '50%x300');

    create().load();

    expect(containerEl.style.width).toBe('50%');
    expect(containerEl.style.height).toBe('300px');
  });

  it('should ignore an alt from which the resolver extracts no size token', () => {
    containerEl.setAttr('alt', 'page.html');

    create({ getSizeToken: () => '' }).load();

    expect(containerEl.style.width).toBe('100%');
  });

  it('should fall back to the settings default for a content-fit axis', () => {
    containerEl.setAttr('alt', 'width: fit-content; height: max-content');
    settings.defaultWidth = '70%';

    create().load();

    expect(containerEl.style.width).toBe('70%');
    expect(containerEl.style.height).toBe('400px');
  });

  it('should fall back to the built-in default when the settings default is a content-fit keyword too', () => {
    containerEl.setAttr('alt', 'width: fit-content; height: min-content');
    settings.defaultWidth = 'fit-content';
    settings.defaultHeight = 'max-content';

    create().load();

    expect(containerEl.style.width).toBe('100%');
    expect(containerEl.style.height).toBe('400px');
  });

  it('should apply the decoration, clipping the frame only when there is a radius', () => {
    settings.border = '1px solid red';
    settings.borderRadius = '8';

    create().load();

    expect(containerEl.style.borderRadius).toBe('8px');
    expect(containerEl.style.overflow).toBe('hidden');
  });

  it('should leave the overflow alone without a radius', () => {
    create().load();

    expect(containerEl.style.overflow).toBe('');
  });

  it('should re-apply the size when the size attributes change', async () => {
    create().load();

    containerEl.setAttr('width', '250');
    await flushMutations();

    expect(containerEl.style.width).toBe('250px');
  });

  it('should stop following the size attributes once unloaded', async () => {
    const component = create();
    component.load();
    component.unload();

    containerEl.setAttr('width', '250');
    await flushMutations();

    expect(containerEl.style.width).toBe('100%');
  });

  it('should follow Obsidian\'s color scheme, live', () => {
    create().load();
    expect(getIframe().style.colorScheme).toBe('light');

    isDarkMode = true;
    app.workspace.trigger('css-change');

    expect(getIframe().style.colorScheme).toBe('dark');
  });
});

beforeEach(() => {
  const appMock = App.createConfigured__();
  app = appMock.asOriginalType__();
  isDarkMode = false;
  vi.spyOn(app, 'isDarkMode').mockImplementation(() => isDarkMode);
  containerEl = createDiv();
  document.body.append(containerEl);
  settings = new PluginSettings();
  isOriginalIsDesktopApp = Platform.isDesktopApp;
  Platform.isDesktopApp = true;
});

afterEach(() => {
  containerEl.remove();
  Platform.isDesktopApp = isOriginalIsDesktopApp;
  vi.restoreAllMocks();
});

function create(params: CreateParams = {}): RemoteHtmlEmbedComponent {
  return new RemoteHtmlEmbedComponent({
    app,
    containerEl,
    getSizeToken: params.getSizeToken ?? ((altValue): string => altValue),
    pluginSettingsComponent: strictProxy<PluginSettingsComponent>({ settings }),
    subpath: params.subpath ?? '',
    url: URL_WITHOUT_FRAGMENT
  });
}

async function flushMutations(): Promise<void> {
  // Mutation observers deliver in a microtask.
  await noopAsync();
}

function getButton(): HTMLButtonElement | null {
  return containerEl.querySelector('button');
}

function getIframe(): HTMLIFrameElement {
  const iframeEl = containerEl.querySelector('iframe');
  if (!iframeEl) {
    throw new Error('No iframe rendered');
  }
  return iframeEl;
}
