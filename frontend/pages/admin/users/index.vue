<script setup>
import { NuxtLink } from '#components';
import { useUserManagementStore } from '@/stores/user_management';
const { $swal } = useNuxtApp();
const userManagementStore = useUserManagementStore();
const state = reactive({
});

const users = computed(() => [...userManagementStore.getUsers()].sort((a, b) => a.id - b.id));

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
            <div class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md">
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
                <div class="mt-3 rounded-lg overflow-hidden ring-1 ring-black ring-opacity-5 ring-inset">
                    <table v-if="users && users.length" class="w-full table-auto table-striped">
                        <thead>
                            <tr class="h-10 bg-primary-blue-100 border border-solid">
                                <th class="px-4 py-2 border border-solid border-black text-white">ID</th>
                                <th class="px-4 py-2 border border-solid border-black text-white">Name</th>
                                <th class="px-4 py-2 border border-solid border-black text-white">Email</th>
                                <th class="px-4 py-2 border border-solid border-black text-white">User Type</th>
                                <th class="px-4 py-2 border border-solid border-black text-white">Email Verified</th>
                                <th class="px-4 py-2 border border-solid border-black text-white">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="user in users" :key="user.id">
                                <td class="border px-4 py-2 text-center">
                                    {{ user.id }}
                                </td>
                                <td class="border px-4 py-2">
                                    {{ user.first_name }} {{ user.last_name }}
                                </td>
                                <td class="border px-4 py-2">
                                    {{ user.email }}
                                </td>
                                <td class="border px-4 py-2 text-center">
                                    <span :class="{'bg-red-500 text-white px-2 py-1 rounded-lg': user.user_type === 'admin', 'bg-blue-500 text-white px-2 py-1 rounded-lg': user.user_type === 'normal'}">
                                        {{ user.user_type.toUpperCase() }}
                                    </span>
                                </td>
                                <td class="border px-4 py-2 text-center">
                                    <span :class="{'text-green-600 font-bold': user.email_verified_at, 'text-red-600': !user.email_verified_at}">
                                        {{ formatDate(user.email_verified_at) }}
                                    </span>
                                </td>
                                <td class="border px-4 py-2">
                                    <div class="flex flex-wrap gap-2">
                                        <NuxtLink :to="`/admin/users/${user.id}`" class="text-xs px-2 py-1 bg-blue-600 text-white hover:bg-blue-700 cursor-pointer font-bold shadow-md rounded-lg">
                                            Edit
                                        </NuxtLink>
                                        <button @click="changeUserType(user.id, user.user_type)" class="text-xs px-2 py-1 bg-yellow-600 text-white hover:bg-yellow-700 cursor-pointer font-bold shadow-md rounded-lg">
                                            {{ user.user_type === 'admin' ? 'Make Normal' : 'Make Admin' }}
                                        </button>
                                        <button @click="toggleEmailVerification(user.id)" class="text-xs px-2 py-1 bg-purple-600 text-white hover:bg-purple-700 cursor-pointer font-bold shadow-md rounded-lg">
                                            {{ user.email_verified_at ? 'Unverify' : 'Verify' }}
                                        </button>
                                        <button @click="deleteUser(user.id)" class="text-xs px-2 py-1 bg-red-600 text-white hover:bg-red-700 cursor-pointer font-bold shadow-md rounded-lg">
                                            Delete
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <div v-else class="text-center text-gray-500 text-4xl mt-20">
                        No users found
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>