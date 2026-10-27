import type { MarkdownViewEphemeralState } from '@obsidian-typings/obsidian-public-latest';

import {
  FileView,
  TFile,
  WorkspaceLeaf
} from 'obsidian';

import type { PluginSettingsComponent } from '../settings/plugin-settings-component.ts';

import { HtmlEmbedComponent } from '../embed/html-embed-component.ts';

export class HtmlFileView extends FileView {
  public static readonly VIEW_TYPE = 'html-file-view';
  private htmlEmbedComponent?: HtmlEmbedComponent;

  public constructor(leaf: WorkspaceLeaf, private readonly pluginSettingsComponent: PluginSettingsComponent) {
    super(leaf);
  }

  public override getViewType(): string {
    return HtmlFileView.VIEW_TYPE;
  }

  public override async onLoadFile(file: TFile): Promise<void> {
    await super.onLoadFile(file);
    this.htmlEmbedComponent = new HtmlEmbedComponent({
      app: this.app,
      containerEl: this.contentEl,
      file,
      pluginSettingsComponent: this.pluginSettingsComponent,
      subpath: ''
    });
    this.addChild(this.htmlEmbedComponent);
    await this.htmlEmbedComponent.loadFileAsync();
  }

  public override setEphemeralState(state: unknown): void {
    super.setEphemeralState(state);
    const ephemeralState = state as Pick<MarkdownViewEphemeralState, 'subpath'>;
    this.htmlEmbedComponent?.setSubpath(ephemeralState.subpath ?? '');
  }
}
