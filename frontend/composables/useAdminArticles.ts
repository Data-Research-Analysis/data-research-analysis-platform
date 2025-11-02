import type { IArticle } from '~/types/IArticle';
import { useArticlesStore } from '@/stores/articles';

/**
 * Composable for fetching admin articles list with client-side SSR
 * 
 * This composable fetches all articles (published and unpublished) from the API
 * for admin management and syncs them with the Pinia store.
 * 
 * Uses `server: false` since admin pages are protected and don't need SEO.
 * 
 * @returns Object with articles data, pending state, error, and refresh function
 * 
 * @example
 * const { data: articles, pending, error } = useAdminArticles()
 */
export const useAdminArticles = () => {
  const articlesStore = useArticlesStore();

  const { data: articles, pending, error, refresh } = useAuthenticatedFetch<IArticle[]>(
    'admin-articles-list',
    '/admin/article/list',
    {
      method: 'GET',
      transform: (data) => Array.isArray(data) ? data : [],
    }
  );

  // Sync with store on client for backward compatibility
  watchEffect(() => {
    if (import.meta.client && articles.value) {
      articlesStore.setArticles(articles.value);
    }
  });

  return { data: articles, pending, error, refresh };
};

/**
 * Composable for fetching a single admin article by ID with client-side SSR
 * 
 * @param articleId - The ID of the article to fetch
 * @returns Object with article data, pending state, error, and refresh function
 * 
 * @example
 * const { data: article, pending, error } = useAdminArticle(articleId)
 */
export const useAdminArticle = (articleId: string | number) => {
  const articlesStore = useArticlesStore();

  const { data: article, pending, error, refresh } = useAuthenticatedFetch<IArticle>(
    `admin-article-${articleId}`,
    `/admin/article/${articleId}`,
    {
      method: 'GET',
      transform: (data) => data || null,
    }
  );

  // Sync with store on client for backward compatibility
  watchEffect(() => {
    if (import.meta.client && article.value) {
      articlesStore.setSelectedArticle(article.value);
    }
  });

  return { data: article, pending, error, refresh };
};
