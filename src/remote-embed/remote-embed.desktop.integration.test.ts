import type { AddressInfo } from 'node:net';
import type {
  MarkdownView,
  WorkspaceLeaf
} from 'obsidian';

import { createServer } from 'node:http';
import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it
} from 'vitest';

// A REMOTE HTML document — `![](http://host/page.html)` or `![[http://host/page.html]]` — is rendered as a
// cross-origin `<iframe src>`, in reading view and in Live Preview alike.
//
// The page is served by a throwaway loopback server, so the suite needs no internet. It reports back to
// Obsidian with `postMessage`, which is the only thing a cross-origin frame can do: its own stylesheet's
// effect (proving its relative assets load with no help), whether it could reach `parent.app` (it must not),
// and how far it scrolled (proving a `#id` travels as a native fragment).
//
// Desktop-only: the Android emulator does not reach the host's loopback interface.

const ANY_AVAILABLE_PORT = 0;
const LOOPBACK_HOST = '127.0.0.1';
const OK_STATUS = 200;
const NOT_FOUND_STATUS = 404;
const RED = 'rgb(255, 0, 0)';
const DEFAULT_HEIGHT = 400;

const PAGE_HTML = `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <h1 id="heading">remote</h1>
  <div style="height: 3000px"></div>
  <h2 id="target">target</h2>
  <div style="height: 3000px"></div>
  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        let parentApp;
        try {
          parentApp = typeof parent.app;
        } catch {
          parentApp = 'blocked';
        }
        parent.postMessage({
          color: getComputedStyle(document.getElementById('heading')).color,
          href: location.href,
          parentApp,
          scrollY: window.scrollY
        }, '*');
      }, 200);
    });
  </script>
</body>
</html>
`;

interface EmbedObservation extends PageReport {
  readonly height: number;
  readonly width: number;
}

interface ExternalBrowserObservation {
  readonly createdFileCount: number;
  readonly openedTarget: null | string;
  readonly openedUrl: null | string;
}

interface ModeObservation {
  /**
   * Whether the first embed's button sits wholly above its frame, rather than beside it.
   */
  readonly buttonAboveFrame: boolean;
  readonly embeds: Record<string, EmbedObservation>;
  readonly externalBrowser: ExternalBrowserObservation;

  /**
   * The editor's selection after a click on the first embed, outside its button and frame; `null` in reading view.
   */
  readonly selectionAfterClick: null | string;
}

interface Observation {
  readonly livePreview: ModeObservation;
  readonly readingView: ModeObservation;
}

/**
 * What the embedded page posts to its parent.
 */
interface PageReport {
  readonly color: string;
  readonly href: string;
  readonly parentApp: string;
  readonly scrollY: number;
}

let baseUrl = '';
const server = createServer((request, response) => {
  const path = request.url ?? '';
  if (path.endsWith('/style.css')) {
    response.writeHead(OK_STATUS, { 'Content-Type': 'text/css' });
    response.end(`h1 { color: ${RED}; }`);
    return;
  }
  if (path.endsWith('.html')) {
    response.writeHead(OK_STATUS, { 'Content-Type': 'text/html' });
    response.end(PAGE_HTML);
    return;
  }
  response.writeHead(NOT_FOUND_STATUS);
  response.end();
});

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server.listen(ANY_AVAILABLE_PORT, LOOPBACK_HOST, resolve);
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://${LOOPBACK_HOST}:${String(address.port)}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });
});

describe('remote HTML embed', () => {
  it('should render both syntaxes as isolated remote frames, in reading view and Live Preview', async () => {
    const result = await observeNote('embed-html-remote-embed-behavior.md', [
      `![](${baseUrl}/attachments/markdown.html)`,
      `![[${baseUrl}/attachments/wikilink.html|300x200]]`,
      `![](${baseUrl}/attachments/fragment.html#target)`
    ]);

    for (const [modeName, { embeds, externalBrowser }] of getModes(result)) {
      const markdown = embeds['/attachments/markdown.html'];
      const wikilink = embeds['/attachments/wikilink.html'];
      const fragment = embeds['/attachments/fragment.html'];

      expect(markdown, modeName).toBeDefined();
      expect(wikilink, modeName).toBeDefined();
      expect(fragment, modeName).toBeDefined();

      // Its own relative stylesheet applied, with no inlining.
      expect(markdown?.color, modeName).toBe(RED);
      // Isolated from Obsidian.
      expect(markdown?.parentApp, modeName).toBe('blocked');
      // The default size (400px high).
      expect(markdown?.height, modeName).toBe(DEFAULT_HEIGHT);

      // The `|300x200` size token.
      expect(wikilink?.width, modeName).toBe(300);
      expect(wikilink?.height, modeName).toBe(200);

      // The `#target` subpath scrolled the document natively.
      expect(fragment?.href, modeName).toMatch(/#target$/u);
      expect(fragment?.scrollY, modeName).toBeGreaterThan(0);
      // Obsidian's fallback `alt` (`fragment.html#target` in Live Preview) is not mistaken for a width.
      expect(fragment?.width, modeName).toBe(markdown?.width);

      expect(externalBrowser.openedUrl, modeName).toBe(`${baseUrl}/attachments/wikilink.html`);
      expect(externalBrowser.openedTarget, modeName).toBe('_external');
      expect(externalBrowser.createdFileCount, modeName).toBe(0);
    }
  });

  // Live Preview draws `![](url)` as an image widget: a flex row, which put the button beside the frame, and
  // whose click handler sits on the `<img>` the embed replaces, so a click revealed nothing.
  it('should stack the button above the frame, and reveal the source on a click, like a vault embed', async () => {
    const embedLine = `![](${baseUrl}/attachments/clicked.html)`;
    const result = await observeNote('embed-html-remote-embed-click.md', [embedLine]);

    for (const [modeName, { buttonAboveFrame }] of getModes(result)) {
      expect(buttonAboveFrame, modeName).toBe(true);
    }
    expect(result.livePreview.selectionAfterClick).toBe(embedLine);
  });

  // A note of its own: reading view only renders the sections near the viewport, and these heights stacked
  // under the first test's would push the last embeds out of it.
  it('should size each syntax the way Obsidian hands the size over', async () => {
    const result = await observeNote('embed-html-remote-embed-sizes.md', [
      `![Home page](${baseUrl}/attachments/captioned.html)`,
      `![Report|320x180](${baseUrl}/attachments/sized.html)`,
      `![Wide|50%x250](${baseUrl}/attachments/css-sized.html)`,
      `![[${baseUrl}/attachments/wikilink-css.html|50%x260]]`
    ]);

    for (const [modeName, { embeds }] of getModes(result)) {
      const captioned = embeds['/attachments/captioned.html'];
      const sized = embeds['/attachments/sized.html'];
      const cssSized = embeds['/attachments/css-sized.html'];
      const wikilinkCss = embeds['/attachments/wikilink-css.html'];
      const fullWidth = captioned?.width ?? 0;

      // `![Home page](url)`: a caption, not a size, so the defaults apply.
      expect(fullWidth, modeName).toBeGreaterThan(0);
      expect(captioned?.height, modeName).toBe(DEFAULT_HEIGHT);

      // `![Report|320x180](url)`: Obsidian hands a numeric size over as `width` / `height` attributes.
      expect(sized?.width, modeName).toBe(320);
      expect(sized?.height, modeName).toBe(180);

      // `![Wide|50%x250](url)`: Obsidian leaves a non-numeric size in `alt`, after the caption.
      expect(Math.abs((cssSized?.width ?? 0) - fullWidth / 2), modeName).toBeLessThanOrEqual(1);
      expect(cssSized?.height, modeName).toBe(250);

      // `![[url|50%x260]]`: a non-numeric size token on the wikilink form.
      expect(Math.abs((wikilinkCss?.width ?? 0) - fullWidth / 2), modeName).toBeLessThanOrEqual(1);
      expect(wikilinkCss?.height, modeName).toBe(260);
    }
  });
});

function getModes(observation: Observation): [string, ModeObservation][] {
  return [['reading view', observation.readingView], ['Live Preview', observation.livePreview]];
}

async function observeNote(noteName: string, noteEmbedLines: string[]): Promise<Observation> {
  return await evalInObsidian({
    callback: async ({ app, embedLines, lib: { clickMouse, waitUntil }, notePath }): Promise<Observation> => {
      // Two waits share the transport's 30s cap for one closure.
      const TIMEOUT_IN_MILLISECONDS = 10_000;
      const noteContent = ['Top line.', '', ...embedLines.flatMap((line) => [line, ''])].join('\n');

      const existing = app.vault.getFileByPath(notePath);
      if (existing) {
        await app.fileManager.trashFile(existing);
      }
      const noteFile = await app.vault.create(notePath, noteContent);

      // Keyed by the frame that sent it: a markdown view builds its Live Preview editor while it is still in
      // reading view, so both modes' frames load, and report, from the start.
      const messages = new Map<MessageEventSource, PageReport>();
      window.addEventListener('message', onMessage);

      try {
        // Each mode gets a leaf OPENED in it. A frame loaded while its mode was hidden has no layout, so it
        // cannot scroll to its fragment; that is not what a reader who opens the note meets.
        const readingView = await observe('reading view', { mode: 'preview' }, false);
        const livePreview = await observe('Live Preview', { mode: 'source', source: false }, true);
        return { livePreview, readingView };
      } finally {
        window.removeEventListener('message', onMessage);
        await app.fileManager.trashFile(noteFile);
      }

      function onMessage(event: MessageEvent<PageReport>): void {
        if (event.source && typeof event.data.href === 'string') {
          messages.set(event.source, event.data);
        }
      }

      async function observe(modeName: string, state: Record<string, unknown>, isLivePreview: boolean): Promise<ModeObservation> {
        const leaf = app.workspace.getLeaf(true);
        try {
          await leaf.openFile(noteFile, { state });
          return await observeLeaf(modeName, leaf, isLivePreview);
        } finally {
          leaf.detach();
        }
      }

      async function observeLeaf(modeName: string, leaf: WorkspaceLeaf, isLivePreview: boolean): Promise<ModeObservation> {
        await waitUntil({
          message: `the remote embeds never reported back in ${modeName}`,
          predicate: () => {
            const iframes = getIframes(leaf);
            return iframes.length === embedLines.length && iframes.every((iframe) => iframe.contentWindow !== null && messages.has(iframe.contentWindow));
          },
          timeoutInMilliseconds: TIMEOUT_IN_MILLISECONDS
        });

        const embeds: Record<string, EmbedObservation> = {};
        for (const iframe of getIframes(leaf)) {
          const pathname = new URL(iframe.src).pathname;
          const message = iframe.contentWindow ? messages.get(iframe.contentWindow) : undefined;
          const host = iframe.parentElement;
          if (!message || !host) {
            continue;
          }
          const rect = host.getBoundingClientRect();
          embeds[pathname] = { ...message, height: Math.round(rect.height), width: Math.round(rect.width) };
        }
        return {
          buttonAboveFrame: isButtonAboveFrame(leaf),
          embeds,
          externalBrowser: clickExternalBrowserButton(leaf),
          // Last: revealing the source makes the editor redraw the widget.
          selectionAfterClick: isLivePreview ? await clickBesideFirstButton(leaf) : null
        };
      }

      function isButtonAboveFrame(leaf: WorkspaceLeaf): boolean {
        const iframe = getIframes(leaf)[0];
        const buttonEl = iframe?.parentElement?.querySelector('button');
        return !!iframe && !!buttonEl && buttonEl.getBoundingClientRect().bottom <= iframe.getBoundingClientRect().top;
      }

      // A real click on the host, in the button's row to its right: outside the button and the frame.
      async function clickBesideFirstButton(leaf: WorkspaceLeaf): Promise<null | string> {
        const CLICK_OFFSET_IN_PIXELS = 20;
        // Short, so the closure's waits stay under the transport's cap.
        const SELECTION_TIMEOUT_IN_MILLISECONDS = 2000;
        const buttonRect = getIframes(leaf)[0]?.parentElement?.querySelector('button')?.getBoundingClientRect();
        if (!buttonRect) {
          return null;
        }
        await clickMouse({ x: buttonRect.right + CLICK_OFFSET_IN_PIXELS, y: buttonRect.top + buttonRect.height / 2 });
        await waitUntil({
          message: 'the click never changed the selection',
          predicate: () => (leaf.view as MarkdownView).editor.getSelection() !== '',
          timeoutInMilliseconds: SELECTION_TIMEOUT_IN_MILLISECONDS
        });
        return (leaf.view as MarkdownView).editor.getSelection();
      }

      // The `![[url]]` host is Obsidian's "could not be found" placeholder, whose own click handler offers to
      // create a note named after the URL; the button must hand the URL to the browser and nothing else.
      function clickExternalBrowserButton(leaf: WorkspaceLeaf): ExternalBrowserObservation {
        const fileCountBefore = app.vault.getFiles().length;
        const buttonEl = getIframes(leaf).find((iframe) => iframe.src.includes('/wikilink.html'))?.parentElement?.querySelector('button');
        if (!buttonEl) {
          return { createdFileCount: 0, openedTarget: null, openedUrl: null };
        }
        const originalOpen = window.open.bind(window);
        let openedUrl: null | string = null;
        let openedTarget: null | string = null;
        // Intercept rather than let a real browser launch on the machine running the suite.
        window.open = (url, target): null => {
          openedUrl = typeof url === 'string' ? url : String(url);
          openedTarget = target ?? null;
          return null;
        };
        try {
          buttonEl.click();
        } finally {
          window.open = originalOpen;
        }
        return { createdFileCount: app.vault.getFiles().length - fileCountBefore, openedTarget, openedUrl };
      }

      function getIframes(leaf: WorkspaceLeaf): HTMLIFrameElement[] {
        return [...leaf.view.containerEl.querySelectorAll<HTMLIFrameElement>(':scope .embed-html-remote iframe')].filter((iframe) => iframe.offsetParent !== null);
      }
    },
    input: { embedLines: noteEmbedLines, notePath: noteName },
    vaultPath: getTemporaryVault().path
  });
}
