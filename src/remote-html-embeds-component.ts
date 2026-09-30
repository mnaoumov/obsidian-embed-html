import type {
  EditorView,
  PluginValue
} from '@codemirror/view';
import type {
  App,
  MarkdownPostProcessorContext
} from 'obsidian';
import type { EditorExtensionRegistrar } from 'obsidian-dev-utils/obsidian/editor-extension-registrar';
import type { MarkdownPostProcessorRegistrar } from 'obsidian-dev-utils/obsidian/markdown-post-processor-registrar';

import { ViewPlugin } from '@codemirror/view';
import { MarkdownRenderChild } from 'obsidian';
import { ComponentEx } from 'obsidian-dev-utils/obsidian/components/component-ex';

import type { HtmlExtensions } from './html-extensions.ts';
import type { PluginSettingsComponent } from './plugin-settings-component.ts';
import type { RemoteHtmlUrl } from './remote-html-url.ts';

import { RemoteHtmlEmbedComponent } from './remote-html-embed-component.ts';
import { parseRemoteHtmlUrl } from './remote-html-url.ts';

const SIZE_ATTRIBUTES = ['width', 'height', 'alt'] as const;
const SIZE_TOKEN_SEPARATOR = '|';
const SRC_ATTRIBUTE = 'src';

// What Obsidian renders for each syntax, in both reading view and Live Preview:
// - `![](url)` is an `<img>` (wrapped in `.image-embed` in Live Preview).
// - `![[url]]` is an unresolved `.internal-embed` placeholder ("could not be found"), whose `src` is the URL.
const IMAGE_SELECTOR = 'img[src]';
const INTERNAL_EMBED_SELECTOR = '.internal-embed[src]';
const LIVE_PREVIEW_IMAGE_EMBED_SELECTOR = '.image-embed';
const EMPTY_ATTACHMENT_CLASS = 'mod-empty-attachment';

/**
 * An element Obsidian rendered for an embed that names a remote HTML document.
 */
export interface Candidate {
  /**
   * The element Obsidian rendered for the embed.
   */
  readonly el: HTMLElement;
  readonly isImage: boolean;
  readonly remoteHtmlUrl: RemoteHtmlUrl;
  readonly src: string;
}

interface RemoteHtmlEmbedsComponentConstructorParams {
  readonly app: App;
  readonly editorExtensionRegistrar: EditorExtensionRegistrar;
  readonly htmlExtensions: HtmlExtensions;
  readonly markdownPostProcessorRegistrar: MarkdownPostProcessorRegistrar;
  readonly pluginSettingsComponent: PluginSettingsComponent;
}

interface TrackedEmbed {
  readonly component: RemoteHtmlEmbedComponent;
  readonly iframeEl: HTMLIFrameElement | null;
  readonly url: string;
}

/**
 * Upgrades the remote HTML embeds of one Live Preview editor.
 *
 * Obsidian's embed widgets fill in their DOM after the editor has drawn them, and the editor redraws a widget
 * from scratch whenever it likes, so rather than hooking the editor's update cycle the watcher watches the
 * content DOM and re-scans on every change. The scan is idempotent — an embed that is already rendered is left
 * alone — which is also what keeps the watcher's own mutations from feeding back into it.
 */
class LivePreviewEmbedWatcher implements PluginValue {
  private readonly observer: MutationObserver;
  private readonly owner: RemoteHtmlEmbedsComponent;
  private readonly trackedEmbeds = new Map<HTMLElement, TrackedEmbed>();
  private readonly view: EditorView;

  public constructor(owner: RemoteHtmlEmbedsComponent, view: EditorView) {
    this.owner = owner;
    this.view = view;
    this.observer = new MutationObserver(() => {
      this.scan();
    });
    this.observer.observe(view.contentDOM, { childList: true, subtree: true });
    this.scan();
  }

  public destroy(): void {
    this.observer.disconnect();
    for (const trackedEmbed of this.trackedEmbeds.values()) {
      this.owner.removeChild(trackedEmbed.component);
    }
    this.trackedEmbeds.clear();
  }

  private scan(): void {
    for (const [hostEl, trackedEmbed] of this.trackedEmbeds) {
      if (!hostEl.isConnected) {
        this.untrack(hostEl, trackedEmbed);
      }
    }

    for (const candidate of this.owner.findCandidates(this.view.contentDOM)) {
      const hostEl = candidate.isImage ? candidate.el.closest<HTMLElement>(LIVE_PREVIEW_IMAGE_EMBED_SELECTOR) : candidate.el;
      if (!hostEl) {
        continue;
      }

      const trackedEmbed = this.trackedEmbeds.get(hostEl);
      if (trackedEmbed) {
        // Still rendered, for the same URL: nothing to do. Otherwise the editor rewrote the widget under the
        // embed, and it is rendered afresh.
        if (trackedEmbed.url === candidate.src && trackedEmbed.iframeEl?.isConnected) {
          continue;
        }
        this.untrack(hostEl, trackedEmbed);
      }

      if (candidate.isImage) {
        copySizeAttributes(candidate.el, hostEl);
      }
      hostEl.removeClass(EMPTY_ATTACHMENT_CLASS);

      const component = this.owner.createEmbed(candidate, hostEl);
      this.owner.addChild(component);
      this.trackedEmbeds.set(hostEl, {
        component,
        iframeEl: hostEl.querySelector('iframe'),
        url: candidate.src
      });
    }
  }

  private untrack(hostEl: HTMLElement, trackedEmbed: TrackedEmbed): void {
    this.owner.removeChild(trackedEmbed.component);
    this.trackedEmbeds.delete(hostEl);
  }
}

/**
 * Turns the embeds that name a REMOTE HTML document (`![](https://host/page.html)`, `![[https://host/page.html]]`)
 * into {@link RemoteHtmlEmbedComponent}s.
 *
 * Obsidian never offers such an embed to `app.embedRegistry` — that only resolves vault files — so the plugin
 * finds what Obsidian rendered instead (a broken `<img>`, or a "could not be found" placeholder) and upgrades it:
 * - in reading view, a markdown post-processor REPLACES the element with a fresh host, which Obsidian owns no
 *   reference to;
 * - in Live Preview the element is a CodeMirror widget, which must not be replaced, so a view plugin renders INTO
 *   the widget's root, and re-renders whenever the editor rebuilds it.
 */
export class RemoteHtmlEmbedsComponent extends ComponentEx {
  private readonly app: App;
  private readonly editorExtensionRegistrar: EditorExtensionRegistrar;
  private readonly htmlExtensions: HtmlExtensions;
  private readonly markdownPostProcessorRegistrar: MarkdownPostProcessorRegistrar;
  private readonly pluginSettingsComponent: PluginSettingsComponent;

  public constructor(params: RemoteHtmlEmbedsComponentConstructorParams) {
    super();
    this.app = params.app;
    this.editorExtensionRegistrar = params.editorExtensionRegistrar;
    this.htmlExtensions = params.htmlExtensions;
    this.markdownPostProcessorRegistrar = params.markdownPostProcessorRegistrar;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
  }

  /**
   * Creates the component that renders a candidate into a host.
   *
   * @param candidate - The candidate.
   * @param hostEl - The element to render into.
   * @returns The component, not yet loaded.
   */
  public createEmbed(candidate: Candidate, hostEl: HTMLElement): RemoteHtmlEmbedComponent {
    const url = candidate.remoteHtmlUrl.url;
    // An unresolved internal embed's `alt` is the size token (`![[url|50%x300]]`), unless Obsidian filled it with
    // the link itself because the embed named none.
    const fallbackAltValues = new Set([candidate.src, url]);
    return new RemoteHtmlEmbedComponent({
      app: this.app,
      containerEl: hostEl,
      getSizeToken: candidate.isImage ? getImageSizeToken : (altValue): string => fallbackAltValues.has(altValue) ? '' : altValue,
      pluginSettingsComponent: this.pluginSettingsComponent,
      subpath: candidate.remoteHtmlUrl.subpath,
      url
    });
  }

  /**
   * Finds the elements under a root that Obsidian rendered for a remote HTML embed.
   *
   * @param rootEl - The root to search.
   * @returns The candidates.
   */
  public findCandidates(rootEl: HTMLElement): Candidate[] {
    const extensions = this.htmlExtensions.list();
    const candidates: Candidate[] = [];
    for (const el of rootEl.querySelectorAll<HTMLElement>(`${IMAGE_SELECTOR}, ${INTERNAL_EMBED_SELECTOR}`)) {
      /* v8 ignore start -- Both selectors require `[src]`, so `getAttr` never returns `null` here. */
      const src = el.getAttr(SRC_ATTRIBUTE) ?? '';
      /* v8 ignore stop */
      const remoteHtmlUrl = parseRemoteHtmlUrl(src, extensions);
      if (remoteHtmlUrl) {
        candidates.push({ el, isImage: el.tagName === 'IMG', remoteHtmlUrl, src });
      }
    }
    return candidates;
  }

  public override onload(): void {
    super.onload();

    this.markdownPostProcessorRegistrar.registerMarkdownPostProcessor({
      postProcessor: (el, context) => {
        this.processReadingView(el, context);
      }
    });

    this.editorExtensionRegistrar.registerEditorExtension(ViewPlugin.define((view) => new LivePreviewEmbedWatcher(this, view)));
  }

  private processReadingView(el: HTMLElement, context: MarkdownPostProcessorContext): void {
    for (const candidate of this.findCandidates(el)) {
      // A `<div>`, not the `<span>` an internal embed uses: an inline box would ignore the width and height.
      const hostEl = createDiv();
      copySizeAttributes(candidate.el, hostEl);
      candidate.el.replaceWith(hostEl);

      const renderChild = new MarkdownRenderChild(hostEl);
      renderChild.addChild(this.createEmbed(candidate, hostEl));
      context.addChild(renderChild);
    }
  }
}

function copySizeAttributes(fromEl: HTMLElement, toEl: HTMLElement): void {
  for (const attribute of SIZE_ATTRIBUTES) {
    const value = fromEl.getAttr(attribute);
    if (value !== null) {
      toEl.setAttr(attribute, value);
    }
  }
}

/**
 * Extracts the size token from an image's `alt`.
 *
 * An image's `alt` is its CAPTION (`![Home page](url)`). Obsidian moves a pure-digit size into the `width` /
 * `height` attributes (`![Report|320x180](url)` leaves `Report`), and leaves any other size where it was
 * written, after the caption (`![Wide|50%x250](url)` keeps `Wide|50%x250`). So only what follows the last `|`
 * is a size token. In Live Preview an `alt` nobody wrote is the file name, which has no `|` either.
 *
 * @param altValue - The image's `alt`.
 * @returns The size token, or `''` for none.
 */
function getImageSizeToken(altValue: string): string {
  const separatorIndex = altValue.lastIndexOf(SIZE_TOKEN_SEPARATOR);
  return separatorIndex === -1 ? '' : altValue.slice(separatorIndex + 1);
}
