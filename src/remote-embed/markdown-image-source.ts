const IMAGE_PREFIX = '![';
const DESTINATION_PREFIX = '](';
const ESCAPE = '\\';
const OPEN_BRACKET = '[';
const CLOSE_BRACKET = ']';
const OPEN_PAREN = '(';
const CLOSE_PAREN = ')';
const LINE_BREAK = '\n';

/**
 * Measures the markdown image (`![alt](destination "title")`) that opens a text.
 *
 * Brackets in the alt and parentheses in the destination may nest, as CommonMark allows, and a backslash escapes
 * the character after it.
 *
 * @param text - The text, from where the image starts.
 * @returns The image's length, or `null` when the text does not open with a complete image.
 */
export function getMarkdownImageSourceLength(text: string): null | number {
  if (!text.startsWith(IMAGE_PREFIX)) {
    return null;
  }

  const altEnd = findClosing(text, IMAGE_PREFIX.length, OPEN_BRACKET, CLOSE_BRACKET);
  if (altEnd === null || !text.startsWith(DESTINATION_PREFIX, altEnd)) {
    return null;
  }

  const destinationEnd = findClosing(text, altEnd + DESTINATION_PREFIX.length, OPEN_PAREN, CLOSE_PAREN);
  return destinationEnd === null ? null : destinationEnd + 1;
}

function findClosing(text: string, start: number, open: string, close: string): null | number {
  let depth = 0;
  for (let index = start; index < text.length; index++) {
    switch (text.charAt(index)) {
      case close: {
        if (depth === 0) {
          return index;
        }
        depth--;
        break;
      }
      case ESCAPE: {
        index++;
        break;
      }
      case LINE_BREAK: {
        return null;
      }
      case open: {
        depth++;
        break;
      }
      default: {
        break;
      }
    }
  }
  return null;
}
