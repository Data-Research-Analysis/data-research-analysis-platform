<template>
    <div class="mt-8 pt-6 border-t border-gray-200">
        <h3 class="mb-1 text-base font-semibold text-gray-900 flex items-center gap-2">
            <i class="fas fa-magic text-indigo-500"></i>
            Quick-Start Templates
        </h3>
        <p class="mb-4 text-sm text-gray-500">
            Select a pre-built combination to get started faster
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
            <button
                v-for="template in templates"
                :key="template.id"
                class="flex items-center gap-3 px-4 py-3 border-[1.5px] border-gray-200 rounded-lg bg-white cursor-pointer transition-all duration-200 text-left font-inherit hover:border-indigo-500 hover:bg-[#fafafe]"
                :class="{ 'border-indigo-500 bg-indigo-50': isActive(template) }"
                @click="handleSelect(template)"
            >
                <i :class="template.icon" class="text-xl text-indigo-500 shrink-0"></i>
                <span class="flex flex-col flex-1 min-w-0">
                    <span class="text-sm font-semibold text-gray-900">{{ template.name }}</span>
                    <span class="text-xs text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis">{{ template.description }}</span>
                </span>
                <i
                    v-if="isActive(template)"
                    class="fas fa-check text-indigo-500 text-base shrink-0"
                ></i>
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { CONNECTION_TEMPLATES, type ConnectionTemplate } from '~/constants/connectionTemplates';

interface Props {
    selectedSourceIds: Set<string>;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    (e: 'apply', sourceIds: string[]): void;
}>();

const templates = CONNECTION_TEMPLATES;

function isActive(template: ConnectionTemplate): boolean {
    return template.sourceIds.every(id => props.selectedSourceIds.has(id));
}

function handleSelect(template: ConnectionTemplate) {
    emit('apply', template.sourceIds);
}
</script>