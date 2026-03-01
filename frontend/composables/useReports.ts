import { getAuthToken } from '@/composables/AuthToken';

export interface IReportItem {
    id?: number;
    item_type: 'dashboard' | 'widget' | 'insight';
    ref_id?: number | null;
    widget_id?: string | null;
    display_order: number;
    title_override?: string | null;
    resolved_title?: string | null;
    /** Dashboard public share key (present only when item_type === 'dashboard' and the dashboard has an active share link) */
    dashboard_share_key?: string | null;
}

export interface IReport {
    id: number;
    project_id: number;
    created_by: number;
    created_by_name?: string | null;
    name: string;
    description?: string | null;
    status: 'draft' | 'published';
    created_at: string;
    updated_at: string;
    share_key?: string | null;
    share_expires_at?: string | null;
    items_count?: number;
    items?: IReportItem[];
}

export const useReports = () => {
    const config = useRuntimeConfig();

    const authHeaders = (): Record<string, string> => {
        const token = getAuthToken();
        if (!token) throw new Error('Authentication required');
        return {
            'Authorization': `Bearer ${token}`,
            'Authorization-Type': 'auth',
            'Content-Type': 'application/json',
        };
    };

    const getReports = async (projectId: number): Promise<IReport[]> => {
        try {
            const response = await $fetch<{ success: boolean; reports: IReport[] }>(
                `${config.public.apiBase}/reports?projectId=${projectId}`,
                { headers: authHeaders() },
            );
            return response?.success ? response.reports : [];
        } catch (error) {
            console.error('[useReports] getReports failed:', error);
            return [];
        }
    };

    const getReport = async (reportId: number, projectId: number): Promise<IReport | null> => {
        try {
            const response = await $fetch<{ success: boolean; report: IReport }>(
                `${config.public.apiBase}/reports/${reportId}?projectId=${projectId}`,
                { headers: authHeaders() },
            );
            return response?.success ? response.report : null;
        } catch (error) {
            console.error('[useReports] getReport failed:', error);
            return null;
        }
    };

    const getPublicReport = async (key: string): Promise<IReport | null> => {
        try {
            const response = await $fetch<{ success: boolean; report: IReport }>(
                `${config.public.apiBase}/reports/public/${key}`,
            );
            return response?.success ? response.report : null;
        } catch (error) {
            console.error('[useReports] getPublicReport failed:', error);
            return null;
        }
    };

    const createReport = async (
        projectId: number,
        name: string,
        description?: string,
    ): Promise<IReport | null> => {
        try {
            const response = await $fetch<{ success: boolean; report: IReport }>(
                `${config.public.apiBase}/reports`,
                {
                    method: 'POST',
                    headers: authHeaders(),
                    body: { projectId, name, description: description || null },
                },
            );
            return response?.success ? response.report : null;
        } catch (error) {
            console.error('[useReports] createReport failed:', error);
            return null;
        }
    };

    const updateReport = async (
        reportId: number,
        projectId: number,
        fields: Partial<Pick<IReport, 'name' | 'description' | 'status'>>,
    ): Promise<boolean> => {
        try {
            const response = await $fetch<{ success: boolean }>(
                `${config.public.apiBase}/reports/${reportId}`,
                { method: 'PATCH', headers: authHeaders(), body: { ...fields, projectId } },
            );
            return response?.success ?? false;
        } catch (error) {
            console.error('[useReports] updateReport failed:', error);
            return false;
        }
    };

    const deleteReport = async (reportId: number, projectId: number): Promise<boolean> => {
        try {
            const response = await $fetch<{ success: boolean }>(
                `${config.public.apiBase}/reports/${reportId}?projectId=${projectId}`,
                { method: 'DELETE', headers: authHeaders() },
            );
            return response?.success ?? false;
        } catch (error) {
            console.error('[useReports] deleteReport failed:', error);
            return false;
        }
    };

    const publishReport = async (reportId: number, projectId: number): Promise<boolean> => {
        try {
            const response = await $fetch<{ success: boolean }>(
                `${config.public.apiBase}/reports/${reportId}/publish`,
                { method: 'POST', headers: authHeaders(), body: { projectId } },
            );
            return response?.success ?? false;
        } catch (error) {
            console.error('[useReports] publishReport failed:', error);
            return false;
        }
    };

    const generateShareKey = async (
        reportId: number,
        projectId: number,
        expiryDays: number = 30,
    ): Promise<{ key: string; expiresAt: string } | null> => {
        try {
            const response = await $fetch<{ success: boolean; key: string; expiresAt: string }>(
                `${config.public.apiBase}/reports/${reportId}/share`,
                {
                    method: 'POST',
                    headers: authHeaders(),
                    body: { projectId, expiryHours: expiryDays * 24 },
                },
            );
            return response?.success ? { key: response.key, expiresAt: response.expiresAt } : null;
        } catch (error) {
            console.error('[useReports] generateShareKey failed:', error);
            return null;
        }
    };

    const revokeShareKey = async (reportId: number, projectId: number): Promise<boolean> => {
        try {
            const response = await $fetch<{ success: boolean }>(
                `${config.public.apiBase}/reports/${reportId}/share?projectId=${projectId}`,
                { method: 'DELETE', headers: authHeaders() },
            );
            return response?.success ?? false;
        } catch (error) {
            console.error('[useReports] revokeShareKey failed:', error);
            return false;
        }
    };

    const updateItems = async (
        reportId: number,
        projectId: number,
        items: IReportItem[],
    ): Promise<boolean> => {
        try {
            const response = await $fetch<{ success: boolean }>(
                `${config.public.apiBase}/reports/${reportId}/items`,
                { method: 'PUT', headers: authHeaders(), body: { projectId, items } },
            );
            return response?.success ?? false;
        } catch (error) {
            console.error('[useReports] updateItems failed:', error);
            return false;
        }
    };

    const formatReportDate = (dateStr: string | null | undefined): string => {
        if (!dateStr) return '—';
        const date = new Date(dateStr);
        const diff = Date.now() - date.getTime();
        if (diff < 60_000) return 'Just now';
        if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
        if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
        if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    return {
        getReports,
        getReport,
        getPublicReport,
        createReport,
        updateReport,
        updateItems,
        deleteReport,
        publishReport,
        generateShareKey,
        revokeShareKey,
        formatReportDate,
    };
};
