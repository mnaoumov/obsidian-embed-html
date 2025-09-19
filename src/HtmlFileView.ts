import {
  FileView,
  WorkspaceLeaf
} from 'obsidian';
import { invokeAsyncSafely } from 'obsidian-dev-utils/Async';

import type { Plugin } from './Plugin.ts';

import { HtmlEmbedComponent } from './HtmlEmbedComponent.ts';

interface EphemeralState {
  subpath?: string;
}

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

  public override setEphemeralState(state: unknown): void {
    super.setEphemeralState(state);
    invokeAsyncSafely(async () => this.render(state as EphemeralState));
  }

  private async render(ephemeralState: EphemeralState): Promise<void> {
    if (!this.file) {
      return;
    }
    const htmlEmbedComponent = new HtmlEmbedComponent(this.plugin, this.contentEl, this.file, ephemeralState.subpath);
    this.addChild(htmlEmbedComponent);
    await htmlEmbedComponent.loadFileAsync();
  }
}
