import {
  readdirSync,
  readFileSync
} from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { getRootFolder } from 'obsidian-dev-utils/script-utils/root';
import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  beforeAll,
  describe,
  expect,
  it
} from 'vitest';

// The Embed HTML half of the demo-vault gate: every note's HTML embeds resolve and render, and every
// Embed that declares a numeric size renders at that many pixels. The GENERIC half — clicking each
// `code-button` — is `demo-vault-buttons.demo-vault.integration.test.ts`, which is ODU's
// `registerDemoVaultButtonSuite`. Both are collected by the `integration-tests:demo-vault` project.

// A single `evalInObsidian` closure runs as one CDP `Runtime.evaluate`, which the harness caps at
// 30s — so the per-note walk is bounded well under that cap.
const SETTLE_TIMEOUT_MS = 20_000;
const POLL_INTERVAL_MS = 100;

const ROOT = getRootFolder() ?? process.cwd();
const DEMO_VAULT_DIR = join(ROOT, 'demo-vault');

// `00 Start.md` is a landing page and `README.md` is repo docs — neither is a self-contained feature demo.
const EXCLUDED_TOP_LEVEL = new Set(['00 Start.md', 'README.md']);

// Minimal structural view of the plugin's public settings API (`plugin.pluginSettingsComponent`), used only
// To type the cast inside the serialized closure — the real definition lives in `src/plugin.ts` /
// `src/plugin-settings.ts`. Type-only, so it is erased before the closure is serialized.
interface EmbedHtmlPluginLike {
  pluginSettingsComponent: EmbedHtmlSettingsComponentLike;
}

interface EmbedHtmlSettingsComponentLike {
  readonly defaultSettings: Readonly<Record<string, unknown>>;
  editAndSave(this: void, editor: (settings: Record<string, unknown>) => void): Promise<void>;
}

interface NoteExpectation {
  // `src|axis|value` keys for every embed whose size token is a pure-digit form (`N` or `NxM`) that
  // Obsidian routes into the container's numeric `width`/`height` attributes. Each must actually be
  // Measured at render time — a declared numeric size that is never measured signals the size check
  // Silently did nothing (e.g. Obsidian changed its attribute routing), not that the size was correct.
  expectedSizeKeys: string[];
  htmlEmbedCount: number;
  name: string;
}

interface SettleResult {
  readonly debug: unknown;
  readonly embedIframeCount: number;
  readonly internalEmbedCount: number;
  // Keys (`src|axis|value`) of the numeric-attribute sizes actually measured during the walk, used to
  // Prove the size check ran rather than silently measuring nothing (see `expectedSizeKeys`).
  readonly measuredSizeKeys: string[];
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

// Parses every `![[file.html…|token]]` embed and, for the pure-digit tokens Obsidian routes into the
// Container's numeric `width`/`height` attributes (`N` → width, `NxM` → both), returns the `src|axis|value`
// Keys the render is expected to expose. Fenced code samples that merely SHOW the syntax are stripped
// First so only real embeds count. Deliberately narrow: `x200`, `500x-`, `50%`, `width: …` stay in the
// Embed's `alt` and are validated by the size-spec unit tests and the sizing integration test, not here.
function extractExpectedSizeKeys(source: string): string[] {
  const withoutFences = source.replaceAll(/```[\s\S]*?```/g, '');
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
        expectedSizeKeys: extractExpectedSizeKeys(source),
        htmlEmbedCount: (source.match(/!\[\[[^\]]*\.html[^\]]*\]\]/g) ?? []).length,
        name
      };
    });
}

const NOTES = listSelfContainedNotes();

// Opens the note in reading view and walks it — a viewport at a time, wrapping back to the top — until
// Every HTML embed has produced an iframe. Returns the embed health counts. Reading view renders
// Sections lazily and unmounts them far off-screen, so no single position holds a whole note: the
// Counts are running maxima over the walk rather than one snapshot.
async function openAndSettle(noteName: string, expectedEmbeds: number, expectedSizeKeys: string[]): Promise<SettleResult> {
  return evalInObsidian({
    async callback({ app, expectedEmbeds: wantEmbeds, expectedSizeKeys: wantSizeKeys, intervalMs, lib: { waitUntil }, notePath, obsidianModule, settleTimeoutMs }): Promise<SettleResult> {
      function view(): InstanceType<typeof obsidianModule.MarkdownView> | null {
        return app.workspace.getActiveViewOfType(obsidianModule.MarkdownView);
      }
      function previewEl(): HTMLElement | null {
        return view()?.containerEl.querySelector<HTMLElement>(':scope .markdown-preview-view') ?? null;
      }
      function unresolved(): HTMLElement[] {
        return [...view()?.containerEl.querySelectorAll<HTMLElement>(':scope .internal-embed.is-unresolved, .internal-embed.mod-empty') ?? []];
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
        for (const embedEl of view()?.containerEl.querySelectorAll<HTMLElement>(':scope .internal-embed') ?? []) {
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
        for (const embedEl of view()?.containerEl.querySelectorAll<HTMLElement>(':scope .internal-embed') ?? []) {
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
      let maxUnresolved = 0;
      let isAtBottomOnce = false;
      for (let elapsed = 0; elapsed < settleTimeoutMs; elapsed += intervalMs) {
        const scroller = previewEl();
        if (scroller) {
          // Advance gradually so each embed enters the viewport and mounts — a single jump to the
          // Bottom skips the middle ones, whose collapsed height keeps the document short.
          const isAtBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4;
          isAtBottomOnce ||= isAtBottom;
          scroller.scrollTop = isAtBottom ? 0 : scroller.scrollTop + Math.floor(scroller.clientHeight * 0.8);
        }
        await sleep(intervalMs);
        recordEmbedSizes();
        maxRenderedEmbeds = Math.max(maxRenderedEmbeds, markRenderedEmbeds());
        maxUnresolved = Math.max(maxUnresolved, unresolved().length);
        trace.push(`${String(markRenderedEmbeds())}i`);
        // Done once we have walked to the bottom at least once, seen every declared embed produce an
        // Iframe at least once, and settled a stable size for every embed that declares one. A short
        // Note whose embeds are still collapsed reports scrollHeight ~= clientHeight on the first scan
        // (so `atBottom` fires immediately) — requiring an iframe first stops the walk from exiting
        // Before anything rendered, and requiring settled sizes stops a mid-transition reading from
        // Slipping through. Both were sources of flaky passes.
        const isAllEmbedsRendered = wantEmbeds === 0 || maxRenderedEmbeds > 0;
        const isAllSizesSettled = wantSizeKeys.every((key) => measuredSizes.has(key));
        if (isAtBottomOnce && isAllEmbedsRendered && isAllSizesSettled) {
          break;
        }
      }

      const embeds = [...view()?.containerEl.querySelectorAll<HTMLElement>(':scope .internal-embed') ?? []];
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
        sizeViolations,
        unresolvedEmbedCount: maxUnresolved
      };
    },
    input: { expectedEmbeds, expectedSizeKeys, intervalMs: POLL_INTERVAL_MS, notePath: noteName, settleTimeoutMs: SETTLE_TIMEOUT_MS },
    vaultPath: getTemporaryVault().path
  });
}

// Puts every Embed HTML setting back to its default. The button suite shares this project's single
// Obsidian and temp vault, and four of `02 Custom Size.md`'s buttons deliberately change the default
// Width/height; its last button resets them, but a button that fails mid-note never gets there. The
// Assertions below only measure embeds carrying an explicit numeric size, which overrides the defaults
// Either way — this makes that independence structural rather than incidental.
async function resetSettings(): Promise<void> {
  await evalInObsidian({
    async callback({ app }): Promise<void> {
      const plugin = app.plugins.getPlugin('embed-html') as EmbedHtmlPluginLike | null;
      if (!plugin) {
        throw new Error('embed-html plugin is not enabled');
      }
      const settingsComponent = plugin.pluginSettingsComponent;
      // `defaultSettings` is the component's own copy of the defaults, so nothing is duplicated here.
      const defaults = { ...settingsComponent.defaultSettings };
      await settingsComponent.editAndSave((settings) => {
        Object.assign(settings, defaults);
      });
    },
    input: {},
    vaultPath: getTemporaryVault().path
  });
}

describe('demo vault embeds', () => {
  beforeAll(async () => {
    await resetSettings();
  });

  it.each(NOTES)('renders every HTML embed at its declared size in "$name"', async (expectation) => {
    const settled = await openAndSettle(expectation.name, expectation.htmlEmbedCount, expectation.expectedSizeKeys);

    const context = JSON.stringify({ ...expectation, ...settled }, null, 2);

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
  });
});
