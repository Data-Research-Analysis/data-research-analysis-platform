import type { IAuthor } from '~/types/IAuthor';

export function useAuthors() {
  const { data, pending, error, refresh } = useAuthenticatedFetch<IAuthor[]>(
    'authors',
    '/admin/author/list',
    {
      method: 'GET',
      transform: (data) => Array.isArray(data) ? data : [],
    }
  );

  return {
    authors: data,
    pending,
    error,
    refresh,
  };
}

export function useAuthor(authorId: string | number) {
  const { data, pending, error, refresh } = useAuthenticatedFetch<IAuthor>(
    `admin-author-${authorId}`,
    `/admin/author/${authorId}`,
    {
      method: 'GET',
      transform: (data) => data || null,
    }
  );

  return {
    author: data,
    pending,
    error,
    refresh,
  };
}
