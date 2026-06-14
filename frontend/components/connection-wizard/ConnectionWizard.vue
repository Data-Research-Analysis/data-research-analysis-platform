<template>
    <div class="max-w-[1080px] mx-auto px-4 py-8 sm:px-6 min-h-screen">
        <!-- Queue Processing State -->
        <div v-if="processingQueue" class="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div class="mb-6">
                <div class="inline-flex items-center gap-3 px-5 py-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                    <i class="fas fa-spinner fa-spin text-indigo-500 text-lg"></i>
                    <span class="text-sm font-medium text-indigo-700">
                        Preparing connection {{ queueProgress.current }} of {{ queueProgress.total }}...
                    </span>
                </div>
            </div>
            <p class="text-gray-500 text-sm">Redirecting to the next data source setup page.</p>
        </div>

        <!-- Normal Source Selection -->
        <template v-else>
            <!-- Header -->
            <div class="mb-8 text-center">
                <h1 class="mb-2 text-2xl sm:text-3xl font-bold text-gray-900">Smart Connection Wizard</h1>
                <p class="text-gray-500 text-sm">Choose data sources to connect. Each will be set up sequentially using its dedicated setup page.</p>
            </div>

            <!-- Source Selection -->
            <SourceSelectionStep
                v-model="selectedSourceIds"
                @next="handleConnectSources"
            />
        </template>
    </div>
</template>

<script setup lang="ts">
import { CONNECTION_SOURCES } from '~/constants/connectionSources';

const selectedSourceIds = ref<string[]>([]);
const route = useRoute();
const router = useRouter();
const { setQueue, getQueue, hasActiveQueue } = useWizardReturn();

const projectId = computed(() => route.params.projectid as string);
const processingQueue = ref(false);
const queueProgress = ref({ current: 1, total: 1 });

/**
 * On mount, check if there's a remaining queue from a previous connection.
 * If so, auto-redirect to the next source's connect page.
 */
onMounted(() => {
    const queue = getQueue();
    if (queue && hasActiveQueue()) {
        const currentItem = queue.items[queue.currentIndex];
        if (currentItem) {
            processingQueue.value = true;
            queueProgress.value = {
                current: queue.currentIndex + 1,
                total: queue.items.length,
            };
            // Brief delay so user sees the status, then redirect
            setTimeout(() => {
                router.push(`/projects/${projectId.value}/data-sources/connect/${currentItem.connectRoute}`);
            }, 600);
        }
    }
});

function handleConnectSources() {
    if (selectedSourceIds.value.length === 0) return;

    // Resolve connect routes for all selected sources
    const resolved = selectedSourceIds.value
        .map(id => CONNECTION_SOURCES.find(s => s.id === id))
        .filter((s): s is NonNullable<typeof s> => !!s && !!s.connectRoute);

    if (resolved.length === 0) return;

    // Single source — go directly, no queue needed
    if (resolved.length === 1) {
        router.push(`/projects/${projectId.value}/data-sources/connect/${resolved[0].connectRoute}`);
        return;
    }

    // Multiple sources — store queue and redirect to first
    setQueue(
        projectId.value,
        resolved.map(s => s.id),
        resolved.map(s => s.connectRoute),
    );

    router.push(`/projects/${projectId.value}/data-sources/connect/${resolved[0].connectRoute}`);
}
</script>