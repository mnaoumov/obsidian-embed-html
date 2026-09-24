import type {
  App as AppOriginal,
  TFile,
  WorkspaceLeaf
} from 'obsidian';

import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { HtmlExtensions } from './html-extensions.ts';
import type { PluginSettingsComponent } from './plugin-settings-component.ts';

import { OpenInNewTabComponent } from './open-in-new-tab-component.ts';

let app: AppOriginal;
let component: null | OpenInNewTabComponent = null;

describe('OpenInNewTabComponent', () => {
  it('should redirect an html file opened in an occupied leaf to a new tab when enabled', async () => {
    loadComponent(true);

    const leaf = app.workspace.getLeaf();
    await showNoteIn(leaf);

    const openFileMock = vi.fn<WorkspaceLeaf['openFile']>();
    const newLeaf = strictProxy<WorkspaceLeaf>({ openFile: openFileMock });
    const getLeafSpy = vi.spyOn(app.workspace, 'getLeaf').mockReturnValue(newLeaf);

    const file = strictProxy<TFile>({ extension: 'html', path: 'a.html' });
    const openState = { active: true };
    await leaf.openFile(file, openState);

    expect(getLeafSpy).toHaveBeenCalledWith('tab');
    expect(openFileMock).toHaveBeenCalledWith(file, openState);
  });

  it('should not redirect when the setting is disabled', async () => {
    loadComponent(false);

    const leaf = app.workspace.getLeaf();
    await showNoteIn(leaf);

    const getLeafSpy = vi.spyOn(app.workspace, 'getLeaf');

    await leaf.openFile(strictProxy<TFile>({ extension: 'html', path: 'a.html' }));

    expect(getLeafSpy).not.toHaveBeenCalled();
  });

  it('should not redirect when the target leaf is empty', async () => {
    loadComponent(true);

    const leaf = app.workspace.getLeaf();
    await leaf.setViewState({ type: 'empty' });

    const getLeafSpy = vi.spyOn(app.workspace, 'getLeaf');

    await leaf.openFile(strictProxy<TFile>({ extension: 'html', path: 'a.html' }));

    expect(getLeafSpy).not.toHaveBeenCalled();
  });

  it('should not redirect when opening a non-html file', async () => {
    loadComponent(true);

    const leaf = app.workspace.getLeaf();
    await showNoteIn(leaf);

    const getLeafSpy = vi.spyOn(app.workspace, 'getLeaf');

    await leaf.openFile(strictProxy<TFile>({ extension: 'md', path: 'a.md' }));

    expect(getLeafSpy).not.toHaveBeenCalled();
  });

  it('should restore the original behavior when unloaded', async () => {
    loadComponent(true);

    const leaf = app.workspace.getLeaf();
    await showNoteIn(leaf);

    component?.unload();
    component = null;

    const getLeafSpy = vi.spyOn(app.workspace, 'getLeaf');

    await leaf.openFile(strictProxy<TFile>({ extension: 'html', path: 'a.html' }));

    expect(getLeafSpy).not.toHaveBeenCalled();
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  app = App.createConfigured__().asOriginalType__();
});

afterEach(() => {
  // Unload to remove the WorkspaceLeaf.prototype patch so it does not leak into other tests.
  component?.unload();
  component = null;
  vi.restoreAllMocks();
});

function loadComponent(shouldOpenInNewTab: boolean): void {
  const htmlExtensions = strictProxy<HtmlExtensions>({
    list: vi.fn(() => ['html'])
  });
  const pluginSettingsComponent = strictProxy<PluginSettingsComponent>({
    settings: { shouldOpenInNewTab }
  });
  component = new OpenInNewTabComponent({
    app,
    htmlExtensions,
    pluginSettingsComponent
  });
  component.load();
}

// A markdown view with no file closes back to the empty view, as in Obsidian, so occupying a leaf takes a real note.
async function showNoteIn(leaf: WorkspaceLeaf): Promise<void> {
  const note = await app.vault.create('note.md', '');
  await leaf.setViewState({ state: { file: note.path }, type: 'markdown' });
  expect(leaf.getViewState().type).toBe('markdown');
}
