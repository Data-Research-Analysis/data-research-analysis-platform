import {defineStore} from 'pinia'
import type { ISitemapEntry } from '~/types/ISitemapEntry';

export const useSitemapStore = defineStore('sitemapDRA', () => {
    const sitemapEntries = ref<ISitemapEntry[]>([]);
    const selectedEntry = ref<ISitemapEntry>();

    function setSitemapEntries(entries: ISitemapEntry[]) {
        sitemapEntries.value = entries;
        if (import.meta.client) {
            localStorage.setItem('sitemapEntries', JSON.stringify(entries));
            enableRefreshDataFlag('setSitemapEntries');
        }
    }

    function setSelectedEntry(entry: ISitemapEntry) {
        selectedEntry.value = entry;
        if (import.meta.client) {
            localStorage.setItem('selectedSitemapEntry', JSON.stringify(entry));
        }
    }

    function getSitemapEntries() {
        if (import.meta.client && localStorage.getItem('sitemapEntries')) {
            sitemapEntries.value = JSON.parse(localStorage.getItem('sitemapEntries') || 'null') || [];
        }
        return sitemapEntries.value;
    }

    function getSelectedEntry() {
        if (import.meta.client && localStorage.getItem('selectedSitemapEntry')) {
            selectedEntry.value = JSON.parse(localStorage.getItem('selectedSitemapEntry') || 'null');
        }
        return selectedEntry.value;
    }

    function clearSitemapEntries() {
        sitemapEntries.value = [];
        if (import.meta.client) {
            localStorage.removeItem('sitemapEntries');
            enableRefreshDataFlag('clearSitemapEntries');
        }
    }

    function clearSelectedEntry() {
        selectedEntry.value = undefined;
        if (import.meta.client) {
            localStorage.removeItem('selectedSitemapEntry');
        }
    }

    async function retrieveSitemapEntries() {
        const token = getAuthToken();
        if (!token) {
            setSitemapEntries([]);
            return;
        }
        const url = `${baseUrl()}/admin/sitemap/list`;
        const data = await $fetch(url, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        setSitemapEntries(data);
    }

    async function addSitemapEntry(url: string, publishStatus: string, priority: number) {
        const token = getAuthToken();
        if (!token) {
            return false;
        }
        const apiUrl = `${baseUrl()}/admin/sitemap/add`;
        await $fetch(apiUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
            body: {
                url,
                publish_status: publishStatus,
                priority
            },
        });
        await retrieveSitemapEntries();
        return true;
    }

    async function editSitemapEntry(entryId: number, url: string, priority: number) {
        const token = getAuthToken();
        if (!token) {
            return false;
        }
        const apiUrl = `${baseUrl()}/admin/sitemap/edit`;
        await $fetch(apiUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
            body: {
                entry_id: entryId,
                url,
                priority
            },
        });
        await retrieveSitemapEntries();
        return true;
    }

    async function publishEntry(entryId: number) {
        const token = getAuthToken();
        if (!token) {
            return false;
        }
        const url = `${baseUrl()}/admin/sitemap/publish/${entryId}`;
        await $fetch(url, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        await retrieveSitemapEntries();
        return true;
    }

    async function unpublishEntry(entryId: number) {
        const token = getAuthToken();
        if (!token) {
            return false;
        }
        const url = `${baseUrl()}/admin/sitemap/unpublish/${entryId}`;
        await $fetch(url, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        await retrieveSitemapEntries();
        return true;
    }

    async function deleteEntry(entryId: number) {
        const token = getAuthToken();
        if (!token) {
            return false;
        }
        const url = `${baseUrl()}/admin/sitemap/delete/${entryId}`;
        await $fetch(url, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        await retrieveSitemapEntries();
        return true;
    }

    async function reorderEntries(entryIds: number[]) {
        const token = getAuthToken();
        if (!token) {
            return false;
        }
        const url = `${baseUrl()}/admin/sitemap/reorder`;
        await $fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
            body: {
                entry_ids: entryIds
            },
        });
        await retrieveSitemapEntries();
        return true;
    }

    return {
        sitemapEntries,
        selectedEntry,
        setSitemapEntries,
        setSelectedEntry,
        getSitemapEntries,
        getSelectedEntry,
        clearSitemapEntries,
        clearSelectedEntry,
        retrieveSitemapEntries,
        addSitemapEntry,
        editSitemapEntry,
        publishEntry,
        unpublishEntry,
        deleteEntry,
        reorderEntries
    }
});
