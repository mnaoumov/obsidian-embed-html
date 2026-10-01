import type { TransactionSpec } from '@codemirror/state';
import type {
  EditorView,
  PluginValue
} from '@codemirror/view';
import type {
  App as AppOriginal,
  MarkdownPostProcessorContext,
  MarkdownRenderChild as MarkdownRenderChildOriginal
} from 'obsidian';
import type { EditorExtensionRegistrar } from 'obsidian-dev-utils/obsidian/editor-extension-registrar';
import type { MarkdownPostProcessorRegistrar } from 'obsidian-dev-utils/obsidian/markdown-post-processor-registrar';
import type { MockInstance } from 'vitest';

import { ViewPlugin } from '@codemirror/view';
import { noopAsync } from 'obsidian-dev-utils/function';
import { castTo } from 'obsidian-dev-utils/object-utils';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  App,
  MarkdownRenderChild
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

import { HtmlExtensions } from './html-extensions.ts';
import { PluginSettings } from './plugin-settings.ts';
import { RemoteHtmlEmbedsComponent } from './remote-html-embeds-component.ts';

type DispatchFunction = (spec: TransactionSpec) => void;
type PostProcessor = Parameters<MarkdownPostProcessorRegistrar['registerMarkdownPostProcessor']>[0]['postProcessor'];
type WatcherFactory = (view: EditorView) => PluginValue;

const REMOTE_URL = 'https://example.com/attachments/page.html';
const NOT_FOUND_TEXT = 'Could not be found';

let app: AppOriginal;
let component: RemoteHtmlEmbedsComponent;
let rootEl: HTMLElement;
let registerEditorExtension: ReturnType<typeof vi.fn<EditorExtensionRegistrar['registerEditorExtension']>>;
let registerMarkdownPostProcessor: ReturnType<typeof vi.fn<MarkdownPostProcessorRegistrar['registerMarkdownPostProcessor']>>;
let defineSpy: MockInstance<typeof ViewPlugin.define>;

describe('RemoteHtmlEmbedsComponent', () => {
  describe('registration', () => {
    it('should register a markdown post-processor and an editor extension on load', () => {
      expect(registerMarkdownPostProcessor).toHaveBeenCalledOnce();
      expect(registerEditorExtension).toHaveBeenCalledOnce();
      expect(registerEditorExtension.mock.calls[0]?.[0]).toBe(defineSpy.mock.results[0]?.value);
    });
  });

  describe('reading view', () => {
    it('should replace a remote HTML image with a rendered host, keeping its size attributes', async () => {
      rootEl.createEl('p').createEl('img', { attr: { alt: 'x', src: REMOTE_URL, width: '300' } });
      const context = createContext();

      await getPostProcessor()(rootEl, context.context);

      expect(rootEl.querySelector('img')).toBeNull();
      const hostEl = rootEl.querySelector<HTMLElement>(':scope > p > div');
      expect(hostEl?.getAttr('width')).toBe('300');
      expect(hostEl?.getAttr('alt')).toBe('x');
      expect(hostEl?.getAttr('height')).toBeNull();
      expect(context.renderChildren).toHaveLength(1);
      expect(context.renderChildren[0]).toBeInstanceOf(MarkdownRenderChild);

      context.renderChildren[0]?.load();
      expect(hostEl?.querySelector('iframe')?.getAttr('src')).toBe(REMOTE_URL);
      // `![x|300](url)`: the size is in the attributes and `x` is only the caption.
      expect(hostEl?.style.width).toBe('300px');
    });

    it('should read the size token that follows the caption in the alt of an image', async () => {
      rootEl.createEl('p').createEl('img', { attr: { alt: 'Wide|50%x300', src: REMOTE_URL } });
      const context = createContext();

      await getPostProcessor()(rootEl, context.context);
      context.renderChildren[0]?.load();

      const hostEl = rootEl.querySelector<HTMLElement>(':scope > p > div');
      expect(hostEl?.style.width).toBe('50%');
      expect(hostEl?.style.height).toBe('300px');
    });

    it('should read the alt of an image with no size token as a caption', async () => {
      rootEl.createEl('p').createEl('img', { attr: { alt: 'Home page', src: REMOTE_URL } });
      const context = createContext();

      await getPostProcessor()(rootEl, context.context);
      context.renderChildren[0]?.load();

      expect(rootEl.querySelector<HTMLElement>(':scope > p > div')?.style.width).toBe('100%');
    });

    it('should size an image with no alt from its size attributes', async () => {
      rootEl.createEl('p').createEl('img', { attr: { height: '120', src: REMOTE_URL } });
      const context = createContext();

      await getPostProcessor()(rootEl, context.context);
      context.renderChildren[0]?.load();

      expect(rootEl.querySelector<HTMLElement>(':scope > p > div')?.style.height).toBe('120px');
    });

    it('should replace an unresolved internal embed naming a remote HTML document, with its subpath', async () => {
      rootEl.createEl('p').createSpan({
        attr: { alt: `${REMOTE_URL}#top`, src: `${REMOTE_URL}#top` },
        cls: ['internal-embed', 'mod-empty-attachment'],
        text: NOT_FOUND_TEXT
      });
      const context = createContext();

      await getPostProcessor()(rootEl, context.context);
      context.renderChildren[0]?.load();

      expect(rootEl.querySelector('.internal-embed')).toBeNull();
      const hostEl = rootEl.querySelector<HTMLElement>('div.embed-html-remote');
      expect(hostEl?.querySelector('iframe')?.getAttr('src')).toBe(`${REMOTE_URL}#top`);
      // The `alt` is Obsidian's fallback (the link itself), so it is not read as a width.
      expect(hostEl?.style.width).toBe('100%');
    });

    it('should leave every other image and embed alone', async () => {
      const paragraphEl = rootEl.createEl('p');
      paragraphEl.createEl('img', { attr: { src: 'https://example.com/a.png' } });
      paragraphEl.createSpan({ attr: { src: 'note.html' }, cls: 'internal-embed' });
      paragraphEl.createEl('img');
      const html = rootEl.innerHTML;
      const context = createContext();

      await getPostProcessor()(rootEl, context.context);

      expect(rootEl.innerHTML).toBe(html);
      expect(context.renderChildren).toHaveLength(0);
    });
  });

  describe('Live Preview', () => {
    it('should render into the image widget root in place, carrying the image\'s size attributes', () => {
      rootEl.createDiv('image-embed').createDiv('image-wrapper').createEl('img', { attr: { alt: 'page.html#x', src: `${REMOTE_URL}#x`, width: '320' } });
      const widgetEl = rootEl.querySelector<HTMLElement>('.image-embed');

      createWatcher();

      expect(rootEl.querySelector('.image-embed')).toBe(widgetEl);
      expect(widgetEl?.querySelector('img')).toBeNull();
      expect(widgetEl?.hasClass('embed-html-remote')).toBe(true);
      expect(widgetEl?.querySelector('iframe')?.getAttr('src')).toBe(`${REMOTE_URL}#x`);
      expect(widgetEl?.style.width).toBe('320px');
    });

    it('should render into an unresolved internal embed widget in place, dropping its empty-attachment look', () => {
      rootEl.createDiv({ attr: { alt: REMOTE_URL, src: REMOTE_URL }, cls: ['internal-embed', 'mod-empty-attachment'], text: NOT_FOUND_TEXT });
      const widgetEl = rootEl.querySelector<HTMLElement>('.internal-embed');

      createWatcher();

      expect(widgetEl?.hasClass('mod-empty-attachment')).toBe(false);
      expect(widgetEl?.textContent).not.toContain(NOT_FOUND_TEXT);
      expect(widgetEl?.querySelector('iframe')?.getAttr('src')).toBe(REMOTE_URL);
    });

    it('should skip an image that is not inside an image widget', () => {
      rootEl.createEl('img', { attr: { src: REMOTE_URL } });

      createWatcher();

      expect(rootEl.querySelector('img')).not.toBeNull();
      expect(rootEl.querySelector('iframe')).toBeNull();
    });

    it('should upgrade a widget the editor draws later', async () => {
      createWatcher();

      rootEl.createDiv({ attr: { alt: REMOTE_URL, src: REMOTE_URL }, cls: 'internal-embed' });
      await flushMutations();

      expect(rootEl.querySelector('iframe')?.getAttr('src')).toBe(REMOTE_URL);
    });

    it('should leave a rendered embed alone on a re-scan', async () => {
      rootEl.createDiv({ attr: { src: REMOTE_URL }, cls: 'internal-embed' });
      createWatcher();
      const iframeEl = rootEl.querySelector('iframe');

      rootEl.createDiv({ text: 'unrelated change' });
      await flushMutations();

      expect(rootEl.querySelector('iframe')).toBe(iframeEl);
      expect(rootEl.querySelectorAll('iframe')).toHaveLength(1);
    });

    it('should render afresh when the editor rewrites the widget under the embed', async () => {
      rootEl.createDiv({ attr: { src: REMOTE_URL }, cls: 'internal-embed' });
      createWatcher();
      const widgetEl = rootEl.querySelector<HTMLElement>('.internal-embed');

      widgetEl?.setText(NOT_FOUND_TEXT);
      await flushMutations();

      expect(widgetEl?.querySelector('iframe')?.getAttr('src')).toBe(REMOTE_URL);
    });

    it('should render afresh when the widget now names another document', async () => {
      rootEl.createDiv({ attr: { src: REMOTE_URL }, cls: 'internal-embed' });
      createWatcher();
      const widgetEl = rootEl.querySelector<HTMLElement>('.internal-embed');
      const otherUrl = 'https://example.com/other.html';

      widgetEl?.setAttr('src', otherUrl);
      rootEl.createDiv();
      await flushMutations();

      expect(widgetEl?.querySelector('iframe')?.getAttr('src')).toBe(otherUrl);
    });

    it('should unload the embed of a widget the editor removed', async () => {
      rootEl.createDiv({ attr: { src: REMOTE_URL }, cls: 'internal-embed' });
      const removeChildSpy = vi.spyOn(component, 'removeChild');
      createWatcher();

      rootEl.empty();
      await flushMutations();

      expect(removeChildSpy).toHaveBeenCalledOnce();
    });

    describe('a click on an image widget', () => {
      const IMAGE_SOURCE = `![Page](${REMOTE_URL})`;
      const LINE_PREFIX = 'Text ';
      const LINE_FROM = 100;
      const IMAGE_FROM = LINE_FROM + LINE_PREFIX.length;

      it('should select the whole source of the image, which reveals it, as a click on a vault embed does', () => {
        const editor = createEditorHarness(`${LINE_PREFIX}${IMAGE_SOURCE} more`);
        const widgetEl = createImageWidget();
        createWatcher(editor.view);

        widgetEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

        expect(editor.focus).toHaveBeenCalledOnce();
        expect(editor.dispatch).toHaveBeenCalledWith({
          scrollIntoView: true,
          selection: { anchor: IMAGE_FROM + IMAGE_SOURCE.length, head: IMAGE_FROM }
        });
      });

      it('should place the cursor at the widget when its source is not an image', () => {
        const editor = createEditorHarness(`${LINE_PREFIX}something else`);
        const widgetEl = createImageWidget();
        createWatcher(editor.view);

        widgetEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

        expect(editor.dispatch).toHaveBeenCalledWith({ scrollIntoView: true, selection: { anchor: IMAGE_FROM, head: IMAGE_FROM } });
      });

      it('should leave a click somebody already handled alone', () => {
        const editor = createEditorHarness(`${LINE_PREFIX}${IMAGE_SOURCE}`);
        const widgetEl = createImageWidget();
        createWatcher(editor.view);
        const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
        clickEvent.preventDefault();

        widgetEl.dispatchEvent(clickEvent);

        expect(editor.dispatch).not.toHaveBeenCalled();
      });

      it('should stop selecting once the embed is unloaded', async () => {
        const editor = createEditorHarness(`${LINE_PREFIX}${IMAGE_SOURCE}`);
        const widgetEl = createImageWidget();
        createWatcher(editor.view);

        widgetEl.remove();
        rootEl.createDiv();
        await flushMutations();
        widgetEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

        expect(editor.dispatch).not.toHaveBeenCalled();
      });

      it('should leave an internal embed to Obsidian, which selects its source by itself', () => {
        const editor = createEditorHarness(`${LINE_PREFIX}${IMAGE_SOURCE}`);
        const widgetEl = rootEl.createDiv({ attr: { src: REMOTE_URL }, cls: 'internal-embed' });
        createWatcher(editor.view);

        widgetEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

        expect(editor.dispatch).not.toHaveBeenCalled();
      });

      function createImageWidget(): HTMLElement {
        const widgetEl = rootEl.createDiv('image-embed');
        widgetEl.createDiv('image-wrapper').createEl('img', { attr: { src: REMOTE_URL } });
        return widgetEl;
      }

      function createEditorHarness(lineText: string): EditorHarness {
        const dispatch = vi.fn<DispatchFunction>();
        const focus = vi.fn<EditorView['focus']>();
        const view = strictProxy<EditorView>({
          contentDOM: rootEl,
          // `dispatch` is overloaded, which a mock of one signature cannot satisfy.
          dispatch: castTo<EditorView['dispatch']>(dispatch),
          focus,
          posAtDOM: () => IMAGE_FROM,
          state: strictProxy<EditorView['state']>({
            doc: strictProxy<EditorView['state']['doc']>({
              lineAt: () => strictProxy<ReturnType<EditorView['state']['doc']['lineAt']>>({ from: LINE_FROM, text: lineText })
            })
          })
        });
        return { dispatch, focus, view };
      }
    });

    it('should stop watching and unload every embed when destroyed', async () => {
      rootEl.createDiv({ attr: { src: REMOTE_URL }, cls: 'internal-embed' });
      const removeChildSpy = vi.spyOn(component, 'removeChild');
      const watcher = createWatcher();

      watcher.destroy?.();
      const laterWidgetEl = rootEl.createDiv({ attr: { src: REMOTE_URL }, cls: 'internal-embed' });
      await flushMutations();

      expect(removeChildSpy).toHaveBeenCalledOnce();
      expect(laterWidgetEl.querySelector('iframe')).toBeNull();
    });
  });
});

beforeEach(() => {
  app = App.createConfigured__().asOriginalType__();
  rootEl = createDiv();
  document.body.append(rootEl);

  registerEditorExtension = vi.fn<EditorExtensionRegistrar['registerEditorExtension']>();
  registerMarkdownPostProcessor = vi.fn<MarkdownPostProcessorRegistrar['registerMarkdownPostProcessor']>();
  defineSpy = vi.spyOn(ViewPlugin, 'define');

  component = new RemoteHtmlEmbedsComponent({
    app,
    editorExtensionRegistrar: strictProxy<EditorExtensionRegistrar>({ registerEditorExtension }),
    htmlExtensions: new HtmlExtensions(),
    markdownPostProcessorRegistrar: strictProxy<MarkdownPostProcessorRegistrar>({ registerMarkdownPostProcessor }),
    pluginSettingsComponent: strictProxy<PluginSettingsComponent>({ settings: new PluginSettings() })
  });
  component.load();
});

afterEach(() => {
  component.unload();
  rootEl.remove();
  vi.restoreAllMocks();
});

interface ContextHarness {
  readonly context: MarkdownPostProcessorContext;
  readonly renderChildren: MarkdownRenderChildOriginal[];
}

interface EditorHarness {
  readonly dispatch: ReturnType<typeof vi.fn<DispatchFunction>>;
  readonly focus: ReturnType<typeof vi.fn<EditorView['focus']>>;
  readonly view: EditorView;
}

function createContext(): ContextHarness {
  const renderChildren: MarkdownRenderChildOriginal[] = [];
  const context = strictProxy<MarkdownPostProcessorContext>({
    addChild: (child: MarkdownRenderChildOriginal) => {
      renderChildren.push(child);
    }
  });
  return { context, renderChildren };
}

function createWatcher(view?: EditorView): PluginValue {
  const factory = defineSpy.mock.calls[0]?.[0] as undefined | WatcherFactory;
  if (!factory) {
    throw new Error('No view plugin defined');
  }
  return factory(view ?? strictProxy<EditorView>({ contentDOM: rootEl }));
}

async function flushMutations(): Promise<void> {
  // Mutation observers deliver in a microtask.
  await noopAsync();
}

function getPostProcessor(): PostProcessor {
  const postProcessor = registerMarkdownPostProcessor.mock.calls[0]?.[0].postProcessor;
  if (!postProcessor) {
    throw new Error('No post-processor registered');
  }
  return postProcessor;
}
