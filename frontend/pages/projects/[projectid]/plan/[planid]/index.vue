<script setup lang="ts">
import { usePaidMediaPlansStore, type IPlanStep } from '@/stores/paid_media_plans';
import { useMarkdown } from '~/composables/useMarkdown';

definePageMeta({ layout: 'project' });

const route = useRoute();
const router = useRouter();
const projectId = computed(() => parseInt(String(route.params.projectid), 10));
const planId = computed(() => parseInt(String(route.params.planid), 10));

const store = usePaidMediaPlansStore();
const { renderMarkdown } = useMarkdown();

const selectedStepKey = ref<string | null>(null);
const centerTab = ref<'details' | 'files'>('details');
// const isChatOpen = ref(false); -- Ask AI chat hidden for now; restore when needed
const isActing = ref(false);
const isSyncing = ref(false);

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

async function syncPlanResults() {
    isSyncing.value = true;
    try {
        await store.syncResults(planId.value);
    } finally {
        isSyncing.value = false;
    }
}

const isControlling = ref(false);
const isBriefOpen = ref(false);

async function pausePlan() {
    isControlling.value = true;
    try {
        await store.pausePlan(planId.value);
    } finally {
        isControlling.value = false;
    }
}

async function resumePlan() {
    isControlling.value = true;
    try {
        await store.resumePlan(planId.value);
    } finally {
        isControlling.value = false;
    }
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
const canPause = computed(() => planStatus.value === 'running' && !store.waitingStep);
const canResume = computed(() => ['paused', 'failed', 'draft'].includes(planStatus.value));
const briefComplete = computed(() => {
    const coreFacts = store.currentPlan?.state?.core_facts ?? {};
    return Boolean(store.currentPlan?.name?.trim()) && Boolean(coreFacts.website) && Boolean(coreFacts.industry) && Array.isArray(coreFacts.platforms) && coreFacts.platforms.length > 0 && Array.isArray(coreFacts.markets) && coreFacts.markets.length > 0;
});
const isAdvancedMode = computed(() => store.currentPlan?.mode === 'advanced');

let activePlanRefresh: ReturnType<typeof setInterval> | null = null;

async function refreshActivePlan() {
    const plan = store.currentPlan;
    if (!plan) return;
    if (plan.status !== 'running' && !store.waitingStep) return;
    try {
        await store.refreshPlanState(planId.value);
    } catch {
        // transient network issue — the next tick retries
    }
}

onMounted(async () => {
    const { forceHide } = useGlobalLoader();
    forceHide();
    updateIsWide();
    window.addEventListener('resize', updateIsWide);
    store.initializeSocketListeners();
    await store.fetchPlan(planId.value);
    autoSelectStep();
    maybeAutoResume();
    activePlanRefresh = setInterval(refreshActivePlan, 5000);
});

async function maybeAutoResume() {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const plan = store.currentPlan;
    if (!plan) return;
    // Only re-kick plans the engine should be working on. Paused and failed
    // plans wait for an explicit user decision, so they never auto-resume.
    if (plan.status !== 'draft' && plan.status !== 'running') return;
    if (plan.status === 'completed' || plan.status === 'archived') return;
    if (store.runningStep || store.waitingStep) return;
    const hasWork = store.nextPendingStep || store.steps.some((s) => s.status === 'failed');
    if (!hasWork) return;
    try {
        await store.startPlan(planId.value);
    } catch {
        // keep existing state; the engine heartbeat re-kicks plans with pending work
    }
}

onUnmounted(() => {
    if (activePlanRefresh) clearInterval(activePlanRefresh);
    window.removeEventListener('resize', updateIsWide);
    stopResize();
});

watch(() => store.runningStep, () => autoSelectStep());
watch(() => store.waitingStep, () => autoSelectStep());

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
const isWaiting = computed(() => selectedStep.value?.status === 'waiting_for_input');
const isFailed = computed(() => selectedStep.value?.status === 'failed');

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
const planReady = computed(() => store.currentPlan?.status === 'completed');
// const allStepsCompleted = computed(() =>
//     store.steps.length > 0 && store.steps.every((step) => step.status === 'completed' || step.status === 'skipped')
// );

// watch(allStepsCompleted, (completed) => {
//     if (!completed) isChatOpen.value = false;
// });

async function retrySelectedStep() {
    if (!selectedStep.value) return;
    isActing.value = true;
    try {
        await store.retryStep(planId.value, selectedStep.value.stepKey);
    } finally {
        isActing.value = false;
    }
}

function openArtifact(artifactId: number) {
    router.push(`/projects/${projectId.value}/plan/${planId.value}/artifact/${artifactId}`);
}

function onSelectStep(step: IPlanStep) {
    selectedStepKey.value = step.stepKey;
}
</script>

<template>
    <div class="h-[calc(100dvh-5rem+400px)] p-4 pb-6 flex flex-col">
        <PlanProgressHeader class="mb-3" />
        <div v-if="store.currentPlan && planStatus !== 'completed'" class="flex flex-wrap items-center gap-2 mb-3">
            <span class="text-xs uppercase tracking-wide px-2 py-1 rounded-full font-medium" :class="statusClass">{{ statusLabel }}</span>
            <button
                v-if="canPause"
                type="button"
                class="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
                :disabled="isControlling"
                @click="pausePlan"
            >
                <font-awesome-icon :icon="['fas', 'pause']" class="mr-1" />
                Pause
            </button>
            <button
                v-if="canResume"
                type="button"
                class="px-3 py-1.5 rounded-lg bg-primary-blue-100 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
                :disabled="isControlling"
                @click="resumePlan"
            >
                <font-awesome-icon :icon="['fas', isControlling ? 'circle-notch' : 'play']" class="mr-1" :class="{ 'animate-spin': isControlling }" />
                Resume
            </button>
            <button
                v-if="isAdvancedMode"
                type="button"
                class="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 cursor-pointer"
                @click="isBriefOpen = true"
            >
                <font-awesome-icon :icon="['fas', 'clipboard-list']" class="mr-1" />
                Client brief
                <span class="ml-1 text-xs" :class="briefComplete ? 'text-green-600' : 'text-amber-600'">
                    {{ briefComplete ? 'complete' : 'incomplete' }}
                </span>
            </button>
            <p v-if="!isAdvancedMode" class="text-sm text-gray-500">
                Basic mode: the AI builds the brief from your website and asks only for what it needs — answer its questions as they appear.
            </p>
            <p v-if="planStatus === 'failed'" class="text-sm text-red-600">
                A step needs attention. Fix or retry it — the loop will continue automatically.
            </p>
            <p v-else-if="store.waitingStep" class="text-sm text-amber-700">
                Waiting for your input. Answer the step's question to continue.
            </p>
        </div>
        <div v-if="planReady" class="flex flex-wrap items-center gap-2 mb-3">
            <span class="text-sm text-gray-600 font-medium mr-1">Plan ready:</span>
            <PlanExportButton :plan-id="planId" />
            <PlanPublishModal :plan-id="planId" />

            <button
                type="button"
                class="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
                :disabled="isSyncing"
                @click="syncPlanResults"
            >
                <font-awesome-icon :icon="['fas', isSyncing ? 'circle-notch' : 'rotate']" class="mr-1" :class="{ 'animate-spin': isSyncing }" />
                {{ isSyncing ? 'Syncing...' : 'Sync results' }}
            </button>
        </div>
        <div ref="containerRef" class="flex flex-col lg:flex-row flex-1 min-h-0 relative">
            <aside class="bg-white border border-gray-200 rounded-2xl p-3 overflow-y-auto shrink-0" :style="leftStyle">
                <PlanStepTimeline :active-step-key="selectedStepKey" @select="onSelectStep" />
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
                        <h2 class="text-lg font-semibold text-gray-800 truncate">{{ selectedStep.title }}</h2>
                        <p class="text-xs text-gray-500">
                            {{ selectedStep.status }} ·
                            <span v-if="selectedStep.durationMs">ran in {{ Math.round(selectedStep.durationMs / 1000) }}s</span>
                            <span v-if="selectedStep.attempts > 1"> · attempt {{ selectedStep.attempts }}</span>
                        </p>
                    </div>
                    <div v-else />
                    <div class="flex gap-2 items-center shrink-0">
                        <button v-if="selectedStep?.status === 'failed'" type="button"
                            class="px-3 py-1.5 rounded-lg bg-primary-blue-100 text-white text-sm disabled:opacity-50 cursor-pointer"
                            :disabled="isActing" @click="retrySelectedStep()">
                            Retry
                        </button>
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
                        <!-- Ask AI chat hidden for now; restore when needed
                        <div class="relative group">
                            <button
                                type="button"
                                class="px-3 py-1.5 rounded-lg border text-sm font-medium"
                                :class="allStepsCompleted
                                    ? ['border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer', isChatOpen ? 'bg-gray-100' : '']
                                    : 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'"
                                :disabled="!allStepsCompleted"
                                :aria-disabled="!allStepsCompleted"
                                :aria-label="allStepsCompleted ? 'Ask AI' : 'Ask AI, disabled until all steps are completed'"
                                :aria-describedby="!allStepsCompleted ? 'ask-ai-disabled-tooltip' : undefined"
                                @click="isChatOpen = !isChatOpen"
                            >
                                <font-awesome-icon :icon="['fas', allStepsCompleted ? 'comments' : 'circle-exclamation']" class="mr-1" />
                                Ask AI
                            </button>
                            <span
                                v-if="!allStepsCompleted"
                                id="ask-ai-disabled-tooltip"
                                role="tooltip"
                                class="pointer-events-none absolute right-0 top-full mt-2 z-30 w-64 rounded-lg bg-gray-900 px-3 py-2 text-xs leading-5 text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
                            >
                                AI chat will be enabled once all of the steps have been completed.
                            </span>
                        </div>
                        -->
                    </div>
                </div>

                <div class="flex-1 min-h-0 overflow-y-auto p-4">
                    <template v-if="centerTab === 'details'">
                        <div v-if="!selectedStep" class="text-sm text-gray-500 text-center py-16">
                            No step selected. Pick a step from the timeline.
                        </div>

                        <template v-else>
                            <div v-if="isWaiting && selectedStep.gate" class="mb-4">
                                <PlanGatePrompt :gate="selectedStep.gate" @answer="(gateId, answer) => store.answerGate(planId, gateId, answer)" />
                            </div>

                            <div v-if="store.runningStep" class="mb-3">
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
                            </div>

                            <div v-if="selectedStep.outputSummary" class="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-gray-700 mb-3">
                                <p class="font-medium text-blue-700 mb-1">Summary</p>
                                <p class="whitespace-pre-wrap">{{ selectedStep.outputSummary }}</p>
                            </div>

                            <PlanArtifactViewer v-if="selectedArtifact" :artifact="selectedArtifact" class="mb-3" />
                            <div v-else-if="selectedStep.status === 'completed'" class="text-sm text-gray-500 py-6">
                                This step produced no deliverable file.
                            </div>

                            <div class="mt-4">
                                <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Activity</p>
                                <PlanProcessLog />
                            </div>
                        </template>
                    </template>

                    <template v-else>
                        <PlanArtifactPanel @open-artifact="openArtifact" />
                    </template>
                </div>
            </main>

            <!-- Ask AI chat hidden for now; restore when needed
            <aside
                v-if="isChatOpen"
                class="absolute inset-y-0 right-0 w-[30rem] max-w-full bg-white border-l border-gray-200 shadow-2xl rounded-l-2xl z-20 flex flex-col"
            >
                <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <p class="text-sm font-semibold text-gray-700">
                        <font-awesome-icon :icon="['fas', 'comments']" class="mr-1" />
                        Ask the plan AI
                    </p>
                    <button type="button" class="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer" @click="isChatOpen = false">
                        <font-awesome-icon :icon="['fas', 'xmark']" />
                    </button>
                </div>
                <div class="flex-1 min-h-0 overflow-hidden">
                    <PlanChat />
                </div>
            </aside>
            -->
        </div>
    </div>

    <overlay-dialog v-if="isBriefOpen" @close="isBriefOpen = false">
        <template #overlay>
            <div class="max-h-[80vh] overflow-y-auto">
                <PlanBriefForm :plan-id="planId" @close="isBriefOpen = false" @saved="store.fetchPlan(planId)" />
            </div>
        </template>
    </overlay-dialog>
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
