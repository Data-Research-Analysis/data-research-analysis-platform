/**
 * Plugin to initialize the current user on app start
 * 
 * This plugin runs on client-side only and fetches the current user
 * from the backend if an auth token exists. This ensures the user
 * store is populated before components render, preventing the
 * "undefined user" issue on page refresh.
 * 
 * NOTE: This plugin is PASSIVE - it won't redirect or block navigation.
 * The authorization middleware handles redirects.
 */
export default defineNuxtPlugin({
  name: 'init-user',
  parallel: true, // Run in parallel, don't block app startup
  async setup(nuxtApp) {
    // Only run on client side
    if (import.meta.server) {
      return;
    }

    // Check if user has auth token
    const authToken = getAuthToken();
    
    if (authToken) {    
      // Fetch user in background - don't await or block
      // This prevents blocking the app if backend is slow/unavailable
      setTimeout(async () => {
        try {
          const config = useRuntimeConfig();
          const apiUrl = config.public.NUXT_API_URL;
          const loggedInUserStore = useLoggedInUserStore();
          
          // Make a simple fetch without the composable to avoid redirect issues
          const response = await fetch(`${apiUrl}/auth/me`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
              'Authorization-Type': 'auth',
            },
          });

          if (response.ok) {
            const userData = await response.json();
            loggedInUserStore.setLoggedInUser(userData);
          }
        } catch (error) {
          // Don't clear token or redirect - let middleware handle it
        }
      }, 100); // Small delay to let app finish initializing
    }
  }
});
