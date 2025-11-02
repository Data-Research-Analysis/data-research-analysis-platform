import type { ICategory } from '~/types/ICategory';

/**
 * Composable for fetching categories (admin-protected)
 * Uses client-side SSR (server: false) since it requires authentication
 * 
 * @returns Object containing categories data, loading state, error state, and refresh function
 */
export function useCategories() {
  const articlesStore = useArticlesStore();

  const { data, pending, error, refresh } = useAuthenticatedFetch<ICategory[]>(
    'categories',
    '/admin/category/list'
  );

  // Sync fetched categories with the store
  watchEffect(() => {
    if (data.value) {
      articlesStore.setCategories(data.value);
    }
    if (error.value) {
      console.error('Error fetching categories:', error.value);
    }
  });

  return {
    categories: data,
    pending,
    error,
    refresh,
  };
}
