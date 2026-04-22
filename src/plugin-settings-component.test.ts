import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

const PluginSettingsComponentBaseMock = vi.hoisted(() =>
  class {
    protected createDefaultSettings(): unknown {
      return undefined;
    }
  }
);

vi.mock('obsidian-dev-utils/obsidian/plugin/components/plugin-settings-component', () => ({
  PluginSettingsComponentBase: PluginSettingsComponentBaseMock
}));

vi.mock('./plugin-settings.ts', () => ({
  PluginSettings: class MockPluginSettings {
    public defaultHeight = '400px';
    public defaultWidth = '100%';
  }
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { PluginSettingsComponent } from './plugin-settings-component.ts';

describe('PluginSettingsComponent', () => {
  it('should create default settings', () => {
    const component = new PluginSettingsComponent(null as never);
    const settings = component['createDefaultSettings']();

    expect(settings).toBeDefined();
    expect(settings.defaultHeight).toBe('400px');
    expect(settings.defaultWidth).toBe('100%');
  });
});
