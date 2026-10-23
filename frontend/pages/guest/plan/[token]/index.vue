<script setup lang="ts">
import { usePaidMediaPlansStore, type IPlanStep } from '@/stores/paid_media_plans';
import { useMarkdown } from '~/composables/useMarkdown';

const route = useRoute();
const router = useRouter();

const store = usePaidMediaPlansStore();
const { renderMarkdown } = useMarkdown();

const token = computed(() => String(route.params.token ?? ''));
const GUEST_FREE_STEPS = 6;

const selectedStepKey = ref<string | null>(null);
const hasManuallySelected = ref(false);
const centerTab = ref<'details' | 'files'>('details');
const isExpired = ref(false);
const isActing = ref(false);

const containerRef = ref<HTMLElement | null>(null);
const isWide = ref(false);
const leftWidth = ref(24);
const leftStyle = computed(() => (isWide.value ? { width: `${leftWidth.value}%` } : { width: '100%' }));

let resizing: 'left' | null = null;
let startX = 0;
let startLeft = 0;
let containerWidth = 1;

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function startResize(side: 'left', event: MouseEvent) {
    resizing = side;
    startX = event.clientX;
    startLeft = leftWidth.value;
    containerWidth = containerRef.value?.clientWidth ?? window.innerWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onResizeMove);
    window.addEventListener('mouseup', stopResize);
}

function onResizeMove(event: MouseEvent) {
    if (!resizing) return;
    const deltaPercent = ((event.clientX - startX) / containerWidth) * 100;
    leftWidth.value = clamp(startLeft + deltaPercent, 14, 45);
}

function stopResize() {
    resizing = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', onResizeMove);
    window.removeEventListener('mouseup', stopResize);
}

function updateIsWide() {
    isWide.value = window.innerWidth >= 1024;
}

const planStatus = computed(() => store.currentPlan?.status ?? 'draft');
const statusLabel = computed(() => {
    switch (planStatus.value) {
        case 'running': return 'Running';
        case 'paused': return 'Paused';
        case 'failed': return 'Needs attention';
        case 'completed': return 'Completed';
        case 'archived': return 'Archived';
        default: return 'Queued';
    }
});
const statusClass = computed(() => {
    switch (planStatus.value) {
        case 'running': return 'bg-blue-100 text-blue-700';
        case 'paused': return 'bg-amber-100 text-amber-700';
        case 'failed': return 'bg-red-100 text-red-700';
        case 'completed': return 'bg-green-100 text-green-700';
        case 'archived': return 'bg-gray-100 text-gray-600';
        default: return 'bg-gray-100 text-gray-600';
    }
});

/** Guest gating: steps 1-6 are free, the rest are the registration hook. */
const lockedStepNumbers = computed(() =>
    store.steps.filter((s) => s.stepNumber > GUEST_FREE_STEPS).map((s) => s.stepNumber)
);
const freeStepsDone = computed(() => {
    const freeSteps = store.steps.filter((s) => s.stepNumber <= GUEST_FREE_STEPS);
    return freeSteps.length > 0 && freeSteps.every((s) => s.status === 'completed' || s.status === 'skipped');
});
const atGuestLimit = computed(() => {
    if (!store.currentPlan) return false;
    if (planStatus.value === 'paused') return true;
    return freeStepsDone.value && store.steps.some((s) => s.stepNumber > GUEST_FREE_STEPS && s.status === 'pending');
});
const percent = computed(() => {
    const total = store.steps.length || 1;
    return Math.round((store.completedStepCount / total) * 100);
});

// ─── Timing (elapsed + estimated remaining) ───────────────────────────

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

const executionStart = computed<number | null>(() => {
    const starts = store.steps.map(stepStart).filter((t): t is number => t != null);
    if (!starts.length) return null;
    return Math.min(...starts);
});

const clock = computed<number>(() => {
    const status = planStatus.value;
    if (!TERMINAL_STATUSES.includes(status)) return now.value;
    const ends = store.steps.map(stepEnd).filter((t): t is number => t != null);
    if (ends.length) return Math.max(...ends);
    const updated = store.currentPlan?.updatedAt ? new Date(store.currentPlan.updatedAt).getTime() : NaN;
    return Number.isNaN(updated) ? now.value : updated;
});

const elapsedMs = computed<number | null>(() => {
    if (executionStart.value == null) return null;
    return Math.max(0, clock.value - executionStart.value);
});

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
    if (planStatus.value === 'completed' || planStatus.value === 'archived') return 0;
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

const elapsedLabel = computed(() => (elapsedMs.value == null ? '—' : formatDuration(elapsedMs.value)));
const remainingLabel = computed(() => {
    if (planStatus.value === 'completed' || planStatus.value === 'archived') return 'done';
    if (remainingMs.value == null) return 'estimating…';
    if (remainingMs.value === 0) return 'done';
    return `~${formatDuration(remainingMs.value)}`;
});

function goToRegister() {
    if (import.meta.client) {
        window.location.href = '/register?plan=free&cycle=monthly';
    }
}

let activePlanRefresh: ReturnType<typeof setInterval> | null = null;

async function refreshActivePlan() {
    if (isExpired.value) return;
    try {
        await store.refreshGuestPlanState(token.value);
    } catch (e: any) {
        const status = e?.statusCode ?? e?.status ?? e?.response?.status;
        if (status === 404) {
            isExpired.value = true;
        }
    }
}

async function maybeAutoStart() {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const plan = store.currentPlan;
    if (!plan || isExpired.value) return;
    if (plan.status !== 'draft' && plan.status !== 'running') return;
    if (store.runningStep || store.waitingStep) return;
    const hasWork = store.nextPendingStep || store.steps.some((s) => s.status === 'failed');
    if (!hasWork) return;
    try {
        await store.startGuestPlan(token.value);
    } catch {
        // engine heartbeat re-kicks plans with pending work
    }
}

onMounted(async () => {
    const { forceHide } = useGlobalLoader();
    forceHide();
    updateIsWide();
    window.addEventListener('resize', updateIsWide);
    if (token.value) store.setGuestToken(token.value);
    try {
        await store.fetchGuestPlan(token.value);
    } catch (e: any) {
        const status = e?.statusCode ?? e?.status ?? e?.response?.status;
        if (status === 404) {
            isExpired.value = true;
        }
    }
    autoSelectStep();
    maybeAutoStart();
    activePlanRefresh = setInterval(refreshActivePlan, 5000);
});

onUnmounted(() => {
    if (activePlanRefresh) clearInterval(activePlanRefresh);
    window.removeEventListener('resize', updateIsWide);
    stopResize();
});

watch(() => store.runningStep, () => {
    if (!hasManuallySelected.value) autoSelectStep();
});
watch(() => store.waitingStep, () => {
    // Always surface a gate that needs an answer — the user must see the question.
    if (store.waitingStep) selectedStepKey.value = store.waitingStep.stepKey;
    else if (!hasManuallySelected.value) autoSelectStep();
});

function autoSelectStep() {
    const waiting = store.waitingStep;
    if (waiting) {
        selectedStepKey.value = waiting.stepKey;
        return;
    }
    const running = store.runningStep;
    if (running) {
        selectedStepKey.value = running.stepKey;
        return;
    }
    const lastWithArtifact = store.artifacts[store.artifacts.length - 1];
    if (lastWithArtifact) {
        const step = store.steps.find((s) => s.id === lastWithArtifact.stepId);
        if (step) selectedStepKey.value = step.stepKey;
    } else if (!selectedStepKey.value) {
        const failed = store.steps.find((s) => s.status === 'failed');
        if (failed) selectedStepKey.value = failed.stepKey;
        else {
            const next = store.nextPendingStep;
            if (next) selectedStepKey.value = next.stepKey;
        }
    }
}

const selectedStep = computed<IPlanStep | null>(() => store.steps.find((s) => s.stepKey === selectedStepKey.value) ?? null);
const selectedArtifact = computed(() => {
    if (!selectedStep.value) return store.artifacts[store.artifacts.length - 1] ?? null;
    return store.artifacts.filter((a) => a.stepId === selectedStep.value?.id)[store.artifacts.filter((a) => a.stepId === selectedStep.value?.id).length - 1] ?? null;
});
const selectedStepLocked = computed(() => selectedStep.value ? selectedStep.value.stepNumber > GUEST_FREE_STEPS : false);
const isWaiting = computed(() => selectedStep.value?.status === 'waiting_for_input');
const isFailed = computed(() => selectedStep.value?.status === 'failed');
const isSelectedRunning = computed(() => {
    const running = store.runningStep;
    return Boolean(running && selectedStepKey.value && running.stepKey === selectedStepKey.value);
});

const streamingRendered = computed(() => renderMarkdown(store.streamingText));

const TOOL_LABELS: Record<string, string> = {
    web_search: 'Searching the web',
    web_fetch: 'Fetching a page',
    read_state: 'Reading plan state',
    read_artifact: 'Reading prior deliverables',
    write_artifact: 'Writing the deliverable',
    write_state: 'Updating plan state',
    run_script: 'Building the deliverable file',
    ask_user: 'Preparing a question for you',
};

const latestToolLabel = computed(() => {
    const toolEvents = store.events.filter((event) => event.eventType === 'tool_call');
    const last = toolEvents[toolEvents.length - 1];
    const toolName = last?.data?.toolName ?? '';
    if (!toolName) return store.streamingText ? 'Streaming response...' : 'Thinking...';
    return TOOL_LABELS[toolName] ?? `Running ${toolName}`;
});

async function retrySelectedStep() {
    if (!selectedStep.value || selectedStepLocked.value) return;
    isActing.value = true;
    try {
        await store.runGuestStep(token.value, selectedStep.value.stepKey);
    } finally {
        isActing.value = false;
    }
}

function onSelectStep(step: IPlanStep) {
    selectedStepKey.value = step.stepKey;
    hasManuallySelected.value = true;
}
</script>

<template>
    <div class="h-[calc(100dvh-5rem+400px)] p-4 pb-6 mt-6 flex flex-col">
        <!-- Expired state: the 24h preview lapsed -->
        <div v-if="isExpired" class="max-w-xl mx-auto mt-16 bg-white border border-gray-200 rounded-2xl p-8 text-center">
            <font-awesome-icon :icon="['fas', 'hourglass-end']" class="text-5xl text-gray-300 mb-4" />
            <h1 class="text-xl font-semibold text-gray-800 mb-2">Your free plan preview has expired</h1>
            <p class="text-sm text-gray-500 mb-6">
                Guest plans last 24 hours. Create a free account and we will never lose your plan.
            </p>
            <button
                type="button"
                class="px-6 py-2.5 rounded-lg bg-primary-blue-100 text-white font-medium hover:bg-primary-blue-200 cursor-pointer"
                @click="goToRegister"
            >
                Create a free account
            </button>
        </div>

        <template v-else>
            <!-- Header -->
            <div v-if="store.currentPlan" class="bg-white border border-gray-200 rounded-xl px-4 py-3 mb-3">
                <div class="flex flex-wrap items-center justify-between gap-3">
                    <div class="min-w-0">
                        <div class="flex items-center gap-2">
                            <span class="text-xs uppercase tracking-wide px-2 py-1 rounded-full" :class="statusClass">{{ statusLabel }}</span>
                            <h2 class="text-lg font-semibold text-gray-800 truncate">{{ store.currentPlan.name }}</h2>
                        </div>
                        <p class="text-sm text-gray-500 mt-0.5">
                            {{ store.completedStepCount }} of {{ store.steps.length }} steps ·
                            {{ store.currentPlan.markets?.join(', ') || 'no markets' }} ·
                            {{ store.currentPlan.platforms?.join(', ') || 'no platforms' }}
                        </p>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="flex items-center gap-2">
                            <div class="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div class="h-full bg-primary-blue-100 rounded-full transition-all" :style="{ width: `${percent}%` }" />
                            </div>
                            <span class="text-xs text-gray-600 font-medium">{{ percent }}%</span>
                        </div>
                        <span class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                            <font-awesome-icon :icon="['fas', 'hourglass-half']" class="mr-1" />
                            Free preview lasts 24h — register to keep it
                        </span>
                    </div>
                </div>
                <div class="mt-2 pt-2 border-t border-gray-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span class="flex items-center gap-1.5">
                        <font-awesome-icon :icon="['fas', 'stopwatch']" class="text-primary-blue-100" />
                        Elapsed: <span class="font-medium text-gray-700">{{ elapsedLabel }}</span>
                    </span>
                    <span class="flex items-center gap-1.5">
                        <font-awesome-icon :icon="['fas', 'hourglass-half']" class="text-primary-blue-100" />
                        Estimated remaining: <span class="font-medium text-gray-700">{{ remainingLabel }}</span>
                    </span>
                </div>
            </div>

            <!-- Guest limit reached: registration hook -->
            <div v-if="atGuestLimit && planStatus !== 'completed'" class="mb-3 rounded-2xl bg-gradient-to-r from-primary-blue-100 to-blue-700 text-white p-4 flex flex-wrap items-center justify-between gap-3">
                <div class="min-w-0">
                    <p class="font-semibold">
                        <font-awesome-icon :icon="['fas', 'lock']" class="mr-1" />
                        You have seen the free preview — the rest of the plan is ready to build
                    </p>
                    <p class="text-sm text-blue-100 mt-0.5">
                        Register a free account to unlock ad copy, creatives, media plan, tracking and the full strategy deck. Your 24h preview is saved and continues where it left off.
                    </p>
                </div>
                <button
                    type="button"
                    class="px-5 py-2.5 rounded-lg bg-white text-primary-blue-100 font-semibold hover:bg-blue-50 cursor-pointer shrink-0"
                    @click="goToRegister"
                >
                    Create free account — keep my plan
                </button>
            </div>

            <div ref="containerRef" class="flex flex-col lg:flex-row flex-1 min-h-0 relative">
                <aside class="bg-white border border-gray-200 rounded-2xl p-3 overflow-y-auto shrink-0" :style="leftStyle">
                    <PlanStepTimeline :active-step-key="selectedStepKey" :locked-step-numbers="lockedStepNumbers" @select="onSelectStep" />
                </aside>

                <div
                    class="hidden lg:flex items-center justify-center w-2 shrink-0 cursor-col-resize group"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize steps panel"
                    @mousedown="startResize('left', $event)"
                >
                    <div class="w-0.5 h-10 rounded-full bg-gray-200 group-hover:bg-primary-blue-100 transition-colors" />
                </div>

                <main class="bg-white border border-gray-200 rounded-2xl flex flex-col flex-1 min-w-0 overflow-hidden">
                    <div class="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-100">
                        <div v-if="selectedStep" class="min-w-0">
                            <h2 class="text-lg font-semibold text-gray-800 truncate">
                                <font-awesome-icon v-if="selectedStepLocked" :icon="['fas', 'lock']" class="mr-1 text-gray-400" />
                                {{ selectedStep.title }}
                            </h2>
                            <p class="text-xs text-gray-500">
                                {{ selectedStep.status }} ·
                                <span v-if="selectedStep.durationMs">ran in {{ Math.round(selectedStep.durationMs / 1000) }}s</span>
                            </p>
                        </div>
                        <div v-else />
                        <div class="flex rounded-lg bg-gray-100 p-0.5">
                            <button type="button"
                                class="px-3 py-1.5 text-sm font-medium rounded-md cursor-pointer"
                                :class="centerTab === 'details' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
                                @click="centerTab = 'details'">
                                Step
                            </button>
                            <button type="button"
                                class="px-3 py-1.5 text-sm font-medium rounded-md cursor-pointer"
                                :class="centerTab === 'files' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
                                @click="centerTab = 'files'">
                                Files
                            </button>
                        </div>
                    </div>

                    <div class="flex-1 min-h-0 overflow-y-auto p-4">
                        <template v-if="centerTab === 'details'">
                            <!-- Locked step: registration gate -->
                            <div v-if="selectedStepLocked" class="max-w-md mx-auto text-center py-16">
                                <div class="mx-auto h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                                    <font-awesome-icon :icon="['fas', 'lock']" class="text-3xl text-gray-400" />
                                </div>
                                <h3 class="text-lg font-semibold text-gray-800 mb-1">"{{ selectedStep?.title }}" is a premium deliverable</h3>
                                <p class="text-sm text-gray-500 mb-6">
                                    Register a free account to unlock every deliverable — ad copy, creatives, landing pages, media plan, tracking setup and the client deck — and keep your plan forever.
                                </p>
                                <button
                                    type="button"
                                    class="px-6 py-2.5 rounded-lg bg-primary-blue-100 text-white font-medium hover:bg-primary-blue-200 cursor-pointer"
                                    @click="goToRegister"
                                >
                                    Unlock with a free account
                                </button>
                            </div>

                            <template v-else>
                                <div v-if="!selectedStep" class="text-sm text-gray-500 text-center py-16">
                                    No step selected. Pick a step from the timeline.
                                </div>

                                <template v-else>
                                    <div v-if="isWaiting && selectedStep.gate" class="mb-4">
                                        <PlanGatePrompt :gate="selectedStep.gate" @answer="(gateId, answer) => store.answerGuestGate(token, gateId, answer)" />
                                    </div>

                                    <div v-if="isSelectedRunning" class="mb-3">
                                        <div class="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                                            <div class="flex items-center gap-3 p-4">
                                                <div class="relative h-10 w-10 shrink-0">
                                                    <span class="absolute inset-0 rounded-full bg-primary-blue-100/20 animate-ping"></span>
                                                    <span class="absolute inset-0 rounded-full border-2 border-primary-blue-100/30"></span>
                                                    <span class="absolute inset-0 flex items-center justify-center">
                                                        <font-awesome-icon :icon="['fas', 'sparkles']" class="text-primary-blue-100 text-base" />
                                                    </span>
                                                </div>
                                                <div class="min-w-0 flex-1">
                                                    <p class="text-sm font-semibold text-gray-800 truncate">{{ store.runningStep.title }}</p>
                                                    <p class="text-xs text-gray-500 flex items-center gap-2">
                                                        <span class="w-1.5 h-1.5 rounded-full bg-primary-blue-100 animate-pulse"></span>
                                                        <span class="truncate">{{ latestToolLabel }}</span>
                                                    </p>
                                                </div>
                                                <span class="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-primary-blue-100 text-xs font-medium">
                                                    <font-awesome-icon :icon="['fas', 'circle-notch']" class="animate-spin" />
                                                    Working
                                                </span>
                                            </div>
                                            <div class="h-0.5 w-full bg-gray-100 overflow-hidden">
                                                <div class="plan-loader-bar h-full w-1/3 bg-gradient-to-r from-transparent via-primary-blue-100 to-transparent"></div>
                                            </div>
                                            <div v-if="store.streamingText" class="p-4 border-t border-gray-100">
                                                <div class="prose prose-sm max-w-none text-gray-700" v-html="streamingRendered" />
                                            </div>
                                        </div>
                                    </div>

                                    <div v-if="isFailed" class="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700 mb-3">
                                        <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="text-red-500 mt-0.5 shrink-0" />
                                        <div class="min-w-0">
                                            <p class="font-semibold">Step could not finish</p>
                                            <p class="mt-1">{{ selectedStep.error || 'Unknown error' }}</p>
                                        </div>
                                        <button
                                            type="button"
                                            class="ml-auto px-3 py-1.5 rounded-lg bg-primary-blue-100 text-white text-xs font-medium cursor-pointer"
                                            :disabled="isActing"
                                            @click="retrySelectedStep"
                                        >
                                            {{ isActing ? 'Retrying...' : 'Retry' }}
                                        </button>
                                    </div>

                                    <div v-if="selectedStep.outputSummary" class="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-gray-700 mb-3">
                                        <p class="font-medium text-blue-700 mb-1">Summary</p>
                                        <p class="whitespace-pre-wrap">{{ selectedStep.outputSummary }}</p>
                                    </div>

                                    <PlanArtifactViewer v-if="selectedArtifact" :artifact="selectedArtifact" :allow-download="false" class="mb-3" />
                                    <div v-else class="text-sm text-gray-500 py-6">
                                        <template v-if="selectedStep.status === 'pending'">This step hasn't run yet — the plan reaches it in order.</template>
                                        <template v-else-if="selectedStep.status === 'running'">This step is working now; the deliverable appears here when it's ready.</template>
                                        <template v-else-if="selectedStep.status === 'waiting_for_input'">Waiting for your input to continue this step.</template>
                                        <template v-else-if="selectedStep.status === 'failed'">This step needs attention.</template>
                                        <template v-else>This step produced no deliverable file.</template>
                                    </div>

                                    <div class="mt-4">
                                        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Activity</p>
                                        <PlanProcessLog />
                                    </div>
                                </template>
                            </template>
                        </template>

                        <template v-else>
                            <PlanArtifactPanel :allow-download="false" />
                        </template>
                    </div>
                </main>
            </div>
        </template>
    </div>
</template>

<style scoped>
@keyframes plan-loader-slide {
    0% {
        transform: translateX(-120%);
    }
    100% {
        transform: translateX(420%);
    }
}

.plan-loader-bar {
    animation: plan-loader-slide 1.4s ease-in-out infinite;
}
</style>
