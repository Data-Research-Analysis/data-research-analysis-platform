import { defineStore } from 'pinia';
import { baseUrl } from '~/composables/Utils';
import { getAuthToken } from '~/composables/AuthToken';
import { enableRefreshDataFlag } from '~/composables/Utils';

export interface IEmailPreferences {
    id?: number;
    user_id?: number;
    subscription_updates: boolean;
    expiration_warnings: boolean;
    renewal_reminders: boolean;
    promotional_emails: boolean;
    created_at?: string;
    updated_at?: string;
}

export const useEmailPreferencesStore = defineStore('emailPreferences', () => {
    const preferences = ref<IEmailPreferences | null>(null);
    const loading = ref(false);
    const error = ref<string | null>(null);

    function setPreferences(prefs: IEmailPreferences) {
        preferences.value = prefs;
        if (import.meta.client) {
            localStorage.setItem('emailPreferences', JSON.stringify(prefs));
            enableRefreshDataFlag('setEmailPreferences');
        }
    }

    function getPreferences() {
        if (import.meta.client && localStorage.getItem('emailPreferences')) {
            preferences.value = JSON.parse(localStorage.getItem('emailPreferences') || 'null');
        }
        return preferences.value;
    }

    async function fetchPreferences(): Promise<IEmailPreferences | null> {
        loading.value = true;
        error.value = null;
        try {
            const token = getAuthToken();
            if (!token) {
                throw new Error('No authentication token found');
            }

            const url = `${baseUrl()}/user/email-preferences`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch email preferences: ${response.statusText}`);
            }

            const data = await response.json();
            const prefs = data.data || data;
            setPreferences(prefs);
            return prefs;
        } catch (err: any) {
            error.value = err.message;
            console.error('Error fetching email preferences:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    async function updatePreferences(prefs: Partial<IEmailPreferences>): Promise<IEmailPreferences> {
        loading.value = true;
        error.value = null;
        try {
            const token = getAuthToken();
            if (!token) {
                throw new Error('No authentication token found');
            }

            const url = `${baseUrl()}/user/email-preferences`;
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
                body: JSON.stringify(prefs),
            });

            if (!response.ok) {
                throw new Error(`Failed to update email preferences: ${response.statusText}`);
            }

            const data = await response.json();
            const updatedPrefs = data.data || data;
            setPreferences(updatedPrefs);
            return updatedPrefs;
        } catch (err: any) {
            error.value = err.message;
            console.error('Error updating email preferences:', err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    function clearPreferences() {
        preferences.value = null;
        if (import.meta.client) {
            localStorage.removeItem('emailPreferences');
            enableRefreshDataFlag('clearEmailPreferences');
        }
    }

    return {
        preferences,
        loading,
        error,
        setPreferences,
        getPreferences,
        fetchPreferences,
        updatePreferences,
        clearPreferences,
    };
});
