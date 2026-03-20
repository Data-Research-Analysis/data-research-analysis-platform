import {defineStore} from 'pinia'
import type { IUsersPlatform } from '~/types/IUsersPlatform';
export const useLoggedInUserStore = defineStore('loggedInUserDRA', () => {
    const loggedInUser = ref<IUsersPlatform>()

    function setLoggedInUser(user: IUsersPlatform) {
        loggedInUser.value = user;
        // Only update localStorage on client side
        if (import.meta.client) {
            try {
                localStorage.setItem('loggedInUser', JSON.stringify(user));
                enableRefreshDataFlag('setLoggedInUser');
            } catch (error: any) {
                if (error.name === 'QuotaExceededError') {
                    console.warn('[LoggedInUserStore] localStorage quota exceeded for user.');
                    enableRefreshDataFlag('setLoggedInUser');
                } else {
                    console.error('[LoggedInUserStore] Error saving user to localStorage:', error);
                }
            }
        }
    }
    
    function getLoggedInUser() {
        // If value is undefined and we're on client, try loading from localStorage as fallback
        if (!loggedInUser.value && import.meta.client) {
            const stored = localStorage.getItem('loggedInUser');
            if (stored && stored !== 'null' && stored !== 'undefined') {
                try {
                    loggedInUser.value = JSON.parse(stored);
                } catch (error) {
                    console.error('Error parsing stored user data:', error);
                    localStorage.removeItem('loggedInUser');
                }
            }
        }
        return loggedInUser.value;
    }
    
    function clearUserPlatform() {
        loggedInUser.value = undefined;
        // Only update localStorage on client side
        if (import.meta.client) {
            localStorage.removeItem('loggedInUser');
            enableRefreshDataFlag('clearUserPlatform');
        }
    }
    
    async function retrieveLoggedInUser() {
        const token = getAuthToken();
        if (!token) return;
        
        try {
            const config = useRuntimeConfig();
            const response = await $fetch<IUsersPlatform>(
                `${config.public.apiBase}/auth/me`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Authorization-Type': 'auth'
                    }
                }
            );
            
            if (response) {
                // Keep the token from the existing user or the current token
                const existingUser = getLoggedInUser();
                const userWithToken = {
                    ...response,
                    token: existingUser?.token || token
                };
                setLoggedInUser(userWithToken);
            }
        } catch (error) {
            console.error('[LoggedInUserStore] Error fetching user data:', error);
        }
    }
    
    return {
        loggedInUser,
        setLoggedInUser,
        getLoggedInUser,
        clearUserPlatform,
        retrieveLoggedInUser,
    }
});
