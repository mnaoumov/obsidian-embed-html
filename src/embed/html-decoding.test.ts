import {
  describe,
  expect,
  it
} from 'vitest';

import {
  decodeHtmlBytes,
  PRESCAN_MAX_BYTE_COUNT,
  sniffHtmlEncoding
} from './html-decoding.ts';

// `Привіт` in Windows-1251.
const GREETING_WINDOWS_1251 = [0xCF, 0xF0, 0xE8, 0xE2, 0xB3, 0xF2] as const;
const GREETING = 'Привіт';

function ascii(text: string): number[] {
  return [...new TextEncoder().encode(text)];
}

function bytesOf(...parts: (readonly number[] | string)[]): Uint8Array {
  return new Uint8Array(parts.flatMap((part) => typeof part === 'string' ? ascii(part) : [...part]));
}

function utf16(text: string, isLittleEndian: boolean): number[] {
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    const low = code % 0x1_00;
    const high = Math.floor(code / 0x1_00);
    bytes.push(...(isLittleEndian ? [low, high] : [high, low]));
  }
  return bytes;
}

describe('decodeHtmlBytes', () => {
  it('should decode UTF-8 without a BOM', () => {
    const html = `<html><body>${GREETING}</body></html>`;
    expect(decodeHtmlBytes(new TextEncoder().encode(html))).toBe(html);
  });

  it('should decode UTF-8 with a BOM and drop the BOM', () => {
    const html = `<html><body>${GREETING}</body></html>`;
    expect(decodeHtmlBytes(bytesOf([0xEF, 0xBB, 0xBF], html))).toBe(html);
  });

  it('should accept an ArrayBuffer, as vault.readBinary returns', () => {
    const html = `<p>${GREETING}</p>`;
    expect(decodeHtmlBytes(new TextEncoder().encode(html).buffer)).toBe(html);
  });

  it('should decode UTF-16LE by its BOM', () => {
    const html = `<html><body>${GREETING}</body></html>`;
    expect(decodeHtmlBytes(bytesOf([0xFF, 0xFE], utf16(html, true)))).toBe(html);
  });

  it('should decode UTF-16BE by its BOM', () => {
    const html = `<html><body>${GREETING}</body></html>`;
    expect(decodeHtmlBytes(bytesOf([0xFE, 0xFF], utf16(html, false)))).toBe(html);
  });

  it('should decode by a meta charset attribute', () => {
    const bytes = bytesOf('<html><head><meta charset="windows-1251"></head><body>', GREETING_WINDOWS_1251, '</body></html>');
    expect(decodeHtmlBytes(bytes)).toBe(`<html><head><meta charset="windows-1251"></head><body>${GREETING}</body></html>`);
  });

  it('should decode by an unquoted, mixed-case meta charset, as court-registry pages write it', () => {
    const bytes = bytesOf('<!DOCTYPE html><HTML><HEAD><META http-equiv=Content-Type content="text/html" charset=Windows-1251></HEAD><BODY>', GREETING_WINDOWS_1251);
    expect(decodeHtmlBytes(bytes)).toContain(GREETING);
  });

  it('should decode by the http-equiv Content-Type form', () => {
    const bytes = bytesOf('<head><meta http-equiv="Content-Type" content="text/html; charset=windows-1251"></head>', GREETING_WINDOWS_1251);
    expect(decodeHtmlBytes(bytes)).toContain(GREETING);
  });

  it('should let a BOM win over a meta charset', () => {
    const html = `<meta charset="windows-1251">${GREETING}`;
    expect(decodeHtmlBytes(bytesOf([0xEF, 0xBB, 0xBF], html))).toBe(html);
  });

  it('should fall back to UTF-8 for an unknown label rather than throw', () => {
    const html = `<meta charset="no-such-encoding">${GREETING}`;
    expect(decodeHtmlBytes(new TextEncoder().encode(html))).toBe(html);
  });
});

describe('sniffHtmlEncoding', () => {
  it('should default to UTF-8 when nothing declares an encoding', () => {
    expect(sniffHtmlEncoding(bytesOf('<html><body>plain</body></html>'))).toBe('utf-8');
  });

  it('should resolve encoding labels to their canonical name', () => {
    expect(sniffHtmlEncoding(bytesOf('<meta charset="cp1251">'))).toBe('windows-1251');
    expect(sniffHtmlEncoding(bytesOf('<meta charset=koi8-r>'))).toBe('koi8-r');
    expect(sniffHtmlEncoding(bytesOf('<meta charset="Shift_JIS">'))).toBe('shift_jis');
  });

  it('should skip an unknown label and use a later meta', () => {
    expect(sniffHtmlEncoding(bytesOf('<meta charset="bogus"><meta charset="windows-1251">'))).toBe('windows-1251');
  });

  it('should ignore a meta inside a comment', () => {
    expect(sniffHtmlEncoding(bytesOf('<!-- <meta charset="windows-1251"> --><meta charset="koi8-r">'))).toBe('koi8-r');
  });

  it('should read single-quoted values', () => {
    expect(sniffHtmlEncoding(bytesOf('<meta charset=\'koi8-r\'>'))).toBe('koi8-r');
    expect(sniffHtmlEncoding(bytesOf('<meta http-equiv=\'content-type\' content=\'text/html; charset="windows-1251"\'>'))).toBe('windows-1251');
    expect(sniffHtmlEncoding(bytesOf('<meta http-equiv="Content-Type" content="text/html; charset=\'koi8-r\'">'))).toBe('koi8-r');
  });

  it('should let the first of two same-named attributes win', () => {
    expect(sniffHtmlEncoding(bytesOf('<meta charset="koi8-r" CHARSET="windows-1251">'))).toBe('koi8-r');
  });

  it('should read past a valueless attribute', () => {
    expect(sniffHtmlEncoding(bytesOf('<meta data-flag charset="koi8-r">'))).toBe('koi8-r');
  });

  it('should skip a Content-Type meta with no content or no charset in it', () => {
    expect(sniffHtmlEncoding(bytesOf('<meta http-equiv="Content-Type"><meta charset="koi8-r">'))).toBe('koi8-r');
    expect(sniffHtmlEncoding(bytesOf('<meta http-equiv="Content-Type" content="text/html">'))).toBe('utf-8');
  });

  it('should skip a meta that declares no encoding', () => {
    expect(sniffHtmlEncoding(bytesOf('<meta name="DOCID" content="1"><meta charset="koi8-r">'))).toBe('koi8-r');
  });

  it('should ignore an http-equiv other than Content-Type', () => {
    expect(sniffHtmlEncoding(bytesOf('<meta http-equiv="refresh" content="0; charset=windows-1251">'))).toBe('utf-8');
  });

  it('should not read a tag that merely starts with meta', () => {
    expect(sniffHtmlEncoding(bytesOf('<metadata charset="windows-1251">'))).toBe('utf-8');
  });

  it('should map a meta-declared UTF-16 to UTF-8, as the standard does', () => {
    expect(sniffHtmlEncoding(bytesOf('<meta charset="utf-16">'))).toBe('utf-8');
  });

  it('should map x-user-defined to windows-1252, as the standard does', () => {
    expect(sniffHtmlEncoding(bytesOf('<meta charset="x-user-defined">'))).toBe('windows-1252');
  });

  it('should find a charset past the first 1024 bytes while still in the head, as Chrome does', () => {
    // The court-registry shape: dozens of metadata META tags before the Content-Type one.
    const metadata = '<META NAME="DOCID" CONTENT="53011868">\n'.repeat(60);
    const bytes = bytesOf('<html><head>', metadata, '<meta http-equiv="Content-Type" content="text/html; charset=Windows-1251"></head><body>', GREETING_WINDOWS_1251);
    expect(sniffHtmlEncoding(bytes)).toBe('windows-1251');
    expect(decodeHtmlBytes(bytes)).toContain(GREETING);
  });

  it('should ignore a meta after the head has ended', () => {
    expect(sniffHtmlEncoding(bytesOf('<html><head></head><body><meta charset="windows-1251">'))).toBe('utf-8');
    expect(sniffHtmlEncoding(bytesOf('<body class="x"><meta charset="windows-1251">'))).toBe('utf-8');
  });

  it('should not read past the prescan cap', () => {
    const padding = ' '.repeat(PRESCAN_MAX_BYTE_COUNT);
    expect(sniffHtmlEncoding(bytesOf(padding, '<meta charset="windows-1251">'))).toBe('utf-8');
  });
});
