<script setup lang="ts">
import { usePaidMediaPlansStore } from '@/stores/paid_media_plans';
import { useProjectsStore } from '@/stores/projects';

definePageMeta({ layout: 'project' });

const route = useRoute();
const router = useRouter();
const projectId = computed(() => parseInt(String(route.params.projectid), 10));

const store = usePaidMediaPlansStore();
const subscriptionStore = useSubscriptionStore();
const projectsStore = useProjectsStore();

const currentPlanId = computed(() => {
    const project = projectsStore.projects.find(p => p.id === projectId.value);
    return project?.current_plan_id ?? null;
});

const aligningPlanId = ref<number | null>(null);

async function alignPlan(planId: number) {
    if (aligningPlanId.value !== null) return;
    aligningPlanId.value = planId;
    try {
        const ok = await projectsStore.alignPlan(projectId.value, planId);
        if (ok) await store.fetchPlans(projectId.value);
    } finally {
        aligningPlanId.value = null;
    }
}

const planBuildsHint = computed(() => {
    const stats = subscriptionStore.usageStats;
    if (!stats) return '';
    if (stats.maxPlansPerMonth === null || stats.maxPlansPerMonth === -1) return 'Unlimited plan builds on your plan.';
    const remaining = Math.max(0, stats.maxPlansPerMonth - stats.plansUsed);
    return `${remaining} of ${stats.maxPlansPerMonth} plan builds left this month.`;
});

onMounted(async () => {
    subscriptionStore.fetchUsageStats().catch(() => {});
    if (import.meta.client && projectsStore.projects.length === 0) {
        await projectsStore.retrieveProjects();
    }
    await store.fetchPlans(projectId.value);
});

function openPlan(planId: number) {
    router.push(`/projects/${projectId.value}/plan/${planId}`);
}

function onCreated(planId: number) {
    router.push(`/projects/${projectId.value}/plan/${planId}`);
}

async function confirmDelete(planId: number, name: string) {
    const { $swal } = useNuxtApp();
    const result = await $swal.fire({
        title: 'Delete this plan?',
        text: `${name} and its chat history, files, and events will be permanently removed. Deleting a plan does not restore your monthly plan-build allowance.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
    });
    if (!result.isConfirmed) return;
    try {
        await store.deletePlan(planId);
        await store.fetchPlans(projectId.value);
    } catch {
        // plan stays in the list on failure
    }
}

const statusLabel: Record<string, string> = {
    draft: 'Queued',
    running: 'In progress',
    paused: 'Paused',
    failed: 'Needs attention',
    completed: 'Ready',
    archived: 'Archived',
};
</script>

<template>
    <div class="p-6 max-w-6xl mx-auto">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
                <h1 class="text-2xl font-semibold text-gray-800">Paid media plans</h1>
                <p class="text-sm text-gray-500 mt-1">Plan, launch, track, improve. A guided loop that builds your plan pack step by step.</p>
                <p v-if="planBuildsHint" class="text-xs text-gray-400 mt-1">{{ planBuildsHint }}</p>
            </div>
            <PlanStartModal :project-id="projectId" @created="onCreated" />
        </div>

        <div v-if="store.isLoading" class="flex items-center justify-center py-20">
            <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-3xl text-primary-blue-100" />
        </div>

        <div v-else-if="store.plans.length === 0" class="bg-white border border-gray-200 rounded-2xl p-10 text-center">
            <font-awesome-icon :icon="['fas', 'bullseye']" class="text-4xl text-gray-300 mx-auto mb-4" />
            <h2 class="text-lg font-semibold text-gray-800">Build your paid media plan</h2>
            <p class="text-sm text-gray-500 mt-2 max-w-md mx-auto">
                A complete plan in 17 steps. About 3 checks from you and 30 minutes of work, most of it done for you.
                You get a brief, research, audience, keywords, copy, creatives, landing pages, media plan, tracking,
                build guide, checklist, deck, and results review.
            </p>
        </div>

        <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div
                    v-for="plan in store.plans"
                    :key="plan.id"
                    class="relative bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-shadow"
                >
                    <button
                        type="button"
                        class="text-left w-full cursor-pointer"
                        @click="openPlan(plan.id)"
                    >
                        <div class="flex items-center justify-between mb-2 pr-6">
                            <h3 class="font-semibold text-gray-800 truncate">{{ plan.name }}</h3>
                            <span class="text-xs px-2 py-1 rounded-full"
                                :class="plan.status === 'completed' ? 'bg-green-100 text-green-700' : plan.status === 'running' ? 'bg-blue-100 text-blue-700' : plan.status === 'paused' ? 'bg-amber-100 text-amber-700' : plan.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'">
                                {{ statusLabel[plan.status] }}
                            </span>
                        </div>
                        <div class="flex items-center gap-2 text-sm text-gray-600 mb-3">
                            <span>{{ plan.completedStepCount }} of {{ plan.stepCount }} steps</span>
                            <span class="text-gray-300">·</span>
                            <span>{{ plan.artifactCount }} files</span>
                        </div>
                        <div class="flex flex-wrap gap-1">
                            <span v-for="market in plan.markets" :key="market" class="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{{ market }}</span>
                            <span v-if="plan.budgetTotal" class="text-xs px-2 py-0.5 bg-primary-blue-100/10 text-primary-blue-100 rounded-full">{{ plan.budgetTotal }} {{ plan.currency }}</span>
                        </div>
                        <p class="text-xs text-gray-400 mt-3">Updated {{ new Date(plan.updatedAt).toLocaleDateString() }}</p>
                    </button>
                    <button
                        type="button"
                        class="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                        :aria-label="`Delete plan ${plan.name}`"
                        @click="confirmDelete(plan.id, plan.name)"
                    >
                        <font-awesome-icon :icon="['fas', 'trash']" class="w-4 h-4" />
                    </button>

                    <button
                        v-if="plan.id === currentPlanId"
                        type="button"
                        class="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium bg-green-100 text-green-700 rounded-lg"
                    >
                        <font-awesome-icon :icon="['fas', 'bullseye']" class="w-3 h-3" />
                        Aligned with intelligence overview
                    </button>
                    <button
                        v-else
                        type="button"
                        class="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 hover:bg-primary-blue-100/10 hover:text-primary-blue-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        :disabled="aligningPlanId !== null"
                        @click="alignPlan(plan.id)"
                    >
                        <font-awesome-icon :icon="['fas', 'bullseye']" class="w-3 h-3" />
                        {{ aligningPlanId === plan.id ? 'Aligning…' : 'Align with intelligence overview' }}
                    </button>
                </div>
        </div>
    </div>
</template>
