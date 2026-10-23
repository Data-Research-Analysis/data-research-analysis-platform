<script setup lang="ts">
import { usePaidMediaPlansStore } from '@/stores/paid_media_plans';

const store = usePaidMediaPlansStore();

const expanded = ref(false);
</script>

<template>
    <div class="text-xs">
        <button
            type="button"
            class="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 cursor-pointer"
            @click="expanded = !expanded"
        >
            <font-awesome-icon :icon="['fas', 'scroll']" class="w-3 h-3" />
            Process log <span class="text-gray-400">({{ store.events.length }})</span>
            <font-awesome-icon :icon="['fas', expanded ? 'chevron-up' : 'chevron-down']" class="w-2.5 h-2.5" />
        </button>
        <div v-if="expanded" class="mt-2 max-h-64 overflow-y-auto border border-gray-100 rounded-lg">
            <ul class="divide-y divide-gray-50">
                <li v-for="event in [...store.events].reverse()" :key="event.id" class="flex items-start gap-2 px-3 py-1.5">
                    <span class="w-2 h-2 mt-1.5 rounded-full shrink-0"
                        :class="event.severity === 'error' ? 'bg-red-400' : event.severity === 'warn' ? 'bg-amber-400' : 'bg-blue-400'" />
                    <div class="min-w-0">
                        <p class="text-gray-600 truncate">{{ event.message }}</p>
                        <p class="text-gray-400">{{ new Date(event.createdAt).toLocaleTimeString() }} · {{ event.eventType }}</p>
                    </div>
                </li>
                <li v-if="store.events.length === 0" class="px-3 py-2 text-gray-400">No activity yet.</li>
            </ul>
        </div>
    </div>
</template>
