import {
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { getRootFolder } from 'obsidian-dev-utils/script-utils/root';
import { evalInObsidian } from 'obsidian-integration-testing';
import { getTempVault } from 'obsidian-integration-testing/vitest-global-setup';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it
} from 'vitest';

// A single `evalInObsidian` closure runs as one CDP `Runtime.evaluate`, which the harness caps at
// 30s — so the per-note work is split into several short evals (open+settle, then one per button)
// Rather than one long closure. These ceilings bound each individual eval well under that cap.
const SETTLE_TIMEOUT_MS = 20_000;
const BUTTON_RENDER_TIMEOUT_MS = 10_000;
const BUTTON_RESULT_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 100;

const ROOT = getRootFolder() ?? process.cwd();
const DEMO_VAULT_DIR = join(ROOT, 'demo-vault');
const REPORT_PATH = join(ROOT, 'demo-vault-execution-report.json');

// `00 Start.md` is a landing page and `README.md` is repo docs — neither is a self-contained feature demo.
const EXCLUDED_TOP_LEVEL = new Set(['00 Start.md', 'README.md']);

interface ButtonResult {
  readonly caption: string;
  readonly output: string;
  readonly status: 'error' | 'ok' | 'timeout' | 'unknown';
}

interface CstEnableResult {
  readonly cstLoaded: boolean;
  readonly loadedPlugins: string[];
}

interface NoteExpectation {
  buttonCount: number;
  // `src|axis|value` keys for every embed whose size token is a pure-digit form (`N` or `NxM`) that
  // Obsidian routes into the container's numeric `width`/`height` attributes. Each must actually be
  // Measured at render time — a declared numeric size that is never measured signals the size check
  // Silently did nothing (e.g. Obsidian changed its attribute routing), not that the size was correct.
  expectedSizeKeys: string[];
  htmlEmbedCount: number;
  name: string;
}

interface NoteReport extends NoteExpectation, SettleResult {
  readonly buttonResults: ButtonResult[];
}

interface SettleResult {
  readonly debug: unknown;
  readonly embedIframeCount: number;
  readonly internalEmbedCount: number;
  // Keys (`src|axis|value`) of the numeric-attribute sizes actually measured during the walk, used to
  // Prove the size check ran rather than silently measuring nothing (see `expectedSizeKeys`).
  readonly measuredSizeKeys: string[];
  readonly renderedButtonCount: number;
  readonly sizeViolations: SizeViolation[];
  readonly unresolvedEmbedCount: number;
}

// One committed size reading during the walk: a computed value and how many consecutive scans it has
// Held steady, so a value is only trusted once it stops changing (see `recordEmbedSizes`).
interface SizeReading {
  readonly count: number;
  readonly value: string;
}

// A rendered embed whose numeric `width`/`height` attribute (what Obsidian routes `|400`, `|600x200`,
// `|x200` into) did not translate into the matching computed pixel size on the container.
interface SizeViolation {
  readonly actual: string;
  readonly attribute: string;
  readonly axis: 'height' | 'width';
  readonly expected: string;
  readonly src: string;
}

const report: NoteReport[] = [];

// Parses every `![[file.html…|token]]` embed and, for the pure-digit tokens Obsidian routes into the
// Container's numeric `width`/`height` attributes (`N` → width, `NxM` → both), returns the `src|axis|value`
// Keys the render is expected to expose. Fenced code samples that merely SHOW the syntax are stripped
// First so only real embeds count. Deliberately narrow: `x200`, `500x-`, `50%`, `width: …` stay in the
// Embed's `alt` and are validated by the size-spec unit tests and the sizing integration test, not here.
function extractExpectedSizeKeys(source: string): string[] {
  const withoutFences = source.replace(/```[\s\S]*?```/g, '');
  const keys = new Set<string>();
  const embedRegex = /!\[\[(?<src>[^\]|#]+\.html)(?:#[^\]|]*)?\|(?<token>[^\]]*)\]\]/g;
  let match: null | RegExpExecArray;
  while ((match = embedRegex.exec(withoutFences)) !== null) {
    const src = match.groups?.['src'] ?? '';
    const token = (match.groups?.['token'] ?? '').trim();
    if (/^\d+$/.test(token)) {
      keys.add(`${src}|width|${token}`);
      continue;
    }
    const dimensions = /^(?<width>\d+)x(?<height>\d+)$/.exec(token);
    if (dimensions) {
      keys.add(`${src}|width|${dimensions.groups?.['width'] ?? ''}`);
      keys.add(`${src}|height|${dimensions.groups?.['height'] ?? ''}`);
    }
  }
  return [...keys];
}

function listSelfContainedNotes(): NoteExpectation[] {
  const names = readdirSync(DEMO_VAULT_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && !EXCLUDED_TOP_LEVEL.has(entry.name))
    .map((entry) => entry.name)
    .sort();

  // DEMO_NOTES="a.md,b.md" narrows the walk for fast iteration.
  const filter = process.env['DEMO_NOTES'];
  const wanted = filter ? new Set(filter.split(',').map((name) => name.trim())) : null;

  return names
    .filter((name) => !wanted || wanted.has(name))
    .map((name) => {
      const source = readFileSync(join(DEMO_VAULT_DIR, name), 'utf-8');
      return {
        buttonCount: (source.match(/```code-button/g) ?? []).length,
        expectedSizeKeys: extractExpectedSizeKeys(source),
        htmlEmbedCount: (source.match(/!\[\[[^\]]*\.html[^\]]*\]\]/g) ?? []).length,
        name
      };
    });
}

const NOTES = listSelfContainedNotes();

// Clicks the code button at `index` and reads CST's result line. Each embed-html demo button calls
// `rebuildView()`, which re-renders the whole note and scrolls back to the top — so this re-scrolls to
// The bottom to re-mount the button row before clicking. Running one button per eval keeps every eval
// Under the 30s CDP cap and starts from a settled view.
async function clickButton(noteName: string, index: number): Promise<ButtonResult> {
  return evalInObsidian({
    args: { buttonRenderTimeoutMs: BUTTON_RENDER_TIMEOUT_MS, buttonResultTimeoutMs: BUTTON_RESULT_TIMEOUT_MS, index, intervalMs: POLL_INTERVAL_MS, notePath: noteName },
    async fn({ app, buttonRenderTimeoutMs, buttonResultTimeoutMs, index: buttonIndex, intervalMs, lib: { waitUntil }, obsidianModule }): Promise<ButtonResult> {
      function view(): InstanceType<typeof obsidianModule.MarkdownView> | null {
        return app.workspace.getActiveViewOfType(obsidianModule.MarkdownView);
      }
      function previewEl(): HTMLElement | null {
        return view()?.containerEl.querySelector<HTMLElement>('.markdown-preview-view') ?? null;
      }
      function runButtons(): HTMLButtonElement[] {
        return [...view()?.containerEl.querySelectorAll<HTMLButtonElement>('.block-language-code-button button.mod-cta') ?? []];
      }

      try {
        await waitUntil({
          intervalInMilliseconds: intervalMs,
          message: `code button #${String(buttonIndex + 1)} never rendered`,
          predicate: (): boolean => {
            const scroller = previewEl();
            if (scroller) {
              scroller.scrollTop = scroller.scrollHeight;
            }
            return runButtons().length > buttonIndex;
          },
          timeoutInMilliseconds: buttonRenderTimeoutMs
        });
      } catch {
        return { caption: `#${String(buttonIndex + 1)}`, output: '', status: 'timeout' };
      }

      const button = runButtons()[buttonIndex];
      if (!button) {
        return { caption: `#${String(buttonIndex + 1)}`, output: '', status: 'timeout' };
      }
      const caption = button.textContent;
      const block = button.closest<HTMLElement>('.block-language-code-button') ?? button.parentElement;
      button.scrollIntoView();
      button.click();

      let status: ButtonResult['status'];
      try {
        await waitUntil({
          intervalInMilliseconds: intervalMs,
          message: `button "${caption}" never reported a result`,
          // The retained `block` reference still receives CST's result line after the rebuild detaches it.
          predicate: (): boolean => /Executed (?:successfully|with error)/.test(block?.textContent ?? ''),
          timeoutInMilliseconds: buttonResultTimeoutMs
        });
        const text = block?.textContent ?? '';
        if (text.includes('Executed with error')) {
          status = 'error';
        } else if (text.includes('Executed successfully')) {
          status = 'ok';
        } else {
          status = 'unknown';
        }
      } catch {
        status = 'timeout';
      }

      return { caption, output: (block?.textContent ?? '').slice(0, 400), status };
    },
    vaultPath: getTempVault().path
  });
}

// The harness enables only the plugin-under-test (embed-html) and rewrites `community-plugins.json`
// To just that, so the seeded CodeScript Toolkit stays dormant and the `code-button` blocks never
// Become buttons. Turn off restricted mode and enable CST (its binary is seeded into the vault) once,
// Before any note opens, so the buttons render. In real use demo-vault-helper does this on launch.
async function enableCodeScriptToolkit(): Promise<CstEnableResult> {
  return evalInObsidian({
    args: { intervalMs: POLL_INTERVAL_MS, timeoutMs: SETTLE_TIMEOUT_MS },
    async fn({ app, intervalMs, lib: { waitUntil }, timeoutMs }): Promise<CstEnableResult> {
      if (typeof app.plugins.isEnabled === 'function' && !app.plugins.isEnabled()) {
        await app.plugins.setEnable(true);
      }
      if (!app.plugins.getPlugin('fix-require-modules')) {
        await app.plugins.enablePlugin('fix-require-modules');
      }
      try {
        await waitUntil({
          intervalInMilliseconds: intervalMs,
          message: 'CodeScript Toolkit never loaded',
          predicate: (): boolean => app.plugins.getPlugin('fix-require-modules') !== null,
          timeoutInMilliseconds: timeoutMs
        });
      } catch {
        // Reported via the returned flag; the test's beforeAll assertion fails loudly.
      }
      return { cstLoaded: app.plugins.getPlugin('fix-require-modules') !== null, loadedPlugins: Object.keys(app.plugins.plugins) };
    },
    vaultPath: getTempVault().path
  });
}

// Opens the note in reading view and walks it to the bottom until every HTML embed has produced an
// Iframe and every code button has rendered. Returns the embed/button health counts. Reading view
// Renders sections lazily and can unmount them far off-screen, so counts track the max simultaneously
// Mounted — and the walk never resets to the top (that would unmount the buttons at the note's end).
async function openAndSettle(noteName: string, expectedButtons: number, expectedEmbeds: number, expectedSizeKeys: string[]): Promise<SettleResult> {
  return evalInObsidian({
    args: { expectedButtons, expectedEmbeds, expectedSizeKeys, intervalMs: POLL_INTERVAL_MS, notePath: noteName, settleTimeoutMs: SETTLE_TIMEOUT_MS },
    async fn({ app, expectedButtons: wantButtons, expectedEmbeds: wantEmbeds, expectedSizeKeys: wantSizeKeys, intervalMs, lib: { waitUntil }, notePath, obsidianModule, settleTimeoutMs }): Promise<SettleResult> {
      function view(): InstanceType<typeof obsidianModule.MarkdownView> | null {
        return app.workspace.getActiveViewOfType(obsidianModule.MarkdownView);
      }
      function previewEl(): HTMLElement | null {
        return view()?.containerEl.querySelector<HTMLElement>('.markdown-preview-view') ?? null;
      }
      function buttons(): number {
        return view()?.containerEl.querySelectorAll('.block-language-code-button button.mod-cta').length ?? 0;
      }
      function unresolved(): HTMLElement[] {
        return [...view()?.containerEl.querySelectorAll<HTMLElement>('.internal-embed.is-unresolved, .internal-embed.mod-empty') ?? []];
      }
      // Records the settled computed pixel size of every mounted embed that carries a numeric
      // `width`/`height` attribute — the pure-digit tokens (`|400`, `|600x200`) that Obsidian itself
      // Routes into those attributes. This validates end-to-end that the declared size actually reaches
      // The container — independently of the plugin's own resolver, so a resolver bug cannot mask the
      // Failure. Non-numeric tokens (`x200`, `50%`, `500x-`, `width: ...`) stay in the embed's `alt` and
      // Are covered by the size-spec unit tests and the sizing integration test instead.
      //
      // The plugin applies the resolved size only once the iframe's document finishes loading, which can
      // Lag the iframe element appearing; reading before then catches the default size mid-transition
      // (the source of a flaky 604px). So only a fully-loaded iframe is read, and a value is committed
      // Only after two identical consecutive readings — a settled size, never a transition frame.
      const STABLE_READINGS = 2;
      const measuredSizes = new Map<string, SizeViolation>();
      const sizeReadings = new Map<string, SizeReading>();
      function recordEmbedSizes(): void {
        const win = view()?.containerEl.ownerDocument.defaultView ?? window;
        for (const embedEl of view()?.containerEl.querySelectorAll<HTMLElement>('.internal-embed') ?? []) {
          const iframeEl = embedEl.querySelector<HTMLIFrameElement>('iframe');
          if (!iframeEl || iframeEl.contentDocument?.readyState !== 'complete') {
            continue;
          }
          const src = embedEl.getAttribute('src') ?? '';
          const computed = win.getComputedStyle(embedEl);
          for (const axis of ['width', 'height'] as const) {
            const attribute = embedEl.getAttribute(axis);
            if (attribute === null || !/^\d+$/.test(attribute)) {
              continue;
            }
            const key = `${src}|${axis}|${attribute}`;
            const value = computed.getPropertyValue(axis);
            const previous = sizeReadings.get(key);
            const count = previous?.value === value ? previous.count + 1 : 1;
            sizeReadings.set(key, { count, value });
            if (count >= STABLE_READINGS) {
              measuredSizes.set(key, { actual: value, attribute, axis, expected: `${attribute}px`, src });
            }
          }
        }
      }

      // Tag every embed that has produced an iframe, so the count survives an embed later being
      // Scrolled out of view and its iframe torn down. Returns the running total of embeds seen rendered.
      function markRenderedEmbeds(): number {
        let count = 0;
        for (const embedEl of view()?.containerEl.querySelectorAll<HTMLElement>('.internal-embed') ?? []) {
          if (embedEl.querySelector('iframe')) {
            embedEl.dataset['testHtmlRendered'] = '1';
          }
          if (embedEl.dataset['testHtmlRendered'] === '1') {
            count++;
          }
        }
        return count;
      }

      await app.workspace.openLinkText(notePath.replace(/\.md$/, ''), '', false);
      await app.workspace.getLeaf(false).setViewState({ state: { file: notePath, mode: 'preview' }, type: 'markdown' });
      await waitUntil({
        intervalInMilliseconds: intervalMs,
        message: `preview view for "${notePath}" never mounted`,
        predicate: (): boolean => previewEl() !== null,
        timeoutInMilliseconds: settleTimeoutMs
      });

      // Reading view virtualizes: it unmounts `.internal-embed` sections once far off-screen, so no
      // Snapshot ever holds all of a long note's embeds at once — an exact count is infeasible. Instead
      // Walk the whole note top-to-bottom, recording the most embeds seen rendered as iframes (a
      // Lower bound) and any unresolved embed that appears at any point along the way.
      const trace: string[] = [];
      let maxRenderedEmbeds = 0;
      let maxButtons = 0;
      let maxUnresolved = 0;
      let atBottomOnce = false;
      for (let elapsed = 0; elapsed < settleTimeoutMs; elapsed += intervalMs) {
        const scroller = previewEl();
        if (scroller) {
          // Advance gradually so each embed enters the viewport and mounts — a single jump to the
          // Bottom skips the middle ones, whose collapsed height keeps the document short.
          const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4;
          atBottomOnce ||= atBottom;
          scroller.scrollTop = atBottom ? 0 : scroller.scrollTop + Math.floor(scroller.clientHeight * 0.8);
        }
        await sleep(intervalMs);
        recordEmbedSizes();
        maxRenderedEmbeds = Math.max(maxRenderedEmbeds, markRenderedEmbeds());
        maxButtons = Math.max(maxButtons, buttons());
        maxUnresolved = Math.max(maxUnresolved, unresolved().length);
        trace.push(`${String(markRenderedEmbeds())}i/${String(buttons())}b`);
        // Done once we have walked to the bottom at least once, rendered the code buttons, seen every
        // Declared embed produce an iframe at least once, and settled a stable size for every embed that
        // Declares one. A short note whose embeds are still collapsed reports scrollHeight ~= clientHeight
        // On the first scan (so `atBottom` fires immediately) — requiring an iframe first stops the walk
        // From exiting before anything rendered, and requiring settled sizes stops a mid-transition
        // Reading from slipping through. Both were sources of flaky passes.
        const allEmbedsRendered = wantEmbeds === 0 || maxRenderedEmbeds > 0;
        const allSizesSettled = wantSizeKeys.every((key) => measuredSizes.has(key));
        if (atBottomOnce && maxButtons >= wantButtons && allEmbedsRendered && allSizesSettled) {
          break;
        }
      }

      const embeds = [...view()?.containerEl.querySelectorAll<HTMLElement>('.internal-embed') ?? []];
      const scroller = previewEl();
      // A single subpixel of rounding is tolerated; anything larger means the declared size was ignored.
      const SIZE_TOLERANCE_PX = 1;
      const sizeViolations = [...measuredSizes.values()].filter((measured) => {
        const actualPx = Number.parseFloat(measured.actual);
        const expectedPx = Number.parseFloat(measured.expected);
        return !Number.isFinite(actualPx) || Math.abs(actualPx - expectedPx) > SIZE_TOLERANCE_PX;
      });
      return {
        debug: {
          codeButtonBlocks: view()?.containerEl.querySelectorAll('.block-language-code-button').length ?? -1,
          cstLoaded: app.plugins.getPlugin('fix-require-modules') !== null,
          embedSample: embeds.slice(0, 3).map((embedEl) => ({
            className: embedEl.className,
            hasIframe: embedEl.querySelector('iframe') !== null,
            src: embedEl.getAttribute('src') ?? embedEl.getAttribute('alt')
          })),
          loadedPlugins: Object.keys(app.plugins.plugins),
          measuredSizes: [...measuredSizes.values()],
          scroller: scroller ? { clientHeight: scroller.clientHeight, scrollHeight: scroller.scrollHeight, scrollTop: scroller.scrollTop, tag: `${scroller.tagName}.${scroller.className}` } : null,
          trace,
          unresolvedSample: unresolved().slice(0, 4).map((el) => el.getAttribute('src') ?? el.getAttribute('alt'))
        },
        embedIframeCount: maxRenderedEmbeds,
        internalEmbedCount: embeds.length,
        measuredSizeKeys: [...measuredSizes.keys()],
        renderedButtonCount: maxButtons,
        sizeViolations,
        unresolvedEmbedCount: maxUnresolved
      };
    },
    vaultPath: getTempVault().path
  });
}

afterAll(() => {
  mkdirSync(join(REPORT_PATH, '..'), { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf-8');
});

describe('demo vault execution', () => {
  beforeAll(async () => {
    const enabled = await enableCodeScriptToolkit();
    expect(enabled.cstLoaded, `CodeScript Toolkit failed to load: ${JSON.stringify(enabled.loadedPlugins)}`).toBe(true);
  });

  it.each(NOTES)('renders embeds and runs code buttons in "$name"', async (expectation) => {
    const settled = await openAndSettle(expectation.name, expectation.buttonCount, expectation.htmlEmbedCount, expectation.expectedSizeKeys);

    const buttonResults: ButtonResult[] = [];
    for (let index = 0; index < expectation.buttonCount; index++) {
      buttonResults.push(await clickButton(expectation.name, index));
    }

    report.push({ ...expectation, ...settled, buttonResults });

    const brokenButtons = buttonResults.filter((buttonResult) => buttonResult.status !== 'ok');
    const context = JSON.stringify(
      { ...expectation, ...settled, buttonResults: brokenButtons.length > 0 ? brokenButtons : `${String(buttonResults.length)} ok` },
      null,
      2
    );

    // No embed anywhere in the note fell back to Obsidian's "file does not exist" placeholder.
    expect(settled.unresolvedEmbedCount, `unresolved embeds in "${expectation.name}":\n${context}`).toBe(0);
    // A note that declares HTML embeds actually rendered at least one as an iframe (virtualization
    // Makes an exact all-at-once count infeasible; see the settle walk).
    if (expectation.htmlEmbedCount > 0) {
      expect(settled.embedIframeCount, `HTML embeds that rendered an iframe in "${expectation.name}":\n${context}`)
        .toBeGreaterThan(0);
    }
    // Every declared numeric size was actually measured — guards against the check silently doing nothing
    // (e.g. Obsidian stops routing `|400` into the width attribute), which would make the assertion below
    // Pass vacuously and let a real sizing regression through — exactly the "not full" gap being closed.
    const unmeasuredSizeKeys = expectation.expectedSizeKeys.filter((key) => !settled.measuredSizeKeys.includes(key));
    expect(unmeasuredSizeKeys, `declared embed sizes that were never measured in "${expectation.name}":\n${context}`)
      .toEqual([]);
    // Every embed whose size token routed into a numeric width/height attribute (`|400`, `|600x200`)
    // Actually rendered at that pixel size — the end-to-end check the health counts above miss.
    expect(settled.sizeViolations, `embeds that ignored their declared size in "${expectation.name}":\n${context}`)
      .toEqual([]);
    // Every code button rendered and executed without error.
    expect(buttonResults.length, `code buttons executed in "${expectation.name}":\n${context}`)
      .toBe(expectation.buttonCount);
    expect(brokenButtons, `broken code buttons in "${expectation.name}":\n${context}`).toEqual([]);
  });
});
