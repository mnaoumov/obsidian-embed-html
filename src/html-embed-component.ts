import type { EmbedComponent } from 'obsidian-typings';

import {
  App,
  Component,
  TFile
} from 'obsidian';
import { invokeAsyncSafely } from 'obsidian-dev-utils/async';
import { trimStart } from 'obsidian-dev-utils/string';

import type { PluginSettingsComponent } from './plugin-settings-component.ts';

const WIDTH_ATTRIBUTE = 'width';
const HEIGHT_ATTRIBUTE = 'height';

interface HtmlEmbedComponentParams {
  app: App;
  containerEl: HTMLElement;
  file: TFile;
  pluginSettingsComponent: PluginSettingsComponent;
  subpath: string;
}

type Mode = 'extract' | 'scroll';

interface Options {
  id: string;
  mode: Mode;
}

export class HtmlEmbedComponent extends Component implements EmbedComponent {
  private readonly app: App;
  private readonly containerEl: HTMLElement;
  private readonly file: TFile;
  private readonly pluginSettingsComponent: PluginSettingsComponent;
  private subpath: string;

  public constructor(params: HtmlEmbedComponentParams) {
    super();

    this.app = params.app;
    this.containerEl = params.containerEl;
    this.file = params.file;
    this.subpath = params.subpath;
    this.pluginSettingsComponent = params.pluginSettingsComponent;

    const mo = new MutationObserver(() => {
      this.updateSize();
    });
    mo.observe(this.containerEl, {
      attributeFilter: [WIDTH_ATTRIBUTE, HEIGHT_ATTRIBUTE],
      attributes: true
    });

    this.register(() => {
      mo.disconnect();
    });
  }

  public loadFile(): void {
    invokeAsyncSafely(async () => this.loadFileAsync());
  }

  public async loadFileAsync(): Promise<void> {
    this.containerEl.empty();

    this.updateSize();

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
    const url = URL.createObjectURL(blob);

    const iframeEl = this.containerEl.createEl('iframe', {
      attr: {
        height: '100%',
        width: '100%'
      }
    });

    iframeEl.addEventListener('load', () => {
      URL.revokeObjectURL(url);
      if (!iframeEl.contentDocument) {
        return;
      }
      this.initIframe(iframeEl.contentDocument);
    });

    iframeEl.src = url;
  }

  public setSubpath(subpath: string): void {
    this.subpath = subpath;
    this.loadFile();
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

        // eslint-disable-next-line obsidianmd/no-forbidden-elements -- need `style` element in custom `iframe`.
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

  private parseOptions(): Options {
    const searchParams = new URLSearchParams(`id=${trimStart(this.subpath, '#')}`);
    return {
      /* v8 ignore start -- The `id` key is always present in the constructed URLSearchParams string, so `get('id')` never returns `null`. */
      id: searchParams.get('id') ?? '',
      /* v8 ignore stop */
      mode: (searchParams.get('mode') ?? 'scroll') as Mode
    };
  }

  private updateSize(): void {
    this.containerEl.setCssProps({
      height: toPx(this.containerEl.getAttr(HEIGHT_ATTRIBUTE) ?? this.pluginSettingsComponent.settings.defaultHeight),
      width: toPx(this.containerEl.getAttr(WIDTH_ATTRIBUTE) ?? this.pluginSettingsComponent.settings.defaultWidth)
    });
  }
}

function toPx(value: string): string {
  if (value === String(Number(value))) {
    return `${value}px`;
  }
  return value;
}
