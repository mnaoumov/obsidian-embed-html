import { evalInObsidian } from 'obsidian-integration-testing';
import { getTempVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  describe,
  expect,
  it
} from 'vitest';

// Reproduces GitHub issue #4: embedding an HTML file that lives in a DIFFERENT folder than the note,
// By a RELATIVE path and by a FULL (vault-relative / "absolute") path. The note lives in
// `embed-html-path-probe/notes/` and the HTML file in `embed-html-path-probe/assets/`, so:
//   1. the relative embed `![](../assets/probe.html)` (Markdown embed, relative to the note's folder), and
//   2. the full-vault-path embed `![[embed-html-path-probe/assets/probe.html]]` (wikilink, from the root)
// Must BOTH resolve to the same `TFile` and render an iframe carrying the probe content.
//
// LINUX NOTE (G97 / G99 — "verify both ends"): issue #4 reports this failing on Linux ONLY. The plugin
// Never resolves the path itself — Obsidian core resolves the link to a `TFile` BEFORE the embed factory
// Runs, and the plugin then reads it through vault APIs (`vault.read` / `getResourcePath`), which are
// Separator- and case-preserving and OS-agnostic. So the resolution is Obsidian-core + filesystem
// Behavior, and the only axis that differs Windows↔Linux is the filesystem's case sensitivity
// (case-insensitive NTFS vs case-sensitive ext4). This suite is the reproduction vehicle; it is
// Platform-parameterized so the SAME body runs on each end. It passes on the Windows dev host (via
// `path-resolution.desktop.integration.test.ts`); the Linux run is PENDING a Linux CI runner (via
// `path-resolution.linux.integration.test.ts`), which is the missing verification for #4.

interface EmbedObservation {
  hasIframe: boolean;
  isUnresolved: boolean;
  src: string;
  srcdocHasMarker: boolean;
}

export function registerPathResolutionSuite(platform: string): void {
  describe(`embed by relative and full vault path (${platform})`, () => {
    it('should render an HTML embed from another folder by BOTH a relative path and a full vault path', async () => {
      const result = await evalInObsidian({
        // eslint-disable-next-line unicorn/name-replacements -- `fn` is an `obsidian-integration-testing` parameter name.
        fn: async ({ app, lib: { waitUntil } }) => {
          const TIMEOUT_IN_MILLISECONDS = 20_000;
          const MARKER = 'PATH_RESOLUTION_PROBE';
          const baseDirectory = 'embed-html-path-probe';
          const assetsDirectory = `${baseDirectory}/assets`;
          const notesDirectory = `${baseDirectory}/notes`;
          const htmlPath = `${assetsDirectory}/probe.html`;
          const notePath = `${notesDirectory}/note.md`;
          // The note lives in `notes/`, the HTML file in the sibling `assets/`, so the two link forms are
          // Genuinely distinct: `../assets/probe.html` is note-relative; the wikilink is the full path.
          const relativeLink = '../assets/probe.html';
          const fullLink = htmlPath;

          await cleanup();
          await ensureFolder(baseDirectory);
          await ensureFolder(assetsDirectory);
          await ensureFolder(notesDirectory);

          await app.vault.create(
            htmlPath,
            `<html><body><div style="height: 80px">${MARKER}</div></body></html>`
          );
          const noteFile = await app.vault.create(
            notePath,
            `![](${relativeLink})\n\n![[${fullLink}]]\n`
          );

          const leaf = app.workspace.getLeaf(true);
          await leaf.openFile(noteFile, { state: { mode: 'preview' } });

          let isTimedOut = false;
          try {
            await waitUntil({
              message: 'both embeds (relative + full vault path) never rendered iframes with the probe content',
              predicate: () => {
                const embeds = collect();
                return embeds.length >= 2 && embeds.every((embed) => embed.hasIframe && embed.srcdocHasMarker);
              },
              timeoutInMilliseconds: TIMEOUT_IN_MILLISECONDS
            });
          } catch {
            isTimedOut = true;
          }

          const observations = collect();

          leaf.detach();
          await cleanup();

          return {
            fullLink,
            observations,
            relativeLink,
            timedOut: isTimedOut
          };

          function collect(): EmbedObservation[] {
            const els = [...leaf.view.containerEl.querySelectorAll<HTMLElement>(':scope .markdown-preview-view .internal-embed')];
            return els.map((el) => {
              const iframe = el.querySelector<HTMLIFrameElement>('iframe');
              return {
                hasIframe: iframe !== null,
                isUnresolved: el.classList.contains('is-unresolved') || el.classList.contains('mod-empty'),
                src: el.getAttribute('src') ?? '',
                // The plugin renders via `iframe.srcdoc`, which reflects to the attribute, so the probe
                // Content is readable without reaching into the (same-origin) iframe document.
                srcdocHasMarker: (iframe?.getAttribute('srcdoc') ?? '').includes(MARKER)
              };
            });
          }

          async function ensureFolder(path: string): Promise<void> {
            if (!app.vault.getAbstractFileByPath(path)) {
              await app.vault.createFolder(path);
            }
          }

          async function cleanup(): Promise<void> {
            const existing = app.vault.getAbstractFileByPath(baseDirectory);
            if (existing) {
              await app.fileManager.trashFile(existing);
            }
          }
        },
        vaultPath: getTempVault().path
      });

      expect(result.timedOut).toBe(false);
      expect(result.observations).toHaveLength(2);
      // No embed fell back to Obsidian's "'file' could not be found." placeholder — the core resolver
      // Found the `TFile` for BOTH the relative and the full-vault-path link (the exact #4 failure mode).
      expect(result.observations.every((observation) => !observation.isUnresolved)).toBe(true);
      // Both embeds rendered an iframe whose `srcdoc` carries the probe content.
      expect(result.observations.every((observation) => observation.hasIframe && observation.srcdocHasMarker)).toBe(true);
      // The two embeds really are the two DIFFERENT link forms — so the test cannot pass with two copies
      // Of the same form. The relative embed keeps its `../` source; the other is the full vault path.
      const srcs = result.observations.map((observation) => observation.src);
      expect(srcs.some((src) => src.startsWith('../'))).toBe(true);
      expect(srcs).toContain(result.fullLink);
    });
  });
}
