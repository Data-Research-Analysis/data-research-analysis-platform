import { useAppFetch } from '@/composables/useAppFetch'
import { baseUrl } from '~/composables/Utils'
import { getAuthToken } from '~/composables/AuthToken'

/**
 * Composable for the GA4 acquisition overview. Reads the GA4 Data API
 * aggregate tables via the platform backend (no BigQuery layer required).
 */
export const useGA4Overview = () => {
    const authHeaders = () => ({
        Authorization: `Bearer ${getAuthToken()}`,
        'Authorization-Type': 'auth',
    })

    const getOverview = async (
        projectId: number,
        preset: string = 'last_90_days',
        startDate?: string,
        endDate?: string,
        dataSourceId?: number | null,
    ): Promise<any | null> => {
        try {
            const params = new URLSearchParams({ preset })
            if (startDate && endDate) {
                params.set('startDate', startDate)
                params.set('endDate', endDate)
            }
            if (dataSourceId != null) {
                params.set('dataSourceId', String(dataSourceId))
            }
            const res = await useAppFetch<{ success: boolean; data: any }>(
                `${baseUrl()}/ga4/overview/${projectId}?${params.toString()}`,
                { headers: authHeaders() },
            )
            return res.data
        } catch (error) {
            console.error('[useGA4Overview] overview error:', error)
            return null
        }
    }

    return { getOverview }
}
