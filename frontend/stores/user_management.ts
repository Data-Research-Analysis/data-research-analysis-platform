import {defineStore} from 'pinia'
import type { IUserManagement } from '~/types/IUserManagement';

export const useUserManagementStore = defineStore('userManagementStore', () => {
    const users = ref<IUserManagement[]>([]);
    const selectedUser = ref<IUserManagement | null>(null);

    // Only access localStorage on client side
    if (import.meta.client) {
        if (localStorage.getItem('userManagementUsers')) {
            users.value = JSON.parse(localStorage.getItem('userManagementUsers') || 'null') || [];
        }
        if (localStorage.getItem('selectedUserManagement')) {
            selectedUser.value = JSON.parse(localStorage.getItem('selectedUserManagement') || 'null');
        }
    }

    function setUsers(usersList: IUserManagement[]) {
        users.value = usersList;
        if (import.meta.client) {
            localStorage.setItem('userManagementUsers', JSON.stringify(usersList));
        }
    }

    function setSelectedUser(user: IUserManagement) {
        selectedUser.value = user;
        if (import.meta.client) {
            localStorage.setItem('selectedUserManagement', JSON.stringify(user));
        }
    }

    function getUsers() {
        return users.value;
    }

    function getSelectedUser() {
        return selectedUser.value;
    }

    function clearUsers() {
        users.value = [];
        if (import.meta.client) {
            localStorage.removeItem('userManagementUsers');
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
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        const data = await response.json();
        setUsers(data);
    }

    async function retrieveUserById(userId: number) {
        const token = getAuthToken();
        if (!token) {
            return null;
        }
        const url = `${baseUrl()}/admin/users/${userId}`;
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        if (response.status === 200) {
            const data = await response.json();
            setSelectedUser(data);
            return data;
        }
        return null;
    }

    async function updateUser(userId: number, userData: any) {
        const token = getAuthToken();
        if (!token) {
            return false;
        }
        const url = `${baseUrl()}/admin/users/${userId}`;
        const response = await fetch(url, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
            body: JSON.stringify(userData),
        });
        return response.status === 200;
    }

    async function changeUserType(userId: number, userType: string) {
        const token = getAuthToken();
        if (!token) {
            return false;
        }
        const url = `${baseUrl()}/admin/users/${userId}/change-type`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
            body: JSON.stringify({ user_type: userType }),
        });
        return response.status === 200;
    }

    async function toggleEmailVerification(userId: number) {
        const token = getAuthToken();
        if (!token) {
            return false;
        }
        const url = `${baseUrl()}/admin/users/${userId}/toggle-email-verification`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        return response.status === 200;
    }

    async function createUser(userData: any) {
        const token = getAuthToken();
        if (!token) {
            return { success: false, message: 'No authentication token' };
        }
        const url = `${baseUrl()}/admin/users`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
            body: JSON.stringify(userData),
        });
        
        if (response.status === 201) {
            const data = await response.json();
            return { success: true, user: data.user, message: data.message };
        } else {
            const errorData = await response.json();
            return { success: false, message: errorData.message || 'Failed to create user' };
        }
    }

    async function deleteUser(userId: number) {
        const token = getAuthToken();
        if (!token) {
            return false;
        }
        const url = `${baseUrl()}/admin/users/${userId}`;
        const response = await fetch(url, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        return response.status === 200;
    }

    async function getPrivateBetaUserForConversion(betaUserId: number) {
        const token = getAuthToken();
        if (!token) {
            return { success: false, message: 'Not authenticated' };
        }
        
        const url = `${baseUrl()}/admin/users/convert/${betaUserId}`;
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        
        if (response.status === 200) {
            const betaUser = await response.json();
            return { success: true, betaUser };
        } else {
            const errorData = await response.json();
            return { success: false, message: errorData.message || 'Failed to fetch beta user data' };
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
    }
});