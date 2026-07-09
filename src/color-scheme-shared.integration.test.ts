import { evalInObsidian } from 'obsidian-integration-testing';
import { getTempVault } from 'obsidian-integration-testing/vitest-global-setup';
import {
  describe,
  expect,
  it
} from 'vitest';

interface SchemeObservation {
  colorScheme: string;
  expectedDark: boolean;
  isDarkMode: boolean;
  prefersDark: boolean | null;
  theme: string;
}

export function registerColorSchemeSuite(platform: string): void {
  describe(`color-scheme propagation (${platform})`, () => {
    it('should propagate Obsidian base color scheme to the embed iframe', async () => {
      const result = await evalInObsidian({
        fn: async ({ app, waitUntil }) => {
          const TIMEOUT_IN_MILLISECONDS = 20_000;
          const htmlPath = 'embed-html-color-scheme-probe.html';
          const notePath = 'embed-html-color-scheme-probe.md';

          await deleteIfExists(htmlPath);
          await deleteIfExists(notePath);

          await app.vault.create(
            htmlPath,
            '<html><body><div style="height: 100px">COLOR_SCHEME_PROBE</div></body></html>'
          );
          const noteFile = await app.vault.create(notePath, `![[${htmlPath}]]`);

          const leaf = app.workspace.getLeaf(true);
          await leaf.openFile(noteFile, { state: { mode: 'preview' } });

          await waitUntil({
            message: 'embed iframe did not render initially',
            predicate: () => getVisibleIframe() !== null,
            timeoutInMilliseconds: TIMEOUT_IN_MILLISECONDS
          });

          const wasDarkOriginally = app.isDarkMode();

          // Toggle Obsidian's base color scheme (independent of the OS) and confirm the embed follows it.
          // `obsidian` is the dark base scheme, `moonstone` the light one; `updateTheme()` toggles the
          // Body theme classes and fires `css-change`, which the plugin listens for to re-apply.
          const cases: [boolean, 'moonstone' | 'obsidian'][] = [[true, 'obsidian'], [false, 'moonstone']];
          const observations: SchemeObservation[] = [];
          for (const [expectedDark, theme] of cases) {
            app.changeTheme(theme);
            app.updateTheme();

            await waitUntil({
              message: `embed iframe did not follow the ${theme} color scheme`,
              predicate: () => iframePrefersDark() === expectedDark,
              timeoutInMilliseconds: TIMEOUT_IN_MILLISECONDS
            });

            observations.push({
              colorScheme: getVisibleIframe()?.style.colorScheme ?? '',
              expectedDark,
              isDarkMode: app.isDarkMode(),
              prefersDark: iframePrefersDark(),
              theme
            });
          }

          app.changeTheme(wasDarkOriginally ? 'obsidian' : 'moonstone');
          app.updateTheme();

          leaf.detach();
          await deleteIfExists(htmlPath);
          await deleteIfExists(notePath);

          return observations;

          function getVisibleIframe(): HTMLIFrameElement | null {
            // Reading-view virtualization can momentarily keep a detached/off-layout iframe alongside
            // The live one; only the laid-out (offsetParent non-null) iframe evaluates media queries,
            // So the assertions target that one.
            const iframes = Array.from(leaf.view.containerEl.querySelectorAll<HTMLIFrameElement>('.internal-embed iframe'));
            return iframes.find((iframe) => iframe.offsetParent !== null) ?? null;
          }

          function iframePrefersDark(): boolean | null {
            const win = getVisibleIframe()?.contentWindow;
            if (!win) {
              return null;
            }
            return win.matchMedia('(prefers-color-scheme: dark)').matches;
          }

          async function deleteIfExists(path: string): Promise<void> {
            const existing = app.vault.getAbstractFileByPath(path);
            if (existing) {
              await app.fileManager.trashFile(existing);
            }
          }
        },
        vaultPath: getTempVault().path
      });

      expect(result).toHaveLength(2);
      for (const observation of result) {
        expect(observation.isDarkMode).toBe(observation.expectedDark);
        expect(observation.prefersDark).toBe(observation.expectedDark);
        expect(observation.colorScheme).toBe(observation.expectedDark ? 'dark' : 'light');
      }
    });
  });
}
