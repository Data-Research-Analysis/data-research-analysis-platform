<template>
  <span 
    :class="badgeClasses"
    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium">
    <font-awesome :icon="iconClass" :class="iconAnimation" class="text-xs" />
    {{ statusText }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  status?: string;
}>();

const statusConfig: Record<string, { text: string; color: string; icon: string; animate?: boolean }> = {
  idle: { text: 'Idle', color: 'bg-gray-100 text-gray-800', icon: 'fas fa-pause' },
  queued: { text: 'Queued', color: 'bg-blue-100 text-blue-800', icon: 'fas fa-clock', animate: true },
  refreshing: { text: 'Refreshing', color: 'bg-indigo-100 text-indigo-800', icon: 'fas fa-sync-alt', animate: true },
  completed: { text: 'Completed', color: 'bg-green-100 text-green-800', icon: 'fas fa-check-circle' },
  failed: { text: 'Failed', color: 'bg-red-100 text-red-800', icon: 'fas fa-exclamation-circle' },
};

const config = computed(() => statusConfig[props.status || 'idle'] || statusConfig.idle);

const badgeClasses = computed(() => config.value.color);
const iconClass = computed(() => config.value.icon);
const statusText = computed(() => config.value.text);
const iconAnimation = computed(() => config.value.animate ? 'animate-spin' : '');
</script>
