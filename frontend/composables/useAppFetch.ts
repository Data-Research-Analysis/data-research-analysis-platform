import { useGlobalLoader } from '@/composables/useGlobalLoader';
import { useLoaderMessages } from '@/composables/useLoaderMessages';

// Create a configured fetch instance
export const useAppFetch = $fetch.create({
  onRequest({ request, options }) {
    const { showLoader, getCurrentBatch } = useGlobalLoader();
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
      // Capture the batch context AT THE TIME of the request so that
      // onResponse can decrement the correct counter. This prevents the
      // race condition where a navigation starts a batch between onRequest
      // and onResponse, causing the response handler to decrement the
      // batch counter instead of the global individual counter.
      const capturedBatchId = getCurrentBatch();
      showLoader(getMessageForContext(window.location.pathname, url));
      // Store captured context in options for retrieval in onResponse
      (options as any).__capturedBatchId = capturedBatchId;
    }
  },
  onResponse({ response, request, options }) {
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

    // Pass the captured batch ID so hideLoader decrements the correct counter
    const capturedBatchId = (options as any).__capturedBatchId ?? undefined;
    hideLoader(capturedBatchId);
  },
  onResponseError({ response, options }) {
    const { hideLoader } = useGlobalLoader();
    // Use the same captured batch ID to properly clean up on errors
    const capturedBatchId = (options as any).__capturedBatchId ?? undefined;
    hideLoader(capturedBatchId);
    console.error('[useAppFetch] ❌ onResponseError:', {
      status: response?.status,
      statusText: response?.statusText,
      url: response?.url,
      data: response?._data,
    });
  }
});
