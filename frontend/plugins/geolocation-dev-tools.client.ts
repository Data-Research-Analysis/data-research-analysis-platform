/**
 * Geolocation Dev Tools Plugin (dev only)
 *
 * Registers geolocation testing helpers on `window` so they are available
 * directly in the browser console during development:
 *
 *   mockRegion('eu_eea_uk')    // force EU consent flow
 *   mockRegion('us')           // force US/CCPA consent flow
 *   mockRegion('rest_of_world')
 *   clearRegionMock()          // revert to real geolocation
 *   getCurrentRegion()         // read cached region
 *   debugGeolocation()         // dump all consent data to console
 *
 * This plugin is automatically excluded from production builds by Nuxt
 * because its filename ends with `.client.ts` and it is only loaded when
 * `import.meta.dev` is true.
 */
export default defineNuxtPlugin(() => {
  if (!import.meta.dev) return;

  import('@/utils/test-geolocation').then((mod) => {
    (window as any).mockRegion = mod.mockRegion;
    (window as any).clearRegionMock = mod.clearRegionMock;
    (window as any).getCurrentRegion = mod.getCurrentRegion;
    (window as any).debugGeolocation = mod.debugGeolocation;

    console.log('🧪 Geolocation testing utilities loaded. Available functions:');
    console.log('  - mockRegion(region)       // "eu_eea_uk" | "us" | "rest_of_world"');
    console.log('  - clearRegionMock()        // Use real geolocation');
    console.log('  - getCurrentRegion()       // Check cached region');
    console.log('  - debugGeolocation()       // Show all consent data');
  });
});
