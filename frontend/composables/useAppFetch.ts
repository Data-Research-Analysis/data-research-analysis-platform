import { useGlobalLoader } from '@/composables/useGlobalLoader';
import { useLoaderMessages } from '@/composables/useLoaderMessages';

// Create a configured fetch instance
export const useAppFetch = $fetch.create({
  onRequest({ request, options }) {
    const { showLoader } = useGlobalLoader();
    const { getMessageForContext } = useLoaderMessages();

    // URLs that should not trigger the loader
    const excludedUrls = [
      '/generate-token',
      '/validate-token',
      '/admin/image/upload',
      '/image/upload',
      '/insights/session',
      '/insights/reports',
      '/google-ad-manager/networks'
    ];

    const url = typeof request === 'string' ? request : (request as Request).url;
    const isExcluded = excludedUrls.some(u => url.includes(u));

    console.log('[useAppFetch] 🌐 onRequest:', {
      url,
      method: options.method || 'GET',
      baseURL: options.baseURL,
      headerKeys: options.headers ? Object.keys(options.headers) : [],
      isExcluded,
    });

    if (!isExcluded) {
      showLoader(getMessageForContext(window.location.pathname, url));
    }
  },
  onResponse({ response, request }) {
    const { hideLoader } = useGlobalLoader();

    const url = typeof request === 'string' ? request : (request as Request).url;
    console.log('[useAppFetch] ✅ onResponse:', {
      url,
      status: response.status,
      statusCode: response.status,
      responseType: typeof response._data,
      isNull: response._data === null,
      isUndefined: response._data === undefined,
      dataKeys: response._data && typeof response._data === 'object' ? Object.keys(response._data) : [],
    });

    hideLoader();
  },
  onResponseError({ response }) {
    const { forceHide } = useGlobalLoader();
    forceHide();
    console.error('[useAppFetch] ❌ onResponseError:', {
      status: response?.status,
      statusText: response?.statusText,
      url: response?.url,
      data: response?._data,
    });
  }
});
