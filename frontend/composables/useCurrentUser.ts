import type { IUsersPlatform } from '~/types/IUsersPlatform';
import { useLoggedInUserStore } from '@/stores/logged_in_user';

/**
 * Composable for fetching the current authenticated user from the backend
 * 
 * This composable fetches the current user data from /auth/me endpoint
 * and syncs it with the logged in user store.
 * 
 * Uses client-side only SSR (server: false) since it requires authentication.
 * This ensures the user data is always fresh from the backend on page load.
 * 
 * @returns Object with user data, pending state, error, and refresh function
 * 
 * @example
 * const { data: currentUser, pending, error } = useCurrentUser()
 */
export const useCurrentUser = () => {
  const loggedInUserStore = useLoggedInUserStore();
  const config = useRuntimeConfig();
  const apiUrl = config.public.NUXT_API_URL;
  const router = useRouter();

  const { data: currentUser, pending, error, refresh } = useAsyncData<IUsersPlatform | null>(
    'current-user',
    async () => {
      try {
        // Get auth token from cookie
        const authToken = getAuthToken();
        
        // If no token, user is not authenticated
        if (!authToken) {
          return null;
        }

        // Fetch current user from backend
        const response = await fetch(`${apiUrl}/auth/me`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
            'Authorization-Type': 'auth',
          },
        });

        // Handle unauthorized (token expired or invalid)
        if (response.status === 401 || response.status === 404) {
          // Just return null - don't redirect here
          // Let the authorization middleware handle redirects
          console.warn('User authentication failed, token may be invalid');
          return null;
        }

        // Handle other errors
        if (!response.ok) {
          console.error('Error fetching current user:', response.statusText);
          return null;
        }

        // Parse and return user data
        const userData = await response.json();
        return userData as IUsersPlatform;

      } catch (err: any) {
        console.error('Error fetching current user:', err);
        return null;
      }
    },
    {
      lazy: false, // Load immediately
      server: false, // Client-only (requires auth)
    }
  );

  // Sync with store on client when user data is available
  watchEffect(() => {
    if (import.meta.client && currentUser.value) {
      loggedInUserStore.setLoggedInUser(currentUser.value);
    }
  });

  return { data: currentUser, pending, error, refresh };
};
