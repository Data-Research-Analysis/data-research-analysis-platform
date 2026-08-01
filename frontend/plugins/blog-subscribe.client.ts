export default defineNuxtPlugin({
    name: 'blog-subscribe',
    parallel: true,
    setup(nuxtApp) {
        if (import.meta.server) return;

        const BLOG_COOKIE = 'blog_subscribed';
        const bsModal = shallowRef(false);

        nuxtApp.provide('bsModal', bsModal);
        nuxtApp.provide('bsOpenModal', () => { bsModal.value = true; });
        nuxtApp.provide('bsCloseModal', () => { bsModal.value = false; });

        const shouldShowOnBlog = () => {
            const route = useRoute();
            if (!route.path.startsWith('/articles')) return;
            if (useCookie(BLOG_COOKIE).value) return;
            if (getAuthToken()) return;

            const shownCookie = useCookie('blog_subscribe_shown', { default: () => '0', path: '/' });
            const shown = parseInt(shownCookie.value, 10) || 0;
            if (shown >= 1) return;

            bsModal.value = true;
            shownCookie.value = '1';
        };

        const router = useRouter();
        router.afterEach(() => {
            setTimeout(shouldShowOnBlog, 3000);
        });
    },
});
