import { useArticlesStore } from '@/stores/articles';

export const usePublicArticles = () => {
  const articlesStore = useArticlesStore();
  
  // Get runtime config BEFORE the async function to avoid context issues
  const config = useRuntimeConfig();
  const apiUrl = config.public.NUXT_API_URL;
  
  const { data: articles, pending, error, refresh } = useAsyncData(
    'public-articles', 
    async () => {
      try {
        // Fetch token directly without using baseUrl() to avoid composable context issues
        const tokenUrl = `${apiUrl}/generate-token`;
        const tokenResponse = await fetch(tokenUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });
        const responseToken = await tokenResponse.json();
        const token = responseToken.token;
        
        // Fetch articles
        const url = `${apiUrl}/article/list`;
        
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "Authorization-Type": "non-auth",
          },
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch articles: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Sync with store for client-side navigation
        if (import.meta.client && data) {
          articlesStore.setArticles(data);
        }
        
        return data;
      } catch (err) {
        console.error('[usePublicArticles] Error fetching public articles:', err);
        // Return empty array instead of throwing during SSR to prevent page crash
        return [];
      }
    },
    {
      lazy: false,
      server: true,
      transform: (data) => data || []
    }
  );
  
  return { articles, pending, error, refresh };
};
