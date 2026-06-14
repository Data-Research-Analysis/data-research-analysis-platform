<template>
    <div v-if="progress" class="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 p-4 mb-6 bg-indigo-50 border border-indigo-200 rounded-xl">
        <!-- Left: Progress Info -->
        <div class="flex items-center gap-3">
            <!-- Step indicators -->
            <div class="flex items-center gap-1.5">
                <template v-for="i in progress.total" :key="i">
                    <div
                        class="w-2.5 h-2.5 rounded-full transition-colors duration-200"
                        :class="{
                            'bg-indigo-500': i < progress.current,
                            'bg-indigo-500 ring-2 ring-indigo-300 animate-pulse': i === progress.current,
                            'bg-gray-300': i > progress.current,
                        }"
                    ></div>
                </template>
            </div>
            <span class="text-sm font-medium text-indigo-700">
                Connecting source {{ progress.current }} of {{ progress.total }}
            </span>
            <span v-if="sourceName" class="text-sm text-indigo-500">
                &mdash; {{ sourceName }}
            </span>
        </div>

        <!-- Right: Cancel button -->
        <button
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-lg cursor-pointer transition-colors duration-150 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
            @click="handleCancel"
        >
            <i class="fas fa-times text-[0.65rem]"></i>
            Cancel Queue
        </button>
    </div>
</template>

<script setup lang="ts">
import { CONNECTION_SOURCES } from '~/constants/connectionSources';

const { getQueueProgress, cancelQueue } = useWizardReturn();
const route = useRoute();

const projectId = computed(() => route.params.projectid as string);
const progress = ref<ReturnType<typeof getQueueProgress>>(null);

const sourceName = computed(() => {
    if (!progress.value) return '';
    const source = CONNECTION_SOURCES.find(s => s.id === progress.value!.sourceId);
    return source?.name || '';
});

onMounted(() => {
    progress.value = getQueueProgress();
});

function handleCancel() {
    cancelQueue(projectId.value);
}
</script>