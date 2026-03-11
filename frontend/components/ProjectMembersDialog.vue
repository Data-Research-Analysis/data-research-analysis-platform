<template>
    <overlay-dialog v-if="isOpen" @close="close" :y-offset="50">
        <template v-slot:overlay>
            <div class="w-full">
                <h2 class="text-3xl font-bold mb-6 text-gray-900">Project Members</h2>
                
                <!-- Add Member Section (Admin/Owner only) -->
                <div v-if="canManageMembers" class="mb-8 pb-8 border-b border-gray-200">
                <h3 class="text-lg font-semibold mb-4 text-gray-800">Invite Member</h3>

                <!-- Member usage bar -->
                <div class="mb-4 p-3 bg-gray-50 rounded-lg flex items-center justify-between gap-4">
                    <div class="flex items-center gap-2 text-sm text-gray-600">
                        <font-awesome-icon :icon="['fas', 'users']" class="text-gray-400" />
                        <span>
                            <span v-if="maxMembersAllowed === null">
                                <strong class="text-gray-800">{{ currentMemberUsage }}</strong> sub-user<span v-if="currentMemberUsage !== 1">s</span> across all projects
                                <span class="text-green-600 font-medium ml-1">(Unlimited)</span>
                            </span>
                            <span v-else-if="maxMembersAllowed === 0">
                                Sub-users are not available on the <strong class="text-gray-800">FREE</strong> plan
                            </span>
                            <span v-else>
                                <strong :class="isAtMemberLimit ? 'text-red-600' : 'text-gray-800'">{{ currentMemberUsage }}</strong>
                                <span class="text-gray-500"> / {{ maxMembersAllowed }} sub-users used</span>
                            </span>
                        </span>
                    </div>
                    <span v-if="maxMembersAllowed !== null && maxMembersAllowed > 0" 
                          :class="['text-xs font-medium px-2.5 py-1 rounded-full', isAtMemberLimit ? 'bg-red-100 text-red-700' : remainingMembers <= 10 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700']">
                        {{ isAtMemberLimit ? 'Limit reached' : `${remainingMembers} remaining` }}
                    </span>
                </div>

                <!-- At-limit banner -->
                <div v-if="isAtMemberLimit" class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                    <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="text-red-500 flex-shrink-0" />
                    <p class="text-sm text-red-700">
                        You've reached the member limit for your 
                        <strong>{{ tierDisplayName }}</strong> plan. 
                        <button @click="handleComingSoon" class="underline font-medium cursor-pointer">Upgrade your plan</button> to invite more members.
                    </p>
                </div>

                <div class="flex gap-3 flex-wrap">
                    <input 
                        v-model="inviteEmail" 
                        type="email"
                        placeholder="Email address" 
                        class="flex-1 min-w-[200px] px-3.5 py-2.5 border border-gray-300 rounded-md text-[15px] focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <select
                        v-model="inviteMarketingRole"
                        class="min-w-[160px] px-3.5 py-2.5 border border-gray-300 rounded-md text-[15px] focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                        v-tippy="{ content: 'Marketing persona: controls what this member can do in this project' }"
                    >
                        <option value="analyst">Analyst (Full access)</option>
                        <option value="manager">Manager (Publish only)</option>
                        <option value="cmo">CMO (Read-only)</option>
                    </select>
                    <button 
                        @click="inviteMember" 
                        class="px-5 py-2.5 bg-blue-500 text-white rounded-md font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer" 
                        :disabled="!inviteEmail || isAtMemberLimit"
                        :title="isAtMemberLimit ? 'Member limit reached — upgrade to invite more' : ''"
                    >
                        Send Invitation
                    </button>
                </div>
                <p v-if="inviteMessage" :class="['mt-3 px-2.5 py-2.5 rounded-md text-sm', inviteError ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800']">
                    {{ inviteMessage }}
                </p>
                </div>
                
                <!-- Members List -->
                <div class="mt-6">
                <h3 class="text-lg font-semibold mb-4 text-gray-800">Current Members</h3>
                <div v-if="loading" class="p-8 text-center text-gray-500">
                    <spinner />
                </div>
                <div v-else-if="localMembers.length === 0" class="p-8 text-center text-gray-500">
                    No members yet
                </div>
                <div v-else class="flex flex-col gap-3">
                    <div 
                        v-for="member in localMembers" 
                        :key="member.id" 
                        class="flex items-center justify-between p-4 bg-gray-50 rounded-lg gap-4"
                    >
                        <div class="flex-1 flex flex-col gap-1">
                            <span class="font-semibold text-gray-800">
                                {{ member.user.first_name }} {{ member.user.last_name }}
                            </span>
                            <span class="text-sm text-gray-600">{{ member.user.email }}</span>
                        </div>
                        
                        <div v-if="member.is_owner" class="min-w-[80px]">
                            <span class="inline-block px-3 py-1.5 rounded text-sm font-medium capitalize bg-red-100 text-red-800">
                                Owner
                            </span>
                        </div>

                        <!-- Marketing role column (only shown in marketing project context) -->
                        <div v-if="showMarketingRole" class="min-w-[140px]">
                            <div v-if="canManageMembers" class="flex flex-col gap-1">
                                <label class="text-xs font-medium text-gray-500">Marketing Role</label>
                                <select
                                    v-model="member.marketing_role"
                                    @change="updateMarketingRole(member)"
                                    class="px-2.5 py-1.5 border border-gray-300 rounded text-sm cursor-pointer w-full"
                                >
                                    <option value="cmo">CMO</option>
                                    <option value="manager">Manager</option>
                                    <option value="analyst">Analyst</option>
                                </select>
                            </div>
                            <span
                                v-else-if="member.marketing_role"
                                :class="[
                                    'inline-block px-3 py-1.5 rounded text-sm font-medium capitalize',
                                    member.marketing_role === 'cmo' ? 'bg-purple-100 text-purple-800' : '',
                                    member.marketing_role === 'manager' ? 'bg-indigo-100 text-indigo-800' : '',
                                    member.marketing_role === 'analyst' ? 'bg-cyan-100 text-cyan-800' : ''
                                ]"
                            >
                                {{ member.marketing_role }}
                            </span>
                            <span v-else class="text-sm text-gray-400">—</span>
                        </div>
                        
                        <button 
                            v-if="canManageMembers && !member.is_owner"
                            @click="removeMember(member)"
                            class="px-2.5 py-1.5 bg-red-400 text-white rounded text-sm hover:bg-red-500 transition-colors cursor-pointer"
                            title="Remove member"
                        >
                            ✕
                        </button>
                    </div>
                </div>
                </div>
                
                <!-- Pending Invitations Section -->
                <div v-if="canManageMembers" class="mt-8">
                <h3 class="text-lg font-semibold mb-4 text-gray-800">Pending Invitations</h3>
                <div v-if="loadingInvitations" class="p-8 text-center text-gray-500">
                    <spinner />
                </div>
                <div v-else-if="pendingInvitations.length === 0" class="p-6 text-center text-gray-500 bg-gray-50 rounded-lg">
                    No pending invitations
                </div>
                <div v-else class="flex flex-col gap-3">
                    <div 
                        v-for="invitation in pendingInvitations" 
                        :key="invitation.id" 
                        class="flex items-center justify-between p-4 bg-amber-50 rounded-lg gap-4 border border-amber-200"
                    >
                        <div class="flex-1 flex flex-col gap-1">
                            <span class="font-semibold text-gray-800">
                                {{ invitation.invited_email }}
                            </span>
                            <div class="flex items-center gap-3 text-sm text-gray-600">
                                <span class="capitalize">{{ invitation.marketing_role }}</span>
                                <span>•</span>
                                <span>Expires: {{ formatDate(invitation.expires_at) }}</span>
                            </div>
                        </div>
                        
                        <div class="flex gap-2">
                            <button 
                                @click="resendInvitation(invitation.id)"
                                class="px-3 py-1.5 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
                                :disabled="resending === invitation.id"
                            >
                                {{ resending === invitation.id ? 'Sending...' : 'Resend' }}
                            </button>
                            <button 
                                @click="cancelInvitation(invitation.id)"
                                class="px-3 py-1.5 bg-red-400 text-white rounded text-sm hover:bg-red-500 transition-colors"
                                :disabled="cancelling === invitation.id"
                            >
                                {{ cancelling === invitation.id ? 'Cancelling...' : 'Cancel' }}
                            </button>
                        </div>
                    </div>
                </div>
                </div>
            </div>
        </template>
    </overlay-dialog>
    
    <!-- Tier Limit Modal -->
    <TierLimitModal
        :show="tierLimitModal.show"
        :resource="tierLimitModal.resource"
        :currentUsage="tierLimitModal.currentUsage"
        :tierLimit="tierLimitModal.tierLimit"
        :tierName="tierLimitModal.tierName"
        :upgradeTiers="tierLimitModal.upgradeTiers"
        @close="hideLimitModal"
    />
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useProjectsStore } from '~/stores/projects';
import { useLoggedInUserStore } from '~/stores/logged_in_user';
import { useSubscriptionStore } from '~/stores/subscription';
import { useTierLimits } from '~/composables/useTierLimits';

interface Member {
    id: number;
    is_owner: boolean;
    marketing_role: string | null;
    user: {
        id: number;
        first_name: string;
        last_name: string;
        email: string;
    };
    added_at: string;
    invited_by: any;
}

interface Invitation {
    id: number;
    project_id: number;
    invited_email: string;
    marketing_role: string;
    status: string;
    expires_at: string;
    created_at: string;
}

const props = defineProps<{
    projectId: number;
    isOpen: boolean;
    userRole: 'owner' | 'admin' | 'editor' | 'viewer';
    members: Member[];
    showMarketingRole?: boolean;
}>();

const projectsStore = useProjectsStore();
const loggedInUserStore = useLoggedInUserStore();
const subscriptionStore = useSubscriptionStore();

function handleComingSoon() {
    const { $swal } = useNuxtApp() as any;
    $swal.fire({
        title: 'Coming Soon!',
        text: 'Paid plans are coming soon. We will notify you when they are available.',
        icon: 'info',
        confirmButtonText: 'Got it',
        confirmButtonColor: '#3b82f6',
    });
}
const { checkMemberLimit, modalState: tierLimitModal, hideLimitModal } = useTierLimits();

// Member limit computed properties
const maxMembersAllowed = computed(() => subscriptionStore.usageStats?.maxMembersPerProject ?? null);
const currentMemberUsage = computed(() => subscriptionStore.usageStats?.memberCount ?? 0);
const tierDisplayName = computed(() => {
    const t = subscriptionStore.usageStats?.tier || 'FREE';
    return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
});
const remainingMembers = computed(() => {
    if (maxMembersAllowed.value === null) return Infinity;
    return Math.max(0, maxMembersAllowed.value - currentMemberUsage.value);
});
const isAtMemberLimit = computed(() => {
    if (maxMembersAllowed.value === null) return false;
    return currentMemberUsage.value >= maxMembersAllowed.value;
});

const emit = defineEmits(['close', 'memberUpdated']);

const localMembers = ref<Member[]>([]);
const pendingInvitations = ref<Invitation[]>([]);
const inviteEmail = ref('');
const inviteMarketingRole = ref<'analyst' | 'manager' | 'cmo'>('manager');
const inviteMessage = ref('');
const inviteError = ref(false);
const loading = ref(false);
const loadingInvitations = ref(false);
const resending = ref<number | null>(null);
const cancelling = ref<number | null>(null);

// Initialize localMembers with props.members
watch(() => props.members, (newMembers) => {
    if (newMembers && Array.isArray(newMembers)) {
        localMembers.value = [...newMembers];
    }
}, { immediate: true, deep: true });

// Fetch pending invitations when dialog opens
watch(() => props.isOpen, async (newValue) => {
    if (newValue) {
        inviteEmail.value = '';
        inviteMessage.value = '';
        inviteError.value = false;
        inviteMarketingRole.value = 'manager';
        
        // Fetch pending invitations if user can manage members
        if (canManageMembers.value) {
            await fetchPendingInvitations();
        }
    }
});

const canManageMembers = computed(() => {
    // System admins always have access
    const user = loggedInUserStore.getLoggedInUser();
    if (user?.user_type === 'admin') return true;
    // Look up the project by ID and check my_role
    const project = projectsStore.projects.find(p => p.id === props.projectId);
    if (!project) return false;
    const myRole = project.my_role as string | null;
    // analyst can manage members; project owner (is_owner flag) also can
    return project.is_owner || myRole === 'analyst';
});

function close() {
    emit('close');
}

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
        return 'expired';
    } else if (diffDays === 0) {
        return 'today';
    } else if (diffDays === 1) {
        return 'tomorrow';
    } else if (diffDays < 7) {
        return `in ${diffDays} days`;
    } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
}

async function fetchPendingInvitations() {
    if (!canManageMembers.value) return;
    
    try {
        loadingInvitations.value = true;
        const data = await $fetch<{success: boolean, invitations: any[]}>(
            `${baseUrl()}/project-invitations/project/${props.projectId}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Authorization-Type': 'auth',
                }
            }
        );
        
        if (data.success) {
            pendingInvitations.value = data.invitations || [];
        }
    } catch (error) {
        console.error('Error fetching invitations:', error);
    } finally {
        loadingInvitations.value = false;
    }
}

async function resendInvitation(invitationId: number) {
    try {
        resending.value = invitationId;
        const data = await $fetch<{success: boolean, message: string}>(
            `${baseUrl()}/project-invitations/${invitationId}/resend`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Authorization-Type': 'auth',
                }
            }
        );
        
        if (data.success) {
            inviteMessage.value = 'Invitation resent successfully';
            inviteError.value = false;
            setTimeout(() => { inviteMessage.value = ''; }, 3000);
        } else {
            inviteMessage.value = data.message || 'Failed to resend invitation';
            inviteError.value = true;
        }
    } catch (error) {
        console.error('Error resending invitation:', error);
        inviteMessage.value = 'Failed to resend invitation';
        inviteError.value = true;
    } finally {
        resending.value = null;
    }
}

async function cancelInvitation(invitationId: number) {
    if (!confirm('Cancel this invitation?')) return;
    
    try {
        cancelling.value = invitationId;
        const data = await $fetch<{success: boolean}>(
            `${baseUrl()}/project-invitations/${invitationId}`,
            {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Authorization-Type': 'auth',
                }
            }
        );
        
        if (data.success) {
            pendingInvitations.value = pendingInvitations.value.filter(i => i.id !== invitationId);
            inviteMessage.value = 'Invitation cancelled';
            inviteError.value = false;
            setTimeout(() => { inviteMessage.value = ''; }, 3000);
        } else {
            inviteMessage.value = data.message || 'Failed to cancel invitation';
            inviteError.value = true;
        }
    } catch (error) {
        console.error('Error cancelling invitation:', error);
        inviteMessage.value = 'Failed to cancel invitation';
        inviteError.value = true;
    } finally {
        cancelling.value = null;
    }
}

async function inviteMember() {
    if (!inviteEmail.value) return;
    
    // Check tier limits before allowing invitation
    if (!checkMemberLimit()) {
        return;
    }
    
    inviteMessage.value = '';
    inviteError.value = false;
    
    try {
        const data = await $fetch<{success: boolean, message: string, invitation: any}>(
            `${baseUrl()}/project-invitations`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Authorization-Type': 'auth',
                },
                body: {
                    projectId: props.projectId,
                    email: inviteEmail.value,
                    marketing_role: inviteMarketingRole.value
                }
            }
        );
        
        if (data.success) {
            if (data.invitation?.addedDirectly) {
                inviteMessage.value = `User added successfully`;
                // Refresh members list
                emit('memberUpdated');
            } else {
                inviteMessage.value = `Invitation sent to ${inviteEmail.value}`;
                // Refresh invitations list
                await fetchPendingInvitations();
            }
            inviteEmail.value = '';
            inviteMarketingRole.value = 'manager';
            inviteError.value = false;
        } else {
            inviteMessage.value = data.message || 'Failed to send invitation';
            inviteError.value = true;
        }
    } catch (error: any) {
        inviteMessage.value = error.message || 'Failed to send invitation';
        inviteError.value = true;
    }
}

async function updateMarketingRole(member: Member) {
    try {
        const data = await $fetch<{success: boolean, message: string}>(
            `${baseUrl()}/project/${props.projectId}/members/${member.user.id}/marketing-role`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Authorization-Type': 'auth',
                },
                body: { marketing_role: member.marketing_role ?? null },
            }
        );

        if (!data.success) {
            console.error('Failed to update marketing role:', data.message);
            localMembers.value = [...props.members];
        }
    } catch (error) {
        console.error('Error updating marketing role:', error);
        localMembers.value = [...props.members];
    }
}

async function removeMember(member: Member) {
    const { $swal } = useNuxtApp() as any;
    const result = await $swal.fire({
        title: 'Remove Team Member?',
        text: `Remove ${member.user.first_name} ${member.user.last_name} from this project? This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Yes, remove',
        cancelButtonText: 'Cancel'
    });
    
    if (!result.isConfirmed) {
        return;
    }
    
    try {
        const data = await $fetch<{success: boolean, message: string}>(`${baseUrl()}/project/${props.projectId}/members/${member.user.id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`,
                'Authorization-Type': 'auth',
            }
        });
        
        if (data.success) {
            // Remove from local members
            localMembers.value = localMembers.value.filter(m => m.user.id !== member.user.id);
            emit('memberUpdated');
        } else {
            console.error('Failed to remove member:', data.message);
        }
    } catch (error) {
        console.error('Error removing member:', error);
    }
}
</script>