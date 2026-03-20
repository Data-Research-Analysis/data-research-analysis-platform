<template>
    <div class="min-h-screen bg-gray-50">
        <div class="max-w-2xl mx-auto px-4 py-12">
            <!-- Loading State -->
            <div v-if="isLoading" class="text-center py-12">
                <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-4xl text-blue-600 mb-4" />
                <p class="text-gray-600">Loading invitation...</p>
            </div>

            <!-- Error State (Invalid/Expired Token) -->
            <div v-else-if="error" class="bg-white rounded-lg shadow-lg p-8 text-center">
                <font-awesome-icon :icon="['fas', 'circle-xmark']" class="text-6xl text-red-500 mb-4" />
                <h1 class="text-2xl font-bold text-gray-900 mb-2">Invalid Invitation</h1>
                <p class="text-gray-600 mb-6">{{ error }}</p>
                <NuxtLink 
                    to="/projects" 
                    class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 cursor-pointer"
                >
                    Go to Projects
                    <font-awesome-icon :icon="['fas', 'arrow-right']" class="ml-2" />
                </NuxtLink>
            </div>

            <!-- Invitation Details -->
            <div v-else-if="invitation" class="bg-white rounded-lg shadow-lg p-8">
                <!-- Header -->
                <div class="text-center mb-8">
                    <div class="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                        <font-awesome-icon :icon="['fas', 'envelope-open-text']" class="text-3xl text-blue-600" />
                    </div>
                    <h1 class="text-3xl font-bold text-gray-900 mb-2">You're Invited!</h1>
                    <p class="text-gray-600">Join {{ invitation.organization_name }} as a team member</p>
                </div>

                <!-- Invitation Details Card -->
                <div class="border border-gray-200 rounded-lg p-6 mb-6">
                    <div class="space-y-4">
                        <!-- Organization -->
                        <div>
                            <div class="text-sm font-medium text-gray-500 mb-1">Organization</div>
                            <div class="text-lg font-semibold text-gray-900">{{ invitation.organization_name }}</div>
                        </div>

                        <!-- Role -->
                        <div>
                            <div class="text-sm font-medium text-gray-500 mb-1">Your Role</div>
                            <div class="flex items-center gap-2">
                                <span :class="getRoleBadgeClass(invitation.role)" class="px-3 py-1 text-sm font-semibold rounded-full">
                                    {{ invitation.role.toUpperCase() }}
                                </span>
                                <span class="text-sm text-gray-600">{{ getRoleDescription(invitation.role) }}</span>
                            </div>
                        </div>

                        <!-- Invited By -->
                        <div>
                            <div class="text-sm font-medium text-gray-500 mb-1">Invited By</div>
                            <div class="flex items-center gap-2">
                                <font-awesome-icon :icon="['fas', 'user']" class="text-gray-400" />
                                <span class="text-gray-900">{{ invitation.inviter_name }}</span>
                            </div>
                        </div>

                        <!-- Email -->
                        <div>
                            <div class="text-sm font-medium text-gray-500 mb-1">Invitation Sent To</div>
                            <div class="flex items-center gap-2">
                                <font-awesome-icon :icon="['fas', 'envelope']" class="text-gray-400" />
                                <span class="text-gray-900">{{ invitation.invited_email }}</span>
                            </div>
                        </div>

                        <!-- Expiration -->
                        <div>
                            <div class="text-sm font-medium text-gray-500 mb-1">Expires</div>
                            <div class="flex items-center gap-2">
                                <font-awesome-icon :icon="['fas', 'clock']" class="text-gray-400" />
                                <span :class="isExpiringSoon ? 'text-amber-600 font-medium' : 'text-gray-900'">
                                    {{ formatExpirationDate(invitation.expires_at) }}
                                    <span v-if="isExpiringSoon" class="ml-2">({{ daysUntilExpiration }} days left)</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Expiring Soon Warning -->
                <div v-if="isExpiringSoon" class="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div class="flex items-start gap-3">
                        <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="text-amber-600 mt-0.5" />
                        <div>
                            <h3 class="text-sm font-semibold text-amber-900">Invitation Expiring Soon</h3>
                            <p class="text-sm text-amber-800">
                                This invitation will expire in {{ daysUntilExpiration }} days. Accept it now to join the organization.
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Actions -->
                <div class="space-y-3">
                    <!-- Logged In User -->
                    <div v-if="isLoggedIn">
                        <button
                            @click="acceptInvitation"
                            :disabled="isAccepting"
                            class="w-full px-6 py-3 text-base font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 cursor-pointer"
                        >
                            <font-awesome-icon v-if="isAccepting" :icon="['fas', 'spinner']" class="animate-spin mr-2" />
                            Accept Invitation
                        </button>
                        <p class="text-sm text-gray-500 text-center mt-2">
                            You'll join {{ invitation.organization_name }} immediately
                        </p>
                    </div>

                    <!-- Guest User -->
                    <div v-else>
                        <NuxtLink
                            :to="`/register?token=${token}`"
                            class="block w-full px-6 py-3 text-base font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 text-center cursor-pointer"
                        >
                            Create Account & Accept
                        </NuxtLink>
                        <div class="relative my-4">
                            <div class="absolute inset-0 flex items-center">
                                <div class="w-full border-t border-gray-300"></div>
                            </div>
                            <div class="relative flex justify-center text-sm">
                                <span class="px-2 bg-white text-gray-500">or</span>
                            </div>
                        </div>
                        <NuxtLink
                            :to="`/login?redirect=/organization-invitations/accept/${token}`"
                            class="block w-full px-6 py-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 text-center cursor-pointer"
                        >
                            Log In to Accept
                        </NuxtLink>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
definePageMeta({
    middleware: []  // Public page, no auth required to view
});

const route = useRoute();
const router = useRouter();
const config = useRuntimeConfig();
const $swal = inject('$swal') as any;

const token = route.params.token as string;

const invitation = ref<any>(null);
const isLoading = ref(true);
const isAccepting = ref(false);
const error = ref<string | null>(null);

const isLoggedIn = computed(() => !!getAuthToken());
const isExpiringSoon = computed(() => {
    if (!invitation.value) return false;
    return daysUntilExpiration.value <= 2;
});

const daysUntilExpiration = computed(() => {
    if (!invitation.value) return 0;
    const now = new Date();
    const expires = new Date(invitation.value.expires_at);
    const diffTime = expires.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

onMounted(() => {
    loadInvitation();
});

async function loadInvitation() {
    try {
        isLoading.value = true;
        error.value = null;

        const response = await $fetch<{ success: boolean; invitation: any; error?: string }>(
            `${config.public.apiBase}/organization-invitations/token/${token}`,
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.success && response.invitation) {
            invitation.value = response.invitation;
        } else {
            error.value = response.error || 'This invitation is invalid or has expired';
        }
    } catch (e: any) {
        console.error('Failed to load invitation:', e);
        error.value = e.data?.message || 'Unable to load invitation. It may be invalid or expired.';
    } finally {
        isLoading.value = false;
    }
}

async function acceptInvitation() {
    const authToken = getAuthToken();
    if (!authToken) {
        router.push(`/login?redirect=/organization-invitations/accept/${token}`);
        return;
    }

    try {
        isAccepting.value = true;

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
                title: 'Welcome!',
                text: `You have joined ${invitation.value.organization_name}`,
                icon: 'success',
                confirmButtonColor: '#3C8DBC'
            });

            // Redirect to projects
            router.push('/projects');
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
        isAccepting.value = false;
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

function getRoleDescription(role: string): string {
    switch (role.toLowerCase()) {
        case 'owner':
            return 'Full control over organization';
        case 'admin':
            return 'Manage members and settings';
        case 'member':
            return 'Access to projects';
        default:
            return '';
    }
}

function formatExpirationDate(expiresAt: string): string {
    const date = new Date(expiresAt);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
</script>
