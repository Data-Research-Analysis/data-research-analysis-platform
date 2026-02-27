/**
 * Server-side stub for v-tippy directive.
 * The real implementation lives in vuetippy.client.ts (browser only).
 * This no-op registration prevents Vue SSR from throwing
 * "Failed to resolve directive: tippy" during server rendering.
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('tippy', {
    // No-op: tooltips are DOM-only, nothing to do on the server.
  })
})
