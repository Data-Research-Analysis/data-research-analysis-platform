import {defineStore} from 'pinia'
import type { IPrivateBetaUser } from '~/types/IPrivateBetaUser';
export const usePrivateBetaUserStore = defineStore('privateBetaUserStore', () => {
    const privateBetaUsers = ref<IPrivateBetaUser[]>([]);

    function setPrivateBetaUsers(usersList: IPrivateBetaUser[]) {
        privateBetaUsers.value = usersList;
        if (import.meta.client) {
            localStorage.setItem('privateBetaUsers', JSON.stringify(usersList));
            enableRefreshDataFlag('setPrivateBetaUsers');
        }
    }
    function getPrivateBetaUsers() {
        if (import.meta.client && localStorage.getItem('privateBetaUsers')) {
            privateBetaUsers.value = JSON.parse(localStorage.getItem('privateBetaUsers') || 'null') || [];
        }
        return privateBetaUsers.value;
    }
    function clearPrivateBetaUsers() {
        privateBetaUsers.value = [];
        if (import.meta.client) {
            localStorage.removeItem('privateBetaUsers');
            enableRefreshDataFlag('clearPrivateBetaUsers');
        }
    }
    async function retrievePrivateBetaUsers() {
        const token = getAuthToken();
        if (!token) {
            setPrivateBetaUsers([]);
            return;
        }
        const url = `${baseUrl()}/admin/private-beta-users/list`;
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        const data = await response.json();
        setPrivateBetaUsers(data);
    }
    return {
        privateBetaUsers,
        setPrivateBetaUsers,
        getPrivateBetaUsers,
        clearPrivateBetaUsers,
        retrievePrivateBetaUsers,
    }
});
