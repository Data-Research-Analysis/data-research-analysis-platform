<template>
    <div class="flex flex-row">
        <sidebar-admin class="w-1/6" />
        <div class="w-5/6">
            <div class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md rounded-lg">
                <!-- Header -->
                <div class="mb-8">
                    <NuxtLink to="/admin/organizations" class="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 mb-4">
                        <font-awesome-icon :icon="['fas', 'arrow-left']" class="mr-2" />
                        Back to Organizations
                    </NuxtLink>
                    <h1 class="text-3xl font-bold text-gray-900">Organization Settings</h1>
                    <p class="mt-2 text-sm text-gray-500" v-if="organization">{{ organization.name }}</p>
                </div>

                <!-- Loading State -->
                <div v-if="isLoading" class="flex justify-center items-center py-12">
                    <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue-500 mb-4"></div>
                </div>

                <!-- Error State -->
                <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p class="text-red-800">{{ error }}</p>
                </div>

                <!-- Settings Tabs -->
                <div v-else-if="organization" class="bg-white shadow rounded-lg">
                <!-- Tab Navigation -->
                <div class="border-b border-gray-200">
                    <nav class="-mb-px flex space-x-8 px-6" aria-label="Tabs">
                        <button
                            v-for="tab in tabs"
                            :key="tab.id"
                            @click="activeTab = tab.id"
                            :class="[
                                activeTab === tab.id
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                                'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm cursor-pointer'
                            ]"
                        >
                            <font-awesome-icon :icon="tab.icon" class="mr-2" />
                            {{ tab.name }}
                        </button>
                    </nav>
                </div>

                <!-- Tab Content -->
                <div class="p-6">
                    <!-- General Settings -->
                    <div v-if="activeTab === 'general'">
                        <h2 class="text-lg font-medium text-gray-900 mb-4">General Information</h2>
                        <form @submit.prevent="updateGeneral" class="space-y-6">
                            <BaseFormField label="Organization Name" required>
                                <BaseInput
                                    id="org-name"
                                    v-model="generalForm.name"
                                    required
                                />
                            </BaseFormField>

                            <BaseFormField
                                label="Email Domain (Optional)"
                                hint="Users with this email domain can auto-join (Enterprise only)"
                            >
                                <BaseInput
                                    id="org-domain"
                                    v-model="generalForm.domain"
                                    placeholder="example.com"
                                />
                            </BaseFormField>

                            <div class="flex justify-end">
                                <button
                                    type="submit"
                                    :disabled="isSaving"
                                    class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
                                >
                                    <font-awesome-icon v-if="isSaving" :icon="['fas', 'spinner']" class="animate-spin mr-2" />
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>

                    <!-- Members Tab -->
                    <div v-else-if="activeTab === 'members'">
                        <div class="flex justify-between items-center mb-4">
                            <h2 class="text-lg font-medium text-gray-900">Organization Members</h2>
                            <button
                                v-if="canInviteMembers"
                                @click="showInviteModal = true"
                                class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
                            >
                                <font-awesome-icon :icon="['fas', 'user-plus']" class="mr-2" />
                                Add Member
                            </button>
                        </div>

                        <!-- Usage Badge -->
                        <div v-if="usage" class="mb-4 p-4 bg-blue-50 rounded-lg">
                            <p class="text-sm text-blue-800">
                                <font-awesome-icon :icon="['fas', 'users']" class="mr-2" />
                                {{ usage.currentMembers }} / {{ usage.maxMembers || 'Unlimited' }} members used
                            </p>
                        </div>

                        <!-- Upgrade Prompt for Solo Plans -->
                        <div v-if="!canInviteMembers && usage && usage.maxMembers === 1" class="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <h3 class="text-sm font-medium text-yellow-800 mb-2">
                                <font-awesome-icon :icon="['fas', 'lock']" class="mr-2" />
                                Team Features Locked
                            </h3>
                            <p class="text-sm text-yellow-700 mb-3">
                                Upgrade to PROFESSIONAL to add up to 5 team members and unlock collaboration features.
                            </p>
                            <NuxtLink :to="`/pricing?orgId=${organization.id}`" class="inline-flex items-center px-3 py-2 text-sm font-medium text-yellow-800 bg-yellow-100 rounded-md hover:bg-yellow-200">
                                View Plans
                                <font-awesome-icon :icon="['fas', 'arrow-right']" class="ml-2" />
                            </NuxtLink>
                        </div>

                        <!-- Members Table -->
                        <div class="overflow-x-auto">
                            <table class="min-w-full divide-y divide-gray-200">
                                <thead class="bg-gray-50">
                                    <tr>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody class="bg-white divide-y divide-gray-200">
                                    <tr v-for="member in members" :key="member.id">
                                        <td class="px-6 py-4 whitespace-nowrap">
                                            <div class="text-sm font-medium text-gray-900">{{ member.user?.email || 'N/A' }}</div>
                                            <div class="text-sm text-gray-500">{{ member.user?.first_name }} {{ member.user?.last_name }}</div>
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap">
                                            <span :class="getRoleBadgeClass(member.role)" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                                                {{ member.role }}
                                            </span>
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {{ formatDate(member.joined_at.toString()) }}
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                v-if="member.role !== 'owner' && isOwnerOrAdmin"
                                                @click="removeMember(member.user_id)"
                                                class="text-red-600 hover:text-red-900"
                                            >
                                                Remove
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <!-- Pending Invitations Section -->
                        <div v-if="pendingOrgInvitations.length > 0" class="mt-8">
                            <h3 class="text-lg font-medium text-gray-900 mb-4">Pending Invitations</h3>
                            <div class="space-y-3">
                                <div 
                                    v-for="invite in pendingOrgInvitations" 
                                    :key="invite.id"
                                    class="p-4 bg-amber-50 border border-amber-200 rounded-lg"
                                >
                                    <div class="flex items-center justify-between">
                                        <div class="flex-1">
                                            <div class="flex items-center gap-2 mb-1">
                                                <font-awesome-icon :icon="['fas', 'envelope']" class="text-amber-600" />
                                                <span class="text-sm font-medium text-gray-900">{{ invite.invited_email }}</span>
                                                <span :class="getRoleBadgeClass(invite.role)" class="px-2 py-0.5 text-xs leading-5 font-semibold rounded-full">
                                                    {{ invite.role }}
                                                </span>
                                            </div>
                                            <div class="text-xs text-gray-600">
                                                <span>Invited by {{ invite.inviter_name || 'Unknown' }}</span>
                                                <span class="mx-2">•</span>
                                                <span>Expires {{ formatDate(invite.expires_at) }}</span>
                                            </div>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <button
                                                @click="resendOrgInvitation(invite.id)"
                                                :disabled="resendingInviteId === invite.id"
                                                class="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 rounded hover:bg-blue-200 disabled:opacity-50 cursor-pointer"
                                            >
                                                <font-awesome-icon v-if="resendingInviteId === invite.id" :icon="['fas', 'spinner']" class="animate-spin mr-1" />
                                                Resend
                                            </button>
                                            <button
                                                @click="cancelOrgInvitation(invite.id)"
                                                :disabled="cancellingInviteId === invite.id"
                                                class="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 rounded hover:bg-red-200 disabled:opacity-50 cursor-pointer"
                                            >
                                                <font-awesome-icon v-if="cancellingInviteId === invite.id" :icon="['fas', 'spinner']" class="animate-spin mr-1" />
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Billing Tab -->
                    <div v-else-if="activeTab === 'billing'">
                        <h2 class="text-lg font-medium text-gray-900 mb-6">Billing & Subscription</h2>
                        
                        <!-- Current Plan Card -->
                        <div class="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                            <div class="flex justify-between items-start mb-4">
                                <div>
                                    <h3 class="text-base font-medium text-gray-900">Current Plan</h3>
                                    <p class="text-2xl font-bold text-blue-600 mt-2">{{ billingData.currentTier?.tierName?.toUpperCase() || 'FREE' }}</p>
                                    <p class="text-sm text-gray-500 mt-1" v-if="billingData.currentTier?.billingCycle">
                                        {{ billingData.currentTier.billingCycle === 'monthly' ? 'Billed Monthly' : 'Billed Annually' }}
                                    </p>
                                </div>
                                <div class="text-right">
                                    <p class="text-sm text-gray-500">Next billing date</p>
                                    <p class="text-sm font-medium text-gray-900">{{ billingData.nextBillingDate || 'N/A' }}</p>
                                </div>
                            </div>
                            
                            <div class="border-t border-gray-200 pt-4 mt-4">
                                <NuxtLink
                                    :to="`/pricing?orgId=${orgId}`"
                                    class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
                                >
                                    <font-awesome-icon :icon="['fas', 'arrow-up']" class="mr-2" />
                                    Change Plan
                                </NuxtLink>
                            </div>
                        </div>

                        <!-- Usage Summary -->
                        <div class="bg-white border border-gray-200 rounded-lg p-6 mb-6" v-if="usage">
                            <h3 class="text-base font-medium text-gray-900 mb-4">Current Usage</h3>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <p class="text-sm text-gray-500">Team Members</p>
                                    <p class="text-lg font-semibold text-gray-900">
                                        {{ usage.currentMembers }} / {{ formatFeatureLimit(usage.maxMembers) }}
                                    </p>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-500">Projects</p>
                                    <p class="text-lg font-semibold text-gray-900">
                                        {{ usage.currentProjects || 0 }} / {{ formatFeatureLimit(usage.maxProjects) }}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <!-- Downgrade Requests History -->
                        <div class="bg-white border border-gray-200 rounded-lg p-6" v-if="billingData.downgradeRequests.length > 0">
                            <h3 class="text-base font-medium text-gray-900 mb-4">Recent Tier Changes</h3>
                            <div class="space-y-3">
                                <div 
                                    v-for="request in billingData.downgradeRequests"
                                    :key="request.id"
                                    class="flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
                                >
                                    <div>
                                        <p class="text-sm font-medium text-gray-900">
                                            {{ request.current_tier?.toUpperCase() }} → {{ request.requested_tier?.toUpperCase() }}
                                        </p>
                                        <p class="text-xs text-gray-500">{{ formatDate(request.created_at) }}</p>
                                    </div>
                                    <span 
                                        :class="[
                                            'text-xs px-2 py-1 rounded-full',
                                            request.status === 'completed' ? 'bg-green-100 text-green-800' : 
                                            request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                                            'bg-gray-100 text-gray-800'
                                        ]"
                                    >
                                        {{ request.status }}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- Loading State -->
                        <div v-if="billingLoading" class="flex justify-center items-center py-12">
                            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        </div>
                    </div>

                    <!-- Danger Zone -->
                    <div v-else-if="activeTab === 'danger'">
                        <h2 class="text-lg font-medium text-red-600 mb-4">Danger Zone</h2>
                        <div class="border border-red-200 rounded-lg p-6">
                            <h3 class="text-base font-medium text-gray-900 mb-2">Deactivate Organization</h3>
                            <p class="text-sm text-gray-500 mb-4">
                                Deactivating will hide this organization from all members. Projects and data will be preserved but inaccessible.
                            </p>
                            <button
                                @click="confirmDeactivate"
                                class="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700"
                            >
                                Deactivate Organization
                            </button>
                        </div>
                    </div>
                </div>
            </div>

        <!-- Invite Member Modal -->
        <overlay-dialog v-if="showInviteModal" @close="showInviteModal = false" :y-offset="100">
            <template v-slot:overlay>
                <h3 class="text-2xl font-bold text-gray-900 mb-6">Invite Team Member</h3>
                
                <form @submit.prevent="inviteMember" class="space-y-6">
                    <BaseFormField label="Email Address" required hint="Enter the email address of the person you want to invite">
                        <BaseInput
                            id="invite-email"
                            v-model="inviteEmail"
                            type="email"
                            required
                            placeholder="colleague@company.com"
                        />
                    </BaseFormField>
                    
                    <BaseFormField label="Role">
                        <BaseSelect
                            id="invite-role"
                            v-model="inviteRole"
                            :options="[
                                { value: 'member', label: 'Member' },
                                { value: 'admin', label: 'Admin' }
                            ]"
                        />
                    </BaseFormField>
                    
                    <div class="flex justify-end space-x-3">
                        <button type="button" @click="showInviteModal = false" class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer">
                            Cancel
                        </button>
                        <button type="submit" :disabled="isInviting" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
                            <font-awesome-icon v-if="isInviting" :icon="['fas', 'spinner']" class="animate-spin mr-2" />
                            Send Invitation
                        </button>
                    </div>
                </form>
            </template>
        </overlay-dialog>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
definePageMeta({
    layout: 'default'
});

import { useOrganizationsStore } from '@/stores/organizations';
import type { IOrganization, IOrganizationMember, IOrganizationUsage } from '~/types/IOrganization';

const route = useRoute();
const router = useRouter();
const organizationsStore = useOrganizationsStore();
const config = useRuntimeConfig();
const { $swal } = useNuxtApp() as any;

const orgId = computed(() => parseInt(route.params.orgid as string));

// State
const isLoading = ref(true);
const isSaving = ref(false);
const isInviting = ref(false);
const error = ref<string | null>(null);
const activeTab = ref('general');
const showInviteModal = ref(false);
const inviteEmail = ref('');
const inviteRole = ref('member');

const organization = ref<IOrganization | null>(null);
const members = ref<IOrganizationMember[]>([]);
const pendingOrgInvitations = ref<any[]>([]);
const loadingInvitations = ref(false);
const resendingInviteId = ref<number | null>(null);
const cancellingInviteId = ref<number | null>(null);
const usage = ref<IOrganizationUsage | null>(null);
const subscription = ref<any>(null);

const generalForm = reactive<{ name: string; domain: string }>({
    name: '',
    domain: ''
});

// Billing state
const billingLoading = ref(false);
interface BillingData {
    currentTier: { tierName: string; billingCycle: string } | null;
    nextBillingDate: string | null;
    paymentMethod: { type: string; last4: string; expiryMonth: number; expiryYear: number; brand: string } | null;
    downgradeRequests: any[];
}
const billingData = reactive<BillingData>({
    currentTier: null,
    nextBillingDate: null,
    paymentMethod: null,
    downgradeRequests: []
});

// Use composable
const orgSubscription = useOrganizationSubscription();

// Tabs configuration
const tabs = [
    { id: 'general', name: 'General', icon: ['fas', 'cog'] },
    { id: 'members', name: 'Members', icon: ['fas', 'users'] },
    { id: 'billing', name: 'Billing', icon: ['fas', 'credit-card'] },
    { id: 'danger', name: 'Danger Zone', icon: ['fas', 'exclamation-triangle'] }
];

// Computed
const isOwnerOrAdmin = computed(() => {
    return organization.value?.user_role === 'owner' || organization.value?.user_role === 'admin';
});

const canInviteMembers = computed(() => {
    if (!usage.value) return false;
    if (usage.value.maxMembers === null) return true; // Unlimited
    return usage.value.currentMembers < usage.value.maxMembers;
});

// Methods
async function loadOrganization() {
    const token = getAuthToken();
    if (!token) {
        router.push('/login');
        return;
    }

    try {
        isLoading.value = true;
        error.value = null;

        const response = await $fetch<{ success: boolean; data: IOrganization }>(`${config.public.apiBase}/organizations/${orgId.value}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth'
            }
        });

        if (response.success && response.data) {
            organization.value = response.data;
            generalForm.name = response.data.name;
            generalForm.domain = response.data.domain || '';
        }

        await Promise.all([
            loadMembers(),
            loadUsage(),
            loadPendingInvitations()
        ]);
    } catch (e: any) {
        console.error('Failed to load organization:', e);
        error.value = e.message || 'Failed to load organization';
    } finally {
        isLoading.value = false;
    }
}

async function loadMembers() {
    const token = getAuthToken();
    if (!token) return;

    try {
        const response = await $fetch<{ success: boolean; members: any[] }>(
            `${config.public.apiBase}/organizations/${orgId.value}/members`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                    'X-Organization-Id': orgId.value.toString()
                }
            }
        );

        if (response.success && response.members) {
            // Map API response to IOrganizationMember format
            members.value = response.members.map((m: any) => ({
                id: m.id,
                organization_id: orgId.value,
                user_id: m.users_platform_id,
                role: m.role || 'member',
                joined_at: new Date(m.joined_at || m.created_at),
                invited_by: m.invited_by || null,
                is_active: m.is_active !== false,
                user: {
                    id: m.users_platform_id,
                    email: m.user_email,
                    first_name: m.user_first_name || m.user_name?.split(' ')[0] || '',
                    last_name: m.user_last_name || m.user_name?.split(' ').slice(1).join(' ') || '',
                }
            }));
        }
    } catch (e) {
        console.error('Failed to load members:', e);
    }
}

async function loadUsage() {
    const token = getAuthToken();
    if (!token) return;

    try {
        const response = await $fetch<{ success: boolean; data: IOrganizationUsage }>(
            `${config.public.apiBase}/organizations/${orgId.value}/usage`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                    'X-Organization-Id': orgId.value.toString()
                }
            }
        );

        if (response.success && response.data) {
            usage.value = response.data;
        }
    } catch (e) {
        console.error('Failed to load usage:', e);
    }
}

async function updateGeneral() {
    const token = getAuthToken();
    if (!token) return;

    try {
        isSaving.value = true;

        const response = await $fetch(`${config.public.apiBase}/organizations/${orgId.value}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth',
                'X-Organization-Id': orgId.value.toString(),
                'Content-Type': 'application/json'
            },
            body: {
                name: generalForm.name,
                domain: generalForm.domain || null
            }
        });

        // Reload organization to get updated data
        await organizationsStore.retrieveOrganizations();
        await loadOrganization();

        // Show success message
        $swal.fire({
            title: 'Success',
            text: 'Organization updated successfully',
            icon: 'success',
            confirmButtonColor: '#3C8DBC'
        });
    } catch (e: any) {
        console.error('Failed to update organization:', e);
        $swal.fire({
            title: 'Error',
            text: e.message || 'Failed to update organization',
            icon: 'error',
            confirmButtonColor: '#3C8DBC'
        });
    } finally {
        isSaving.value = false;
    }
}

async function loadPendingInvitations() {
    const token = getAuthToken();
    if (!token) return;

    try {
        loadingInvitations.value = true;
        const response = await $fetch<{ success: boolean; invitations: any[] }>(
            `${config.public.apiBase}/organization-invitations/org/${orgId.value}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                    'X-Organization-Id': orgId.value.toString()
                }
            }
        );

        if (response.success) {
            pendingOrgInvitations.value = response.invitations;
        }
    } catch (e) {
        console.error('Failed to load invitations:', e);
    } finally {
        loadingInvitations.value = false;
    }
}

async function inviteMember() {
    const token = getAuthToken();
    if (!token) return;

    try {
        isInviting.value = true;

        await $fetch(`${config.public.apiBase}/organization-invitations`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth',
                'X-Organization-Id': orgId.value.toString(),
                'Content-Type': 'application/json'
            },
            body: {
                organizationId: orgId.value,
                email: inviteEmail.value,
                role: inviteRole.value
            }
        });

        // Reload members and usage
        await Promise.all([loadMembers(), loadUsage(), loadPendingInvitations()]);

        // Reset form and close modal
        inviteEmail.value = '';
        inviteRole.value = 'member';
        showInviteModal.value = false;

        $swal.fire({
            title: 'Success',
            text: 'Invitation sent successfully',
            icon: 'success',
            confirmButtonColor: '#3C8DBC'
        });
    } catch (e: any) {
        console.error('Failed to invite member:', e);
        // Upsell modal when the org has hit its member seat limit
        if (e.data?.code === 'MEMBER_LIMIT_EXCEEDED' || e.response?.status === 403 && e.data?.code === 'MEMBER_LIMIT_EXCEEDED') {
            const tier = organization.value?.subscription?.subscription_tier?.tier_name?.toUpperCase() ?? 'current';
            const result = await $swal.fire({
                title: 'Member limit reached',
                html: `Your <strong>${tier}</strong> plan allows up to <strong>${e.data.limit}</strong> member${e.data.limit === 1 ? '' : 's'}. Upgrade your plan to collaborate with more team members.`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'View Upgrade Options',
                confirmButtonColor: '#3C8DBC',
                cancelButtonText: 'Cancel',
            });
            if (result.isConfirmed) {
                await navigateTo('/pricing');
            }
        } else {
            $swal.fire({
                title: 'Error',
                text: e.data?.message || e.message || 'Failed to send invitation',
                icon: 'error',
                confirmButtonColor: '#3C8DBC'
            });
        }
    } finally {
        isInviting.value = false;
    }
}

async function resendOrgInvitation(inviteId: number) {
    const token = getAuthToken();
    if (!token) return;

    try {
        resendingInviteId.value = inviteId;

        await $fetch(`${config.public.apiBase}/organization-invitations/resend/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth',
                'X-Organization-Id': orgId.value.toString()
            }
        });

        $swal.fire({
            title: 'Success',
            text: 'Invitation resent',
            icon: 'success',
            confirmButtonColor: '#3C8DBC'
        });
    } catch (e: any) {
        $swal.fire({
            title: 'Error',
            text: e.data?.message || 'Failed to resend invitation',
            icon: 'error',
            confirmButtonColor: '#3C8DBC'
        });
    } finally {
        resendingInviteId.value = null;
    }
}

async function cancelOrgInvitation(inviteId: number) {
    const { value: confirmed } = await $swal.fire({
        title: 'Cancel Invitation?',
        text: 'This will revoke the invitation link',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#DD4B39',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, cancel it'
    });

    if (!confirmed) return;

    const token = getAuthToken();
    if (!token) return;

    try {
        cancellingInviteId.value = inviteId;

        await $fetch(`${config.public.apiBase}/organization-invitations/${inviteId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth',
                'X-Organization-Id': orgId.value.toString()
            }
        });

        await loadPendingInvitations();

        $swal.fire({
            title: 'Success',
            text: 'Invitation cancelled',
            icon: 'success',
            confirmButtonColor: '#3C8DBC'
        });
    } catch (e: any) {
        $swal.fire({
            title: 'Error',
            text: e.data?.message || 'Failed to cancel invitation',
            icon: 'error',
            confirmButtonColor: '#3C8DBC'
        });
    } finally {
        cancellingInviteId.value = null;
    }
}

async function removeMember(userId: number) {
    const { value: confirmRemove } = await $swal.fire({
        title: 'Remove Member?',
        text: 'Are you sure you want to remove this member from the organization?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3C8DBC',
        cancelButtonColor: '#DD4B39',
        confirmButtonText: 'Yes, remove them'
    });

    if (!confirmRemove) return;

    const token = getAuthToken();
    if (!token) return;

    try {
        await $fetch(`${config.public.apiBase}/organizations/${orgId.value}/members/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth',
                'X-Organization-Id': orgId.value.toString()
            }
        });

        await Promise.all([loadMembers(), loadUsage()]);
        $swal.fire({
            title: 'Success',
            text: 'Member removed successfully',
            icon: 'success',
            confirmButtonColor: '#3C8DBC'
        });
    } catch (e: any) {
        console.error('Failed to remove member:', e);
        $swal.fire({
            title: 'Error',
            text: e.message || 'Failed to remove member',
            icon: 'error',
            confirmButtonColor: '#3C8DBC'
        });
    }
}

async function confirmDeactivate() {
    const { value: confirmDeactivation } = await $swal.fire({
        title: 'Deactivate Organization?',
        text: 'Are you sure you want to deactivate this organization? This action can be reversed by contacting support.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#DD4B39',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, deactivate it'
    });

    if (confirmDeactivation) {
        $swal.fire({
            title: 'Contact Support Required',
            text: 'Organization deactivation is currently only available through support. Please contact support@dataresearchanalysis.com',
            icon: 'info',
            confirmButtonColor: '#3C8DBC'
        });
    }
}

function getRoleBadgeClass(role: string) {
    switch (role) {
        case 'owner':
            return 'bg-purple-100 text-purple-800';
        case 'admin':
            return 'bg-blue-100 text-blue-800';
        case 'member':
            return 'bg-gray-100 text-gray-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatFeatureLimit(value: number | null | undefined): string {
    if (value === null || value === undefined || value === -1) {
        return 'Unlimited';
    }
    return value.toString();
}

// Billing methods
async function loadBillingData() {
    billingLoading.value = true;
    
    try {
        // Load payment method
        const paymentMethodResult = await orgSubscription.getPaymentMethod(orgId.value);
        if (paymentMethodResult.success && paymentMethodResult.data) {
            billingData.paymentMethod = paymentMethodResult.data;
        }

        // Load downgrade requests
        const downgradeResult = await orgSubscription.getDowngradeRequests(orgId.value);
        if (downgradeResult.success && downgradeResult.data) {
            billingData.downgradeRequests = downgradeResult.data;
        }

        // Set current tier from subscription (already loaded)
        if (organization.value?.subscription) {
            billingData.currentTier = {
                tierName: organization.value.subscription.subscription_tier?.tier_name || 'free',
                billingCycle: organization.value.subscription.billing_cycle || 'monthly'
            };
            
            // Calculate next billing date
            if (organization.value.subscription.ends_at) {
                const endsAt = organization.value.subscription.ends_at;
                billingData.nextBillingDate = formatDate(typeof endsAt === 'string' ? endsAt : endsAt.toISOString());
            }
        }
    } catch (e) {
        console.error('[loadBillingData] Error:', e);
    } finally {
        billingLoading.value = false;
    }
}

// Watch for tab changes to load billing data
watch(activeTab, async (newTab) => {
    if (newTab === 'billing') {
        await loadBillingData();
    }
});

// Lifecycle
onMounted(() => {
    loadOrganization();
});
</script>
