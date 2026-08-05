export class PluginSettings {
  public background = '';
  public border = '';
  public borderRadius = '';
  public defaultHeight = '400px';
  public defaultMaxHeight = '';
  public defaultMaxWidth = '';
  public defaultMinHeight = '';
  public defaultMinWidth = '';
  public defaultWidth = '100%';
  public shouldOpenInNewTab = false;

  /**
   * When enabled, an embedded HTML file is NOT rendered in the in-note iframe. The embed shows a
   * click-to-open affordance instead, and opening it hands the file's `file://` URL — fragment
   * identifier included — to the system's default browser.
   *
   * Wanted for large reference documents, where a real browser brings tabs, zoom, find, print and
   * extensions that the embedded view cannot (issue #14).
   *
   * Desktop only: it needs the file's absolute path, which only a `FileSystemAdapter` exposes. On
   * mobile the embed falls back to the iframe, so the setting is inert rather than broken.
   */
  public shouldOpenInSystemBrowser = false;
}
