<script setup lang="ts">
import { usePaidMediaPlansStore, type IPlanStep } from '@/stores/paid_media_plans';

const store = usePaidMediaPlansStore();

const plan = computed(() => store.currentPlan);
const percent = computed(() => {
    const total = store.steps.length || 1;
    return Math.round((store.completedStepCount / total) * 100);
});

const nextActionLabel = computed(() => {
    const waiting = store.waitingStep;
    const running = store.runningStep;
    const planStatus = plan.value?.status;
    if (waiting) return `Your turn: ${waiting.gate?.question ?? `answer the ${waiting.title} gate`}.`;
    if (running) return `${running.title} is running.`;
    if (planStatus === 'failed') return `Needs attention: a step failed. Fix or retry it to continue.`;
    if (planStatus === 'paused') return `Paused — press Resume to continue.`;
    if (planStatus === 'completed') return `Plan ready. ${store.artifacts.length} files.`;
    return `Next up: ${store.nextPendingStep?.title ?? 'nothing pending'}.`;
});

// ─── Timing ────────────────────────────────────────────────────────────

const now = ref(Date.now());
let ticker: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
    ticker = setInterval(() => {
        now.value = Date.now();
    }, 1000);
});

onBeforeUnmount(() => {
    if (ticker) clearInterval(ticker);
});

const TERMINAL_STATUSES = ['completed', 'failed', 'archived'];

const stepStart = (step: IPlanStep): number | null => {
    if (!step.startedAt) return null;
    const t = new Date(step.startedAt).getTime();
    return Number.isNaN(t) ? null : t;
};

const stepEnd = (step: IPlanStep): number | null => {
    if (step.completedAt) {
        const t = new Date(step.completedAt).getTime();
        if (!Number.isNaN(t)) return t;
    }
    if (step.durationMs != null) {
        const start = stepStart(step);
        if (start != null) return start + step.durationMs;
    }
    return null;
};

/** First time any step started — the real beginning of execution. */
const executionStart = computed<number | null>(() => {
    const starts = store.steps.map(stepStart).filter((t): t is number => t != null);
    if (!starts.length) return null;
    return Math.min(...starts);
});

/** Clock used for elapsed time: live while active, frozen once terminal. */
const clock = computed<number>(() => {
    const status = plan.value?.status;
    if (!TERMINAL_STATUSES.includes(status)) return now.value;

    const ends = store.steps.map(stepEnd).filter((t): t is number => t != null);
    if (ends.length) return Math.max(...ends);
    const updated = plan.value?.updatedAt ? new Date(plan.value.updatedAt).getTime() : NaN;
    return Number.isNaN(updated) ? now.value : updated;
});

const elapsedMs = computed<number | null>(() => {
    if (executionStart.value == null) return null;
    return Math.max(0, clock.value - executionStart.value);
});

/** Average duration of finished steps, used to estimate the rest. */
const averageStepMs = computed<number | null>(() => {
    const durations = store.steps
        .filter((step) => step.status === 'completed' || step.status === 'skipped')
        .map((step) => {
            if (step.durationMs != null && step.durationMs > 0) return step.durationMs;
            const start = stepStart(step);
            const end = stepEnd(step);
            if (start != null && end != null && end > start) return end - start;
            return null;
        })
        .filter((d): d is number => d != null && d > 0);

    if (!durations.length) return null;
    return durations.reduce((sum, d) => sum + d, 0) / durations.length;
});

const remainingSteps = computed(() =>
    store.steps.filter((step) => step.status !== 'completed' && step.status !== 'skipped').length,
);

const remainingMs = computed<number | null>(() => {
    if (!store.steps.length) return null;
    if (plan.value?.status === 'completed' || plan.value?.status === 'archived') return 0;
    if (remainingSteps.value === 0) return 0;
    if (averageStepMs.value == null) return null;
    return averageStepMs.value * remainingSteps.value;
});

function formatDuration(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

const elapsedLabel = computed(() => {
    if (elapsedMs.value == null) return '—';
    return formatDuration(elapsedMs.value);
});

const remainingLabel = computed(() => {
    if (plan.value?.status === 'completed' || plan.value?.status === 'archived') return 'done';
    if (remainingMs.value == null) return 'estimating…';
    if (remainingMs.value === 0) return 'done';
    return `~${formatDuration(remainingMs.value)}`;
});
</script>

<template>
    <div v-if="plan" class="bg-white border border-gray-200 rounded-xl px-4 py-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="min-w-0">
                <div class="flex items-center gap-2">
                    <NuxtLink :to="`/projects/${plan.projectId}/plan`" class="text-sm text-gray-500 hover:text-primary-blue-100 truncate">
                        <font-awesome-icon :icon="['fas', 'arrow-left']" class="mr-1" /> Plans
                    </NuxtLink>
                    <span class="text-gray-300">/</span>
                    <h2 class="text-lg font-semibold text-gray-800 truncate">{{ plan.name }}</h2>
                </div>
                <p class="text-sm text-gray-500 mt-0.5">
                    {{ store.completedStepCount }} of {{ store.steps.length }} steps ·
                    {{ plan.markets?.join(', ') || 'no markets' }} ·
                    {{ plan.platforms?.join(', ') || 'no platforms' }} ·
                    {{ plan.budgetTotal ? `${plan.budgetTotal} ${plan.currency}` : 'no budget' }}
                </p>
            </div>
            <div class="flex items-center gap-4">
                <div class="flex items-center gap-2">
                    <div class="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div class="h-full bg-primary-blue-100 rounded-full transition-all" :style="{ width: `${percent}%` }" />
                    </div>
                    <span class="text-xs text-gray-600 font-medium">{{ percent }}%</span>
                </div>
                <p class="text-sm font-medium text-gray-700">{{ nextActionLabel }}</p>
                <span class="text-xs uppercase tracking-wide px-2 py-1 rounded-full"
                    :class="plan.status === 'completed' ? 'bg-green-100 text-green-700' : plan.status === 'running' ? 'bg-blue-100 text-blue-700' : plan.status === 'paused' ? 'bg-amber-100 text-amber-700' : plan.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'">
                    {{ plan.status === 'failed' ? 'needs attention' : plan.status === 'draft' ? 'queued' : plan.status }}
                </span>
            </div>
        </div>
        <div class="mt-2 pt-2 border-t border-gray-100 flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span class="flex items-center gap-1.5">
                <font-awesome-icon :icon="['fas', 'clock']" class="text-gray-400" />
                Elapsed <span class="font-medium text-gray-700">{{ elapsedLabel }}</span>
            </span>
            <span class="text-gray-300">·</span>
            <span class="flex items-center gap-1.5">
                <font-awesome-icon :icon="['fas', 'hourglass-half']" class="text-gray-400" />
                Estimated remaining <span class="font-medium text-gray-700">{{ remainingLabel }}</span>
            </span>
        </div>
    </div>
</template>
