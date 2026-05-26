<template>
    <div class="connection-templates">
        <h3 class="connection-templates__title">
            <i class="fas fa-magic"></i>
            Quick-Start Templates
        </h3>
        <p class="connection-templates__subtitle">
            Select a pre-built combination to get started faster
        </p>

        <div class="connection-templates__grid">
            <button
                v-for="template in templates"
                :key="template.id"
                class="template-chip"
                :class="{ 'template-chip--active': isActive(template) }"
                @click="handleSelect(template)"
            >
                <i :class="template.icon" class="template-chip__icon"></i>
                <span class="template-chip__content">
                    <span class="template-chip__name">{{ template.name }}</span>
                    <span class="template-chip__desc">{{ template.description }}</span>
                </span>
                <i
                    v-if="isActive(template)"
                    class="fas fa-check template-chip__check"
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

<style scoped>
.connection-templates {
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid #e5e7eb;
}

.connection-templates__title {
    margin: 0 0 0.25rem;
    font-size: 1rem;
    font-weight: 600;
    color: #111827;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.connection-templates__title i {
    color: #6366f1;
}

.connection-templates__subtitle {
    margin: 0 0 1rem;
    font-size: 0.85rem;
    color: #6b7280;
}

.connection-templates__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 0.75rem;
}

/* Template Chip */
.template-chip {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border: 1.5px solid #e5e7eb;
    border-radius: 0.5rem;
    background: #ffffff;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    font-family: inherit;
}

.template-chip:hover {
    border-color: #6366f1;
    background: #fafafe;
}

.template-chip--active {
    border-color: #6366f1;
    background: #eef2ff;
}

.template-chip__icon {
    font-size: 1.25rem;
    color: #6366f1;
    flex-shrink: 0;
}

.template-chip__content {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
}

.template-chip__name {
    font-size: 0.85rem;
    font-weight: 600;
    color: #111827;
}

.template-chip__desc {
    font-size: 0.75rem;
    color: #6b7280;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.template-chip__check {
    color: #6366f1;
    font-size: 1rem;
    flex-shrink: 0;
}

/* Responsive */
@media (max-width: 639px) {
    .connection-templates__grid {
        grid-template-columns: 1fr;
    }
}
</style>