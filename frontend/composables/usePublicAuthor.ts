import type { MaybeRefOrGetter } from 'vue';
import type { IAuthor } from '@/types/IAuthor';
import type { IArticle } from '@/types/IArticle';

interface PublicAuthorResponse {
  author: IAuthor;
  articles: IArticle[];
}

/**
 * Fetch a public author profile and their published articles by slug.
 * Mirrors usePublicArticle: the public author endpoint requires a generated
 * non-auth token, so the token is fetched first.
 */
export const usePublicAuthor = (slugInput: MaybeRefOrGetter<string>) => {
  const config = useRuntimeConfig();
  const apiUrl = config.public.NUXT_API_URL;
  const slug = computed(() => toValue(slugInput));

  const { data, pending, error, refresh } = useAsyncData<PublicAuthorResponse | null>(
    () => `public-author-${slug.value}`,
    async () => {
      try {
        const responseToken = await $fetch<any>(`${apiUrl}/generate-token`);
        const token = responseToken.token;

        const url = `${apiUrl}/author/${encodeURIComponent(slug.value)}`;
        const result = await $fetch<PublicAuthorResponse>(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Authorization-Type': 'non-auth',
          },
        });
        return result;
      } catch (err) {
        console.error('[usePublicAuthor] Error fetching author:', err);
        return null;
      }
    },
    {
      lazy: false,
      server: true,
      dedupe: 'defer',
      watch: [slug],
    }
  );

  return {
    author: computed(() => data.value?.author ?? null),
    articles: computed(() => data.value?.articles ?? []),
    pending,
    error,
    refresh,
  };
};
