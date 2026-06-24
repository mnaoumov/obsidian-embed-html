import type { ExtensionsRegistrar } from 'obsidian-dev-utils/obsidian/extensions-registrar';
import type { ViewRegistrar } from 'obsidian-dev-utils/obsidian/view-registrar';

import { ComponentEx } from 'obsidian-dev-utils/obsidian/components/component-ex';

import type { HtmlExtensions } from './html-extensions.ts';
import type { PluginSettingsComponent } from './plugin-settings-component.ts';

import { HtmlFileView } from './html-file-view.ts';

interface HtmlFileViewComponentConstructorParams {
  readonly extensionsRegistrar: ExtensionsRegistrar;
  readonly htmlExtensions: HtmlExtensions;
  readonly pluginSettingsComponent: PluginSettingsComponent;
  readonly viewRegistrar: ViewRegistrar;
}

export class HtmlFileViewComponent extends ComponentEx {
  private readonly extensionsRegistrar: ExtensionsRegistrar;
  private readonly htmlExtensions: HtmlExtensions;
  private readonly pluginSettingsComponent: PluginSettingsComponent;
  private readonly viewRegistrar: ViewRegistrar;

  public constructor(params: HtmlFileViewComponentConstructorParams) {
    super();
    this.extensionsRegistrar = params.extensionsRegistrar;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
    this.htmlExtensions = params.htmlExtensions;
    this.viewRegistrar = params.viewRegistrar;
  }

  public override onload(): void {
    super.onload();

    this.extensionsRegistrar.registerExtensions({
      extensions: this.htmlExtensions.list(),
      viewType: HtmlFileView.VIEW_TYPE
    });

    this.viewRegistrar.registerView({
      type: HtmlFileView.VIEW_TYPE,
      viewCreator: (leaf) => {
        return new HtmlFileView(leaf, this.pluginSettingsComponent);
      }
    });
  }
}
