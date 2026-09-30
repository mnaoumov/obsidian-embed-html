import type { App } from 'obsidian';

import {
  ButtonComponent,
  Platform
} from 'obsidian';
import { ComponentEx } from 'obsidian-dev-utils/obsidian/components/component-ex';

import type { PluginSettingsComponent } from './plugin-settings-component.ts';

import {
  resolveEmbedDecoration,
  resolveEmbedSize
} from './embed-size.ts';
import { PluginSettings } from './plugin-settings.ts';
import { getContentKeyword } from './size-spec.ts';

const WIDTH_ATTRIBUTE = 'width';
const HEIGHT_ATTRIBUTE = 'height';
const ALT_ATTRIBUTE = 'alt';
const OPTIONS_SEPARATOR = '&';

/**
 * The class every remote embed host carries, so it can be found and styled.
 */
export const REMOTE_EMBED_CLASS = 'embed-html-remote';

interface RemoteHtmlEmbedComponentConstructorParams {
  readonly app: App;

  /**
   * The element the embed renders into. Its `width` / `height` / `alt` attributes carry the embed's size, the
   * same way an internal embed's container does.
   */
  readonly containerEl: HTMLElement;

  /**
   * Extracts the size token from the container's `alt`, which can also hold a caption, or a fallback Obsidian
   * filled in.
   *
   * @param altValue - The container's `alt` (`''` when absent).
   * @returns The size token, or `''` for none.
   */
  readonly getSizeToken: (altValue: string) => string;

  readonly pluginSettingsComponent: PluginSettingsComponent;

  /**
   * The subpath without its leading `#` (`id`, or `id&mode=extract`), or `''`.
   */
  readonly subpath: string;

  /**
   * The document's address, without any fragment.
   */
  readonly url: string;
}

/**
 * Renders a REMOTE HTML document (`![](https://host/page.html)`) into an embed.
 *
 * Unlike a vault file, which goes through `srcdoc` (see `HtmlEmbedComponent`), a remote page is loaded as a
 * cross-origin `<iframe src>`. A `srcdoc` document shares Obsidian's own origin, so a page from the web
 * rendered that way could reach `app` — and on desktop, Node — merely because a note names it. A cross-origin
 * frame is isolated by the browser, and keeps its own stylesheets, scripts and relative assets working with no
 * help. The price is that nothing inside the document can be read: a content-fit size (`fit-content` and
 * friends) cannot be measured and falls back to the default, and `mode=extract` cannot hide the rest of the
 * page. A `#id` still scrolls, natively, as the URL's fragment.
 */
export class RemoteHtmlEmbedComponent extends ComponentEx {
  private readonly app: App;
  private readonly containerEl: HTMLElement;
  private readonly frameUrl: string;
  private readonly getSizeToken: (altValue: string) => string;
  private iframeEl: HTMLIFrameElement | null = null;
  private readonly pluginSettingsComponent: PluginSettingsComponent;

  public constructor(params: RemoteHtmlEmbedComponentConstructorParams) {
    super();
    this.app = params.app;
    this.containerEl = params.containerEl;
    this.getSizeToken = params.getSizeToken;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
    this.frameUrl = buildFrameUrl(params.url, params.subpath);
  }

  public override onload(): void {
    super.onload();

    this.containerEl.empty();
    this.containerEl.addClass(REMOTE_EMBED_CLASS);

    if (this.pluginSettingsComponent.settings.shouldShowOpenInExternalBrowserButton && Platform.isDesktopApp) {
      new ButtonComponent(this.containerEl).setButtonText('Open in external browser').onClick((event_) => {
        // The host can be an unresolved internal embed, whose own click handler would offer to CREATE a note
        // named after the URL.
        event_.stopPropagation();
        window.open(this.frameUrl, '_external');
      });
    }

    this.iframeEl = this.containerEl.createEl('iframe', {
      attr: {
        height: '100%',
        src: this.frameUrl,
        width: '100%'
      }
    });

    this.applySize();
    this.applyColorScheme();

    const mo = new MutationObserver(() => {
      this.applySize();
    });
    mo.observe(this.containerEl, {
      attributeFilter: [WIDTH_ATTRIBUTE, HEIGHT_ATTRIBUTE, ALT_ATTRIBUTE],
      attributes: true
    });
    this.register(() => {
      mo.disconnect();
    });

    // Chromium propagates the frame element's `color-scheme` into a cross-origin document too, so its
    // `prefers-color-scheme` follows Obsidian's base color scheme, and has to follow a live switch.
    this.registerEvent(this.app.workspace.on('css-change', () => {
      this.applyColorScheme();
    }));
  }

  private applyColorScheme(): void {
    this.iframeEl?.setCssStyles({
      colorScheme: this.app.isDarkMode() ? 'dark' : 'light'
    });
  }

  private applySize(): void {
    const settings = this.pluginSettingsComponent.settings;
    const altValue = this.containerEl.getAttr(ALT_ATTRIBUTE) ?? '';
    const size = resolveEmbedSize({
      altToken: this.getSizeToken(altValue),
      heightAttribute: this.containerEl.getAttr(HEIGHT_ATTRIBUTE),
      settings,
      widthAttribute: this.containerEl.getAttr(WIDTH_ATTRIBUTE)
    });
    const decoration = resolveEmbedDecoration(settings);

    const props: Record<string, string> = {
      'background': decoration.background,
      'border': decoration.border,
      'border-radius': decoration.borderRadius,
      'height': withoutContentKeyword(size.height, settings.defaultHeight, DEFAULT_SETTINGS.defaultHeight),
      'max-height': size.maxHeight,
      'max-width': size.maxWidth,
      'min-height': size.minHeight,
      'min-width': size.minWidth,
      'overflow': decoration.borderRadius === '' ? '' : 'hidden',
      'width': withoutContentKeyword(size.width, settings.defaultWidth, DEFAULT_SETTINGS.defaultWidth)
    };
    this.containerEl.setCssProps(props);
  }
}

const DEFAULT_SETTINGS = new PluginSettings();

function buildFrameUrl(url: string, subpath: string): string {
  // The subpath is `id` or `id&mode=...`. Only the id can travel into a cross-origin document, as its fragment.
  const optionsIndex = subpath.indexOf(OPTIONS_SEPARATOR);
  const id = optionsIndex === -1 ? subpath : subpath.slice(0, optionsIndex);
  return id === '' ? url : `${url}#${encodeURIComponent(id)}`;
}

/**
 * Replaces a content-fit keyword, which cannot be measured across origins, with a size that can be applied.
 *
 * @param value - The resolved value for the axis.
 * @param settingsDefault - The settings default for the axis.
 * @param builtInDefault - The plugin's built-in default for the axis, for when the settings default is a content keyword as well.
 * @returns A value with no content keyword.
 */
function withoutContentKeyword(value: string, settingsDefault: string, builtInDefault: string): string {
  if (!getContentKeyword(value)) {
    return value;
  }
  return getContentKeyword(settingsDefault) ? builtInDefault : settingsDefault;
}
