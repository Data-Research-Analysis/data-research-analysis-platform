import type { MaybeRefOrGetter } from 'vue';
import type { IArticle } from '@/types/IArticle';

/**
 * Fetch a single published article (full body) by slug.
 *
 * The article list endpoint no longer returns article bodies, so the detail
 * page fetches its own article here. The key is derived from the slug and the
 * call is watched, so client-side navigation between articles refetches.
 */
export const usePublicArticle = (slugInput: MaybeRefOrGetter<string>) => {
  const config = useRuntimeConfig();
  const apiUrl = config.public.NUXT_API_URL;
  const slug = computed(() => toValue(slugInput));

  const { data: article, pending, error, refresh } = useAsyncData<IArticle | null>(
    () => `public-article-${slug.value}`,
    async () => {
      try {
        const tokenUrl = `${apiUrl}/generate-token`;
        const responseToken = await $fetch<any>(tokenUrl);
        const token = responseToken.token;

        const url = `${apiUrl}/article/${encodeURIComponent(slug.value)}`;
        const data = await $fetch<IArticle>(url, {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Authorization-Type": "non-auth",
          },
        });
        return data;
      } catch (err) {
        console.error('[usePublicArticle] Error fetching article:', err);
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

  return { article, pending, error, refresh };
};
