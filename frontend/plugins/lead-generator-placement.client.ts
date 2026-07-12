export default defineNuxtPlugin({
    name: 'lead-generator-placement',
    parallel: true,
    async setup(nuxtApp) {
        if (import.meta.server) return;

        const config = useRuntimeConfig();
        const { hasDownloaded, getShownCount } = useLeadGeneratorCookie();

        const lgModal = shallowRef(false);
        const currentLeadGenerator = shallowRef<any>(null);
        const currentPlacementId = shallowRef(0);
        const currentPlacementAdditionalContent = shallowRef<string | null>(null);

        nuxtApp.provide('lgPlacementModal', lgModal);
        nuxtApp.provide('lgPlacementData', currentLeadGenerator);
        nuxtApp.provide('lgPlacementId', currentPlacementId);
        nuxtApp.provide('lgPlacementAdditionalContent', currentPlacementAdditionalContent);
        nuxtApp.provide('lgCloseModal', () => {
            lgModal.value = false;
            currentLeadGenerator.value = null;
            currentPlacementAdditionalContent.value = null;
        });
        nuxtApp.provide('lgOnDownloaded', () => {
            setTimeout(() => { lgModal.value = false; }, 2000);
        });

        const fetchAndShowPlacements = async () => {
            const route = useRoute();
            const path = route.path;

            if (path.startsWith('/admin/')) return;
            if (getAuthToken()) return;

            try {
                const response = await $fetch<any>(
                    `${config.public.apiBase}/lead-generators/page-placements?pageUrl=${encodeURIComponent(path)}`
                );
                if (!response.success || !response.data || !response.data.length) return;

                for (const placement of response.data) {
                    if (hasDownloaded(placement.lead_generator_id)) continue;
                    const shown = getShownCount(placement.id);
                    if (shown >= placement.frequency) continue;

                    currentLeadGenerator.value = placement.lead_generator;
                    currentPlacementId.value = placement.id;
                    currentPlacementAdditionalContent.value = placement.additional_content || null;
                    lgModal.value = true;
                    return;
                }
            } catch (err) {
                // Silently fail
            }
        };

        const router = useRouter();
        router.afterEach(() => {
            setTimeout(fetchAndShowPlacements, 1000);
        });
    },
});
