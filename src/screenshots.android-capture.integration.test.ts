/**
 * @file
 *
 * Produces the mobile screenshots the community-store listing needs
 * (T461-P21), driving staged notes in Obsidian Mobile on a real Android
 * emulator and writing images/screenshots/screenshot-mobile-N.png.
 *
 * The mobile counterpart of the desktop capture suite, showing the same five
 * frames. It is worth taking rather than reusing the desktop images because an
 * embedded page has to fit a phone, which is exactly the doubt a reader has
 * about embedding a report into a note they read on the train.
 *
 * See the desktop suite for why the fixtures carry their stylesheet at the END
 * of the body, and why shot 1 is the plugin turned off.
 *
 * There is no mobile equivalent of the desktop viewport override, so the AVD is
 * built at exactly 900x1600 — see [[T461-P21]] for its one-time provisioning.
 */

import {
  mkdirSync,
  writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import {
  captureObsidianScreenshot,
  evalInObsidian,
  labelScreenshot,
  readPngDimensions
} from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  beforeAll,
  describe,
  expect,
  it
} from 'vitest';

/**
 * What an embed turned into on screen, so a shot can assert it rendered rather
 * than trusting the picture.
 */
interface EmbedProbe {
  readonly hasEmbed: boolean;
  readonly text: string;
}

/**
 * App, reduced to the font-size applier that obsidian-typings does not declare.
 * Setting baseFontSize alone changes nothing on screen.
 */
interface FontSizeApp {
  updateFontSize(this: void): void;
}

/**
 * `App`, reduced to the inline-title toggle that `obsidian-typings` does not
 * declare. Setting the config alone changes nothing on screen.
 */
interface InlineTitleApp {
  updateInlineTitleDisplay(this: void): void;
}

/**
 * The preview half of a Markdown view, reduced to the call that re-renders it.
 */
interface PreviewMode {
  rerender(this: void, isFull: boolean): void;
}

/**
 * A Markdown view, reduced to {@link PreviewMode}.
 */
interface PreviewRenderView {
  previewMode: PreviewMode;
}

/**
 * The settings component every plugin exposes for editing its own settings.
 */
interface SettingsEditableComponent {
  editAndSave(this: void, settingsEditor: (settings: Record<string, unknown>) => void): Promise<void>;
}

/**
 * The plugin, reduced to the settings surface these shots configure.
 */
interface SettingsEditablePlugin {
  pluginSettingsComponent: SettingsEditableComponent;
}

const PLUGIN_ID = 'embed-html';
const WIDTH_IN_PIXELS = 900;
const HEIGHT_IN_PIXELS = 1600;

/**
 * Base font size for the mobile shots. Below the 16px default, so an embedded
 * table and the note around it both fit a 450dp screen.
 */
const MOBILE_FONT_SIZE_IN_PIXELS = 13;

const BASIC_NOTE_PATH = 'Screenshots/Report.md';
const SIZED_NOTE_PATH = 'Screenshots/Sized.md';
const EXTRACT_NOTE_PATH = 'Screenshots/Extract.md';
const SCRIPTED_NOTE_PATH = 'Screenshots/Scripted.md';

const IMAGES_DIRECTORY = join(process.cwd(), 'images', 'screenshots');

beforeAll(async () => {
  const vault = getTemporaryVault();

  vault.populate({
    [BASIC_NOTE_PATH]: '# Quarterly report\n\nThe report itself, embedded from an HTML file:\n\n![[report.html]]\n',
    [EXTRACT_NOTE_PATH]: '# Just one section\n\nOnly the part that matters, pulled out of a bigger page:\n\n![[sections.html#beta&mode=extract]]\n',
    'Screenshots/report.html': buildReportHtml(),
    'Screenshots/scripted.html': buildScriptedHtml(),
    'Screenshots/sections.html': buildSectionsHtml(),
    [SCRIPTED_NOTE_PATH]: '# Built on the fly\n\nThis table did not exist until the page ran:\n\n![[scripted.html]]\n',
    [SIZED_NOTE_PATH]: '# Sized to fit\n\nThe same page, told exactly how much room to take:\n\n![[report.html|760x260]]\n'
  });
  await vault.syncToDevice();

  await evalInObsidian({
    async callback({ app, basicNotePath, fontSizeInPixels, lib: { waitUntil } }) {
      // A closure runs inside ONE Appium execute/sync call, which WebDriver caps
      // Around 30s, so every wait in here stays comfortably under it.
      const SETTLE_TIMEOUT_IN_MILLISECONDS = 15_000;
      const SETTLE_DELAY_IN_MILLISECONDS = 1000;

      app.changeTheme('obsidian');

      await waitUntil({
        message: 'the staged notes to appear in the vault',
        predicate: () => Boolean(app.vault.getFileByPath(basicNotePath)),
        timeoutInMilliseconds: SETTLE_TIMEOUT_IN_MILLISECONDS
      });

      app.vault.setConfig('baseFontSize', fontSizeInPixels);
      const fontApp: unknown = app;
      (fontApp as FontSizeApp).updateFontSize();

      // Each note opens with its own `# H1`, so the inline title doubles it.
      app.vault.setConfig('showInlineTitle', false);
      const inlineTitleApp: unknown = app;
      (inlineTitleApp as InlineTitleApp).updateInlineTitleDisplay();

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);
    },
    input: { basicNotePath: BASIC_NOTE_PATH, fontSizeInPixels: MOBILE_FONT_SIZE_IN_PIXELS },
    vaultPath: vaultPath()
  });

  await applyThemeMatchingSettings();
});

describe('mobile store screenshots', () => {
  it('1 - the same note with the plugin off', async () => {
    // A before-shot is only safe BECAUSE of the caption. A listing carousel
    // Shows screenshots one at a time, so an unlabelled one reads as a picture
    // Of what the plugin does, not of what it fixes.
    await setPluginEnabled(false);
    const probe = await openNote(BASIC_NOTE_PATH);
    expect(probe.hasEmbed).toBe(false);
    await shoot(1, 'Without the plugin: an HTML file you cannot show');
    await setPluginEnabled(true);
  });

  it('2 - the same note, the page embedded', async () => {
    const probe = await openNote(BASIC_NOTE_PATH);
    expect(probe.hasEmbed).toBe(true);
    await shoot(2, 'Embed an HTML file with the syntax you already use');
  });

  it('3 - the embed sized', async () => {
    const probe = await openNote(SIZED_NOTE_PATH);
    expect(probe.hasEmbed).toBe(true);
    await shoot(3, 'Give it exactly the room you want');
  });

  it('4 - one element pulled out of a bigger page', async () => {
    const probe = await openNote(EXTRACT_NOTE_PATH);
    expect(probe.hasEmbed).toBe(true);
    await shoot(4, 'Or embed just one element out of the page');
  });

  it('5 - the page running its own JavaScript', async () => {
    const probe = await openNote(SCRIPTED_NOTE_PATH);
    expect(probe.hasEmbed).toBe(true);
    await shoot(5, 'The page runs its own JavaScript');
  });
});

/**
 * Gives embeds the theme-matching frame the settings tab itself recommends.
 *
 * Left at its default an embed renders on white, which is honest but reads as a
 * foreign object dropped into a dark note. These are the exact values the
 * settings tab documents, so the shots show the plugin configured the way it
 * tells you to configure it.
 */
async function applyThemeMatchingSettings(): Promise<void> {
  await evalInObsidian({
    async callback({ app, pluginId }) {
      const SETTLE_DELAY_IN_MILLISECONDS = 1000;

      const plugin: unknown = app.plugins.getPlugin(pluginId);
      if (!plugin) {
        throw new Error();
      }

      await (plugin as SettingsEditablePlugin).pluginSettingsComponent.editAndSave((settings) => {
        settings['background'] = 'var(--background-primary)';
        settings['border'] = '1px solid var(--background-modifier-border)';
        settings['borderRadius'] = '8px';
      });

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);
    },
    input: { pluginId: PLUGIN_ID },
    vaultPath: vaultPath()
  });
}

/**
 * The stylesheet every staged page carries.
 *
 * The key line is `color-scheme`: the plugin tells the embed which scheme the
 * app is in, so a page that declares it follows the theme instead of rendering
 * as a white rectangle dropped into a dark note. Everything else is the little a
 * real exported report would bring with it.
 *
 * @returns The style block.
 */
function buildPageStyle(): string {
  return '<style>\n'
    + '  :root { color-scheme: light dark; }\n'
    + '  body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; padding: 14px; line-height: 1.5; }\n'
    + '  h2 { margin: 0 0 10px; font-size: 18px; }\n'
    + '  table { border-collapse: collapse; }\n'
    + '  th, td { border: 1px solid rgba(128, 128, 128, 0.4); padding: 6px 12px; text-align: left; }\n'
    + '</style>\n';
}

/**
 * Builds the staged report page — the shape a report exported from another tool
 * actually has.
 *
 * @returns The page's HTML.
 */
function buildReportHtml(): string {
  return '<h2>Revenue by region</h2>\n'
    + '<table>\n'
    + '<tr><th>Region</th><th>Q1</th><th>Q2</th><th>Q3</th></tr>\n'
    + '<tr><td>North</td><td>412</td><td>488</td><td>531</td></tr>\n'
    + '<tr><td>South</td><td>288</td><td>301</td><td>352</td></tr>\n'
    + '<tr><td>Europe</td><td>644</td><td>702</td><td>688</td></tr>\n'
    + '</table>\n'
    + `<p>Exported from the finance tool, embedded straight into the note.</p>\n${buildPageStyle()}`;
}

/**
 * Builds the staged page that writes its own content when it runs.
 *
 * The rows do not exist in the file — they are generated — so a frame showing
 * them is proof the embed executed rather than being rendered as static markup.
 *
 * @returns The page's HTML.
 */
function buildScriptedHtml(): string {
  return '<h2>Generated on load</h2>\n'
    + '<ul id="generated"></ul>\n'
    + '<script>\n'
    + '  const list = document.getElementById("generated");\n'
    + '  for (let power = 1; power <= 6; power++) {\n'
    + '    const item = document.createElement("li");\n'
    + '    item.textContent = "2 to the " + power + " is " + Math.pow(2, power);\n'
    + '    list.append(item);\n'
    + '  }\n'
    + `</script>\n${buildPageStyle()}`;
}

/**
 * Builds the staged multi-section page, for the shot that embeds one section of
 * it and leaves the rest out.
 *
 * @returns The page's HTML.
 */
function buildSectionsHtml(): string {
  return '<section id="alpha"><h2>Alpha</h2><p>The first section, which this note does not want.</p></section>\n'
    + '<section id="beta"><h2>Beta</h2><p>The only section the note asked for, pulled out by its id.</p>'
    + '<ul><li>Kept in place</li><li>Sized by the note</li><li>Nothing else from the page</li></ul></section>\n'
    + `<section id="gamma"><h2>Gamma</h2><p>The last section, also left behind.</p></section>\n${buildPageStyle()}`;
}

/**
 * Opens a staged note in reading view and reports whether an HTML embed
 * rendered in it.
 *
 * @param path - Vault-relative path of the note.
 * @returns What was found on screen.
 */
async function openNote(path: string): Promise<EmbedProbe> {
  return await evalInObsidian({
    async callback({ app, lib: { waitUntil }, obsidianModule, path: notePath }) {
      const RENDER_TIMEOUT_IN_MILLISECONDS = 20_000;
      const EMBED_SETTLE_TIMEOUT_IN_MILLISECONDS = 5000;
      const SETTLE_DELAY_IN_MILLISECONDS = 1500;
      const TEXT_LENGTH_LIMIT = 120;

      const file = app.vault.getFileByPath(notePath);
      if (!file) {
        throw new Error(`Note is missing from the vault: ${notePath}`);
      }

      const leaf = app.workspace.getLeaf(false);
      await leaf.openFile(file);
      // Reading view: an embed is a rendered thing, and source mode would show
      // Only the `![[...]]` line that asks for it.
      await leaf.setViewState({
        state: { file: notePath, mode: 'preview', source: false },
        type: 'markdown'
      });

      await waitUntil({
        message: 'the note to render',
        predicate: () => Boolean(document.querySelector('.markdown-preview-view')),
        timeoutInMilliseconds: RENDER_TIMEOUT_IN_MILLISECONDS
      });

      // Reopening a note Obsidian has already rendered reuses that render, so
      // The frame taken straight after toggling the plugin showed the PREVIOUS
      // State — no embed, in the shot whose whole point is the embed.
      const view: unknown = app.workspace.getActiveViewOfType(obsidianModule.MarkdownView);
      (view as null | PreviewRenderView)?.previewMode.rerender(true);

      // Used BOTH to show an embed appearing and to show one not appearing, so a
      // Timeout here is a legitimate outcome rather than a failure.
      try {
        await waitUntil({
          message: 'the HTML embed to render',
          predicate: () => Boolean(document.querySelector('.markdown-preview-view iframe, .markdown-preview-view .embed-html')),
          timeoutInMilliseconds: EMBED_SETTLE_TIMEOUT_IN_MILLISECONDS
        });
      } catch {
        // Left deliberately empty — see above.
      }

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);

      const embed = document.querySelector('.markdown-preview-view iframe, .markdown-preview-view .embed-html');
      return {
        hasEmbed: Boolean(embed),
        text: (document.querySelector('.markdown-preview-view')?.textContent ?? '').trim().slice(0, TEXT_LENGTH_LIMIT)
      };
    },
    input: { path },
    vaultPath: vaultPath()
  });
}

/**
 * Enables or disables the plugin, for the one shot that shows the state its
 * absence leaves behind.
 *
 * @param isEnabled - Whether the plugin should be on.
 */
async function setPluginEnabled(isEnabled: boolean): Promise<void> {
  await evalInObsidian({
    async callback({ app, isEnabled: shouldEnable, pluginId }) {
      const SETTLE_DELAY_IN_MILLISECONDS = 1500;

      if (shouldEnable) {
        await app.plugins.enablePlugin(pluginId);
      } else {
        await app.plugins.disablePlugin(pluginId);
      }

      app.workspace.trigger('layout-change');

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);
    },
    input: { isEnabled, pluginId: PLUGIN_ID },
    vaultPath: vaultPath()
  });
}

/**
 * Captures the window, captions it, and writes it as
 * `images/screenshots/screenshot-mobile-<index>.png`.
 *
 * @param index - The 1-based listing position.
 * @param caption - The caption drawn across the bottom of the frame.
 */
async function shoot(index: number, caption: string): Promise<void> {
  const captured = await captureObsidianScreenshot({ vaultPath: vaultPath() });

  // The AVD is 900x1600, so the device frame IS the store size. Asserting it
  // Here is what keeps that true: run this against any other AVD and it fails
  // Loudly instead of quietly shipping an off-spec image.
  expect(readPngDimensions(captured)).toStrictEqual({
    heightInPixels: HEIGHT_IN_PIXELS,
    widthInPixels: WIDTH_IN_PIXELS
  });

  const labeled = await labelScreenshot(captured, { text: caption });

  mkdirSync(IMAGES_DIRECTORY, { recursive: true });
  writeFileSync(join(IMAGES_DIRECTORY, `screenshot-mobile-${String(index)}.png`), labeled);
}

function vaultPath(): string {
  return getTemporaryVault().path;
}
