import type {
  App,
  PluginManifest
} from 'obsidian';

import { PluginDataHandler } from 'obsidian-dev-utils/obsidian/data-handler';
import { PluginSettingsTabComponent } from 'obsidian-dev-utils/obsidian/plugin/components/plugin-settings-tab-component';
import { PluginBase } from 'obsidian-dev-utils/obsidian/plugin/plugin';

import { HtmlEmbedRegistryComponent } from './html-embed-registry-component.ts';
import { HtmlExtensions } from './html-extensions.ts';
import { HtmlFileViewComponent } from './html-file-view-component.ts';
import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { PluginSettingsTab } from './plugin-settings-tab.ts';

export class Plugin extends PluginBase {
  public constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    const pluginSettingsComponent = this.addChild(new PluginSettingsComponent(new PluginDataHandler(this)));
    const htmlExtensions = new HtmlExtensions();
    this.addChild(
      new PluginSettingsTabComponent({
        plugin: this,
        pluginSettingsTab: new PluginSettingsTab({
          plugin: this,
          pluginSettingsComponent
        })
      })
    );
    this.addChild(new HtmlEmbedRegistryComponent(this.app, pluginSettingsComponent, htmlExtensions));
    this.addChild(new HtmlFileViewComponent(this.app, this, pluginSettingsComponent, htmlExtensions));
  }
}
