import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAppFetch } from '@/composables/useAppFetch'
import { baseUrl } from '~/composables/Utils'
import { getAuthToken } from '~/composables/AuthToken'

export interface IFunnelCondition {
    field: 'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_term' | 'utm_content'
    operator: 'equals' | 'contains' | 'starts_with' | 'regex'
    value: string
}

export interface IFunnelStep {
    name: string
    order: number
    match_type: 'all' | 'any'
    conditions: IFunnelCondition[]
}

export interface IFunnel {
    id: number
    project_id: number
    name: string
    steps: IFunnelStep[]
    last_analyzed_at: string | null
    conversion_rate: number | null
    created_at: string
    updated_at: string
}

export interface IFunnelCreatePayload {
    project_id: number
    name: string
    steps: IFunnelStep[]
}

export const useFunnelStore = defineStore('funnel', () => {
    const funnels = ref<IFunnel[]>([])
    const isLoading = ref(false)
    const error = ref<string | null>(null)

    const funnelMap = computed(() => {
        const map = new Map<number, IFunnel>()
        for (const f of funnels.value) {
            map.set(f.id, f)
        }
        return map
    })

    function getFunnelById(id: number): IFunnel | undefined {
        return funnelMap.value.get(id)
    }

    async function fetchFunnels(projectId: number) {
        isLoading.value = true
        error.value = null
        try {
            const token = getAuthToken()
            const response = await useAppFetch<{ success: boolean; data: IFunnel[] }>(
                `${baseUrl()}/funnels?projectId=${projectId}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Authorization-Type': 'auth',
                    },
                },
            )
            funnels.value = response?.data ?? []
        } catch (err: any) {
            error.value = err?.message || 'Failed to load funnels'
            funnels.value = []
        } finally {
            isLoading.value = false
        }
    }

    async function createFunnel(projectId: number, payload: IFunnelCreatePayload): Promise<IFunnel | null> {
        isLoading.value = true
        error.value = null
        try {
            const token = getAuthToken()
            const response = await useAppFetch<{ success: boolean; data: IFunnel }>(
                `${baseUrl()}/funnels`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Authorization-Type': 'auth',
                        'Content-Type': 'application/json',
                    },
                    body: payload,
                },
            )
            if (response?.data) {
                funnels.value.push(response.data)
                return response.data
            }
            return null
        } catch (err: any) {
            error.value = err?.message || 'Failed to create funnel'
            return null
        } finally {
            isLoading.value = false
        }
    }

    async function updateFunnel(id: number, payload: Partial<IFunnelCreatePayload>): Promise<boolean> {
        isLoading.value = true
        error.value = null
        try {
            const token = getAuthToken()
            const response = await useAppFetch<{ success: boolean; data: IFunnel }>(
                `${baseUrl()}/funnels/${id}`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Authorization-Type': 'auth',
                        'Content-Type': 'application/json',
                    },
                    body: payload,
                },
            )
            if (response?.data) {
                const idx = funnels.value.findIndex(f => f.id === id)
                if (idx !== -1) funnels.value[idx] = response.data
                return true
            }
            return false
        } catch (err: any) {
            error.value = err?.message || 'Failed to update funnel'
            return false
        } finally {
            isLoading.value = false
        }
    }

    async function deleteFunnel(id: number): Promise<boolean> {
        isLoading.value = true
        error.value = null
        try {
            const token = getAuthToken()
            const response = await useAppFetch<{ success: boolean }>(
                `${baseUrl()}/funnels/${id}`,
                {
                    method: 'DELETE',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Authorization-Type': 'auth',
                    },
                },
            )
            if (response?.success) {
                funnels.value = funnels.value.filter(f => f.id !== id)
                return true
            }
            return false
        } catch (err: any) {
            error.value = err?.message || 'Failed to delete funnel'
            return false
        } finally {
            isLoading.value = false
        }
    }

    async function previewStageMatch(projectId: number, stage: { name: string; conditions: { field: string; operator: string; value: string }[] }): Promise<{ estimatedMatches: number } | null> {
        try {
            const token = getAuthToken()
            const response = await useAppFetch<{ success: boolean; data: { estimatedMatches: number } }>(
                `${baseUrl()}/funnels/preview-stage`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Authorization-Type': 'auth',
                        'Content-Type': 'application/json',
                    },
                    body: { project_id: projectId, stage },
                },
            )
            return response?.data ?? null
        } catch {
            return null
        }
    }

    return {
        funnels,
        isLoading,
        error,
        getFunnelById,
        fetchFunnels,
        createFunnel,
        updateFunnel,
        deleteFunnel,
        previewStageMatch,
    }
})
