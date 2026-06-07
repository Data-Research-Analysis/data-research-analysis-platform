<script setup lang="ts">
/**
 * CampaignStatusBadge — Visual badge for campaign status.
 *
 * Renders a colored pill/badge indicating whether a campaign is
 * active, paused, or completed. Uses the intelligence hub design tokens.
 */

interface Props {
    /** Campaign status */
    status: 'active' | 'paused' | 'completed';
}

defineProps<Props>();

function getStatusClasses(status: string): string {
    switch (status) {
        case 'active':
            return 'bg-emerald-100 text-emerald-800';
        case 'paused':
            return 'bg-amber-100 text-amber-800';
        case 'completed':
            return 'bg-gray-100 text-gray-700';
        default:
            return 'bg-gray-100 text-gray-600';
    }
}
</script>

<template>
    <span
        :class="[
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
            getStatusClasses(status),
        ]"
    >
        <span
            :class="[
                'h-1.5 w-1.5 rounded-full',
                status === 'active' ? 'bg-emerald-500 animate-pulse' : '',
                status === 'paused' ? 'bg-amber-500' : '',
                status === 'completed' ? 'bg-gray-500' : '',
            ]"
        />
        {{ status }}
    </span>
</template>