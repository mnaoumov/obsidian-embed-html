import type { EmbedComponent } from '@obsidian-typings/obsidian-public-latest';

import {
  App,
  TFile
} from 'obsidian';
import { invokeAsyncSafely } from 'obsidian-dev-utils/async';
import { ComponentEx } from 'obsidian-dev-utils/obsidian/components/component-ex';
import { trimStart } from 'obsidian-dev-utils/string';

import type { PluginSettingsComponent } from './plugin-settings-component.ts';
import type { ContentKeyword } from './size-spec.ts';

import {
  getContentKeyword,
  parseSizeSpec
} from './size-spec.ts';

const WIDTH_ATTRIBUTE = 'width';
const HEIGHT_ATTRIBUTE = 'height';
const ALT_ATTRIBUTE = 'alt';

const CONTENT_WIDTH_STYLE_ID = 'embed-html-content-width';
// During content-height measurement the iframe is collapsed to `0px` (so its own viewport height cannot floor the reading) while the container is expanded (a `0`-area ancestor makes the iframe report a `0` content height). Both are restored synchronously, so the ResizeObserver only ever sees the final committed sizes.
const MEASURING_IFRAME_HEIGHT = '0px';
const MEASURING_CONTAINER_HEIGHT = '100000px';

interface HtmlEmbedComponentConstructorParams {
  readonly app: App;
  readonly containerEl: HTMLElement;
  readonly file: TFile;
  readonly pluginSettingsComponent: PluginSettingsComponent;
  readonly subpath: string;
}

type Mode = 'extract' | 'scroll';

interface Options {
  readonly id: string;
  readonly mode: Mode;
}

interface ResolvedSize {
  readonly height: string;
  readonly maxHeight: string;
  readonly maxWidth: string;
  readonly minHeight: string;
  readonly minWidth: string;
  readonly width: string;
}

export class HtmlEmbedComponent extends ComponentEx implements EmbedComponent {
  private readonly app: App;
  private readonly containerEl: HTMLElement;
  private contentWidthStyleEl: HTMLStyleElement | null = null;
  private readonly file: TFile;
  private heightContentKeyword: ContentKeyword | null = null;
  private iframeEl: HTMLIFrameElement | null = null;
  private lastAppliedHeight: null | string = null;
  private lastAppliedWidth: null | string = null;
  private readonly pluginSettingsComponent: PluginSettingsComponent;
  private resizeObserver: null | ResizeObserver = null;
  private subpath: string;
  private widthContentKeyword: ContentKeyword | null = null;

  public constructor(params: HtmlEmbedComponentConstructorParams) {
    super();

    this.app = params.app;
    this.containerEl = params.containerEl;
    this.file = params.file;
    this.subpath = params.subpath;
    this.pluginSettingsComponent = params.pluginSettingsComponent;

    const mo = new MutationObserver(() => {
      this.applySize();
    });
    mo.observe(this.containerEl, {
      attributeFilter: [WIDTH_ATTRIBUTE, HEIGHT_ATTRIBUTE, ALT_ATTRIBUTE],
      attributes: true
    });

    this.register(() => {
      mo.disconnect();
      this.disconnectResizeObserver();
    });
  }

  public loadFile(): void {
    invokeAsyncSafely(async () => this.loadFileAsync());
  }

  public async loadFileAsync(): Promise<void> {
    this.disconnectResizeObserver();
    this.iframeEl = null;
    this.contentWidthStyleEl = null;
    this.lastAppliedWidth = null;
    this.lastAppliedHeight = null;
    this.containerEl.empty();

    this.applySize();

    const html = await this.app.vault.read(this.file);
    const parsedDoc = new DOMParser().parseFromString(html, 'text/html');
    const base = parsedDoc.querySelector('base') ?? parsedDoc.head.createEl('base');
    base.href = this.app.vault.getResourcePath(this.file);
    parsedDoc.head.createEl('script', {
      attr: {
        src: `${location.origin}/enhance.js`
      }
    });

    const iframeHtml = parsedDoc.documentElement.outerHTML;
    const blob = new Blob([iframeHtml], { type: 'text/html' });
    // eslint-disable-next-line n/no-unsupported-features/node-builtins -- URL.createObjectURL is the Web URL API, available in Obsidian's Electron renderer; the rule incorrectly flags it as a Node experimental builtin.
    const url = URL.createObjectURL(blob);

    const iframeEl = this.containerEl.createEl('iframe', {
      attr: {
        height: '100%',
        width: '100%'
      }
    });
    this.iframeEl = iframeEl;

    iframeEl.addEventListener('load', () => {
      // eslint-disable-next-line n/no-unsupported-features/node-builtins -- URL.revokeObjectURL is the Web URL API, available in Obsidian's Electron renderer; the rule incorrectly flags it as a Node experimental builtin.
      URL.revokeObjectURL(url);
      if (!iframeEl.contentDocument) {
        return;
      }
      this.initIframe(iframeEl.contentDocument);
      this.applySize();
    });

    iframeEl.src = url;
  }

  public setSubpath(subpath: string): void {
    this.subpath = subpath;
    this.loadFile();
  }

  private applySize(): void {
    const spec = this.resolveSize();
    this.widthContentKeyword = getContentKeyword(spec.width);
    this.heightContentKeyword = getContentKeyword(spec.height);

    const props: Record<string, string> = {
      'max-height': spec.maxHeight,
      'max-width': spec.maxWidth,
      'min-height': spec.minHeight,
      'min-width': spec.minWidth
    };
    // Content axes are driven by measure(); apply only the literal axes here.
    if (!this.widthContentKeyword) {
      props[WIDTH_ATTRIBUTE] = spec.width;
    }
    if (!this.heightContentKeyword) {
      props[HEIGHT_ATTRIBUTE] = spec.height;
    }
    this.containerEl.setCssProps(props);

    this.configureMeasurement();
  }

  private configureMeasurement(): void {
    this.disconnectResizeObserver();
    this.lastAppliedWidth = null;
    this.lastAppliedHeight = null;

    const iframeDoc = this.iframeEl?.contentDocument;
    if (!iframeDoc) {
      return;
    }

    this.injectContentWidthStyle(iframeDoc);

    if (!this.widthContentKeyword && !this.heightContentKeyword) {
      return;
    }

    const observerWindow = iframeDoc.defaultView ?? window;
    this.resizeObserver = new observerWindow.ResizeObserver(() => {
      this.measure();
    });
    this.resizeObserver.observe(iframeDoc.documentElement);
    this.resizeObserver.observe(iframeDoc.body);
    this.measure();
  }

  private disconnectResizeObserver(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  private initIframe(iframeDoc: HTMLDocument): void {
    this.registerDomEvent(iframeDoc, 'click', (evt) => {
      const iframeWin = iframeDoc.defaultView;
      if (!iframeWin) {
        return;
      }
      if (evt.target instanceof iframeWin.Element) {
        const aEl = evt.target.closest('a');
        if (aEl) {
          aEl.target = '_blank';
        }
      }
    });

    const options = this.parseOptions();
    if (!options.id) {
      return;
    }

    const el = iframeDoc.getElementById(options.id);
    if (!el) {
      return;
    }

    switch (options.mode) {
      case 'extract': {
        const random = String(Date.now());
        const extractedClassName = `extracted-${random}`;
        el.addClass(extractedClassName);

        const extractedParentClassName = `extracted-parent-${random}`;

        let parentEl: Element | null = el.parentElement;

        while (parentEl) {
          parentEl.addClass(extractedParentClassName);
          parentEl = parentEl.parentElement;
        }

        const css = `
*:not(.${extractedParentClassName}):not(.${extractedClassName}):not(.${extractedClassName} *) {
  display:none !important;
}
`;

        iframeDoc.head.createEl('style', {
          text: css
        });
        break;
      }
      case 'scroll': {
        const scrollingEl = iframeDoc.scrollingElement ?? iframeDoc.documentElement;
        const rect = el.getBoundingClientRect();
        const scrollingRect = scrollingEl.getBoundingClientRect();
        scrollingEl.scrollBy({
          behavior: 'instant',
          left: rect.left - scrollingRect.left,
          top: rect.top - scrollingRect.top
        });
        break;
      }
      default:
        break;
    }
  }

  private injectContentWidthStyle(iframeDoc: HTMLDocument): void {
    if (!this.widthContentKeyword) {
      this.contentWidthStyleEl?.remove();
      this.contentWidthStyleEl = null;
      return;
    }

    const css = `body { width: ${this.widthContentKeyword}; }`;
    if (this.contentWidthStyleEl) {
      this.contentWidthStyleEl.textContent = css;
      return;
    }

    this.contentWidthStyleEl = iframeDoc.head.createEl('style', {
      attr: { id: CONTENT_WIDTH_STYLE_ID },
      text: css
    });
  }

  private measure(): void {
    const iframeEl = this.iframeEl;
    const iframeDoc = iframeEl?.contentDocument;
    if (!iframeEl || !iframeDoc) {
      return;
    }

    const props: Record<string, string> = {};

    if (this.heightContentKeyword) {
      const previousContainerHeight = this.containerEl.style.height;
      const previousIframeHeight = iframeEl.style.height;
      this.containerEl.style.height = MEASURING_CONTAINER_HEIGHT;
      iframeEl.style.height = MEASURING_IFRAME_HEIGHT;
      const measuredHeight = `${String(iframeDoc.documentElement.scrollHeight)}px`;
      iframeEl.style.height = previousIframeHeight;
      this.containerEl.style.height = previousContainerHeight;
      if (measuredHeight !== this.lastAppliedHeight) {
        this.lastAppliedHeight = measuredHeight;
        props[HEIGHT_ATTRIBUTE] = measuredHeight;
      }
    }

    if (this.widthContentKeyword) {
      const measuredWidth = `${String(Math.ceil(iframeDoc.body.scrollWidth))}px`;
      if (measuredWidth !== this.lastAppliedWidth) {
        this.lastAppliedWidth = measuredWidth;
        props[WIDTH_ATTRIBUTE] = measuredWidth;
      }
    }

    if (Object.keys(props).length > 0) {
      this.containerEl.setCssProps(props);
    }
  }

  private parseOptions(): Options {
    const searchParams = new URLSearchParams(`id=${trimStart({ prefix: '#', str: this.subpath })}`);
    return {
      /* v8 ignore start -- The `id` key is always present in the constructed URLSearchParams string, so `get('id')` never returns `null`. */
      id: searchParams.get('id') ?? '',
      /* v8 ignore stop */
      mode: (searchParams.get('mode') ?? 'scroll') as Mode
    };
  }

  private resolveSize(): ResolvedSize {
    const settings = this.pluginSettingsComponent.settings;
    const spec = parseSizeSpec(this.containerEl.getAttr(ALT_ATTRIBUTE) ?? '');
    const widthAttr = this.containerEl.getAttr(WIDTH_ATTRIBUTE);
    const heightAttr = this.containerEl.getAttr(HEIGHT_ATTRIBUTE);

    return {
      height: toPx(resolveAxis(spec.height, heightAttr, settings.defaultHeight)),
      maxHeight: toPx(spec.maxHeight ?? settings.defaultMaxHeight),
      maxWidth: toPx(spec.maxWidth ?? settings.defaultMaxWidth),
      minHeight: toPx(spec.minHeight ?? settings.defaultMinHeight),
      minWidth: toPx(spec.minWidth ?? settings.defaultMinWidth),
      width: toPx(resolveAxis(spec.width, widthAttr, settings.defaultWidth))
    };
  }
}

function resolveAxis(fromToken: null | string, fromAttribute: null | string, fromSettings: string): string {
  if (fromToken !== null) {
    return fromToken;
  }
  if (fromAttribute !== null) {
    return fromAttribute;
  }
  return fromSettings;
}

function toPx(value: string): string {
  if (value === String(Number(value))) {
    return `${value}px`;
  }
  return value;
}
