<script setup>
import { NuxtLink } from '#components';
import { usePrivateBetaUserStore } from '@/stores/private_beta_users';
import { useUserManagementStore } from '@/stores/user_management';
const { $swal } = useNuxtApp();
const router = useRouter();
const privateBetaUserStore = usePrivateBetaUserStore();
const userManagementStore = useUserManagementStore();
const state = reactive({
    convertingUsers: new Set(),
});
const privateBetaUsers = computed(() => [...privateBetaUserStore.getPrivateBetaUsers()].sort((a, b) => a.id - b.id));

async function convertBetaUserToUser(betaUser) {
    // Check if already converted
    if (betaUser.is_converted) {
        $swal.fire({
            title: "Already Converted",
            text: `${betaUser.first_name} ${betaUser.last_name} has already been converted to a platform user.`,
            icon: "info",
            confirmButtonColor: "#3C8DBC",
        });
        return;
    }
    
    const { value: confirmConvert } = await $swal.fire({
        title: `Convert ${betaUser.first_name} ${betaUser.last_name} to Full User?`,
        html: `
            <div class="text-left">
                <p><strong>This will:</strong></p>
                <ul style="text-align: left; margin-left: 20px;">
                    <li>Create a new user account with their information</li>
                    <li>Allow them to log in and use the platform</li>
                    <li>Pre-populate the user creation form with their data</li>
                </ul>
                <p><strong>Email:</strong> ${betaUser.business_email}</p>
                <p><strong>Company:</strong> ${betaUser.company_name}</p>
                <p class="mt-3 text-sm text-gray-600"><em>Note: You can modify the information before finalizing the user account.</em></p>
            </div>
        `,
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#3C8DBC",
        cancelButtonColor: "#DD4B39",
        confirmButtonText: "Continue to User Creation",
        cancelButtonText: "Cancel"
    });
    
    if (!confirmConvert) {
        return;
    }

    state.convertingUsers.add(betaUser.id);
    
    try {
        // Navigate to user creation form with beta user ID
        router.push(`/admin/users/create?betaUserId=${betaUser.id}`);
    } catch (error) {
        $swal.fire({
            title: "Error!",
            text: "There was an error starting the conversion process.",
            icon: "error",
            confirmButtonColor: "#3C8DBC",
        });
    } finally {
        state.convertingUsers.delete(betaUser.id);
    }
}

function getButtonText(user) {
    if (state.convertingUsers.has(user.id)) {
        return 'Converting...';
    }
    if (user.is_converted) {
        return 'Already Converted';
    }
    return 'Convert to User';
}

// Check for success message from conversion
onMounted(() => {
    const route = useRoute();
    if (route.query.converted === 'true') {
        const userName = route.query.userName;
        if (userName) {
            $swal.fire({
                title: "Conversion Successful!",
                text: `${userName} has been successfully converted to a platform user.`,
                icon: "success",
                confirmButtonColor: "#3C8DBC",
            });
            // Clean up the URL
            router.replace({ path: route.path });
        }
    }
});
</script>
<template>
    <div class="flex flex-row">
        <sidebar-admin
            class="w-1/6"
        />
        <div class="w-5/6">
            <div class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md rounded-lg">
                <div class="flex flex-row">
                    <div class="font-bold text-2xl mb-5">
                        List Private Beta Users
                    </div>
                </div>
                <div class="bg-white shadow-md overflow-hidden rounded-lg ring-1 ring-gray-200 ring-inset">
                    <div class="overflow-x-auto">
                        <table v-if="privateBetaUsers && privateBetaUsers.length" class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Full Name</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Business Email</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone Number</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Country</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Added On</th>
                                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                <tr v-for="user in privateBetaUsers" 
                                    :key="user.id"
                                    :class="{ 'bg-gray-100': user.is_converted, 'hover:bg-gray-50': !user.is_converted }">
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {{ user.id }}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {{ user.first_name }} {{ user.last_name }}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {{ user.business_email }}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {{ user.phone_number }}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {{ user.company_name }}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {{ user.country }}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {{ user.created_at }}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button 
                                           @click="convertBetaUserToUser(user)"
                                            :disabled="state.convertingUsers.has(user.id) || user.is_converted"
                                            :class="[
                                                'inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg shadow-sm transition-colors',
                                                user.is_converted 
                                                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                                                    : 'bg-green-600 text-white hover:bg-green-700 cursor-pointer'
                                            ]"
                                            :title="user.is_converted 
                                                ? 'This user has already been converted' 
                                                : 'Convert this beta user to a full platform user'"
                                        >
                                            <font-awesome v-if="!user.is_converted" icon="fas fa-user-plus" class="mr-1 text-2xl" />
                                            <font-awesome v-else icon="fas fa-check-circle" class="mr-1 text-2xl" />
                                            {{ getButtonText(user) }}
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <div v-else class="text-center py-12">
                            <font-awesome icon="fas fa-users" class="text-gray-400 text-6xl mb-4" />
                            <p class="text-xl font-semibold text-gray-900">No Private Beta Users found</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>