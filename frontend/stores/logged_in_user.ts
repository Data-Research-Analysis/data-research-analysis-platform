import {defineStore} from 'pinia'
import type { IUsersPlatform } from '~/types/IUsersPlatform';
export const useLoggedInUserStore = defineStore('loggedInUserDRA', () => {
    const loggedInUser = ref<IUsersPlatform>()

    // Only access localStorage on client side
    if (import.meta.client && localStorage.getItem('loggedInUser')) {
        loggedInUser.value = JSON.parse(localStorage.getItem('loggedInUser') || 'null');
    }
    
    function setLoggedInUser(user: IUsersPlatform) {
        console.log('setLoggedInUser called with user:', user);
        loggedInUser.value = user;
        // Only update localStorage on client side
        if (import.meta.client) {
            localStorage.setItem('loggedInUser', JSON.stringify(user));
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
        }
    }
    
    return {
        loggedInUser,
        setLoggedInUser,
        getLoggedInUser,
        clearUserPlatform,
    }
});
