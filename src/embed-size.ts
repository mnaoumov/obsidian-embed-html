/**
 * Resolution of an embed container's box: the six sizing properties and the decoration, merged from the
 * embed's own size token, its `width`/`height` attributes and the settings defaults.
 *
 * Shared by the vault-file embed (`HtmlEmbedComponent`) and the remote one (`RemoteHtmlEmbedComponent`), so
 * the two size identically.
 */

import type { PluginSettings } from './plugin-settings.ts';

import { parseSizeSpec } from './size-spec.ts';

/**
 * The container's resolved decoration, as CSS values (`''` = none).
 */
export interface ResolvedDecoration {
  readonly background: string;
  readonly border: string;
  readonly borderRadius: string;
}

/**
 * The container's resolved box, as CSS values (`''` = unset).
 */
export interface ResolvedSize {
  readonly height: string;
  readonly maxHeight: string;
  readonly maxWidth: string;
  readonly minHeight: string;
  readonly minWidth: string;
  readonly width: string;
}

/**
 * Parameters for {@link resolveEmbedSize}.
 */
export interface ResolveEmbedSizeParams {
  /**
   * The size token from the container's `alt`, with any file-name fallback already stripped (`''` = none).
   */
  readonly altToken: string;

  /**
   * The container's `height` attribute, which Obsidian fills from a pure-digit token.
   */
  readonly heightAttribute: null | string;

  /**
   * The plugin settings supplying the defaults.
   */
  readonly settings: PluginSettings;

  /**
   * The container's `width` attribute, which Obsidian fills from a pure-digit token.
   */
  readonly widthAttribute: null | string;
}

interface ResolveAxisParams {
  readonly fromAttribute: null | string;
  readonly fromSettings: string;
  readonly fromToken: null | string;
}

/**
 * Resolves the container's decoration from the settings.
 *
 * @param settings - The plugin settings.
 * @returns The decoration.
 */
export function resolveEmbedDecoration(settings: PluginSettings): ResolvedDecoration {
  return {
    background: settings.background,
    border: settings.border,
    borderRadius: toPx(settings.borderRadius)
  };
}

/**
 * Resolves the container's box. For each property the token wins, then the attribute (width and height only),
 * then the settings default.
 *
 * @param params - The parameters.
 * @returns The box.
 */
export function resolveEmbedSize(params: ResolveEmbedSizeParams): ResolvedSize {
  const { altToken, heightAttribute, settings, widthAttribute } = params;
  const spec = parseSizeSpec(altToken);

  return {
    height: toPx(resolveAxis({ fromAttribute: heightAttribute, fromSettings: settings.defaultHeight, fromToken: spec.height })),
    maxHeight: toPx(spec.maxHeight ?? settings.defaultMaxHeight),
    maxWidth: toPx(spec.maxWidth ?? settings.defaultMaxWidth),
    minHeight: toPx(spec.minHeight ?? settings.defaultMinHeight),
    minWidth: toPx(spec.minWidth ?? settings.defaultMinWidth),
    width: toPx(resolveAxis({ fromAttribute: widthAttribute, fromSettings: settings.defaultWidth, fromToken: spec.width }))
  };
}

/**
 * Turns a bare number into a pixel length, leaving every other CSS value as it is.
 *
 * @param value - A CSS value.
 * @returns The value, with `px` appended when it is a bare number.
 */
export function toPx(value: string): string {
  return value === String(Number(value)) ? `${value}px` : value;
}

function resolveAxis(params: ResolveAxisParams): string {
  const { fromAttribute, fromSettings, fromToken } = params;
  return fromToken ?? fromAttribute ?? fromSettings;
}
