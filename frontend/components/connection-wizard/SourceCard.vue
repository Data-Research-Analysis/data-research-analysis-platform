<template>
    <div
        class="source-card"
        :class="{
            'source-card--selected': selected,
            'source-card--coming-soon': source.comingSoon,
        }"
        role="button"
        tabindex="0"
        :aria-pressed="selected"
        :aria-label="`Select ${source.name}`"
        @click="handleClick"
        @keydown.enter="handleClick"
        @keydown.space.prevent="handleClick"
    >
        <!-- Popular Badge -->
        <span v-if="source.popular" class="source-card__badge">
            <i class="fas fa-star"></i> Popular
        </span>

        <!-- Selected Checkmark -->
        <span v-if="selected" class="source-card__checkmark">
            <i class="fas fa-check-circle"></i>
        </span>

        <!-- Source Icon / Image -->
        <div class="source-card__icon-wrapper">
            <img
                v-if="source.image"
                :src="source.image"
                :alt="source.name"
                class="source-card__image"
            />
            <i v-else :class="source.icon" class="source-card__icon"></i>
        </div>

        <!-- Source Info -->
        <div class="source-card__info">
            <h4 class="source-card__name">{{ source.name }}</h4>
            <p class="source-card__description">{{ source.description }}</p>
        </div>

        <!-- Coming Soon Overlay -->
        <div v-if="source.comingSoon" class="source-card__coming-soon">
            Coming Soon
        </div>
    </div>
</template>

<script setup lang="ts">
import type { ConnectionSource } from '~/constants/connectionSources';

interface Props {
    source: ConnectionSource;
    selected: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    (e: 'toggle', sourceId: string): void;
}>();

function handleClick() {
    if (props.source.comingSoon) return;
    emit('toggle', props.source.id);
}
</script>

<style scoped>
.source-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.25rem 1rem;
    border: 2px solid #e5e7eb;
    border-radius: 0.75rem;
    background: #ffffff;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: center;
    user-select: none;
}

.source-card:hover:not(.source-card--coming-soon) {
    border-color: #6366f1;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
    transform: translateY(-2px);
}

.source-card--selected {
    border-color: #6366f1;
    background: #eef2ff;
    box-shadow: 0 0 0 1px #6366f1;
}

.source-card--coming-soon {
    opacity: 0.55;
    cursor: not-allowed;
}

/* Badge */
.source-card__badge {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    padding: 0.15rem 0.5rem;
    font-size: 0.65rem;
    font-weight: 600;
    color: #ffffff;
    background: linear-gradient(135deg, #f59e0b, #f97316);
    border-radius: 9999px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
}

/* Checkmark */
.source-card__checkmark {
    position: absolute;
    top: 0.5rem;
    left: 0.5rem;
    font-size: 1.25rem;
    color: #6366f1;
}

/* Icon Wrapper */
.source-card__icon-wrapper {
    width: 3rem;
    height: 3rem;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.75rem;
}

.source-card__image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
}

.source-card__icon {
    font-size: 2rem;
    color: #6b7280;
}

/* Info */
.source-card__info {
    flex: 1;
}

.source-card__name {
    margin: 0 0 0.25rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #111827;
}

.source-card__description {
    margin: 0;
    font-size: 0.75rem;
    color: #6b7280;
    line-height: 1.4;
}

/* Coming Soon Overlay */
.source-card__coming-soon {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 0.35rem;
    text-align: center;
    font-size: 0.7rem;
    font-weight: 600;
    color: #6b7280;
    background: #f3f4f6;
    border-radius: 0 0 0.625rem 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

/* Responsive */
@media (max-width: 639px) {
    .source-card {
        padding: 1rem 0.75rem;
    }

    .source-card__icon-wrapper {
        width: 2.5rem;
        height: 2.5rem;
    }

    .source-card__icon {
        font-size: 1.5rem;
    }

    .source-card__name {
        font-size: 0.8rem;
    }

    .source-card__description {
        font-size: 0.7rem;
    }
}
</style>