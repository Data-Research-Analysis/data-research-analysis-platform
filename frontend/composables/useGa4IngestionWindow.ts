import { toValue, type MaybeRefOrGetter } from 'vue';
import { useDataSourceStore } from '@/stores/data_sources';

/**
 * Resolve the GA4 ingestion window (in days) for a project from its connected
 * Google Analytics data sources. Returns the value chosen at connection time
 * (api_config.sync_window_days). When no value is stored (sources connected
 * before the window setting existed) we default to the maximum supported
 * window (365) so every date preset stays selectable.
 */
export function useGa4IngestionWindow(projectId: MaybeRefOrGetter<number | string | null | undefined>): () => number {
    const dataSourceStore = useDataSourceStore();

    return () => {
        const pid = Number(toValue(projectId));
        if (!pid) return 365;
        const sources = dataSourceStore.getDataSources() || [];
        const ga4 = sources.find(
            (ds: any) => ds.project_id === pid && String(ds.data_type).toLowerCase().includes('google_analytics'),
        ) as any;
        const cd = ga4?.connection_details || {};
        const apiConfig = cd?.api_connection_details?.api_config || cd?.api_config || {};
        const days = Number(apiConfig?.sync_window_days);
        return Number.isFinite(days) && days > 0 ? days : 365;
    };
}
