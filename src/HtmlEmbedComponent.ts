import type {
  EmbedComponent,
  EmbedContext
} from 'obsidian-typings';

import {
  Component,
  TFile
} from 'obsidian';

import type { Plugin } from './Plugin.ts';

const WIDTH_ATTRIBUTE = 'width';
const HEIGHT_ATTRIBUTE = 'height';

export class HtmlEmbedComponent extends Component implements EmbedComponent {
  public constructor(private readonly plugin: Plugin, private readonly context: EmbedContext, private readonly file: TFile) {
    super();

    const mo = new MutationObserver(() => {
      this.loadFile();
    });
    mo.observe(this.context.containerEl, {
      attributeFilter: [WIDTH_ATTRIBUTE, HEIGHT_ATTRIBUTE],
      attributes: true
    });

    this.register(() => {
      mo.disconnect();
    });
  }

  public loadFile(): void {
    this.context.containerEl.empty();
    this.context.containerEl.createEl('iframe', {
      attr: {
        height: this.context.containerEl.getAttr(HEIGHT_ATTRIBUTE) ?? this.plugin.settings.defaultHeight,
        src: this.plugin.app.vault.getResourcePath(this.file),
        width: this.context.containerEl.getAttr(WIDTH_ATTRIBUTE) ?? this.plugin.settings.defaultWidth
      }
    });
  }
}
