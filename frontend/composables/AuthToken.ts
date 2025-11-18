/**
 * Composable for managing the authentication token saved in the browser cookie
 * @param token 
 */
import { useLoggedInUserStore } from "@/stores/logged_in_user";

export function setAuthToken(token: string) {
    // Use Nuxt's useCookie for SSR compatibility
    const authCookie = useCookie('dra_auth_token', {
        maxAge: 3 * 24 * 60 * 60, // 3 days in seconds
        path: '/',
        sameSite: 'strict'
    });
    authCookie.value = token;
}

export function getAuthToken() {
    // Use Nuxt's useCookie for SSR compatibility
    const authCookie = useCookie('dra_auth_token');
    return authCookie.value || undefined;
}

export function deleteAuthToken() {
    const loggedInUserStore = useLoggedInUserStore();
    loggedInUserStore.clearUserPlatform();
    
    // Clear cookie using Nuxt's useCookie
    const authCookie = useCookie('dra_auth_token');
    authCookie.value = null;
    
    // Clear localStorage only on client side
    if (import.meta.client) {
        localStorage.clear();
    }
}

export function isAuthenticated() {
    return getAuthToken() ? true : false;
}
