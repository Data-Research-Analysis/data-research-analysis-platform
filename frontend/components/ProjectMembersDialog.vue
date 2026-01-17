<template>
    <overlay-dialog v-if="isOpen" @close="close" :y-offset="50">
        <template v-slot:overlay>
            <div class="w-full">
                <h2 class="text-3xl font-bold mb-6 text-gray-900">Project Members</h2>
                
                <!-- Add Member Section (Admin/Owner only) -->
                <div v-if="canManageMembers" class="mb-8 pb-8 border-b border-gray-200">
                <h3 class="text-lg font-semibold mb-4 text-gray-800">Invite Member</h3>
                <div class="flex gap-3 flex-wrap">
                    <input 
                        v-model="inviteEmail" 
                        type="email"
                        placeholder="Email address" 
                        class="flex-1 min-w-[200px] px-3.5 py-2.5 border border-gray-300 rounded-md text-[15px] focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <select v-model="inviteRole" class="min-w-[150px] px-3.5 py-2.5 border border-gray-300 rounded-md text-[15px] focus:outline-none focus:border-blue-500 transition-colors cursor-pointer">
                        <option value="viewer">Viewer (Read-only)</option>
                        <option value="editor">Editor (Can create/edit)</option>
                        <option value="admin">Admin (Full control)</option>
                    </select>
                    <button 
                        @click="inviteMember" 
                        class="px-5 py-2.5 bg-blue-500 text-white rounded-md font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer" 
                        :disabled="!inviteEmail"
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
                        
                        <div class="min-w-[120px]">
                            <select 
                                v-if="canManageMembers && member.role !== 'owner'"
                                v-model="member.role"
                                @change="updateRole(member)"
                                class="px-2.5 py-1.5 border border-gray-300 rounded text-sm cursor-pointer"
                            >
                                <option value="viewer">Viewer</option>
                                <option value="editor">Editor</option>
                                <option value="admin">Admin</option>
                            </select>
                            <span 
                                v-else 
                                :class="[
                                    'inline-block px-3 py-1.5 rounded text-sm font-medium capitalize',
                                    member.role === 'owner' ? 'bg-red-100 text-red-800' : '',
                                    member.role === 'admin' ? 'bg-orange-100 text-orange-900' : '',
                                    member.role === 'editor' ? 'bg-blue-100 text-blue-800' : '',
                                    member.role === 'viewer' ? 'bg-teal-50 text-teal-800' : ''
                                ]"
                            >
                                {{ member.role }}
                            </span>
                        </div>
                        
                        <button 
                            v-if="canManageMembers && member.role !== 'owner'"
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
                                <span class="capitalize">{{ invitation.role }}</span>
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
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';

interface Member {
    id: number;
    role: 'owner' | 'admin' | 'editor' | 'viewer';
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
    role: string;
    status: string;
    expires_at: string;
    created_at: string;
}

const props = defineProps<{
    projectId: number;
    isOpen: boolean;
    userRole: 'owner' | 'admin' | 'editor' | 'viewer';
    members: Member[];
}>();

const emit = defineEmits(['close', 'memberUpdated']);

const localMembers = ref<Member[]>([]);
const pendingInvitations = ref<Invitation[]>([]);
const inviteEmail = ref('');
const inviteRole = ref<'viewer' | 'editor' | 'admin'>('viewer');
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
        
        // Fetch pending invitations if user can manage members
        if (canManageMembers.value) {
            await fetchPendingInvitations();
        }
    }
});

const canManageMembers = computed(() => {
    return ['owner', 'admin'].includes(props.userRole);
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
        const response = await fetch(
            `${baseUrl()}/project-invitations/project/${props.projectId}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Authorization-Type': 'auth',
                    'Content-Type': 'application/json'
                }
            }
        );
        
        const data = await response.json();
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
        const response = await fetch(
            `${baseUrl()}/project-invitations/${invitationId}/resend`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Authorization-Type': 'auth',
                    'Content-Type': 'application/json'
                }
            }
        );
        
        const data = await response.json();
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
        const response = await fetch(
            `${baseUrl()}/project-invitations/${invitationId}`,
            {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Authorization-Type': 'auth',
                    'Content-Type': 'application/json'
                }
            }
        );
        
        const data = await response.json();
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
    
    inviteMessage.value = '';
    inviteError.value = false;
    
    try {
        const response = await fetch(
            `${baseUrl()}/project-invitations`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    projectId: props.projectId,
                    email: inviteEmail.value,
                    role: inviteRole.value
                })
            }
        );
        
        const data = await response.json();
        
        if (data.success) {
            if (data.invitation?.addedDirectly) {
                inviteMessage.value = `User added directly as ${inviteRole.value}`;
                // Refresh members list
                emit('memberUpdated');
            } else {
                inviteMessage.value = `Invitation sent to ${inviteEmail.value}`;
                // Refresh invitations list
                await fetchPendingInvitations();
            }
            inviteEmail.value = '';
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

async function updateRole(member: Member) {
    try {
        const response = await fetch(`${baseUrl()}/project/${props.projectId}/members/${member.user.id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`,
                'Authorization-Type': 'auth',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                role: member.role
            })
        });
        
        const data = await response.json();
        if (data.success) {
            emit('memberUpdated');
        } else {
            console.error('Failed to update role:', data.message);
            // Revert on error - sync from props
            localMembers.value = [...props.members];
        }
    } catch (error) {
        console.error('Error updating role:', error);
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
        const response = await fetch(`${baseUrl()}/project/${props.projectId}/members/${member.user.id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`,
                'Authorization-Type': 'auth',
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
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