export type ConsentRegion = 'eu_eea_uk' | 'california' | 'rest_of_world';

interface GeolocationResponse {
    success: boolean;
    region: ConsentRegion;
    ip?: string;
}

export const useGeolocation = () => {
    const config = useRuntimeConfig();
    const region = useState<ConsentRegion | null>('consentRegion', () => null);
    const loading = useState<boolean>('consentRegionLoading', () => false);

    /**
     * Detect user's consent region from backend
     * Caches result in state to avoid repeated calls
     */
    const detectRegion = async (): Promise<ConsentRegion> => {
        // Return cached value if available
        if (region.value) {
            return region.value;
        }

        // Check localStorage cache (valid for 24 hours)
        if (import.meta.client) {
            const cached = localStorage.getItem('consent_region');
            const cacheTime = localStorage.getItem('consent_region_timestamp');
            
            if (cached && cacheTime) {
                const hoursSince = (Date.now() - parseInt(cacheTime)) / (1000 * 60 * 60);
                if (hoursSince < 24) {
                    region.value = cached as ConsentRegion;
                    return region.value;
                }
            }
        }

        // Fetch from backend
        loading.value = true;
        try {
            const response = await $fetch<GeolocationResponse>(
                `${config.public.apiBase}/geolocation/consent-region`
            );

            if (response.success) {
                region.value = response.region;
                
                // Cache in localStorage
                if (import.meta.client) {
                    localStorage.setItem('consent_region', response.region);
                    localStorage.setItem('consent_region_timestamp', Date.now().toString());
                }
                
                return response.region;
            }
        } catch (error) {
            console.error('Failed to detect region:', error);
        } finally {
            loading.value = false;
        }

        // Fallback: treat as EU (strictest privacy)
        region.value = 'eu_eea_uk';
        return 'eu_eea_uk';
    };

    /**
     * Clear cached region (useful for testing)
     */
    const clearRegionCache = () => {
        region.value = null;
        if (import.meta.client) {
            localStorage.removeItem('consent_region');
            localStorage.removeItem('consent_region_timestamp');
        }
    };

    return {
        region: readonly(region),
        loading: readonly(loading),
        detectRegion,
        clearRegionCache
    };
};
