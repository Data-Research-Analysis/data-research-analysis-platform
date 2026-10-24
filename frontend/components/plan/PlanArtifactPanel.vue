<script setup lang="ts">
import { usePaidMediaPlansStore } from '@/stores/paid_media_plans';

const store = usePaidMediaPlansStore();

const emit = defineEmits<{
    openArtifact: [artifactId: number];
}>();

const props = withDefaults(defineProps<{
    allowDownload?: boolean;
}>(), {
    allowDownload: true,
});

function kindIcon(kind: string) {
    if (kind === 'markdown') return ['fas', 'file-pdf'] as const;
    if (kind === 'xlsx') return ['fas', 'file-excel'] as const;
    if (kind === 'pptx') return ['fas', 'file-powerpoint'] as const;
    if (kind === 'json') return ['fas', 'file-code'] as const;
    if (kind === 'csv') return ['fas', 'file-csv'] as const;
    if (kind === 'html') return ['fas', 'globe'] as const;
    return ['fas', 'file'] as const;
}

const isDownloadingId = ref<number | null>(null);

async function downloadArtifact(artifact: { id: number; planId: number; artifactKey: string; kind: string }, format?: 'pdf' | 'xlsx') {
    if (isDownloadingId.value !== null) return;
    isDownloadingId.value = artifact.id;
    try {
        const token = getAuthToken();
        const url = `${baseUrl()}/plans/${artifact.planId}/artifacts/${artifact.id}/download${format ? `?format=${format}` : ''}`;
        const blob = await $fetch<Blob>(url, {
            headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' },
            responseType: 'blob',
        });
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        const extension = artifact.kind === 'markdown' ? (format ?? 'pdf') : artifact.kind;
        link.download = `${artifact.artifactKey}.${extension}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
    } finally {
        isDownloadingId.value = null;
    }
}

function isChecklistArtifact(artifact: { artifactKey: string; kind: string }) {
    return artifact.kind === 'markdown' && artifact.artifactKey.includes('checklist');
}
</script>

<template>
    <div>
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Generated files</p>
        <ul class="space-y-1">
            <li
                v-for="artifact in store.artifacts"
                :key="artifact.id"
                class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 group"
            >
                <font-awesome-icon :icon="kindIcon(artifact.kind)" class="text-gray-400 w-4 h-4 shrink-0" />
                <button type="button" class="text-sm text-gray-700 truncate flex-1 text-left hover:text-primary-blue-100 cursor-pointer" @click="emit('openArtifact', artifact.id)">
                    {{ artifact.title }}
                </button>
                <span v-if="artifact.version > 1" class="text-[10px] text-gray-400">v{{ artifact.version }}</span>
                <button
                    v-if="isChecklistArtifact(artifact)"
                    type="button"
                    class="text-green-600 hover:text-green-800 opacity-0 group-hover:opacity-100 disabled:opacity-50"
                    :disabled="isDownloadingId === artifact.id"
                    :aria-label="`Download ${artifact.title} as Excel`"
                    title="Download as Excel"
                    @click="downloadArtifact(artifact, 'xlsx')"
                >
                    <font-awesome-icon :icon="['fas', isDownloadingId === artifact.id ? 'circle-notch' : 'file-excel']" class="w-3.5 h-3.5" :class="{ 'animate-spin': isDownloadingId === artifact.id }" />
                </button>
                <button
                    v-if="allowDownload"
                    type="button"
                    class="text-gray-400 hover:text-primary-blue-100 opacity-0 group-hover:opacity-100 disabled:opacity-50"
                    :disabled="isDownloadingId === artifact.id"
                    :aria-label="`Download ${artifact.title}`"
                    @click="downloadArtifact(artifact)"
                >
                    <font-awesome-icon :icon="['fas', isDownloadingId === artifact.id ? 'circle-notch' : 'download']" class="w-3.5 h-3.5" :class="{ 'animate-spin': isDownloadingId === artifact.id }" />
                </button>
            </li>
            <li v-if="store.artifacts.length === 0" class="text-sm text-gray-400 px-2 py-1">No files yet. Run a step to generate deliverables.</li>
        </ul>
    </div>
</template>
