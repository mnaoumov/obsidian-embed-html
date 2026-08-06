/**
 * Parsing of the non-sizing flags an embed token may carry.
 *
 * The `alt` token is shared ground: it already carries the sizing declarations that `size-spec.ts` reads
 * (`width: 600px; height: -`). This module runs first and takes only the declarations that are NOT about
 * sizing, handing the rest on untouched — so `size-spec.ts` keeps its contract of splitting a token into
 * the six known box properties and nothing else.
 *
 * Only the declaration form (`property: value`) can carry a flag. The short forms (`600x-`, `-`, `50%`)
 * are pure sizing sugar and are passed through whole.
 */

/**
 * The declaration that overrides the global open-in-default-browser setting for a single embed.
 */
const OPEN_IN_DEFAULT_BROWSER_PROPERTY = 'open-in-default-browser';

const DECLARATION_SEPARATOR = ';';
const PROPERTY_VALUE_SEPARATOR = ':';

const TRUE_VALUES = new Set(['1', 'on', 'true', 'yes']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

/**
 * The non-sizing flags an embed token carries. A field is `null` when the token did not mention it, which
 * is what makes the global setting the default rather than one of the two explicit values.
 */
export interface EmbedOptions {
  readonly shouldOpenInSystemBrowser: boolean | null;
}

/**
 * An embed token split into its non-sizing flags and the sizing remainder.
 */
export interface ParsedEmbedToken {
  readonly options: EmbedOptions;
  readonly sizeToken: string;
}

const EMPTY_EMBED_OPTIONS: EmbedOptions = {
  shouldOpenInSystemBrowser: null
};

/**
 * Splits an embed token into its non-sizing flags and the remainder to hand to the size parser.
 *
 * @param token - The raw `alt` token (e.g. `width: 600px; open-in-default-browser: true`).
 * @returns The recognized flags, plus the token with those declarations removed.
 */
export function parseEmbedToken(token: string): ParsedEmbedToken {
  if (!token.includes(PROPERTY_VALUE_SEPARATOR)) {
    return {
      options: EMPTY_EMBED_OPTIONS,
      sizeToken: token
    };
  }

  const remainingDeclarations: string[] = [];
  let shouldOpenInSystemBrowser: boolean | null = null;

  for (const declaration of token.split(DECLARATION_SEPARATOR)) {
    const separatorIndex = declaration.indexOf(PROPERTY_VALUE_SEPARATOR);
    if (separatorIndex === -1) {
      remainingDeclarations.push(declaration);
      continue;
    }

    const property = declaration.slice(0, separatorIndex).trim().toLowerCase();
    if (property !== OPEN_IN_DEFAULT_BROWSER_PROPERTY) {
      remainingDeclarations.push(declaration);
      continue;
    }

    const parsedValue = parseBoolean(declaration.slice(separatorIndex + 1));
    // An unrecognized value is dropped rather than guessed at, leaving the global setting in charge.
    if (parsedValue !== null) {
      shouldOpenInSystemBrowser = parsedValue;
    }
  }

  return {
    options: { shouldOpenInSystemBrowser },
    sizeToken: remainingDeclarations.join(DECLARATION_SEPARATOR)
  };
}

/**
 * Parses a flag value.
 *
 * @param rawValue - The text after the `:`.
 * @returns The boolean it names, or `null` when it names neither.
 */
function parseBoolean(rawValue: string): boolean | null {
  const normalizedValue = rawValue.trim().toLowerCase();
  if (TRUE_VALUES.has(normalizedValue)) {
    return true;
  }
  if (FALSE_VALUES.has(normalizedValue)) {
    return false;
  }
  return null;
}
