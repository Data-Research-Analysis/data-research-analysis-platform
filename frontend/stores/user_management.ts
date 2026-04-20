import {defineStore} from 'pinia'
import type { IUserManagement } from '~/types/IUserManagement';

export const useUserManagementStore = defineStore('userManagementStore', () => {
    const users = ref<IUserManagement[]>([]);
    const selectedUser = ref<IUserManagement | null>(null);

    function setUsers(usersList: IUserManagement[]) {
        users.value = usersList;
        if (import.meta.client) {
            try {
                localStorage.setItem('userManagementUsers', JSON.stringify(usersList));
                enableRefreshDataFlag('setUsers');
            } catch (error: any) {
                if (error.name === 'QuotaExceededError') {
                    console.warn('[UserManagementStore] localStorage quota exceeded for users.');
                    enableRefreshDataFlag('setUsers');
                } else {
                    console.error('[UserManagementStore] Error saving users to localStorage:', error);
                }
            }
        }
    }

    function setSelectedUser(user: IUserManagement) {
        selectedUser.value = user;
        if (import.meta.client) {
            try {
                localStorage.setItem('selectedUserManagement', JSON.stringify(user));
            } catch (error: any) {
                if (error.name === 'QuotaExceededError') {
                    console.warn('[UserManagementStore] localStorage quota exceeded for selectedUser.');
                } else {
                    console.error('[UserManagementStore] Error saving selectedUser to localStorage:', error);
                }
            }
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
        setUsers(data as IUserManagement[]);
    }

    async function retrieveUserById(userId: number): Promise<IUserManagement | null> {
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
            setSelectedUser(data as IUserManagement);
            return data as IUserManagement;
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
            return { success: true, user: (data as any).user, message: (data as any).message };
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

    async function getEnterpriseQueryForConversion(betaUserId: number) {
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
            return { success: false, message: error.data?.message || 'Failed to fetch enterprise inquiry data' };
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
        getEnterpriseQueryForConversion,
    }
});