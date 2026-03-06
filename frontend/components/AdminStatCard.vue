<script setup lang="ts">
defineProps<{
    label: string;
    value: number | string;
    icon: string[];
    iconBg?: string;
    delta?: string | null;
    deltaPositive?: boolean;
    actionLabel?: string;
    actionTo?: string;
}>();
</script>

<template>
    <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex flex-col gap-3">
        <div class="flex items-center justify-between">
            <span class="text-sm text-gray-500 font-medium">{{ label }}</span>
            <div
                class="flex items-center justify-center h-9 w-9 rounded-lg"
                :class="iconBg || 'bg-blue-100'"
            >
                <font-awesome-icon :icon="icon" class="text-base" :class="iconBg ? 'text-white' : 'text-blue-600'" />
            </div>
        </div>
        <div class="flex items-end gap-3">
            <span class="text-3xl font-bold text-gray-900">{{ value }}</span>
            <span
                v-if="delta != null"
                class="text-xs font-semibold mb-1 px-1.5 py-0.5 rounded"
                :class="deltaPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'"
            >
                {{ delta }}
            </span>
        </div>
        <NuxtLink
            v-if="actionLabel && actionTo"
            :to="actionTo"
            class="text-xs text-blue-600 hover:text-blue-800 font-medium mt-auto"
        >
            {{ actionLabel }} &rarr;
        </NuxtLink>
    </div>
</template>
