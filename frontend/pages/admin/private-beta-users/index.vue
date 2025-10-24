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
            <div class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md">
                <div class="flex flex-row">
                    <div class="font-bold text-2xl mb-5">
                        List Private Beta Users
                    </div>
                </div>
                <div class="mt-3">
                    <table v-if="privateBetaUsers && privateBetaUsers.length" class="w-full table-auto table-striped">
                        <thead>
                            <tr class="h-10 bg-primary-blue-100 border border-solid">
                                <th class="px-4 py-2 border border-solid border-black text-white">ID</th>
                                <th class="px-4 py-2 border border-solid border-black text-white">Full Name</th>
                                <th class="px-4 py-2 border border-solid border-black text-white">Business Email</th>
                                <th class="px-4 py-2 border border-solid border-black text-white">Phone Number</th>
                                <th class="px-4 py-2 border border-solid border-black text-white">Company</th>
                                <th class="px-4 py-2 border border-solid border-black text-white">Country</th>
                                <th class="px-4 py-2 border border-solid border-black text-white">Added On</th>
                                <th class="px-4 py-2 border border-solid border-black text-white">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="user in privateBetaUsers" :key="user.id">
                                <td class="border px-4 py-2 text-center">
                                    {{ user.id }}
                                </td>
                                <td class="border px-4 py-2">
                                    {{ user.first_name }} {{ user.last_name }}
                                </td>
                                <td class="border px-4 py-2">
                                    {{ user.business_email }}
                                </td>
                                <td class="border px-4 py-2">
                                    {{ user.phone_number }}
                                </td>
                                <td class="border px-4 py-2">
                                    {{ user.company_name }}
                                </td>
                                <td class="border px-4 py-2">
                                    {{ user.country }}
                                </td>
                                <td class="border px-4 py-2">
                                    {{ user.created_at }}
                                </td>
                                <td class="border px-4 py-2 text-center">
                                    <button 
                                        @click="convertBetaUserToUser(user)"
                                        :disabled="state.convertingUsers.has(user.id)"
                                        class="text-sm px-3 py-1 bg-green-600 text-white hover:bg-green-700 cursor-pointer font-bold shadow-md rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Convert this beta user to a full platform user"
                                    >
                                        {{ state.convertingUsers.has(user.id) ? 'Converting...' : 'Convert to User' }}
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <div v-else class="text-center text-gray-500 text-4xl mt-20">
                        No Private Beta Users found
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>