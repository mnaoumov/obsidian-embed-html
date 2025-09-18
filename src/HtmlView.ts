import {
  FileView,
  TFile,
  WorkspaceLeaf
} from 'obsidian';

import type { Plugin } from './Plugin.ts';

import { HtmlEmbedComponent } from './HtmlEmbedComponent.ts';

export class HtmlFileView extends FileView {
  public static readonly VIEW_TYPE = 'html-file-view';

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

    const htmlEmbedComponent = new HtmlEmbedComponent(this.plugin, this.contentEl, file);
    this.addChild(htmlEmbedComponent);
    htmlEmbedComponent.loadFile();
  }
}
