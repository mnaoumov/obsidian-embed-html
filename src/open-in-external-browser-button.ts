import { ButtonComponent } from 'obsidian';

/**
 * The class every "Open in external browser" button carries, for a vault file and a remote page alike, so a CSS
 * snippet can restyle the button (its color, say) with one selector.
 */
export const OPEN_IN_EXTERNAL_BROWSER_BUTTON_CLASS = 'embed-html-open-in-external-browser';

/**
 * Renders the "Open in external browser" button into an embed's container.
 *
 * @param containerEl - The embed's container.
 * @param onClick - What a click does.
 * @returns The button.
 */
export function addOpenInExternalBrowserButton(containerEl: HTMLElement, onClick: (event_: MouseEvent) => void): ButtonComponent {
  return new ButtonComponent(containerEl).setButtonText('Open in external browser').setClass(OPEN_IN_EXTERNAL_BROWSER_BUTTON_CLASS).onClick(onClick);
}
