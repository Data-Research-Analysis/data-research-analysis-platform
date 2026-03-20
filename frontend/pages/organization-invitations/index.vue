<template>
    <div class="min-h-screen bg-gray-50">
        <div class="max-w-4xl mx-auto px-4 py-8">
            <div class="mb-6">
                <h1 class="text-3xl font-bold text-gray-900">Organization Invitations</h1>
                <p class="text-gray-600 mt-2">Review and accept invitations to join organizations</p>
            </div>

            <!-- Loading State -->
            <div v-if="isLoading" class="text-center py-12">
                <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-4xl text-blue-600 mb-4" />
                <p class="text-gray-600">Loading your invitations...</p>
            </div>

            <!-- Empty State -->
            <div v-else-if="invitations.length === 0" class="bg-white rounded-lg shadow-sm p-12 text-center">
                <font-awesome-icon :icon="['fas', 'inbox']" class="text-6xl text-gray-300 mb-4" />
                <h2 class="text-xl font-semibold text-gray-900 mb-2">No Pending Invitations</h2>
                <p class="text-gray-600 mb-6">You don't have any organization invitations at the moment</p>
                <NuxtLink 
                    to="/projects" 
                    class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 cursor-pointer"
                >
                    Go to Projects
                    <font-awesome-icon :icon="['fas', 'arrow-right']" class="ml-2" />
                </NuxtLink>
            </div>

            <!-- Invitations List -->
            <div v-else class="space-y-4">
                <div
                    v-for="invite in invitations"
                    :key="invite.id"
                    class="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
                >
                    <div class="flex items-start justify-between">
                        <div class="flex-1">
                            <!-- Organization Name -->
                            <h3 class="text-xl font-semibold text-gray-900 mb-2">
                                {{ invite.organization_name }}
                            </h3>

                            <!-- Role Badge -->
                            <div class="mb-3">
                                <span :class="getRoleBadgeClass(invite.role)" class="px-3 py-1 text-sm font-semibold rounded-full">
                                    {{ invite.role.toUpperCase() }}
                                </span>
                            </div>

                            <!-- Invitation Details -->
                            <div class="space-y-1 text-sm text-gray-600">
                                <div class="flex items-center gap-2">
                                    <font-awesome-icon :icon="['fas', 'user']" class="text-gray-400" />
                                    <span>Invited by <span class="font-medium">{{ invite.inviter_name }}</span></span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <font-awesome-icon :icon="['fas', 'envelope']" class="text-gray-400" />
                                    <span>Sent to <span class="font-medium">{{ invite.invited_email }}</span></span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <font-awesome-icon :icon="['fas', 'clock']" class="text-gray-400" />
                                    <span>
                                        Expires {{ formatExpirationDate(invite.expires_at) }}
                                        <span v-if="isExpiringSoon(invite.expires_at)" class="text-amber-600 font-medium ml-1">
                                            ({{ getDaysUntilExpiration(invite.expires_at) }} days left)
                                        </span>
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- Actions -->
                        <div class="flex flex-col gap-2 ml-4">
                            <button
                                @click="acceptInvitation(invite.id, invite.invitation_token)"
                                :disabled="acceptingId === invite.id"
                                class="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 cursor-pointer min-w-[120px]"
                            >
                                <font-awesome-icon v-if="acceptingId === invite.id" :icon="['fas', 'spinner']" class="animate-spin mr-2" />
                                Accept
                            </button>
                            <NuxtLink
                                :to="`/organization-invitations/accept/${invite.invitation_token}`"
                                class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 text-center cursor-pointer"
                            >
                                View Details
                            </NuxtLink>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
definePageMeta({
    middleware: ['auth']
});

const config = useRuntimeConfig();
const router = useRouter();
const $swal = inject('$swal') as any;

const invitations = ref<any[]>([]);
const isLoading = ref(true);
const acceptingId = ref<number | null>(null);

onMounted(() => {
    loadInvitations();
});

async function loadInvitations() {
    const token = getAuthToken();
    if (!token) {
        router.push('/login');
        return;
    }

    try {
        isLoading.value = true;
        const response = await $fetch<{ success: boolean; invitations: any[] }>(
            `${config.public.apiBase}/organization-invitations/user`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth'
                }
            }
        );

        if (response.success) {
            invitations.value = response.invitations;
        }
    } catch (e) {
        console.error('Failed to load invitations:', e);
        $swal.fire({
            title: 'Error',
            text: 'Failed to load invitations',
            icon: 'error',
            confirmButtonColor: '#3C8DBC'
        });
    } finally {
        isLoading.value = false;
    }
}

async function acceptInvitation(inviteId: number, token: string) {
    const authToken = getAuthToken();
    if (!authToken) {
        router.push('/login');
        return;
    }

    try {
        acceptingId.value = inviteId;

        const response = await $fetch<{ success: boolean; message: string }>(
            `${config.public.apiBase}/organization-invitations/accept`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Authorization-Type': 'auth',
                    'Content-Type': 'application/json'
                },
                body: {
                    token
                }
            }
        );

        if (response.success) {
            await $swal.fire({
                title: 'Success!',
                text: 'You have joined the organization',
                icon: 'success',
                confirmButtonColor: '#3C8DBC'
            });

            // Reload invitations to remove accepted one
            await loadInvitations();

            // If no more invitations, redirect to projects
            if (invitations.value.length === 0) {
                router.push('/projects');
            }
        }
    } catch (e: any) {
        console.error('Failed to accept invitation:', e);
        $swal.fire({
            title: 'Error',
            text: e.data?.message || 'Failed to accept invitation',
            icon: 'error',
            confirmButtonColor: '#3C8DBC'
        });
    } finally {
        acceptingId.value = null;
    }
}

function getRoleBadgeClass(role: string) {
    switch (role.toLowerCase()) {
        case 'owner':
            return 'bg-purple-100 text-purple-800';
        case 'admin':
            return 'bg-blue-100 text-blue-800';
        case 'member':
            return 'bg-green-100 text-green-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

function formatExpirationDate(expiresAt: string): string {
    const date = new Date(expiresAt);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function isExpiringSoon(expiresAt: string): boolean {
    const daysLeft = getDaysUntilExpiration(expiresAt);
    return daysLeft <= 2;
}

function getDaysUntilExpiration(expiresAt: string): number {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffTime = expires.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}
</script>
