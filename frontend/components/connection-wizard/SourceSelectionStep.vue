<template>
    <div class="max-w-[960px] mx-auto p-6">
        <!-- Header -->
        <div class="text-center mb-6">
            <h2 class="mb-2 text-2xl font-bold text-gray-900">What do you want to connect?</h2>
            <p class="text-[0.95rem] text-gray-500">
                Select one or more data sources to get started. You can always add more later.
            </p>
        </div>

        <!-- Search -->
        <div class="relative mb-6">
            <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-[0.9rem]"></i>
            <input
                v-model="searchQuery"
                type="text"
                class="w-full py-3 pr-10 pl-11 border-[1.5px] border-gray-200 rounded-lg text-[0.9rem] font-inherit text-gray-900 bg-gray-50 transition-colors box-border focus:outline-none focus:border-indigo-500 focus:bg-white placeholder:text-gray-400"
                placeholder="Search data sources..."
            />
            <button
                v-if="searchQuery"
                class="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-gray-400 cursor-pointer p-1 text-[0.9rem] hover:text-gray-500"
                @click="searchQuery = ''"
            >
                <i class="fas fa-times"></i>
            </button>
        </div>

        <!-- Source Grid by Category -->
        <div
            v-for="group in filteredGroups"
            :key="group.category"
            class="mb-6"
        >
            <h3 class="mb-3 text-[0.85rem] font-semibold text-gray-500 uppercase tracking-[0.05em]">{{ group.label }}</h3>
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <SourceCard
                    v-for="source in group.sources"
                    :key="source.id"
                    :source="source"
                    :selected="selectedIds.has(source.id)"
                    @toggle="handleToggle"
                />
            </div>
        </div>

        <!-- Empty State -->
        <div
            v-if="filteredGroups.length === 0"
            class="text-center p-8 text-gray-400"
        >
            <i class="fas fa-search text-2xl mb-3 block"></i>
            <p class="mb-3 text-[0.95rem]">No sources match "{{ searchQuery }}"</p>
            <button
                class="py-2 px-4 border border-gray-200 rounded-md bg-white text-indigo-500 cursor-pointer text-[0.85rem] font-inherit hover:bg-gray-50"
                @click="searchQuery = ''"
            >
                Clear search
            </button>
        </div>

        <!-- Templates Section -->
        <ConnectionTemplates
            v-if="filteredGroups.length > 0"
            :selected-source-ids="selectedIds"
            @apply="handleTemplateApply"
        />

        <!-- Footer / Next Button -->
        <div class="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-gray-200">
            <span class="text-[0.9rem] text-gray-500 font-medium">
                <template v-if="selectedIds.size > 0">
                    {{ selectedIds.size }} source{{ selectedIds.size === 1 ? '' : 's' }} selected
                </template>
                <template v-else>
                    Select at least one source to continue
                </template>
            </span>
            <button
                class="inline-flex items-center justify-center gap-2 w-full sm:w-auto py-3 px-7 border-none rounded-lg bg-indigo-500 text-white text-[0.95rem] font-semibold font-inherit cursor-pointer transition-all duration-200 hover:not(:disabled):bg-indigo-600 hover:not(:disabled):-translate-y-px hover:not(:disabled):shadow-[0_4px_12px_rgba(99,102,241,0.3)] disabled:bg-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed"
                :disabled="selectedIds.size === 0"
                @click="handleNext"
            >
                Next
                <i class="fas fa-arrow-right text-[0.85rem]"></i>
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { getSourcesByCategory, type ConnectionSource } from '~/constants/connectionSources';

interface Props {
    modelValue: string[]; // selected source IDs
}

const props = defineProps<Props>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: string[]): void;
    (e: 'next'): void;
}>();

const searchQuery = ref('');

const selectedIds = computed(() => new Set(props.modelValue));

const allGroups = getSourcesByCategory();

const filteredGroups = computed(() => {
    if (!searchQuery.value.trim()) return allGroups;

    const query = searchQuery.value.toLowerCase().trim();
    return allGroups
        .map(group => ({
            ...group,
            sources: group.sources.filter(
                s =>
                    s.name.toLowerCase().includes(query) ||
                    s.description.toLowerCase().includes(query) ||
                    s.categoryLabel.toLowerCase().includes(query)
            ),
        }))
        .filter(group => group.sources.length > 0);
});

function handleToggle(sourceId: string) {
    const current = new Set(props.modelValue);
    if (current.has(sourceId)) {
        current.delete(sourceId);
    } else {
        current.add(sourceId);
    }
    emit('update:modelValue', Array.from(current));
}

function handleTemplateApply(sourceIds: string[]) {
    const current = new Set(props.modelValue);
    // Toggle: if all are already selected, deselect them; otherwise select all
    const allSelected = sourceIds.every(id => current.has(id));
    if (allSelected) {
        sourceIds.forEach(id => current.delete(id));
    } else {
        sourceIds.forEach(id => current.add(id));
    }
    emit('update:modelValue', Array.from(current));
}

function handleNext() {
    if (selectedIds.value.size > 0) {
        emit('next');
    }
}
</script>