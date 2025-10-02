import {
  FileView,
  TFile,
  WorkspaceLeaf
} from 'obsidian';

import type { Plugin } from './Plugin.ts';

import { HtmlEmbedComponent } from './HtmlEmbedComponent.ts';

interface EphemeralState {
  subpath?: string;
}

export class HtmlFileView extends FileView {
  public static readonly VIEW_TYPE = 'html-file-view';
  private htmlEmbedComponent?: HtmlEmbedComponent;

  public constructor(leaf: WorkspaceLeaf, private readonly plugin: Plugin) {
    super(leaf);
  }

  public static register(plugin: Plugin): void {
    plugin.registerView(HtmlFileView.VIEW_TYPE, (leaf) => new HtmlFileView(leaf, plugin));
  }

  public override getViewType(): string {
    return HtmlFileView.VIEW_TYPE;
  }

  public override async onLoadFile(file: TFile): Promise<void> {
    await super.onLoadFile(file);
    this.htmlEmbedComponent = new HtmlEmbedComponent(this.plugin, this.contentEl, file);
    this.addChild(this.htmlEmbedComponent);
    await this.htmlEmbedComponent.loadFileAsync();
  }

  public override setEphemeralState(state: unknown): void {
    super.setEphemeralState(state);
    const ephemeralState = state as EphemeralState;
    this.htmlEmbedComponent?.setSubpath(ephemeralState.subpath ?? '');
  }
}
