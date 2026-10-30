import { OpenBugReportCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/open-bug-report-command-handler';
import { OpenDemoVaultCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/open-demo-vault-command-handler';
import { PluginSettingsTabComponent } from '@mnaoumov/obsidian-lib/components/plugin-settings-tab-component';
import { PluginDataHandler } from '@mnaoumov/obsidian-lib/data-handler';
import { PluginEditorExtensionRegistrar } from '@mnaoumov/obsidian-lib/editor-extension-registrar';
import { PluginExtensionsRegistrar } from '@mnaoumov/obsidian-lib/extensions-registrar';
import { PluginMarkdownPostProcessorRegistrar } from '@mnaoumov/obsidian-lib/markdown-post-processor-registrar';
import { PluginBase } from '@mnaoumov/obsidian-lib/plugin/plugin';
import { PluginEventSourceImpl } from '@mnaoumov/obsidian-lib/plugin/plugin-event-source';
import { PluginViewRegistrar } from '@mnaoumov/obsidian-lib/view-registrar';
import { castTo } from '@mnaoumov/typescript-lib/object-utils';

import { HtmlEmbedRegistryComponent } from './embed/html-embed-registry-component.ts';
import { HtmlFileViewComponent } from './file-view/html-file-view-component.ts';
import { OpenInNewTabComponent } from './file-view/open-in-new-tab-component.ts';
import { HtmlExtensions } from './html-extensions.ts';
import { RemoteHtmlEmbedsComponent } from './remote-embed/remote-html-embeds-component.ts';
import { PluginSettingsComponent } from './settings/plugin-settings-component.ts';
import { PluginSettingsTab } from './settings/plugin-settings-tab.ts';

export class Plugin extends PluginBase {
  /**
   * The plugin's settings component — the public-facing API for reading and editing settings
   * programmatically (e.g. `pluginSettingsComponent.settings`, `pluginSettingsComponent.editAndSave(...)`).
   *
   * `PluginBase` owns the storage as a `protected` accessor; this override widens it back to `public` and
   * narrows the type to this plugin's own component, which is what those external callers need.
   *
   * @returns The settings component.
   */
  public override get pluginSettingsComponent(): PluginSettingsComponent {
    return castTo<PluginSettingsComponent>(super.pluginSettingsComponent);
  }

  /**
   * Sets the settings component.
   *
   * @param value - The settings component.
   */
  public override set pluginSettingsComponent(value: PluginSettingsComponent) {
    super.pluginSettingsComponent = value;
  }

  protected override async onloadImpl(): Promise<void> {
    const pluginSettingsComponent = this.addChild(
      new PluginSettingsComponent({
        dataHandler: new PluginDataHandler(this),
        pluginEventSource: new PluginEventSourceImpl(this)
      })
    );
    this.pluginSettingsComponent = pluginSettingsComponent;
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
      new RemoteHtmlEmbedsComponent({
        app: this.app,
        editorExtensionRegistrar: new PluginEditorExtensionRegistrar(this),
        htmlExtensions,
        markdownPostProcessorRegistrar: new PluginMarkdownPostProcessorRegistrar(this),
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
    await this.commandHandlerComponent.registerCommandHandlers(() => [
      new OpenBugReportCommandHandler({
        app: this.app,
        gitHubRepo: 'mnaoumov/obsidian-embed-html',
        pluginId: this.manifest.id
      }),
      new OpenDemoVaultCommandHandler({
        app: this.app,
        pluginId: this.manifest.id,
        pluginNoticeComponent: this.pluginNoticeComponent,
        pluginVersion: this.manifest.version
      })
    ]);
  }
}
