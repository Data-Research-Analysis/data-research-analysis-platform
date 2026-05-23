/**
 * API Loader Plugin
 * 
 * This plugin previously used a global window.fetch override. 
 * Interception is now handled by the 'useAppFetch' composable.
 */

export default defineNuxtPlugin(() => {
  // Global loader initialization can be handled here if needed.
})
