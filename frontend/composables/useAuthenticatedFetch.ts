/**
 * Composable for authenticated API calls with client-side SSR
 * 
 * This composable is designed for protected pages that require authentication.
 * It uses `server: false` to skip SSR (since protected pages don't need SEO).
 * Data is fetched on the client after authentication is confirmed.
 * 
 * @param key - Unique cache key for the request
 * @param endpoint - API endpoint (e.g., '/project/list')
 * @param options - Additional fetch options (method, body, etc.)
 * @returns Object with data, pending, error, and refresh function
 * 
 * @example
 * const { data: projects, pending, error } = await useAuthenticatedFetch(
 *   'projects-list',
 *   '/project/list'
 * )
 */
export const useAuthenticatedFetch = <T = any>(
  key: string,
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    body?: any;
    transform?: (data: any) => T;
    lazy?: boolean;
  } = {}
) => {
  const config = useRuntimeConfig();
  const apiUrl = config.public.NUXT_API_URL;
  const router = useRouter();

  const {
    method = 'GET',
    body = null,
    transform = (data: any) => data,
    lazy = false,
  } = options;

  const { data, pending, error, refresh } = useAsyncData<T>(
    key,
    async () => {
      try {
        // Get auth token from cookie
        const authToken = getAuthToken();
        
        // Redirect to login if not authenticated
        if (!authToken) {
          if (import.meta.client) {
            await router.push('/login');
          }
          throw new Error('Not authenticated');
        }

        // Build request options
        const requestOptions: any = {
          method,
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Authorization-Type': 'auth',
          },
        };

        // Add body for POST/PUT/PATCH requests
        if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
          requestOptions.body = body;
        }

        // Make API request with $fetch
        try {
          const data = await $fetch(`${apiUrl}${endpoint}`, requestOptions);
          return transform(data);
        } catch (fetchError: any) {
          // Handle unauthorized
          if (fetchError.statusCode === 401) {
            if (import.meta.client) {
              deleteAuthToken();
              await router.push('/login');
            }
            throw new Error('Session expired. Please login again.');
          }
          throw new Error(`API error: ${fetchError.statusCode || 'Unknown error'}`);
        }

      } catch (err: any) {
        console.error(`Error fetching ${endpoint}:`, err);
        throw err; // Re-throw the error so it can be handled by the component
      }
    },
    {
      lazy, // Allow lazy loading if specified
      server: false, // ⚠️ CLIENT-ONLY SSR - Protected pages don't need SEO
    }
  );

  return { data, pending, error, refresh };
};

/**
 * Composable for authenticated mutations (POST/PUT/DELETE)
 * Unlike useAuthenticatedFetch, this doesn't use useAsyncData caching
 * and is meant for one-time actions like creating, updating, or deleting.
 * 
 * @example
 * const { execute, pending, error } = useAuthenticatedMutation()
 * 
 * await execute('/project/add', {
 *   method: 'POST',
 *   body: { project_name: 'New Project' }
 * })
 */
export const useAuthenticatedMutation = () => {
  const config = useRuntimeConfig();
  const apiUrl = config.public.NUXT_API_URL;
  const router = useRouter();

  const pending = ref(false);
  const error = ref<Error | null>(null);

  const execute = async <T = any>(
    endpoint: string,
    options: {
      method?: 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      body?: any;
    } = {}
  ): Promise<T | null> => {
    const { method = 'POST', body = null } = options;

    pending.value = true;
    error.value = null;

    try {
      // Get auth token
      const authToken = getAuthToken();
      
      if (!authToken) {
        if (import.meta.client) {
          await router.push('/login');
        }
        throw new Error('Not authenticated');
      }

      // Build request options
      const requestOptions: any = {
        method,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Authorization-Type': 'auth',
        },
      };

      if (body) {
        requestOptions.body = body;
      }

      // Execute request with $fetch
      try {
        const data = await $fetch(`${apiUrl}${endpoint}`, requestOptions);
        return data;
      } catch (fetchError: any) {
        // Handle errors
        if (fetchError.statusCode === 401) {
          if (import.meta.client) {
            deleteAuthToken();
            await router.push('/login');
          }
          throw new Error('Session expired');
        }
        throw new Error(`API error: ${fetchError.statusCode || 'Unknown error'}`);
      }
      return data as T;

    } catch (err: any) {
      error.value = err;
      console.error(`Mutation error for ${endpoint}:`, err);
      return null;
    } finally {
      pending.value = false;
    }
  };

  return { execute, pending, error };
};
