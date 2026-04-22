import type { App } from 'obsidian';

import { Component } from 'obsidian';

import type { HtmlExtensions } from './html-extensions.ts';
import type { PluginSettingsComponent } from './plugin-settings-component.ts';
import type { Plugin } from './plugin.ts';

import { HtmlFileView } from './html-file-view.ts';

export class HtmlFileViewComponent extends Component {
  public constructor(
    private readonly app: App,
    private readonly plugin: Plugin,
    private readonly pluginSettingsComponent: PluginSettingsComponent,
    private readonly htmlExtensions: HtmlExtensions
  ) {
    super();
  }

  public override onload(): void {
    this.app.viewRegistry.registerExtensions(this.htmlExtensions.list(), HtmlFileView.VIEW_TYPE);
    this.plugin.registerView(HtmlFileView.VIEW_TYPE, (leaf) => new HtmlFileView(leaf, this.pluginSettingsComponent));
    this.register(() => {
      this.app.viewRegistry.unregisterExtensions(this.htmlExtensions.list());
    });
  }
}
