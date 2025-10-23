import {defineStore} from 'pinia'
import type { IPrivateBetaUser } from '~/types/IPrivateBetaUser';
export const usePrivateBetaUserStore = defineStore('privateBetaUserStore', () => {
    const privateBetaUsers = ref<IPrivateBetaUser[]>([]);

    if (localStorage.getItem('privateBetaUsers')) {
        privateBetaUsers.value = JSON.parse(localStorage.getItem('privateBetaUsers') || 'null') || [];
    }
    function setPrivateBetaUsers(usersList: IPrivateBetaUser[]) {
        privateBetaUsers.value = usersList;
        localStorage.setItem('privateBetaUsers', JSON.stringify(usersList));
    }
    function getPrivateBetaUsers() {
        return privateBetaUsers.value;
    }
    function clearPrivateBetaUsers() {
        privateBetaUsers.value = [];
        localStorage.removeItem('privateBetaUsers');
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
