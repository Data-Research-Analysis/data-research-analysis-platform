import type { IArticleVersion } from '~/types/IArticleVersion';
import { useArticlesStore } from '@/stores/articles';

/**
 * SSR-safe composable for fetching article versions for a given article ID.
 * Follows the same pattern as useAdminArticles / useCategories.
 *
 * @param articleId - The ID of the article whose versions to fetch
 * @returns Object with versions data, pending state, error, and refresh function
 *
 * @example
 * const { data: versions, pending, error, refresh } = useArticleVersions(articleId)
 */
export const useArticleVersions = (articleId: number | string) => {
    const articlesStore = useArticlesStore();

    const { data: versions, pending, error, refresh } = useAuthenticatedFetch<IArticleVersion[]>(
        `article-versions-${articleId}`,
        `/admin/article/${articleId}/versions`,
        {
            method: 'GET',
            transform: (data) => (Array.isArray(data) ? data : []),
        }
    );

    // Sync with store on client
    watchEffect(() => {
        if (import.meta.client && versions.value) {
            articlesStore.setArticleVersions(versions.value);
        }
    });

    return { data: versions, pending, error, refresh };
};
