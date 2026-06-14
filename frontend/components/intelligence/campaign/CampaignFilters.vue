<script setup lang="ts">
/**
 * CampaignFilters — Filter/search bar for the Campaign Performance Table.
 *
 * Provides search input, channel filter, status filter, and a reset button.
 * Emits filter changes via v-model bindings on individual props.
 */

interface Props {
    search?: string;
    channel?: string;
    status?: string;
    /** Available channels to populate the channel dropdown */
    channels?: string[];
}

const props = withDefaults(defineProps<Props>(), {
    search: '',
    channel: '',
    status: '',
    channels: () => [],
});

const emit = defineEmits<{
    'update:search': [value: string];
    'update:channel': [value: string];
    'update:status': [value: string];
    reset: [];
}>();

const localSearch = ref(props.search);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

watch(() => props.search, (val) => {
    localSearch.value = val;
});

function onSearchInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    localSearch.value = val;
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        emit('update:search', val);
    }, 300);
}

function onChannelChange(e: Event) {
    emit('update:channel', (e.target as HTMLSelectElement).value);
}

function onStatusChange(e: Event) {
    emit('update:status', (e.target as HTMLSelectElement).value);
}

onBeforeUnmount(() => {
    if (searchTimer) clearTimeout(searchTimer);
});
</script>

<template>
    <div class="flex flex-wrap items-center gap-3">
        <!-- Search input -->
        <div class="relative flex-1 min-w-[200px] max-w-sm">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>
            <input
                type="text"
                :value="localSearch"
                placeholder="Search campaigns..."
                class="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                @input="onSearchInput"
            />
            <button
                v-if="localSearch"
                class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                @click="localSearch = ''; emit('update:search', '')"
            >
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>

        <!-- Channel dropdown -->
        <select
            :value="channel"
            class="rounded-lg border border-gray-300 bg-white py-2 px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            @change="onChannelChange"
        >
            <option value="">All Channels</option>
            <option v-for="ch in channels" :key="ch" :value="ch">{{ ch }}</option>
        </select>

        <!-- Status dropdown -->
        <select
            :value="status"
            class="rounded-lg border border-gray-300 bg-white py-2 px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            @change="onStatusChange"
        >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
        </select>

        <!-- Reset button -->
        <button
            v-if="search || channel || status"
            class="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            @click="emit('reset')"
        >
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reset
        </button>
    </div>
</template>