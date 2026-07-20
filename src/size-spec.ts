/**
 * Parsing of the inline sizing token that Obsidian places into an embed
 * container's `alt` attribute.
 *
 * Obsidian only routes a pure-digit token (`N` or `NxM`) into the container's
 * `width`/`height` attributes; any other display text (`50%`, `600x-`,
 * `width: max-content`, ...) is left verbatim in the `alt` attribute. This
 * module turns that verbatim token into a {@link SizeSpec}.
 *
 * NOTE: when Obsidian consumes a pure-digit token it also resets `alt` to the
 * embed's file name (e.g. `basic.html`), which is NOT a size token. Callers must
 * strip that file-name fallback before calling this parser — otherwise the bare
 * file name is mis-parsed as a `width` and clobbers the numeric attribute.
 *
 * The parser is intentionally small and deterministic: it only splits the token
 * into the six known box properties and normalizes the short-form sugar. It does
 * NOT validate CSS values — invalid values are dropped later by the real browser
 * CSSOM when the resolved styles are applied, which keeps this module's behavior
 * identical under jsdom (used by unit tests) and Obsidian's Chromium runtime.
 */

/**
 * The CSS intrinsic-size keywords that trigger live content measurement. Only
 * these are treated as "fit to content"; lengths, percentages and `auto` are
 * applied as literal CSS.
 */
export const CONTENT_KEYWORDS = ['min-content', 'max-content', 'fit-content'] as const;

/**
 * A CSS intrinsic-size keyword.
 */
export type ContentKeyword = typeof CONTENT_KEYWORDS[number];

/**
 * The short-form marker that expands to `fit-content`.
 */
export const FIT_CONTENT_MARKER = '-';

/**
 * A resolved sizing token. Each field holds a CSS value string, or `null` when
 * the token did not specify that property (so a default can be filled in).
 */
export interface SizeSpec {
  readonly height: null | string;
  readonly maxHeight: null | string;
  readonly maxWidth: null | string;
  readonly minHeight: null | string;
  readonly minWidth: null | string;
  readonly width: null | string;
}

type MutableSizeSpec = {
  -readonly [Key in keyof SizeSpec]: null | string;
};

const EMPTY_SIZE_SPEC: SizeSpec = {
  height: null,
  maxHeight: null,
  maxWidth: null,
  minHeight: null,
  minWidth: null,
  width: null
};

const CSS_PROPERTY_TO_FIELD = new Map<string, keyof SizeSpec>([
  ['height', 'height'],
  ['max-height', 'maxHeight'],
  ['max-width', 'maxWidth'],
  ['min-height', 'minHeight'],
  ['min-width', 'minWidth'],
  ['width', 'width']
]);

const DECLARATION_SEPARATOR = ';';
const PROPERTY_VALUE_SEPARATOR = ':';
const DIMENSION_SEPARATOR = 'x';
const PURE_NUMBER_REGEX = /^\d+(?:\.\d+)?$/;

/**
 * Determines whether a resolved CSS value is an intrinsic-size keyword that
 * requires live content measurement.
 *
 * @param value - A resolved CSS value, or `null`.
 * @returns The matching {@link ContentKeyword}, or `null` when the value is a literal CSS value.
 */
export function getContentKeyword(value: null | string): ContentKeyword | null {
  if (value === null) {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();
  for (const keyword of CONTENT_KEYWORDS) {
    if (normalizedValue === keyword) {
      return keyword;
    }
  }

  return null;
}

/**
 * Parses an embed sizing token into a {@link SizeSpec}.
 *
 * @param token - The raw `alt` token (e.g. `600x-`, `xH`, `width: max-content; min-width: 100px`).
 * @returns The parsed spec; every field is `null` for an empty or unrecognized token.
 */
export function parseSizeSpec(token: string): SizeSpec {
  const trimmedToken = token.trim();
  if (trimmedToken === '') {
    return EMPTY_SIZE_SPEC;
  }

  if (trimmedToken.includes(PROPERTY_VALUE_SEPARATOR)) {
    return parseDeclarationForm(trimmedToken);
  }

  return parseShortForm(trimmedToken);
}

function normalizeValue(rawValue: string): null | string {
  const trimmedValue = rawValue.trim();
  if (trimmedValue === '') {
    return null;
  }

  if (trimmedValue === FIT_CONTENT_MARKER) {
    return 'fit-content';
  }

  if (PURE_NUMBER_REGEX.test(trimmedValue)) {
    return `${trimmedValue}px`;
  }

  return trimmedValue;
}

function parseDeclarationForm(token: string): SizeSpec {
  const spec: MutableSizeSpec = { ...EMPTY_SIZE_SPEC };

  for (const declaration of token.split(DECLARATION_SEPARATOR)) {
    const separatorIndex = declaration.indexOf(PROPERTY_VALUE_SEPARATOR);
    if (separatorIndex === -1) {
      continue;
    }

    const property = declaration.slice(0, separatorIndex).trim().toLowerCase();
    const rawValue = declaration.slice(separatorIndex + 1);
    const field = CSS_PROPERTY_TO_FIELD.get(property);
    if (!field) {
      continue;
    }

    spec[field] = normalizeValue(rawValue);
  }

  return spec;
}

function parseShortForm(token: string): SizeSpec {
  // A bare marker is the headline case: fit the height, keep the default width.
  if (token === FIT_CONTENT_MARKER) {
    return {
      ...EMPTY_SIZE_SPEC,
      height: 'fit-content'
    };
  }

  // `WxH` form: split on a single `x` (pieces then contain no `x`, matching the legacy `NxM` shape). `slice` yields definite strings, so no empty piece is ever `undefined`.
  const separatorIndex = token.indexOf(DIMENSION_SEPARATOR);
  const hasSingleSeparator = separatorIndex !== -1 && !token.includes(DIMENSION_SEPARATOR, separatorIndex + 1);
  if (hasSingleSeparator) {
    return {
      ...EMPTY_SIZE_SPEC,
      height: normalizeValue(token.slice(separatorIndex + 1)),
      width: normalizeValue(token.slice(0, separatorIndex))
    };
  }

  return {
    ...EMPTY_SIZE_SPEC,
    width: normalizeValue(token)
  };
}
