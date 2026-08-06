import type { EmbedComponent } from '@obsidian-typings/obsidian-public-latest';

import {
  App,
  FileSystemAdapter,
  TFile
} from 'obsidian';
import { invokeAsyncSafely } from 'obsidian-dev-utils/async';
import { ComponentEx } from 'obsidian-dev-utils/obsidian/components/component-ex';
import { trimStart } from 'obsidian-dev-utils/string';

import type { PluginSettingsComponent } from './plugin-settings-component.ts';
import type { ContentKeyword } from './size-spec.ts';

import { parseEmbedToken } from './embed-options.ts';
import { buildFileUrl } from './file-url.ts';
import {
  getContentKeyword,
  parseSizeSpec
} from './size-spec.ts';
import { measureStickyOverlap } from './sticky-overlap.ts';

const WIDTH_ATTRIBUTE = 'width';
const HEIGHT_ATTRIBUTE = 'height';
const ALT_ATTRIBUTE = 'alt';

const CONTENT_WIDTH_STYLE_ID = 'embed-html-content-width';
// During content-height measurement the iframe is collapsed to `0px` (so its own viewport height cannot floor the reading) while the container is expanded (a `0`-area ancestor makes the iframe report a `0` content height). Both are restored synchronously, so the ResizeObserver only ever sees the final committed sizes.
const MEASURING_IFRAME_HEIGHT = '0px';
const MEASURING_CONTAINER_HEIGHT = '100000px';

const STYLE_TAG_NAME = 'style';

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

interface ResolveAxisParams {
  readonly fromAttribute: null | string;
  readonly fromSettings: string;
  readonly fromToken: null | string;
}

interface ResolvedDecoration {
  readonly background: string;
  readonly border: string;
  readonly borderRadius: string;
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

    // Open-in-browser mode short-circuits BEFORE the file is read. That is the point for the documents
    // This was asked for (issue #14): 10-15 MB of HTML is never loaded, parsed or held in the note.
    //
    // `getAbsolutePath()` is null when the vault has no filesystem behind it (mobile), and then there is
    // Nothing to hand to a browser — so the embed falls through to the iframe and the setting is inert
    // Rather than broken.
    const absolutePath = this.resolveShouldOpenInSystemBrowser() ? this.getAbsolutePath() : null;
    if (absolutePath !== null) {
      this.renderOpenInSystemBrowserLink(absolutePath);
      return;
    }

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

    const iframeEl = this.containerEl.createEl('iframe', {
      attr: {
        height: '100%',
        width: '100%'
      }
    });
    this.iframeEl = iframeEl;
    this.applyColorScheme();

    iframeEl.addEventListener('load', () => {
      if (!iframeEl.contentDocument) {
        return;
      }
      this.initIframe(iframeEl.contentDocument);
      this.applySize();
    });

    // Embed the document via `srcdoc` rather than an object-URL `src`.
    // Reading-view virtualization detaches and re-attaches each embed's DOM on scroll.
    // Re-attaching an iframe reloads it from its source, and an object URL is single-use:
    // It is revoked after the first load, so that reload would resolve to a blank page.
    // `srcdoc` carries the markup on the element itself, so it reloads cleanly every time.
    iframeEl.srcdoc = iframeHtml;
  }

  public override onload(): void {
    super.onload();
    // Obsidian's base color scheme (Settings → Appearance) is independent of the OS color scheme, and
    // Emits `css-change` when it toggles. Re-apply so an already-rendered embed follows the switch.
    this.registerEvent(this.app.workspace.on('css-change', () => {
      this.applyColorScheme();
    }));
  }

  public setSubpath(subpath: string): void {
    this.subpath = subpath;
    this.loadFile();
  }

  private applyColorScheme(): void {
    // Setting `color-scheme` on the iframe element propagates into the embedded document, so its
    // `prefers-color-scheme` media queries follow Obsidian's base color scheme rather than the OS one.
    this.iframeEl?.setCssStyles({
      colorScheme: this.app.isDarkMode() ? 'dark' : 'light'
    });
  }

  private applySize(): void {
    const spec = this.resolveSize();
    const decoration = this.resolveDecoration();
    this.widthContentKeyword = getContentKeyword(spec.width);
    this.heightContentKeyword = getContentKeyword(spec.height);

    const props: Record<string, string> = {
      'background': decoration.background,
      'border': decoration.border,
      'border-radius': decoration.borderRadius,
      'max-height': spec.maxHeight,
      'max-width': spec.maxWidth,
      'min-height': spec.minHeight,
      'min-width': spec.minWidth,
      // Clip the iframe's square corners to the rounded box, but only when a radius is set so the
      // Default (no radius) keeps the container's natural overflow behavior.
      'overflow': decoration.borderRadius === '' ? '' : 'hidden'
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

  /**
   * The embed's absolute filesystem path, or `null` when the vault has no filesystem behind it.
   *
   * Only a `FileSystemAdapter` (desktop) exposes one. On mobile there is no path to hand to a browser,
   * so this returns `null` and the caller falls back to the iframe rather than rendering an affordance
   * that could not work.
   */
  private getAbsolutePath(): null | string {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) {
      return null;
    }

    return adapter.getFullPath(this.file.path);
  }

  // Obsidian routes a pure-digit size token (`|400`, `|600x200`) into the container's `width`/`height`
  // Attributes and resets `alt` to the embed's own file name. Parsing that file name as a size token would
  // Mis-read it as a width (`basic.html` -> `width: basic.html`) — invalid CSS the browser silently drops,
  // Clobbering the real numeric `width` attribute and falling back to the default width. So an `alt` that is
  // Only the file-name fallback is treated as "no token", letting the numeric attributes (or the defaults)
  // Win; a genuine non-numeric token (`50%`, `width: max-content`) never equals the file name and is kept.
  private getSizeToken(): string {
    const altValue = this.containerEl.getAttr(ALT_ATTRIBUTE) ?? '';
    if ([this.file.basename, this.file.name, this.file.path].includes(altValue)) {
      return '';
    }
    return altValue;
  }

  private initIframe(iframeDoc: HTMLDocument): void {
    this.registerDomEvent(iframeDoc, 'click', ($event) => {
      const iframeWin = iframeDoc.defaultView;
      if (!iframeWin) {
        return;
      }
      if ($event.target instanceof iframeWin.Element) {
        const aEl = $event.target.closest('a');
        if (aEl) {
          aEl.target = '_blank';
        }
      }
    });

    const options = this.parseOptions();
    if (!options.id) {
      return;
    }

    // eslint-disable-next-line unicorn/prefer-query-selector -- The id comes from user-authored embed syntax; `querySelector` would throw on one that is not a valid CSS identifier.
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

        iframeDoc.head.createEl(STYLE_TAG_NAME, {
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

        // The scroll above lands the target flush against the top of the scroll container, which is
        // Exactly where a `position: sticky` header stays pinned — so the target ends up underneath it
        // (issue #14). The overlap can only be measured once the header is in its stuck position, hence
        // The second pass here rather than an offset folded into the scroll above.
        const stickyOverlap = measureStickyOverlap(iframeDoc, el);
        if (stickyOverlap > 0) {
          scrollingEl.scrollBy({
            behavior: 'instant',
            top: -stickyOverlap
          });
        }
        break;
      }
      default: {
        break;
      }
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

    this.contentWidthStyleEl = iframeDoc.head.createEl(STYLE_TAG_NAME, {
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
    const searchParams = new URLSearchParams(`id=${trimStart({ $string: this.subpath, prefix: '#' })}`);
    return {
      /* v8 ignore start -- The `id` key is always present in the constructed URLSearchParams string, so `get('id')` never returns `null`. */
      id: searchParams.get('id') ?? '',
      /* v8 ignore stop */
      mode: (searchParams.get('mode') ?? 'scroll') as Mode
    };
  }

  /**
   * Renders the click-to-open affordance shown in place of the iframe when the embed opens externally.
   *
   * An empty iframe would be wrong here — the note must still say WHAT is embedded, and the fragment is
   * part of that, since the same document is usually embedded at several anchors.
   */
  private renderOpenInSystemBrowserLink(absolutePath: string): void {
    const fragment = trimStart({ $string: this.subpath, prefix: '#' }).trim();
    const label = fragment === '' ? this.file.name : `${this.file.name}#${fragment}`;

    const linkEl = this.containerEl.createEl('a', {
      cls: 'embed-html-open-in-system-browser',
      href: '#',
      text: label
    });
    linkEl.setAttribute('aria-label', `Open ${label} in the default browser`);

    this.registerDomEvent(linkEl, 'click', ($event) => {
      $event.preventDefault();
      // `window.open` rather than an Electron `shell` import: Obsidian already routes an external URL
      // Opened this way to the system browser, so this stays free of a desktop-only import and of the
      // Conditional-import dance that would come with it.
      window.open(buildFileUrl(absolutePath, this.subpath), '_blank');
    });
  }

  private resolveDecoration(): ResolvedDecoration {
    const settings = this.pluginSettingsComponent.settings;
    return {
      background: settings.background,
      border: settings.border,
      borderRadius: toPx(settings.borderRadius)
    };
  }

  /**
   * Resolves whether THIS embed opens in the default browser.
   *
   * The global setting is the default and a token flag overrides it, so a vault can send the two 15 MB
   * reference documents to a browser while everything else keeps rendering in the note (issue #14).
   *
   * @returns Whether this embed should open in the default browser.
   */
  private resolveShouldOpenInSystemBrowser(): boolean {
    const { options } = parseEmbedToken(this.getSizeToken());
    return options.shouldOpenInSystemBrowser ?? this.pluginSettingsComponent.settings.shouldOpenInSystemBrowser;
  }

  private resolveSize(): ResolvedSize {
    const settings = this.pluginSettingsComponent.settings;
    const { sizeToken } = parseEmbedToken(this.getSizeToken());
    const spec = parseSizeSpec(sizeToken);
    const widthAttr = this.containerEl.getAttr(WIDTH_ATTRIBUTE);
    const heightAttr = this.containerEl.getAttr(HEIGHT_ATTRIBUTE);

    return {
      height: toPx(resolveAxis({ fromAttribute: heightAttr, fromSettings: settings.defaultHeight, fromToken: spec.height })),
      maxHeight: toPx(spec.maxHeight ?? settings.defaultMaxHeight),
      maxWidth: toPx(spec.maxWidth ?? settings.defaultMaxWidth),
      minHeight: toPx(spec.minHeight ?? settings.defaultMinHeight),
      minWidth: toPx(spec.minWidth ?? settings.defaultMinWidth),
      width: toPx(resolveAxis({ fromAttribute: widthAttr, fromSettings: settings.defaultWidth, fromToken: spec.width }))
    };
  }
}

function resolveAxis(params: ResolveAxisParams): string {
  const { fromAttribute, fromSettings, fromToken } = params;
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
