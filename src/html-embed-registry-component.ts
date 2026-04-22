import type { App } from 'obsidian';

import { Component } from 'obsidian';

import type { HtmlExtensions } from './html-extensions.ts';
import type { PluginSettingsComponent } from './plugin-settings-component.ts';

import { HtmlEmbedComponent } from './html-embed-component.ts';

export class HtmlEmbedRegistryComponent extends Component {
  public constructor(
    private readonly app: App,
    private readonly pluginSettingsComponent: PluginSettingsComponent,
    private readonly htmlExtensions: HtmlExtensions
  ) {
    super();
  }

  public override onload(): void {
    this.app.embedRegistry.registerExtensions(this.htmlExtensions.list(), (context, file, subpath) => {
      return new HtmlEmbedComponent({
        app: this.app,
        containerEl: context.containerEl,
        file,
        pluginSettingsComponent: this.pluginSettingsComponent,
        subpath: subpath ?? ''
      });
    });

    this.register(() => {
      this.app.embedRegistry.unregisterExtensions(this.htmlExtensions.list());
    });
  }
}
