import type {
  App,
  TFile
} from 'obsidian';

import { WorkspaceLeaf } from 'obsidian';
import { MonkeyAroundComponent } from 'obsidian-dev-utils/obsidian/components/monkey-around-component';

import type { HtmlExtensions } from './html-extensions.ts';
import type { PluginSettingsComponent } from './plugin-settings-component.ts';

// `EMPTY_VIEW_TYPE` is Obsidian's view type for an empty (unoccupied) leaf; it is not exported by `obsidian`.
// A fresh leaf minted for a modifier-click new tab or for a layout restore reports this type.
// Redirecting into such a leaf is undesirable, so only leaves already hosting a real view are redirected.
// This also lets the first HTML open reuse the current empty tab instead of leaving it blank.
const EMPTY_VIEW_TYPE = 'empty';

interface OpenInNewTabComponentConstructorParams {
  readonly app: App;
  readonly htmlExtensions: HtmlExtensions;
  readonly pluginSettingsComponent: PluginSettingsComponent;
}

export class OpenInNewTabComponent extends MonkeyAroundComponent {
  private readonly app: App;
  private readonly htmlExtensions: HtmlExtensions;
  private isRedirecting = false;
  private readonly pluginSettingsComponent: PluginSettingsComponent;

  public constructor(params: OpenInNewTabComponentConstructorParams) {
    super();
    this.app = params.app;
    this.htmlExtensions = params.htmlExtensions;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
  }

  public override onload(): void {
    super.onload();

    this.registerMethodPatch<WorkspaceLeaf, 'openFile'>({
      methodName: 'openFile',
      obj: WorkspaceLeaf.prototype,
      patchHandler: ({ fallback, originalArgs: [file, openState], originalThis: leaf }) => {
        if (this.shouldRedirect(file, leaf)) {
          this.isRedirecting = true;
          try {
            return this.app.workspace.getLeaf('tab').openFile(file, openState);
          } finally {
            this.isRedirecting = false;
          }
        }

        return fallback();
      }
    });
  }

  private shouldRedirect(file: TFile, leaf: WorkspaceLeaf): boolean {
    return !this.isRedirecting
      && this.pluginSettingsComponent.settings.shouldOpenInNewTab
      && this.htmlExtensions.list().includes(file.extension)
      && leaf.getViewState().type !== EMPTY_VIEW_TYPE;
  }
}
