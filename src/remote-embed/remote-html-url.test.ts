import {
  describe,
  expect,
  it
} from 'vitest';

import { parseRemoteHtmlUrl } from './remote-html-url.ts';

const EXTENSIONS = ['htm', 'html'];

describe('parseRemoteHtmlUrl', () => {
  it('should recognize an http URL with an HTML extension', () => {
    expect(parseRemoteHtmlUrl('http://192.168.1.2/attachments/1.html', EXTENSIONS)).toEqual({
      fileName: '1.html',
      subpath: '',
      url: 'http://192.168.1.2/attachments/1.html'
    });
  });

  it('should recognize an https URL and keep its query', () => {
    expect(parseRemoteHtmlUrl('https://example.com/page.htm?x=1', EXTENSIONS)).toEqual({
      fileName: 'page.htm',
      subpath: '',
      url: 'https://example.com/page.htm?x=1'
    });
  });

  it('should match the extension case-insensitively and ignore surrounding whitespace', () => {
    expect(parseRemoteHtmlUrl('  https://example.com/PAGE.HTML  ', EXTENSIONS)?.url).toBe('https://example.com/PAGE.HTML');
  });

  it('should split off the fragment as the decoded subpath', () => {
    expect(parseRemoteHtmlUrl('https://example.com/a%20b.html#my%20id&mode=extract', EXTENSIONS)).toEqual({
      fileName: 'a b.html',
      subpath: 'my id&mode=extract',
      url: 'https://example.com/a%20b.html'
    });
  });

  it('should keep a malformed escape verbatim', () => {
    expect(parseRemoteHtmlUrl('https://example.com/%zz.html#%zz', EXTENSIONS)).toEqual({
      fileName: '%zz.html',
      subpath: '%zz',
      url: 'https://example.com/%zz.html'
    });
  });

  it('should reject a URL whose path has another extension or none', () => {
    expect(parseRemoteHtmlUrl('https://example.com/image.png', EXTENSIONS)).toBeNull();
    expect(parseRemoteHtmlUrl('https://example.com/', EXTENSIONS)).toBeNull();
    expect(parseRemoteHtmlUrl('https://example.com/html', EXTENSIONS)).toBeNull();
  });

  it('should reject a non-http(s) scheme', () => {
    expect(parseRemoteHtmlUrl('file:///C:/vault/page.html', EXTENSIONS)).toBeNull();
    expect(parseRemoteHtmlUrl('app://obsidian.md/page.html', EXTENSIONS)).toBeNull();
  });

  it('should reject a value that is not a URL', () => {
    expect(parseRemoteHtmlUrl('folder/page.html', EXTENSIONS)).toBeNull();
  });
});
