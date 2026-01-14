<template>
    <span 
        v-if="role" 
        :class="badgeClass"
        class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full"
    >
        <component :is="roleIcon" class="h-3 w-3" />
        <span>{{ roleLabel }}</span>
    </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { 
    CrownIcon, 
    ShieldCheckIcon, 
    PencilIcon, 
    EyeIcon 
} from 'lucide-vue-next';

interface Props {
    role: 'owner' | 'admin' | 'editor' | 'viewer';
    isOwner?: boolean;
}

const props = defineProps<Props>();

const roleConfig = {
    owner: {
        label: 'Owner',
        icon: CrownIcon,
        class: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
    },
    admin: {
        label: 'Admin',
        icon: ShieldCheckIcon,
        class: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    },
    editor: {
        label: 'Editor',
        icon: PencilIcon,
        class: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    },
    viewer: {
        label: 'Viewer',
        icon: EyeIcon,
        class: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
    }
};

const effectiveRole = computed(() => {
    // If explicitly marked as owner, show owner badge
    if (props.isOwner) return 'owner';
    return props.role;
});

const roleLabel = computed(() => roleConfig[effectiveRole.value].label);
const roleIcon = computed(() => roleConfig[effectiveRole.value].icon);
const badgeClass = computed(() => roleConfig[effectiveRole.value].class);
</script>
