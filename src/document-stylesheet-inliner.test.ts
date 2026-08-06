import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { inlineDocumentStylesheetsAsync } from './document-stylesheet-inliner.ts';

const BASE_URL = 'app://vault-hash/C:/Vault/page.html';
const MAIN_CSS_URL = 'app://vault-hash/C:/Vault/styles/main.css';

function createDoc(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

function createReader(files: Map<string, string>): (url: string) => Promise<null | string> {
  return vi.fn((url: string) => Promise.resolve(files.get(url) ?? null));
}

describe('inlineDocumentStylesheetsAsync', () => {
  it('should replace a stylesheet link with an inline style carrying its css', async () => {
    const doc = createDoc('<html><head><link rel="stylesheet" href="styles/main.css"></head><body></body></html>');

    await inlineDocumentStylesheetsAsync({
      baseUrl: BASE_URL,
      doc,
      readTextAsync: createReader(new Map([[MAIN_CSS_URL, 'h1 { color: red; }']]))
    });

    expect(doc.querySelector('link')).toBeNull();
    const styleEl = doc.querySelector('style');
    expect(styleEl?.textContent).toBe('h1 { color: red; }');
    expect(styleEl?.dataset['embedHtmlInlinedFrom']).toBe(MAIN_CSS_URL);
  });

  it('should keep the link in place, so the rules keep their cascade position', async () => {
    const doc = createDoc(
      '<html><head><style id="before">h1 { color: blue; }</style><link rel="stylesheet" href="styles/main.css"><style id="after">h1 { color: green; }</style></head></html>'
    );

    await inlineDocumentStylesheetsAsync({
      baseUrl: BASE_URL,
      doc,
      readTextAsync: createReader(new Map([[MAIN_CSS_URL, 'h1 { color: red; }']]))
    });

    const ids = [...doc.querySelectorAll('style')].map((styleEl) => styleEl.id);
    expect(ids).toEqual(['before', '', 'after']);
  });

  it('should carry the link media attribute over to the style element', async () => {
    const doc = createDoc('<html><head><link rel="stylesheet" media="print" href="styles/main.css"></head></html>');

    await inlineDocumentStylesheetsAsync({
      baseUrl: BASE_URL,
      doc,
      readTextAsync: createReader(new Map([[MAIN_CSS_URL, 'h1 { color: red; }']]))
    });

    expect(doc.querySelector('style')?.getAttribute('media')).toBe('print');
  });

  it('should recognize a rel that is uppercase or carries several tokens', async () => {
    const doc = createDoc('<html><head><link rel="Alternate StyleSheet" href="styles/main.css"></head></html>');

    await inlineDocumentStylesheetsAsync({
      baseUrl: BASE_URL,
      doc,
      readTextAsync: createReader(new Map([[MAIN_CSS_URL, 'h1 { color: red; }']]))
    });

    expect(doc.querySelector('style')?.textContent).toBe('h1 { color: red; }');
  });

  it('should leave a link that is not a stylesheet alone', async () => {
    const doc = createDoc('<html><head><link rel="icon" href="favicon.ico"></head></html>');

    await inlineDocumentStylesheetsAsync({
      baseUrl: BASE_URL,
      doc,
      readTextAsync: createReader(new Map())
    });

    expect(doc.querySelector('link')).not.toBeNull();
  });

  it('should leave a link with no rel alone', async () => {
    const doc = createDoc('<html><head><link href="styles/main.css"></head></html>');

    await inlineDocumentStylesheetsAsync({
      baseUrl: BASE_URL,
      doc,
      readTextAsync: createReader(new Map([[MAIN_CSS_URL, 'h1 { color: red; }']]))
    });

    expect(doc.querySelector('link')).not.toBeNull();
    expect(doc.querySelector('style')).toBeNull();
  });

  it('should leave a stylesheet link with no href alone', async () => {
    const doc = createDoc('<html><head><link rel="stylesheet"></head></html>');

    await inlineDocumentStylesheetsAsync({
      baseUrl: BASE_URL,
      doc,
      readTextAsync: createReader(new Map())
    });

    expect(doc.querySelector('link')).not.toBeNull();
  });

  it('should leave a stylesheet link whose href cannot be resolved alone', async () => {
    const doc = createDoc('<html><head><link rel="stylesheet" href="styles/main.css"></head></html>');

    await inlineDocumentStylesheetsAsync({
      baseUrl: 'not-a-url',
      doc,
      readTextAsync: createReader(new Map())
    });

    expect(doc.querySelector('link')).not.toBeNull();
  });

  it('should leave an unreadable stylesheet link alone rather than dropping the markup', async () => {
    const doc = createDoc('<html><head><link rel="stylesheet" href="styles/missing.css"></head></html>');

    await inlineDocumentStylesheetsAsync({
      baseUrl: BASE_URL,
      doc,
      readTextAsync: createReader(new Map())
    });

    expect(doc.querySelector('link')).not.toBeNull();
    expect(doc.querySelector('style')).toBeNull();
  });

  it('should inline the imports of an inline style', async () => {
    const doc = createDoc('<html><head><style>@import "styles/main.css";</style></head></html>');

    await inlineDocumentStylesheetsAsync({
      baseUrl: BASE_URL,
      doc,
      readTextAsync: createReader(new Map([[MAIN_CSS_URL, 'h1 { color: red; }']]))
    });

    expect(doc.querySelector('style')?.textContent).toBe('h1 { color: red; }');
  });

  it('should leave an inline style with no imports untouched', async () => {
    const doc = createDoc('<html><head><style>h1 { background: url(bg.png); }</style></head></html>');
    const readTextAsync = createReader(new Map());

    await inlineDocumentStylesheetsAsync({
      baseUrl: BASE_URL,
      doc,
      readTextAsync
    });

    expect(doc.querySelector('style')?.textContent).toBe('h1 { background: url(bg.png); }');
    expect(readTextAsync).not.toHaveBeenCalled();
  });

  it('should be idempotent, so a re-run only picks up stylesheets that appeared since', async () => {
    const doc = createDoc('<html><head><link rel="stylesheet" href="styles/main.css"></head></html>');
    const readTextAsync = createReader(new Map([[MAIN_CSS_URL, 'h1 { color: red; }']]));
    const params = {
      baseUrl: BASE_URL,
      doc,
      readTextAsync
    };

    await inlineDocumentStylesheetsAsync(params);
    await inlineDocumentStylesheetsAsync(params);

    expect(doc.querySelectorAll('style')).toHaveLength(1);
    expect(readTextAsync).toHaveBeenCalledTimes(1);
  });
});
