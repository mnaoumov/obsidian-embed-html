import type { EmbedComponent } from '@obsidian-typings/obsidian-public-latest';

import {
  App,
  ButtonComponent,
  FileSystemAdapter,
  TFile
} from 'obsidian';
import { invokeAsyncSafely } from 'obsidian-dev-utils/async';
import { ComponentEx } from 'obsidian-dev-utils/obsidian/components/component-ex';
import { trimStart } from 'obsidian-dev-utils/string';

import type { PluginSettingsComponent } from './plugin-settings-component.ts';
import type { ContentKeyword } from './size-spec.ts';

import { inlineDocumentStylesheetsAsync } from './document-stylesheet-inliner.ts';
import { buildFileUrl } from './file-url.ts';
import {
  getContentKeyword,
  parseSizeSpec
} from './size-spec.ts';
import { measureStickyOverlap } from './sticky-overlap.ts';
import { readStylesheetTextAsync } from './stylesheet-reader.ts';

const WIDTH_ATTRIBUTE = 'width';
const HEIGHT_ATTRIBUTE = 'height';
const ALT_ATTRIBUTE = 'alt';

const CONTENT_WIDTH_STYLE_ID = 'embed-html-content-width';
// During content-height measurement the iframe is collapsed to `0px` (so its own viewport height cannot floor the reading) while the container is expanded (a `0`-area ancestor makes the iframe report a `0` content height). Both are restored synchronously, so the ResizeObserver only ever sees the final committed sizes.
const MEASURING_IFRAME_HEIGHT = '0px';
const MEASURING_CONTAINER_HEIGHT = '100000px';

const STYLE_TAG_NAME = 'style';

const HREF_ATTRIBUTE = 'href';
const REL_ATTRIBUTE = 'rel';
const LINK_NODE_NAME = 'LINK';

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
  private stylesheetObserver: MutationObserver | null = null;
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
      this.disconnectStylesheetObserver();
    });
  }

  public loadFile(): void {
    invokeAsyncSafely(async () => this.loadFileAsync());
  }

  public async loadFileAsync(): Promise<void> {
    this.disconnectResizeObserver();
    this.disconnectStylesheetObserver();
    this.iframeEl = null;
    this.contentWidthStyleEl = null;
    this.lastAppliedWidth = null;
    this.lastAppliedHeight = null;
    this.containerEl.empty();

    // The `FileSystemAdapter` check is a DESKTOP test, not a path-availability one: mobile's
    // `CapacitorAdapter` hands out a full path just as well. What is missing on mobile is the LAUNCH
    // Mechanism — Obsidian exposes no way to hand a local file to a browser there, so `window.open` on a
    // `file://` URL does nothing. The button is therefore only offered where clicking it can act.
    if (this.pluginSettingsComponent.settings.shouldShowOpenInExternalBrowserButton && this.app.vault.adapter instanceof FileSystemAdapter) {
      const fullPath = this.app.vault.adapter.getFullPath(this.file.path);
      const fileUrl = buildFileUrl(fullPath);
      new ButtonComponent(this.containerEl).setButtonText('Open in external browser').onClick(() => {
        // `window.open` rather than an Electron `shell` import: Obsidian routes a URL opened with the
        // `_external` target to the SYSTEM browser, so this stays free of a desktop-only import. Without
        // The target the URL would open in an in-app window instead, which is the opposite of the point.
        window.open(fileUrl, '_external');
      });
    }

    this.applySize();

    const html = await this.app.vault.read(this.file);
    const parsedDoc = new DOMParser().parseFromString(html, 'text/html');
    // The injected `<base>` must be the FIRST thing in `<head>`: a `<base>` only governs the elements
    // That follow it, so appending it left every preceding relative `<link rel="stylesheet">` / `<img>` /
    // `<script>` to resolve against the srcdoc's inherited base (`app://obsidian.md/`) and 404.
    const base = parsedDoc.querySelector('base') ?? parsedDoc.head.createEl('base', { prepend: true });
    const resourceUrl = this.app.vault.getResourcePath(this.file);
    base.href = resourceUrl;
    parsedDoc.head.createEl('script', {
      attr: {
        src: `${location.origin}/enhance.js`
      }
    });

    // Stylesheets cannot stay external — Obsidian's CSP follows the embed into the iframe and blocks them.
    await this.inlineStylesheetsAsync(parsedDoc, resourceUrl);

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

  private disconnectStylesheetObserver(): void {
    this.stylesheetObserver?.disconnect();
    this.stylesheetObserver = null;
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

    // Scripts in the document may have added stylesheets of their own while it loaded, and may add more
    // Later; both are CSP-blocked exactly like the ones the parsed copy carried.
    const resourceUrl = this.app.vault.getResourcePath(this.file);
    invokeAsyncSafely(async () => this.inlineStylesheetsAsync(iframeDoc, resourceUrl));
    this.observeStylesheets(iframeDoc, resourceUrl);

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

  /**
   * Inlines the stylesheets of a document that is about to become, or already is, the embed's iframe content.
   *
   * Failures are absorbed by the reader ({@link readStylesheetTextAsync}) — an unreachable stylesheet leaves
   * the document as it was rather than failing the whole render.
   */
  private async inlineStylesheetsAsync(doc: Document, baseUrl: string): Promise<void> {
    await inlineDocumentStylesheetsAsync({
      baseUrl,
      doc,
      readTextAsync: readStylesheetTextAsync
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

  /**
   * Re-runs the inlining pass whenever the embedded document grows a stylesheet after it was parsed.
   *
   * A script in the document can add a `<link rel="stylesheet">` (or flip a preload's `rel` to `stylesheet`)
   * at any time, and that link is CSP-blocked exactly like a static one. The observer runs OUTSIDE the
   * embedded document, so the swap keeps the vault / `requestUrl` reach the document itself does not have.
   *
   * Only `<link>` additions and `<link>` `href`/`rel` changes are acted on, so the `<style>` elements the
   * pass itself inserts cannot retrigger it.
   */
  private observeStylesheets(iframeDoc: HTMLDocument, baseUrl: string): void {
    // Use the framed document's own realm, mirroring `configureMeasurement()`. A document with no browsing
    // Context cannot run the scripts that would add a stylesheet, so there is nothing to observe.
    const MutationObserverConstructor = iframeDoc.defaultView?.MutationObserver;
    if (!MutationObserverConstructor) {
      return;
    }

    const observer = new MutationObserverConstructor((mutations) => {
      if (!checkHasStylesheetLinkMutation(mutations)) {
        return;
      }
      invokeAsyncSafely(async () => this.inlineStylesheetsAsync(iframeDoc, baseUrl));
    });
    observer.observe(iframeDoc, {
      attributeFilter: [HREF_ATTRIBUTE, REL_ATTRIBUTE],
      attributes: true,
      childList: true,
      subtree: true
    });
    this.stylesheetObserver = observer;
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

  private resolveDecoration(): ResolvedDecoration {
    const settings = this.pluginSettingsComponent.settings;
    return {
      background: settings.background,
      border: settings.border,
      borderRadius: toPx(settings.borderRadius)
    };
  }

  private resolveSize(): ResolvedSize {
    const settings = this.pluginSettingsComponent.settings;
    const spec = parseSizeSpec(this.getSizeToken());
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

/**
 * Checks whether a batch of mutations could have introduced a CSP-blocked stylesheet.
 *
 * Narrowing to `<link>` is what keeps the pass from observing its own work: it replaces links with `<style>`
 * elements, whose insertion is therefore not a trigger.
 *
 * @param mutations - The batch reported by the observer.
 * @returns Whether a `<link>` was added, or an existing one's `href`/`rel` changed.
 */
function checkHasStylesheetLinkMutation(mutations: MutationRecord[]): boolean {
  return mutations.some((mutation) => {
    if (mutation.type === 'attributes') {
      return mutation.target.nodeName === LINK_NODE_NAME;
    }
    return [...mutation.addedNodes].some((node) => node.nodeName === LINK_NODE_NAME);
  });
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
