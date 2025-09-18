import type { EmbedComponent } from 'obsidian-typings';

import {
  Component,
  TFile
} from 'obsidian';

import type { Plugin } from './Plugin.ts';

const WIDTH_ATTRIBUTE = 'width';
const HEIGHT_ATTRIBUTE = 'height';

export class HtmlEmbedComponent extends Component implements EmbedComponent {
  public constructor(private readonly plugin: Plugin, private readonly containerEl: HTMLElement, private readonly file: TFile) {
    super();

    const mo = new MutationObserver(() => {
      this.loadFile();
    });
    mo.observe(this.containerEl, {
      attributeFilter: [WIDTH_ATTRIBUTE, HEIGHT_ATTRIBUTE],
      attributes: true
    });

    this.register(() => {
      mo.disconnect();
    });
  }

  public loadFile(): void {
    this.containerEl.empty();
    this.containerEl.createEl('iframe', {
      attr: {
        height: this.containerEl.getAttr(HEIGHT_ATTRIBUTE) ?? this.plugin.settings.defaultHeight,
        src: this.plugin.app.vault.getResourcePath(this.file),
        width: this.containerEl.getAttr(WIDTH_ATTRIBUTE) ?? this.plugin.settings.defaultWidth
      }
    });
  }
}
