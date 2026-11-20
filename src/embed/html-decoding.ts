import { castTo } from '@mnaoumov/typescript-lib/object-utils';

/**
 * Decodes the raw bytes of an HTML file into text the way a browser opening the file would.
 *
 * `vault.read` always decodes as UTF-8, so a page saved in a legacy encoding (a Windows-1251 court
 * registry page, a KOI8-R or Shift_JIS document) turned every non-ASCII byte into U+FFFD before the
 * markup reached the embed. A `srcdoc` document is a string, so the `<meta charset>` inside it cannot
 * repair that afterwards: the encoding has to be chosen while the bytes are still bytes.
 *
 * The order follows the HTML standard's encoding sniffing, minus the parts a vault file has no source
 * for (a transport-layer charset) or that guess (locale defaults, frequency analysis):
 * 1. a byte order mark (UTF-8, UTF-16LE, UTF-16BE);
 * 2. the `<meta charset>` or `<meta http-equiv="Content-Type" content="...; charset=...">` found by
 *    the prescan of the document's head;
 * 3. UTF-8.
 *
 * The prescan reads the whole `<head>`, as Chrome's does, not only the first 1024 bytes the standard
 * names. Court-registry pages carry some forty `<META NAME=...>` lines before their
 * `<meta http-equiv="Content-Type" ...; charset=Windows-1251>`, which sits near byte 2900. Chrome
 * finds it there and shows the page correctly, so a strict 1024-byte prescan would have left exactly
 * the reported file broken. The scan stops at `</head>` or `<body>`, and never reads past
 * {@link PRESCAN_MAX_BYTE_COUNT} bytes.
 */

/**
 * The most leading bytes the prescan looks at, however long the head is.
 */
export const PRESCAN_MAX_BYTE_COUNT = 65_536;

const UTF_8 = 'utf-8';
const UTF_16LE = 'utf-16le';
const UTF_16BE = 'utf-16be';
const WINDOWS_1252 = 'windows-1252';

// The byte order marks, written as the windows-1252 text of their bytes (each of these bytes maps to the
// Latin-1 code point of the same value), so they compare against the decoded prefix directly.
const UTF_8_BOM = 'ï»¿';
const UTF_16LE_BOM = 'ÿþ';
const UTF_16BE_BOM = 'þÿ';
const BOM_MAX_BYTE_COUNT = UTF_8_BOM.length;

const HEAD_END_REG_EXP = /<\/head[\s>]|<body[\s>]/i;
const COMMENT_REG_EXP = /<!--[\s\S]*?(?:-->|$)/g;
const META_TAG_REG_EXP = /<meta(?=[\s/])(?<attributes>[^>]*)>?/gi;
const ATTRIBUTE_REG_EXP = /(?<name>[^\s"'/=>][^\s"'/=>]*)(?:\s*=\s*(?:"(?<doubleQuoted>[^"]*)"|'(?<singleQuoted>[^']*)'|(?<unquoted>[^\s>]+)))?/g;
const CONTENT_CHARSET_REG_EXP = /charset\s*=\s*(?:"(?<doubleQuoted>[^"]*)"|'(?<singleQuoted>[^']*)'|(?<unquoted>[^\s;"']+))/i;

interface AttributeGroups extends QuotedValueGroups {
  readonly name: string;
}

interface MetaTagGroups {
  readonly attributes: string;
}

interface QuotedValueGroups {
  readonly doubleQuoted?: string;
  readonly singleQuoted?: string;
  readonly unquoted?: string;
}

/**
 * Decodes HTML file bytes into a string, picking the encoding by BOM, then by the meta charset prescan,
 * then UTF-8.
 *
 * @param data - The file's bytes, as `vault.readBinary` returns them.
 * @returns The decoded text, with any byte order mark removed.
 */
export function decodeHtmlBytes(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const encoding = sniffHtmlEncoding(bytes);
  // `ignoreBOM: false` (the default) makes the decoder drop the BOM it was chosen by.
  return new TextDecoder(encoding).decode(bytes);
}

/**
 * Picks the encoding a browser would decode the given HTML bytes with.
 *
 * @param bytes - The file's bytes.
 * @returns The canonical name of the encoding, as `TextDecoder.encoding` reports it.
 */
export function sniffHtmlEncoding(bytes: Uint8Array): string {
  const bomPrefix = new TextDecoder(WINDOWS_1252).decode(bytes.subarray(0, BOM_MAX_BYTE_COUNT));
  if (bomPrefix.startsWith(UTF_8_BOM)) {
    return UTF_8;
  }

  if (bomPrefix.startsWith(UTF_16LE_BOM)) {
    return UTF_16LE;
  }

  if (bomPrefix.startsWith(UTF_16BE_BOM)) {
    return UTF_16BE;
  }

  return prescanMetaEncoding(bytes.subarray(0, PRESCAN_MAX_BYTE_COUNT)) ?? UTF_8;
}

function extractCharsetFromContent(content: string): null | string {
  const match = CONTENT_CHARSET_REG_EXP.exec(content);
  return match ? getQuotedValue(castTo<QuotedValueGroups>(match.groups)) : null;
}

function getQuotedValue(groups: QuotedValueGroups): null | string {
  return groups.doubleQuoted ?? groups.singleQuoted ?? groups.unquoted ?? null;
}

function parseAttributes(attributesText: string): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const match of attributesText.matchAll(ATTRIBUTE_REG_EXP)) {
    // Every pattern here has named groups, so a match always carries `groups`, and `name` is not optional.
    const groups = castTo<AttributeGroups>(match.groups);
    const name = groups.name.toLowerCase();
    // The first occurrence of an attribute wins, as in the standard's attribute list.
    if (attributes.has(name)) {
      continue;
    }
    attributes.set(name, getQuotedValue(groups) ?? '');
  }
  return attributes;
}

function prescanMetaEncoding(prefix: Uint8Array): null | string {
  // Every byte maps to one character under windows-1252, and every ASCII byte to itself, so the tag and
  // attribute syntax the prescan looks for survives whatever the real encoding is.
  const withoutComments = new TextDecoder(WINDOWS_1252).decode(prefix).replaceAll(COMMENT_REG_EXP, '');
  const headEndIndex = withoutComments.search(HEAD_END_REG_EXP);
  const text = headEndIndex === -1 ? withoutComments : withoutComments.slice(0, headEndIndex);

  for (const metaMatch of text.matchAll(META_TAG_REG_EXP)) {
    const attributes = parseAttributes(castTo<MetaTagGroups>(metaMatch.groups).attributes);
    let label = attributes.get('charset') ?? null;
    if (label === null && attributes.get('http-equiv')?.toLowerCase() === 'content-type') {
      const content = attributes.get('content');
      label = content === undefined ? null : extractCharsetFromContent(content);
    }

    if (label === null) {
      continue;
    }

    const encoding = resolveEncoding(label);
    if (encoding !== null) {
      return encoding;
    }
  }

  return null;
}

function resolveEncoding(label: string): null | string {
  let encoding: string;
  try {
    encoding = new TextDecoder(label.trim()).encoding;
  } catch {
    // An unknown label is skipped, as the standard does, so a later meta or the UTF-8 default applies.
    return null;
  }

  // A meta tag cannot honestly declare UTF-16: the prescan just read it as ASCII-compatible bytes.
  // The standard maps such a declaration to UTF-8, and `x-user-defined` to windows-1252.
  if (encoding === UTF_16LE || encoding === UTF_16BE) {
    return UTF_8;
  }

  if (encoding === 'x-user-defined') {
    return WINDOWS_1252;
  }

  return encoding;
}
