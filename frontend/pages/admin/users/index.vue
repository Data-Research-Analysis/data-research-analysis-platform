<script setup>
import { NuxtLink } from '#components';
import { useUserManagementStore } from '@/stores/user_management';
const { $swal } = useNuxtApp();
const userManagementStore = useUserManagementStore();
const state = reactive({
    userSubscriptions: {},
    loadingSubscriptions: false,
});

const users = computed(() => [...userManagementStore.getUsers()].sort((a, b) => a.id - b.id));

async function loadUserSubscriptions() {
    state.loadingSubscriptions = true;
    for (const user of users.value) {
        const subscription = await userManagementStore.fetchUserSubscription(user.id);
        state.userSubscriptions[user.id] = subscription;
    }
    state.loadingSubscriptions = false;
}

function getUserSubscription(userId) {
    return state.userSubscriptions[userId];
}

function getTierBadgeClass(tierName) {
    if (!tierName) return 'bg-gray-100 text-gray-700';
    const name = tierName.toUpperCase();
    if (name === 'FREE') return 'bg-gray-100 text-gray-700';
    if (name === 'PRO') return 'bg-blue-100 text-blue-700';
    if (name === 'TEAM') return 'bg-green-100 text-green-700';
    if (name === 'BUSINESS') return 'bg-purple-100 text-purple-700';
    if (name === 'ENTERPRISE') return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-700';
}

onMounted(async () => {
    await userManagementStore.retrieveUsers();
    await loadUserSubscriptions();
});

async function deleteUser(userId) {
    const { value: confirmDelete } = await $swal.fire({
        title: "Are you sure you want to delete this user?",
        text: "You won't be able to revert this! All user data will be permanently removed.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3C8DBC",
        cancelButtonColor: "#DD4B39",
        confirmButtonText: "Yes, delete it!",
    });
    if (!confirmDelete) {
        return;
    }

    const success = await userManagementStore.deleteUser(userId);
    if (success) {
        $swal.fire({
            title: "Deleted!",
            text: "The user has been deleted successfully.",
            icon: "success",
            confirmButtonColor: "#3C8DBC",
        });
        await userManagementStore.retrieveUsers();
    } else {
        $swal.fire({
            title: "Error!",
            text: "There was an error deleting the user.",
            icon: "error",
            confirmButtonColor: "#3C8DBC",
        });
    }
}

async function changeUserType(userId, currentType) {
    const newType = currentType === 'admin' ? 'normal' : 'admin';
    const { value: confirmChange } = await $swal.fire({
        title: `Change user type to ${newType}?`,
        text: `This will change the user's privileges.`,
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#3C8DBC",
        cancelButtonColor: "#DD4B39",
        confirmButtonText: "Yes, change it!",
    });
    if (!confirmChange) {
        return;
    }

    const success = await userManagementStore.changeUserType(userId, newType);
    if (success) {
        $swal.fire({
            title: "Updated!",
            text: `User type changed to ${newType} successfully.`,
            icon: "success",
            confirmButtonColor: "#3C8DBC",
        });
        await userManagementStore.retrieveUsers();
    } else {
        $swal.fire({
            title: "Error!",
            text: "There was an error changing the user type.",
            icon: "error",
            confirmButtonColor: "#3C8DBC",
        });
    }
}

async function toggleEmailVerification(userId) {
    const success = await userManagementStore.toggleEmailVerification(userId);
    if (success) {
        $swal.fire({
            title: "Updated!",
            text: "Email verification status updated successfully.",
            icon: "success",
            confirmButtonColor: "#3C8DBC",
        });
        await userManagementStore.retrieveUsers();
    } else {
        $swal.fire({
            title: "Error!",
            text: "There was an error updating email verification status.",
            icon: "error",
            confirmButtonColor: "#3C8DBC",
        });
    }
}

function formatDate(dateString) {
    if (!dateString) return 'Not verified';
    return new Date(dateString).toLocaleDateString();
}
</script>
<template>
    <div class="flex flex-row">
        <sidebar-admin
            class="w-1/6"
        />
        <div class="w-5/6">
            <div class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md rounded-lg">
                <div class="flex flex-row justify-between items-center mb-5">
                    <div class="font-bold text-2xl">
                        User Management
                    </div>
                    <NuxtLink 
                        to="/admin/users/create"
                        class="text-sm px-4 py-2 bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md rounded-lg"
                    >
                        Add User
                    </NuxtLink>
                </div>
                <div class="bg-white shadow-md overflow-hidden rounded-lg ring-1 ring-gray-200 ring-inset">
                    <div class="overflow-x-auto">
                        <table v-if="users && users.length" class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User Type</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subscription</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email Verified</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                <tr v-for="user in users" :key="user.id" class="hover:bg-gray-50">
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {{ user.id }}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {{ user.first_name }} {{ user.last_name }}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {{ user.email }}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                                        <span :class="{'bg-red-100 text-red-800 px-2 py-1 rounded-lg text-xs font-medium': user.user_type === 'admin', 'bg-blue-100 text-blue-800 px-2 py-1 rounded-lg text-xs font-medium': user.user_type === 'normal'}">
                                            {{ user.user_type.toUpperCase() }}
                                        </span>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                                        <span v-if="state.loadingSubscriptions" class="text-gray-400 text-xs">
                                            Loading...
                                        </span>
                                        <span v-else-if="getUserSubscription(user.id)" :class="['px-2 py-1 rounded-lg text-xs font-medium', getTierBadgeClass(getUserSubscription(user.id)?.subscription_tier?.tier_name)]">
                                            {{ getUserSubscription(user.id)?.subscription_tier?.tier_name?.toUpperCase() || 'UNKNOWN' }}
                                        </span>
                                        <span v-else class="text-gray-400 text-xs">
                                            Not Assigned
                                        </span>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                                        <span :class="{'text-green-600 font-medium': user.email_verified_at, 'text-red-600 font-medium': !user.email_verified_at}">
                                            {{ formatDate(user.email_verified_at) }}
                                        </span>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div class="flex justify-end gap-2">
                                            <NuxtLink :to="`/admin/users/${user.id}`" class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-blue-100 hover:bg-blue-200 text-blue-700 hover:text-blue-900">
                                                <font-awesome icon="fas fa-edit" class="text-base" />
                                                <span>Edit</span>
                                            </NuxtLink>
                                            <button @click="changeUserType(user.id, user.user_type)" class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-yellow-100 hover:bg-yellow-200 text-yellow-700 hover:text-yellow-900">
                                                <font-awesome icon="fas fa-user-shield" class="text-base" />
                                                <span>{{ user.user_type === 'admin' ? 'Make Normal' : 'Make Admin' }}</span>
                                            </button>
                                            <button @click="toggleEmailVerification(user.id)" class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-purple-100 hover:bg-purple-200 text-purple-700 hover:text-purple-900">
                                                <font-awesome :icon="user.email_verified_at ? 'fas fa-envelope-open-text' : 'fas fa-envelope'" class="text-base" />
                                                <span>{{ user.email_verified_at ? 'Unverify Email' : 'Verify Email' }}</span>
                                            </button>
                                            <button @click="deleteUser(user.id)" class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-red-100 hover:bg-red-200 text-red-700 hover:text-red-900">
                                                <font-awesome icon="fas fa-trash" class="text-base" />
                                                <span>Delete</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <div v-else class="text-center py-12">
                            <font-awesome icon="fas fa-users" class="text-gray-400 text-6xl mb-4" />
                            <p class="text-xl font-semibold text-gray-900">No users found</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>