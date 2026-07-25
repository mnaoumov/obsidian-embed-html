import { registerEmbedAppearanceSuite } from './embed-appearance-shared.integration.test.ts';

// Desktop-only: this environment has no Android emulator, so only the desktop entry point is wired.
// The suite lives in the shared `*-shared.integration.test.ts` module (G47), so an
// `embed-appearance.android.integration.test.ts` calling `registerEmbedAppearanceSuite('android')`
// Can be added later without duplicating the body (the feature is cross-platform per manifest
// `isDesktopOnly: false`).
registerEmbedAppearanceSuite('desktop');
