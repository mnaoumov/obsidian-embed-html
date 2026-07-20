import { OpenDemoVaultCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/open-demo-vault-command-handler';
import { PluginSettingsTabComponent } from 'obsidian-dev-utils/obsidian/components/plugin-settings-tab-component';
import { PluginDataHandler } from 'obsidian-dev-utils/obsidian/data-handler';
import { PluginExtensionsRegistrar } from 'obsidian-dev-utils/obsidian/extensions-registrar';
import { PluginBase } from 'obsidian-dev-utils/obsidian/plugin/plugin';
import { PluginEventSourceImpl } from 'obsidian-dev-utils/obsidian/plugin/plugin-event-source';
import { PluginViewRegistrar } from 'obsidian-dev-utils/obsidian/view-registrar';
import { ensureNonNullable } from 'obsidian-dev-utils/type-guards';

import { HtmlEmbedRegistryComponent } from './html-embed-registry-component.ts';
import { HtmlExtensions } from './html-extensions.ts';
import { HtmlFileViewComponent } from './html-file-view-component.ts';
import { OpenInNewTabComponent } from './open-in-new-tab-component.ts';
import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { PluginSettingsTab } from './plugin-settings-tab.ts';

export class Plugin extends PluginBase {
  /**
   * The plugin's settings component — the public-facing API for reading and editing settings
   * programmatically (e.g. `settingsComponent.settings`, `settingsComponent.editAndSave(...)`).
   */
  public get settingsComponent(): PluginSettingsComponent {
    return ensureNonNullable(this.settingsComponentInstance);
  }

  private settingsComponentInstance?: PluginSettingsComponent;

  protected override onloadImpl(): void {
    const pluginSettingsComponent = this.addChild(
      new PluginSettingsComponent({
        dataHandler: new PluginDataHandler(this),
        pluginEventSource: new PluginEventSourceImpl(this)
      })
    );
    this.settingsComponentInstance = pluginSettingsComponent;
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
    this.addChild(
      new HtmlEmbedRegistryComponent({
        app: this.app,
        htmlExtensions,
        pluginSettingsComponent
      })
    );
    this.addChild(
      new HtmlFileViewComponent({
        extensionsRegistrar: new PluginExtensionsRegistrar(this),
        htmlExtensions,
        pluginSettingsComponent,
        viewRegistrar: new PluginViewRegistrar(this)
      })
    );
    this.addChild(
      new OpenInNewTabComponent({
        app: this.app,
        htmlExtensions,
        pluginSettingsComponent
      })
    );
    this.commandHandlerComponent.registerCommandHandlers([
      new OpenDemoVaultCommandHandler({
        app: this.app,
        pluginId: this.manifest.id,
        pluginNoticeComponent: this.pluginNoticeComponent,
        pluginVersion: this.manifest.version
      })
    ]);
  }
}
