<script setup>
import { NuxtLink } from '#components';
import { usePrivateBetaUserStore } from '@/stores/private_beta_users';
const { $swal } = useNuxtApp();
const privateBetaUserStore = usePrivateBetaUserStore();
const state = reactive({
});
const privateBetaUsers = computed(() => [...privateBetaUserStore.getPrivateBetaUsers()].sort((a, b) => a.id - b.id));
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
                                <td class="border px-4 py-2">

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