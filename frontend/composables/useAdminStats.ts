import { ref, onMounted, onUnmounted } from 'vue';
import type {
    IAdminOverviewStats,
    IDataSourceSyncRow,
    ISystemHealthStatus,
} from '~/types/admin/stats';

export const useAdminStats = () => {
    const config = useRuntimeConfig();
    const { $socketio } = useNuxtApp() as any;

    const overviewStats = ref<IAdminOverviewStats | null>(null);
    const syncHealthData = ref<IDataSourceSyncRow[]>([]);
    const systemHealth = ref<ISystemHealthStatus | null>(null);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    const authHeaders = (): Record<string, string> => {
        const token = getAuthToken();
        if (!token) throw new Error('Authentication required');
        return {
            Authorization: `Bearer ${token}`,
            'Authorization-Type': 'auth',
            'Content-Type': 'application/json',
        };
    };

    const fetchOverview = async () => {
        const res = await $fetch<{ success: boolean; data: IAdminOverviewStats }>(
            `${config.public.apiBase}/admin/stats/overview`,
            { headers: authHeaders() }
        );
        if (res.success) overviewStats.value = res.data;
    };

    const fetchSyncHealth = async () => {
        const res = await $fetch<{ success: boolean; data: IDataSourceSyncRow[] }>(
            `${config.public.apiBase}/admin/stats/sync-health`,
            { headers: authHeaders() }
        );
        if (res.success) syncHealthData.value = res.data;
    };

    const fetchSystemHealth = async () => {
        const res = await $fetch<{ success: boolean; data: ISystemHealthStatus }>(
            `${config.public.apiBase}/admin/stats/system-health`,
            { headers: authHeaders() }
        );
        if (res.success) systemHealth.value = res.data;
    };

    const refreshStats = async () => {
        try {
            await Promise.all([fetchOverview(), fetchSyncHealth(), fetchSystemHealth()]);
        } catch (err: any) {
            console.error('[useAdminStats] Refresh failed:', err);
            error.value = err.message;
        }
    };

    const loadAll = async () => {
        isLoading.value = true;
        error.value = null;
        try {
            await refreshStats();
        } finally {
            isLoading.value = false;
        }
    };

    let statsUpdateHandler: (() => void) | null = null;

    onMounted(() => {
        if (!import.meta.client) return;
        loadAll();

        if ($socketio) {
            $socketio.emit('join-admin-room');
            statsUpdateHandler = () => {
                refreshStats();
            };
            $socketio.on('admin-stats-update', statsUpdateHandler);
        }
    });

    onUnmounted(() => {
        if (!import.meta.client) return;
        if ($socketio && statsUpdateHandler) {
            $socketio.off('admin-stats-update', statsUpdateHandler);
        }
    });

    return {
        overviewStats,
        syncHealthData,
        systemHealth,
        isLoading,
        error,
        refreshStats,
    };
};
