<template>
    <overlay-dialog v-if="isOpen" @close="close" :y-offset="50">
        <template v-slot:overlay>
        <div class="bg-white rounded-xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
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
                    <select v-model="inviteRole" class="min-w-[150px] px-3.5 py-2.5 border border-gray-300 rounded-md text-[15px] focus:outline-none focus:border-blue-500 transition-colors">
                        <option value="viewer">Viewer (Read-only)</option>
                        <option value="editor">Editor (Can create/edit)</option>
                        <option value="admin">Admin (Full control)</option>
                    </select>
                    <button 
                        @click="inviteMember" 
                        class="px-5 py-2.5 bg-blue-500 text-white rounded-md font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" 
                        :disabled="!inviteEmail"
                    >
                        Send Invitation
                    </button>
                </div>
                <p v-if="inviteMessage" :class="['mt-3 px-2.5 py-2.5 rounded-md text-sm', inviteError ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800']">
                    {{ inviteMessage }}
                </p>
            </div>
            <div v-else class="mb-8 pb-8 border-b border-gray-200">
                <p class="text-gray-600">You have {{ userRole }} access to this project. Only owners and admins can manage team members.</p>
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
                                class="px-2.5 py-1.5 border border-gray-300 rounded text-sm"
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
                            class="px-2.5 py-1.5 bg-red-400 text-white rounded text-sm hover:bg-red-500 transition-colors"
                            title="Remove member"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            </div>
        </div>
        </template>
    </overlay-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

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

const props = defineProps<{
    projectId: number;
    isOpen: boolean;
    userRole: 'owner' | 'admin' | 'editor' | 'viewer';
    members: Member[];
}>();

const emit = defineEmits(['close', 'memberUpdated']);

const localMembers = ref<Member[]>([]);
const inviteEmail = ref('');
const inviteRole = ref<'viewer' | 'editor' | 'admin'>('viewer');
const inviteMessage = ref('');
const inviteError = ref(false);
const loading = ref(false);

// Initialize localMembers with props.members
watch(() => props.members, (newMembers) => {
    if (newMembers && Array.isArray(newMembers)) {
        localMembers.value = [...newMembers];
    }
}, { immediate: true, deep: true });

const canManageMembers = computed(() => {
    return ['owner', 'admin'].includes(props.userRole);
});

function close() {
    emit('close');
}

async function inviteMember() {
    if (!inviteEmail.value) return;
    
    inviteMessage.value = '';
    inviteError.value = false;
    
    try {
        // Step 1: Look up user by email
        const lookupResponse = await fetch(
            `${baseUrl()}/user/lookup-by-email?email=${encodeURIComponent(inviteEmail.value)}`,
            {
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Authorization-Type': 'auth',
                    'Content-Type': 'application/json'
                }
            }
        );
        
        const lookupData = await lookupResponse.json();
        
        if (!lookupResponse.ok || !lookupData.success) {
            inviteMessage.value = lookupData.message || 'User not found';
            inviteError.value = true;
            return;
        }
        
        const foundUser = lookupData.data;
        
        // Step 2: Add user to project
        const addResponse = await fetch(
            `${baseUrl()}/project/${props.projectId}/members`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Authorization-Type': 'auth',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: foundUser.id,
                    role: inviteRole.value
                })
            }
        );
        
        const addData = await addResponse.json();
        
        if (addData.success) {
            inviteMessage.value = `${foundUser.email} added as ${inviteRole.value}`;
            inviteEmail.value = '';
            inviteError.value = false;
            // Add to local members
            localMembers.value.push(addData.data);
            emit('memberUpdated');
        } else {
            inviteMessage.value = addData.message || 'Failed to add member';
            inviteError.value = true;
        }
    } catch (error: any) {
        inviteMessage.value = error.message || 'Failed to add member';
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
    if (!confirm(`Remove ${member.user.first_name} ${member.user.last_name} from this project?`)) {
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

// Watch for dialog opening to reset form
watch(() => props.isOpen, (newValue) => {
    if (newValue) {
        inviteEmail.value = '';
        inviteMessage.value = '';
        inviteError.value = false;
    }
});
</script>
