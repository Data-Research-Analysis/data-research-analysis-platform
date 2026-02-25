import { defineStore } from 'pinia';
import type {
    ICampaign,
    ICreateCampaignPayload,
    IUpdateCampaignPayload,
    IAddChannelPayload,
    ICampaignChannel,
    IOfflineDataEntry,
    IOfflineDataEntryPayload,
    IOfflineCampaignSummary,
} from '~/types/ICampaign';

let campaignsInitialized = false;

export const useCampaignsStore = defineStore('campaignsDRA', () => {
    const campaigns = ref<ICampaign[]>([]);
    const selectedCampaign = ref<ICampaign | null>(null);

    function setCampaigns(list: ICampaign[]) {
        campaigns.value = list;
        if (import.meta.client) {
            localStorage.setItem('campaigns', JSON.stringify(list));
            enableRefreshDataFlag('setCampaigns');
        }
    }

    function setSelectedCampaign(campaign: ICampaign | null) {
        selectedCampaign.value = campaign;
        if (import.meta.client) {
            localStorage.setItem('selectedCampaign', JSON.stringify(campaign));
        }
    }

    function getCampaigns(): ICampaign[] {
        if (import.meta.client && localStorage.getItem('campaigns')) {
            campaigns.value = JSON.parse(localStorage.getItem('campaigns') || '[]');
        }
        return campaigns.value;
    }

    function getSelectedCampaign(): ICampaign | null {
        if (import.meta.client && localStorage.getItem('selectedCampaign')) {
            selectedCampaign.value = JSON.parse(localStorage.getItem('selectedCampaign') || 'null');
        }
        return selectedCampaign.value;
    }

    function clearCampaigns() {
        campaigns.value = [];
        if (import.meta.client) {
            localStorage.removeItem('campaigns');
            enableRefreshDataFlag('clearCampaigns');
        }
    }

    function clearSelectedCampaign() {
        selectedCampaign.value = null;
        if (import.meta.client) {
            localStorage.removeItem('selectedCampaign');
        }
    }

    async function retrieveCampaigns(projectId: number): Promise<void> {
        const token = getAuthToken();
        if (!token) {
            campaigns.value = [];
            return;
        }
        const data = await $fetch(`${baseUrl()}/campaigns/project/${projectId}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Authorization-Type': 'auth',
            },
        }) as ICampaign[];
        setCampaigns(data);
    }

    async function retrieveCampaignById(campaignId: number): Promise<ICampaign | null> {
        const token = getAuthToken();
        if (!token) return null;
        const data = await $fetch(`${baseUrl()}/campaigns/${campaignId}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Authorization-Type': 'auth',
            },
        }) as ICampaign;
        setSelectedCampaign(data);
        return data;
    }

    async function createCampaign(payload: ICreateCampaignPayload): Promise<ICampaign> {
        const token = getAuthToken();
        if (!token) throw new Error('Not authenticated');
        const campaign = await $fetch(`${baseUrl()}/campaigns`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Authorization-Type': 'auth',
            },
            body: payload,
        }) as ICampaign;
        campaigns.value = [campaign, ...campaigns.value];
        if (import.meta.client) {
            localStorage.setItem('campaigns', JSON.stringify(campaigns.value));
            enableRefreshDataFlag('createCampaign');
        }
        return campaign;
    }

    async function updateCampaign(
        campaignId: number,
        payload: IUpdateCampaignPayload,
    ): Promise<ICampaign | null> {
        const token = getAuthToken();
        if (!token) return null;
        const updated = await $fetch(`${baseUrl()}/campaigns/${campaignId}`, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${token}`,
                'Authorization-Type': 'auth',
            },
            body: payload,
        }) as ICampaign;
        const idx = campaigns.value.findIndex((c) => c.id === campaignId);
        if (idx !== -1) campaigns.value[idx] = updated;
        if (selectedCampaign.value?.id === campaignId) selectedCampaign.value = updated;
        if (import.meta.client) {
            localStorage.setItem('campaigns', JSON.stringify(campaigns.value));
            localStorage.setItem('selectedCampaign', JSON.stringify(selectedCampaign.value));
        }
        return updated;
    }

    async function updateCampaignStatus(campaignId: number, status: string): Promise<void> {
        const token = getAuthToken();
        if (!token) return;
        await $fetch(`${baseUrl()}/campaigns/${campaignId}/status`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${token}`,
                'Authorization-Type': 'auth',
            },
            body: { status },
        });
        const idx = campaigns.value.findIndex((c) => c.id === campaignId);
        if (idx !== -1) campaigns.value[idx].status = status;
        if (selectedCampaign.value?.id === campaignId) selectedCampaign.value.status = status;
        if (import.meta.client) {
            localStorage.setItem('campaigns', JSON.stringify(campaigns.value));
            localStorage.setItem('selectedCampaign', JSON.stringify(selectedCampaign.value));
        }
    }

    async function deleteCampaign(campaignId: number): Promise<void> {
        const token = getAuthToken();
        if (!token) return;
        await $fetch(`${baseUrl()}/campaigns/${campaignId}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${token}`,
                'Authorization-Type': 'auth',
            },
        });
        campaigns.value = campaigns.value.filter((c) => c.id !== campaignId);
        if (selectedCampaign.value?.id === campaignId) selectedCampaign.value = null;
        if (import.meta.client) {
            localStorage.setItem('campaigns', JSON.stringify(campaigns.value));
            localStorage.removeItem('selectedCampaign');
            enableRefreshDataFlag('deleteCampaign');
        }
    }

    async function addChannel(
        campaignId: number,
        channelData: IAddChannelPayload,
    ): Promise<ICampaignChannel> {
        const token = getAuthToken();
        if (!token) throw new Error('Not authenticated');
        const channel = await $fetch(`${baseUrl()}/campaigns/${campaignId}/channels`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Authorization-Type': 'auth',
            },
            body: channelData,
        }) as ICampaignChannel;
        const idx = campaigns.value.findIndex((c) => c.id === campaignId);
        if (idx !== -1) campaigns.value[idx].channels = [...(campaigns.value[idx].channels || []), channel];
        if (selectedCampaign.value?.id === campaignId) {
            selectedCampaign.value.channels = [...(selectedCampaign.value.channels || []), channel];
        }
        if (import.meta.client) {
            localStorage.setItem('campaigns', JSON.stringify(campaigns.value));
            localStorage.setItem('selectedCampaign', JSON.stringify(selectedCampaign.value));
        }
        return channel;
    }

    async function removeChannel(channelId: number): Promise<void> {
        const token = getAuthToken();
        if (!token) return;
        await $fetch(`${baseUrl()}/campaigns/channels/${channelId}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${token}`,
                'Authorization-Type': 'auth',
            },
        });
        campaigns.value = campaigns.value.map((c) => ({
            ...c,
            channels: (c.channels || []).filter((ch) => ch.id !== channelId),
        }));
        if (selectedCampaign.value) {
            selectedCampaign.value.channels = (selectedCampaign.value.channels || []).filter(
                (ch) => ch.id !== channelId,
            );
        }
        if (import.meta.client) {
            localStorage.setItem('campaigns', JSON.stringify(campaigns.value));
            localStorage.setItem('selectedCampaign', JSON.stringify(selectedCampaign.value));
        }
    }

    // Computed: campaigns count for a given project (used by sidebar badge)
    function projectCampaignsCount(projectId: number): number {
        return campaigns.value.filter((c) => c.project_id === projectId).length;
    }

    // -------------------------------------------------------------------------
    // Offline tracking
    // -------------------------------------------------------------------------

    const offlineSummaryCache = ref<Record<number, IOfflineCampaignSummary>>({});

    async function retrieveOfflineSummary(campaignId: number): Promise<IOfflineCampaignSummary> {
        const token = getAuthToken();
        if (!token) throw new Error('Not authenticated');
        const data = await $fetch(`${baseUrl()}/campaigns/${campaignId}/offline/summary`, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Authorization-Type': 'auth',
            },
        }) as IOfflineCampaignSummary;
        offlineSummaryCache.value[campaignId] = data;
        return data;
    }

    async function retrieveOfflineEntriesForChannel(channelId: number): Promise<IOfflineDataEntry[]> {
        const token = getAuthToken();
        if (!token) throw new Error('Not authenticated');
        return await $fetch(`${baseUrl()}/campaigns/channels/${channelId}/offline`, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Authorization-Type': 'auth',
            },
        }) as IOfflineDataEntry[];
    }

    async function addOfflineEntry(channelId: number, payload: IOfflineDataEntryPayload): Promise<IOfflineDataEntry> {
        const token = getAuthToken();
        if (!token) throw new Error('Not authenticated');
        return await $fetch(`${baseUrl()}/campaigns/channels/${channelId}/offline`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Authorization-Type': 'auth',
            },
            body: payload,
        }) as IOfflineDataEntry;
    }

    async function updateOfflineEntry(entryId: number, payload: Partial<IOfflineDataEntryPayload>): Promise<IOfflineDataEntry> {
        const token = getAuthToken();
        if (!token) throw new Error('Not authenticated');
        return await $fetch(`${baseUrl()}/campaigns/offline/${entryId}`, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${token}`,
                'Authorization-Type': 'auth',
            },
            body: payload,
        }) as IOfflineDataEntry;
    }

    async function deleteOfflineEntry(entryId: number): Promise<void> {
        const token = getAuthToken();
        if (!token) return;
        await $fetch(`${baseUrl()}/campaigns/offline/${entryId}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${token}`,
                'Authorization-Type': 'auth',
            },
        });
    }

    function clearOfflineSummaryCache(campaignId?: number) {
        if (campaignId !== undefined) {
            delete offlineSummaryCache.value[campaignId];
        } else {
            offlineSummaryCache.value = {};
        }
    }

    // Hydrate from localStorage on client (run once)
    if (import.meta.client && !campaignsInitialized && localStorage.getItem('campaigns')) {
        campaigns.value = JSON.parse(localStorage.getItem('campaigns') || '[]');
        campaignsInitialized = true;
    }

    return {
        campaigns,
        selectedCampaign,
        setCampaigns,
        setSelectedCampaign,
        getCampaigns,
        getSelectedCampaign,
        clearCampaigns,
        clearSelectedCampaign,
        retrieveCampaigns,
        retrieveCampaignById,
        createCampaign,
        updateCampaign,
        updateCampaignStatus,
        deleteCampaign,
        addChannel,
        removeChannel,
        projectCampaignsCount,
        offlineSummaryCache,
        retrieveOfflineSummary,
        retrieveOfflineEntriesForChannel,
        addOfflineEntry,
        updateOfflineEntry,
        deleteOfflineEntry,
        clearOfflineSummaryCache,
    };
});
