/**
 * Composable for managing the authentication token saved in the browser cookie
 * @param token 
 */
import { useLoggedInUserStore } from "@/stores/logged_in_user";
export function setAuthToken(token: string) {
    const d = new Date();
    d.setTime(d.getTime() + (3 * 24 * 60 * 60 * 1000));//expire in 3 days
    document.cookie = `dra_auth_token=${token}; expires=${d.toUTCString()}; path=/; samesite=strict;`;
}
export function getAuthToken() {
    const cookies = document.cookie.split(';')
    return cookies.find(cookie => {
        if (cookie.split('=')[0].includes('dra_auth_token')) {
            return cookie;
        }
    })?.split('=')[1]
}
export function deleteAuthToken() {
    const loggedInUserStore = useLoggedInUserStore();
    loggedInUserStore.clearUserPlatform();
    document.cookie = "dra_auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    localStorage.clear();

}
export function isAuthenticated() {
    return getAuthToken() ? true : false;
}
