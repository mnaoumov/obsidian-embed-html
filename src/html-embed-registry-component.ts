import type { App } from 'obsidian';

import { ComponentEx } from 'obsidian-dev-utils/obsidian/components/component-ex';

import type { HtmlExtensions } from './html-extensions.ts';
import type { PluginSettingsComponent } from './plugin-settings-component.ts';

import { HtmlEmbedComponent } from './html-embed-component.ts';

interface HtmlEmbedRegistryComponentConstructorParams {
  readonly app: App;
  readonly htmlExtensions: HtmlExtensions;
  readonly pluginSettingsComponent: PluginSettingsComponent;
}

export class HtmlEmbedRegistryComponent extends ComponentEx {
  private readonly app: App;
  private readonly htmlExtensions: HtmlExtensions;
  private readonly pluginSettingsComponent: PluginSettingsComponent;

  public constructor(params: HtmlEmbedRegistryComponentConstructorParams) {
    super();
    this.app = params.app;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
    this.htmlExtensions = params.htmlExtensions;
  }

  public override onload(): void {
    super.onload();
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
