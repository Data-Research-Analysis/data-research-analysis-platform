import { useArticlesStore } from '@/stores/articles';
import type { IArticle } from '@/types/IArticle';

export const usePublicArticles = () => {
  const articlesStore = useArticlesStore();
  
  // Get runtime config BEFORE the async function to avoid context issues
  const config = useRuntimeConfig();
  const apiUrl = config.public.NUXT_API_URL;
  
  const { data: articles, pending, error, refresh } = useAsyncData<IArticle[]>(
    'public-articles', 
    async () => {
      try {
        // Fetch token directly without using baseUrl() to avoid composable context issues
        const tokenUrl = `${apiUrl}/generate-token`;
        const responseToken = await $fetch<any>(tokenUrl);
        const token = responseToken.token;
        
        // Fetch articles
        const url = `${apiUrl}/article/list`;
        
        const data = await $fetch<IArticle[]>(url, {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Authorization-Type": "non-auth",
          },
        });
        
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
      dedupe: 'defer',
      // Strip heavy article bodies from the list payload (defensive: the list
      // endpoint already omits them). The detail page fetches its own body.
      transform: (data) => (data || []).map((item: any) => {
        if (!item || !item.article) return item;
        const { content: _content, content_markdown: _contentMarkdown, ...article } = item.article;
        return { ...item, article };
      })
    }
  );
  
  return { articles, pending, error, refresh };
};
