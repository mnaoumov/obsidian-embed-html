import type {
  App,
  PluginManifest
} from 'obsidian';

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
    const pluginSettingsComponent = this.registerComponent({ component: new PluginSettingsComponent(this), shouldPreload: true });
    const htmlExtensions = new HtmlExtensions();
    this.registerComponent({ component: new PluginSettingsTabComponent(this, new PluginSettingsTab({ plugin: this, pluginSettingsComponent })) });
    this.registerComponent({ component: new HtmlEmbedRegistryComponent(this.app, pluginSettingsComponent, htmlExtensions) });
    this.registerComponent({ component: new HtmlFileViewComponent(this.app, this, pluginSettingsComponent, htmlExtensions) });
  }
}
