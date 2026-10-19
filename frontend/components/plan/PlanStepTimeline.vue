<script setup lang="ts">
import { usePaidMediaPlansStore, type IPlanStep } from '@/stores/paid_media_plans';

const props = defineProps<{
    activeStepKey: string | null;
}>();

const emit = defineEmits<{
    select: [step: IPlanStep];
}>();

const store = usePaidMediaPlansStore();

const PHASES: Array<{ key: string; label: string }> = [
    { key: 'discover', label: 'Discover' },
    { key: 'define', label: 'Define' },
    { key: 'build', label: 'Build' },
    { key: 'launch', label: 'Launch' },
    { key: 'present', label: 'Present' },
];

const stepsByPhase = computed(() => {
    const map: Record<string, IPlanStep[]> = {};
    for (const phase of PHASES) map[phase.key] = [];
    for (const step of store.steps) {
        if (map[step.phase]) map[step.phase].push(step);
    }
    return map;
});

function phaseDone(steps: IPlanStep[]) {
    return steps.filter((s) => s.status === 'completed' || s.status === 'skipped').length;
}

function statusIcon(step: IPlanStep) {
    if (step.status === 'completed') return ['fas', 'check-circle'] as const;
    if (step.status === 'running') return ['fas', 'circle-notch'] as const;
    if (step.status === 'waiting_for_input') return ['fas', 'circle-exclamation'] as const;
    if (step.status === 'failed') return ['fas', 'circle-xmark'] as const;
    if (step.status === 'skipped') return ['fas', 'minus-circle'] as const;
    return ['fas', 'circle'] as const;
}

function statusClasses(step: IPlanStep) {
    if (step.status === 'completed') return 'text-green-600';
    if (step.status === 'running') return 'text-primary-blue-100 animate-spin';
    if (step.status === 'waiting_for_input') return 'text-amber-500';
    if (step.status === 'failed') return 'text-red-500';
    if (step.status === 'skipped') return 'text-gray-400';
    return 'text-gray-300';
}
</script>

<template>
    <nav class="space-y-4" aria-label="Plan steps">
        <div v-for="phase in PHASES" :key="phase.key">
            <div class="flex items-center justify-between mb-1">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">{{ phase.label }}</p>
                <p class="text-xs text-gray-400">{{ phaseDone(stepsByPhase[phase.key]) }} of {{ stepsByPhase[phase.key].length }}</p>
            </div>
            <ul class="space-y-0.5">
                <li v-for="step in stepsByPhase[phase.key]" :key="step.stepKey">
                    <button
                        type="button"
                        class="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm transition-colors"
                        :class="step.stepKey === activeStepKey ? 'bg-primary-blue-100/10 text-primary-blue-100 font-medium' : 'text-gray-600 hover:bg-gray-50'"
                        :aria-label="`${step.title}, ${step.status}`"
                        @click="emit('select', step)"
                    >
                        <font-awesome-icon :icon="statusIcon(step)" class="w-4 h-4 shrink-0" :class="statusClasses(step)" />
                        <span class="truncate">{{ step.title }}</span>
                    </button>
                </li>
            </ul>
        </div>
    </nav>
</template>
