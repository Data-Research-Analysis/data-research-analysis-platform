import {defineStore} from 'pinia'
import type { IUserManagement } from '~/types/IUserManagement';

export const useUserManagementStore = defineStore('userManagementStore', () => {
    const users = ref<IUserManagement[]>([]);
    const selectedUser = ref<IUserManagement | null>(null);

    function setUsers(usersList: IUserManagement[]) {
        users.value = usersList;
        if (import.meta.client) {
            localStorage.setItem('userManagementUsers', JSON.stringify(usersList));
            enableRefreshDataFlag('setUsers');
        }
    }

    function setSelectedUser(user: IUserManagement) {
        selectedUser.value = user;
        if (import.meta.client) {
            localStorage.setItem('selectedUserManagement', JSON.stringify(user));
        }
    }

    function getUsers() {
        if (import.meta.client && localStorage.getItem('userManagementUsers')) {
            users.value = JSON.parse(localStorage.getItem('userManagementUsers') || 'null') || [];
        }
        return users.value;
    }

    function getSelectedUser() {
        if (import.meta.client &&localStorage.getItem('selectedUserManagement')) {
            selectedUser.value = JSON.parse(localStorage.getItem('selectedUserManagement') || 'null');
        }
        return selectedUser.value;
    }

    function clearUsers() {
        users.value = [];
        if (import.meta.client) {
            localStorage.removeItem('userManagementUsers');
            localStorage.setItem('refreshData', 'true');
        }
    }

    function clearSelectedUser() {
        selectedUser.value = null;
        if (import.meta.client) {
            localStorage.removeItem('selectedUserManagement');
        }
    }

    async function retrieveUsers() {
        const token = getAuthToken();
        if (!token) {
            setUsers([]);
            return;
        }
        const url = `${baseUrl()}/admin/users/list`;
        const data = await $fetch(url, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        setUsers(data);
    }

    async function retrieveUserById(userId: number) {
        const token = getAuthToken();
        if (!token) {
            return null;
        }
        const url = `${baseUrl()}/admin/users/${userId}`;
        try {
            const data = await $fetch(url, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
            });
            setSelectedUser(data);
            return data;
        } catch (error) {
            return null;
        }
    }

    async function updateUser(userId: number, userData: any) {
        const token = getAuthToken();
        if (!token) {
            return false;
        }
        const url = `${baseUrl()}/admin/users/${userId}`;
        try {
            await $fetch(url, {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body: userData,
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async function changeUserType(userId: number, userType: string) {
        const token = getAuthToken();
        if (!token) {
            return false;
        }
        const url = `${baseUrl()}/admin/users/${userId}/change-type`;
        try {
            await $fetch(url, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body: { user_type: userType },
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async function toggleEmailVerification(userId: number) {
        const token = getAuthToken();
        if (!token) {
            return false;
        }
        const url = `${baseUrl()}/admin/users/${userId}/toggle-email-verification`;
        try {
            await $fetch(url, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async function createUser(userData: any) {
        const token = getAuthToken();
        if (!token) {
            return { success: false, message: 'No authentication token' };
        }
        const url = `${baseUrl()}/admin/users`;
        try {
            const data = await $fetch(url, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body: userData,
            });
            return { success: true, user: data.user, message: data.message };
        } catch (error: any) {
            return { success: false, message: error.data?.message || 'Failed to create user' };
        }
    }

    async function deleteUser(userId: number) {
        const token = getAuthToken();
        if (!token) {
            return false;
        }
        const url = `${baseUrl()}/admin/users/${userId}`;
        try {
            await $fetch(url, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async function getPrivateBetaUserForConversion(betaUserId: number) {
        const token = getAuthToken();
        if (!token) {
            return { success: false, message: 'Not authenticated' };
        }
        
        const url = `${baseUrl()}/admin/users/convert/${betaUserId}`;
        try {
            const betaUser = await $fetch(url, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
            });
            return { success: true, betaUser };
        } catch (error: any) {
            return { success: false, message: error.data?.message || 'Failed to fetch beta user data' };
        }
    }

    async function fetchUserSubscription(userId: number) {
        const token = getAuthToken();
        if (!token) {
            return null;
        }
        const url = `${baseUrl()}/admin/users/${userId}/subscription`;
        try {
            const result = await $fetch(url, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
            });
            return result.data;
        } catch (error) {
            console.error('Error fetching user subscription:', error);
            return null;
        }
    }

    async function updateUserSubscription(userId: number, tierId: number, endsAt?: string) {
        const token = getAuthToken();
        if (!token) {
            return { success: false, message: 'Not authenticated' };
        }
        const url = `${baseUrl()}/admin/users/${userId}/subscription`;
        try {
            const body: any = { tier_id: tierId };
            if (endsAt) {
                body.ends_at = endsAt;
            }
            const result = await $fetch(url, {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body,
            });
            return { success: true, data: result.data };
        } catch (error: any) {
            console.error('Error updating user subscription:', error);
            return { success: false, message: error.data?.message || error.message || 'Error updating subscription' };
        }
    }

    async function getAvailableTiers(userId: number) {
        const token = getAuthToken();
        if (!token) {
            return [];
        }
        const url = `${baseUrl()}/admin/users/${userId}/available-tiers`;
        try {
            const result = await $fetch(url, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
            });
            return result.data || [];
        } catch (error) {
            console.error('Error fetching available tiers:', error);
            return [];
        }
    }

    return {
        users,
        selectedUser,
        setUsers,
        setSelectedUser,
        getUsers,
        getSelectedUser,
        clearUsers,
        clearSelectedUser,
        retrieveUsers,
        retrieveUserById,
        updateUser,
        changeUserType,
        toggleEmailVerification,
        createUser,
        deleteUser,
        getPrivateBetaUserForConversion,
        fetchUserSubscription,
        updateUserSubscription,
        getAvailableTiers,
    }
});