<template>
    <div class="source-selection-step">
        <!-- Header -->
        <div class="source-selection-step__header">
            <h2 class="source-selection-step__title">What do you want to connect?</h2>
            <p class="source-selection-step__subtitle">
                Select one or more data sources to get started. You can always add more later.
            </p>
        </div>

        <!-- Search -->
        <div class="source-selection-step__search">
            <i class="fas fa-search source-selection-step__search-icon"></i>
            <input
                v-model="searchQuery"
                type="text"
                class="source-selection-step__search-input"
                placeholder="Search data sources..."
            />
            <button
                v-if="searchQuery"
                class="source-selection-step__search-clear"
                @click="searchQuery = ''"
            >
                <i class="fas fa-times"></i>
            </button>
        </div>

        <!-- Source Grid by Category -->
        <div
            v-for="group in filteredGroups"
            :key="group.category"
            class="source-selection-step__category"
        >
            <h3 class="source-selection-step__category-label">{{ group.label }}</h3>
            <div class="source-selection-step__grid">
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
            class="source-selection-step__empty"
        >
            <i class="fas fa-search"></i>
            <p>No sources match "{{ searchQuery }}"</p>
            <button
                class="source-selection-step__empty-clear"
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
        <div class="source-selection-step__footer">
            <span class="source-selection-step__selection-count">
                <template v-if="selectedIds.size > 0">
                    {{ selectedIds.size }} source{{ selectedIds.size === 1 ? '' : 's' }} selected
                </template>
                <template v-else>
                    Select at least one source to continue
                </template>
            </span>
            <button
                class="source-selection-step__next-btn"
                :disabled="selectedIds.size === 0"
                @click="handleNext"
            >
                Next
                <i class="fas fa-arrow-right"></i>
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { getSourcesByCategory, type ConnectionSource } from '~/constants/connectionSources';
import SourceCard from './SourceCard.vue';
import ConnectionTemplates from './ConnectionTemplates.vue';

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

<style scoped>
.source-selection-step {
    max-width: 960px;
    margin: 0 auto;
    padding: 1.5rem;
}

/* Header */
.source-selection-step__header {
    text-align: center;
    margin-bottom: 1.5rem;
}

.source-selection-step__title {
    margin: 0 0 0.5rem;
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
}

.source-selection-step__subtitle {
    margin: 0;
    font-size: 0.95rem;
    color: #6b7280;
}

/* Search */
.source-selection-step__search {
    position: relative;
    margin-bottom: 1.5rem;
}

.source-selection-step__search-icon {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: #9ca3af;
    font-size: 0.9rem;
}

.source-selection-step__search-input {
    width: 100%;
    padding: 0.75rem 2.5rem 0.75rem 2.75rem;
    border: 1.5px solid #e5e7eb;
    border-radius: 0.5rem;
    font-size: 0.9rem;
    font-family: inherit;
    color: #111827;
    background: #f9fafb;
    transition: border-color 0.2s ease;
    box-sizing: border-box;
}

.source-selection-step__search-input:focus {
    outline: none;
    border-color: #6366f1;
    background: #ffffff;
}

.source-selection-step__search-input::placeholder {
    color: #9ca3af;
}

.source-selection-step__search-clear {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    padding: 0.25rem;
    font-size: 0.9rem;
}

.source-selection-step__search-clear:hover {
    color: #6b7280;
}

/* Category */
.source-selection-step__category {
    margin-bottom: 1.5rem;
}

.source-selection-step__category-label {
    margin: 0 0 0.75rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

/* Grid: 4 cols desktop, 2 cols mobile */
.source-selection-step__grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
}

@media (max-width: 899px) {
    .source-selection-step__grid {
        grid-template-columns: repeat(3, 1fr);
    }
}

@media (max-width: 639px) {
    .source-selection-step__grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

/* Empty State */
.source-selection-step__empty {
    text-align: center;
    padding: 2rem;
    color: #9ca3af;
}

.source-selection-step__empty i {
    font-size: 2rem;
    margin-bottom: 0.75rem;
    display: block;
}

.source-selection-step__empty p {
    margin: 0 0 0.75rem;
    font-size: 0.95rem;
}

.source-selection-step__empty-clear {
    padding: 0.5rem 1rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    background: #ffffff;
    color: #6366f1;
    cursor: pointer;
    font-size: 0.85rem;
    font-family: inherit;
}

.source-selection-step__empty-clear:hover {
    background: #f9fafb;
}

/* Footer */
.source-selection-step__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid #e5e7eb;
}

.source-selection-step__selection-count {
    font-size: 0.9rem;
    color: #6b7280;
    font-weight: 500;
}

.source-selection-step__next-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.75rem;
    border: none;
    border-radius: 0.5rem;
    background: #6366f1;
    color: #ffffff;
    font-size: 0.95rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.2s ease;
}

.source-selection-step__next-btn:hover:not(:disabled) {
    background: #4f46e5;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.source-selection-step__next-btn:disabled {
    background: #d1d5db;
    color: #9ca3af;
    cursor: not-allowed;
}

.source-selection-step__next-btn i {
    font-size: 0.85rem;
}

/* Responsive footer */
@media (max-width: 639px) {
    .source-selection-step__footer {
        flex-direction: column;
        gap: 1rem;
        text-align: center;
    }

    .source-selection-step__next-btn {
        width: 100%;
        justify-content: center;
    }
}
</style>