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
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        const data = await response.json();
        setSitemapEntries(data);
    }

    async function addSitemapEntry(url: string, publishStatus: string, priority: number) {
        const token = getAuthToken();
        if (!token) {
            return false;
        }
        const apiUrl = `${baseUrl()}/admin/sitemap/add`;
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
            body: JSON.stringify({
                url,
                publish_status: publishStatus,
                priority
            }),
        });
        const data = await response.json();
        if (response.ok) {
            await retrieveSitemapEntries();
            return true;
        }
        return false;
    }

    async function editSitemapEntry(entryId: number, url: string, priority: number) {
        const token = getAuthToken();
        if (!token) {
            return false;
        }
        const apiUrl = `${baseUrl()}/admin/sitemap/edit`;
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
            body: JSON.stringify({
                entry_id: entryId,
                url,
                priority
            }),
        });
        const data = await response.json();
        if (response.ok) {
            await retrieveSitemapEntries();
            return true;
        }
        return false;
    }

    async function publishEntry(entryId: number) {
        const token = getAuthToken();
        if (!token) {
            return false;
        }
        const url = `${baseUrl()}/admin/sitemap/publish/${entryId}`;
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        if (response.ok) {
            await retrieveSitemapEntries();
            return true;
        }
        return false;
    }

    async function unpublishEntry(entryId: number) {
        const token = getAuthToken();
        if (!token) {
            return false;
        }
        const url = `${baseUrl()}/admin/sitemap/unpublish/${entryId}`;
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        if (response.ok) {
            await retrieveSitemapEntries();
            return true;
        }
        return false;
    }

    async function deleteEntry(entryId: number) {
        const token = getAuthToken();
        if (!token) {
            return false;
        }
        const url = `${baseUrl()}/admin/sitemap/delete/${entryId}`;
        const response = await fetch(url, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        if (response.ok) {
            await retrieveSitemapEntries();
            return true;
        }
        return false;
    }

    async function reorderEntries(entryIds: number[]) {
        const token = getAuthToken();
        if (!token) {
            return false;
        }
        const url = `${baseUrl()}/admin/sitemap/reorder`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
            body: JSON.stringify({
                entry_ids: entryIds
            }),
        });
        if (response.ok) {
            await retrieveSitemapEntries();
            return true;
        }
        return false;
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
