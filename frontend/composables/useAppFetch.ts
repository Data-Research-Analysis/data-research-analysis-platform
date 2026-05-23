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

    if (!isExcluded) {
      showLoader(getMessageForContext(window.location.pathname, url));
    }
  },
  onResponse({ response }) {
    const { hideLoader } = useGlobalLoader();
    hideLoader();
  },
  onResponseError({ response }) {
    const { forceHide } = useGlobalLoader();
    forceHide();
    console.error(`API Error: ${response?.status}`, response);
  }
});
