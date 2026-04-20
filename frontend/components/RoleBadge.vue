<template>
    <span 
        v-if="role" 
        :class="badgeClass"
        class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full"
    >
        <font-awesome-icon :icon="roleIcon" class="h-3 w-3" />
        <span>{{ roleLabel }}</span>
    </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
    role: 'owner' | 'admin' | 'editor' | 'viewer';
    isOwner?: boolean;
}

const props = defineProps<Props>();

const roleConfig = {
    owner: {
        label: 'Owner',
        icon: ['fas', 'crown'] as [string, string],
        class: 'bg-purple-100 text-purple-800'
    },
    admin: {
        label: 'Admin',
        icon: ['fas', 'shield-halved'] as [string, string],
        class: 'bg-blue-100 text-blue-800'
    },
    editor: {
        label: 'Editor',
        icon: ['fas', 'pencil'] as [string, string],
        class: 'bg-green-100 text-green-800'
    },
    viewer: {
        label: 'Viewer',
        icon: ['fas', 'eye'] as [string, string],
        class: 'bg-gray-100 text-gray-800'
    }
};

const effectiveRole = computed(() => {
    if (props.isOwner) return 'owner';
    return props.role;
});

const roleLabel = computed(() => roleConfig[effectiveRole.value].label);
const roleIcon = computed(() => roleConfig[effectiveRole.value].icon);
const badgeClass = computed(() => roleConfig[effectiveRole.value].class);
</script>
