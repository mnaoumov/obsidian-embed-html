import { PluginBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginBase';

import type { PluginTypes } from './PluginTypes.ts';

import { HtmlEmbedComponent } from './HtmlEmbedComponent.ts';
import { HtmlFileView } from './HtmlView.ts';
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
      return new HtmlEmbedComponent(this, context.containerEl, file);
    });
    this.app.viewRegistry.registerExtensions(HTML_EXTENSIONS, HtmlFileView.VIEW_TYPE);
    HtmlFileView.register(this);

    this.register(() => {
      this.app.embedRegistry.unregisterExtensions(HTML_EXTENSIONS);
      this.app.viewRegistry.unregisterExtensions(HTML_EXTENSIONS);
    });
  }
}
