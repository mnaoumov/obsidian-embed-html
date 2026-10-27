import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { inlineCssAsync } from './css-inliner.ts';

const BASE_URL = 'app://vault-hash/C:/Vault/styles/main.css';

function createReader(files: Map<string, string>): (url: string) => Promise<null | string> {
  return vi.fn((url: string) => Promise.resolve(files.get(url) ?? null));
}

describe('inlineCssAsync', () => {
  describe('url() rewriting', () => {
    it('should resolve a relative url against the stylesheet, not the document', async () => {
      const css = await inlineCssAsync({
        css: 'body { background-image: url("bg.svg"); }',
        cssUrl: BASE_URL,
        readTextAsync: createReader(new Map())
      });

      expect(css).toBe('body { background-image: url("app://vault-hash/C:/Vault/styles/bg.svg"); }');
    });

    it('should resolve unquoted and single-quoted urls', async () => {
      const css = await inlineCssAsync({
        css: '@font-face { src: url(fonts/probe.woff2) format("woff2"); }\ndiv { background: url(\'../shared/bg.png\'); }',
        cssUrl: BASE_URL,
        readTextAsync: createReader(new Map())
      });

      expect(css).toContain('url("app://vault-hash/C:/Vault/styles/fonts/probe.woff2")');
      expect(css).toContain('url("app://vault-hash/C:/Vault/shared/bg.png")');
    });

    it('should leave an absolute url unchanged', async () => {
      const css = await inlineCssAsync({
        css: 'div { background: url("https://example.com/bg.png"); }',
        cssUrl: BASE_URL,
        readTextAsync: createReader(new Map())
      });

      expect(css).toBe('div { background: url("https://example.com/bg.png"); }');
    });

    it('should leave fragment, data and blob urls alone', async () => {
      const source = 'a { fill: url(#gradient); background: url("data:image/svg+xml,x"); mask: url(blob:app://obsidian.md/1); }';
      const css = await inlineCssAsync({
        css: source,
        cssUrl: BASE_URL,
        readTextAsync: createReader(new Map())
      });

      expect(css).toBe(source);
    });

    it('should leave an empty url() alone', async () => {
      const css = await inlineCssAsync({
        css: 'div { background: url(); }',
        cssUrl: BASE_URL,
        readTextAsync: createReader(new Map())
      });

      expect(css).toBe('div { background: url(); }');
    });

    it('should leave a url alone when it cannot be resolved at all', async () => {
      const css = await inlineCssAsync({
        css: 'div { background: url("bg.svg"); }',
        cssUrl: 'not-a-url',
        readTextAsync: createReader(new Map())
      });

      expect(css).toBe('div { background: url("bg.svg"); }');
    });
  });

  describe('@import inlining', () => {
    it('should return the css untouched when it has no imports', async () => {
      const readTextAsync = createReader(new Map());
      const css = await inlineCssAsync({
        css: 'h1 { color: red; }',
        cssUrl: BASE_URL,
        readTextAsync
      });

      expect(css).toBe('h1 { color: red; }');
      expect(readTextAsync).not.toHaveBeenCalled();
    });

    it('should inline an import written as a bare string', async () => {
      const css = await inlineCssAsync({
        css: '@import "imported.css";\nh1 { color: red; }',
        cssUrl: BASE_URL,
        readTextAsync: createReader(new Map([['app://vault-hash/C:/Vault/styles/imported.css', 'h2 { color: blue; }']]))
      });

      expect(css).toBe('h2 { color: blue; }\nh1 { color: red; }');
    });

    it('should inline an import written as url() and keep the surrounding css', async () => {
      const css = await inlineCssAsync({
        css: 'h1 { color: red; }\n@import url(\'imported.css\');\nh3 { color: green; }',
        cssUrl: BASE_URL,
        readTextAsync: createReader(new Map([['app://vault-hash/C:/Vault/styles/imported.css', 'h2 { color: blue; }']]))
      });

      expect(css).toBe('h1 { color: red; }\nh2 { color: blue; }\nh3 { color: green; }');
    });

    it('should inline imports recursively and resolve each level against its own url', async () => {
      const css = await inlineCssAsync({
        css: '@import "nested/level1.css";',
        cssUrl: BASE_URL,
        readTextAsync: createReader(
          new Map([
            ['app://vault-hash/C:/Vault/styles/nested/level1.css', '@import "level2.css";\ndiv { background: url(bg.png); }'],
            ['app://vault-hash/C:/Vault/styles/nested/level2.css', 'span { background: url(deep.png); }']
          ])
        )
      });

      expect(css).toContain('url("app://vault-hash/C:/Vault/styles/nested/deep.png")');
      expect(css).toContain('url("app://vault-hash/C:/Vault/styles/nested/bg.png")');
    });

    it('should drop an import that would recurse forever', async () => {
      const css = await inlineCssAsync({
        css: '@import "cycle.css";',
        cssUrl: BASE_URL,
        readTextAsync: createReader(new Map([['app://vault-hash/C:/Vault/styles/cycle.css', '@import "cycle.css";\nh1 { color: red; }']]))
      });

      expect(css).toBe('\nh1 { color: red; }');
    });

    it('should keep an unreadable import, absolutized, rather than dropping the rule', async () => {
      const css = await inlineCssAsync({
        css: '@import "missing.css" screen;',
        cssUrl: BASE_URL,
        readTextAsync: createReader(new Map())
      });

      expect(css).toBe('@import url("app://vault-hash/C:/Vault/styles/missing.css") screen;');
    });

    it('should keep an import whose target cannot be resolved', async () => {
      const css = await inlineCssAsync({
        css: '@import "data:text/css,h1";',
        cssUrl: BASE_URL,
        readTextAsync: createReader(new Map())
      });

      expect(css).toBe('@import "data:text/css,h1";');
    });

    it('should re-apply a media condition the import carried', async () => {
      const css = await inlineCssAsync({
        css: '@import "print.css" print and (min-width: 400px);',
        cssUrl: BASE_URL,
        readTextAsync: createReader(new Map([['app://vault-hash/C:/Vault/styles/print.css', 'h1 { color: red; }']]))
      });

      expect(css).toBe('@media print and (min-width: 400px) {\nh1 { color: red; }\n}');
    });

    it('should re-apply a supports condition, including nested parentheses', async () => {
      const css = await inlineCssAsync({
        css: '@import "grid.css" supports((display: grid) and (color: red)) screen;',
        cssUrl: BASE_URL,
        readTextAsync: createReader(new Map([['app://vault-hash/C:/Vault/styles/grid.css', 'h1 { color: red; }']]))
      });

      expect(css).toBe('@media screen {\n@supports (display: grid) and (color: red) {\nh1 { color: red; }\n}\n}');
    });

    it('should re-apply a named layer', async () => {
      const css = await inlineCssAsync({
        css: '@import "theme.css" layer(theme);',
        cssUrl: BASE_URL,
        readTextAsync: createReader(new Map([['app://vault-hash/C:/Vault/styles/theme.css', 'h1 { color: red; }']]))
      });

      expect(css).toBe('@layer theme {\nh1 { color: red; }\n}');
    });

    it('should keep an anonymous layer anonymous', async () => {
      const css = await inlineCssAsync({
        css: '@import "theme.css" layer;',
        cssUrl: BASE_URL,
        readTextAsync: createReader(new Map([['app://vault-hash/C:/Vault/styles/theme.css', 'h1 { color: red; }']]))
      });

      expect(css).toBe('@layer {\nh1 { color: red; }\n}');
    });

    it('should treat an unbalanced supports condition as a plain media condition', async () => {
      const css = await inlineCssAsync({
        css: '@import "broken.css" supports(display: grid;',
        cssUrl: BASE_URL,
        readTextAsync: createReader(new Map([['app://vault-hash/C:/Vault/styles/broken.css', 'h1 { color: red; }']]))
      });

      expect(css).toBe('@media supports(display: grid {\nh1 { color: red; }\n}');
    });
  });
});
