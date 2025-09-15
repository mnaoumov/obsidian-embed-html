import { PluginBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginBase';

import type { PluginTypes } from './PluginTypes.ts';

import { HtmlEmbedComponent } from './HtmlEmbedComponent.ts';
import { PluginSettingsManager } from './PluginSettingsManager.ts';
import { PluginSettingsTab } from './PluginSettingsTab.ts';

const HTML_EXTENSIONS = ['htm', 'html', 'shtml', 'xht', 'xhtml'];

export class Plugin extends PluginBase<PluginTypes> {
  protected override createSettingsManager(): PluginSettingsManager {
    return new PluginSettingsManager(this);
  }

  protected override createSettingsTab(): PluginSettingsTab {
    return new PluginSettingsTab(this);
  }

  protected override async onloadImpl(): Promise<void> {
    await super.onloadImpl();
    this.app.embedRegistry.registerExtensions(HTML_EXTENSIONS, (context, file) => {
      return new HtmlEmbedComponent(this, context, file);
    });

    this.register(() => {
      this.app.embedRegistry.unregisterExtensions(HTML_EXTENSIONS);
    });
  }
}
