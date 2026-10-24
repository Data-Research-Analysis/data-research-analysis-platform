<script setup lang="ts">
import type { IPlanArtifact } from '@/stores/paid_media_plans';
import { useMarkdown } from '~/composables/useMarkdown';

const props = defineProps<{
    artifact: IPlanArtifact;
    allowDownload?: boolean;
}>();

const allowDownload = computed(() => props.allowDownload ?? true);

const { renderMarkdown } = useMarkdown();

const renderedMarkdown = computed(() => {
    if (props.artifact.kind === 'markdown') return renderMarkdown(props.artifact.content || '');
    return '';
});

const jsonValue = computed(() => {
    if (props.artifact.kind === 'json') {
        try {
            return JSON.parse(props.artifact.content || '{}');
        } catch {
            return null;
        }
    }
    return null;
});

const csvRows = computed(() => {
    if (props.artifact.kind !== 'csv' || !props.artifact.content) return [];
    return props.artifact.content
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => line.split(',').map((cell) => cell.trim()));
});

const isChecklist = computed(() => props.artifact.kind === 'markdown' && props.artifact.artifactKey.includes('checklist'));

function downloadHref(format?: string) {
    const base = `${baseUrl()}/plans/${props.artifact.planId}/artifacts/${props.artifact.id}/download`;
    return format ? `${base}?format=${format}` : base;
}

const isDownloading = ref(false);

async function downloadArtifact(format?: 'pdf' | 'xlsx') {
    if (isDownloading.value) return;
    isDownloading.value = true;
    try {
        const token = getAuthToken();
        const blob = await $fetch<Blob>(downloadHref(format), {
            headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' },
            responseType: 'blob',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const extension = props.artifact.kind === 'markdown' ? (format ?? 'pdf') : props.artifact.kind;
        link.download = `${props.artifact.artifactKey}.${extension}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    } finally {
        isDownloading.value = false;
    }
}
</script>

<template>
    <div>
        <div v-if="artifact.kind === 'markdown'" class="prose prose-sm max-w-none">
            <div v-if="isChecklist && allowDownload" class="flex items-center gap-2 pb-3 mb-4 border-b border-gray-100">
                <button
                    type="button"
                    class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-blue-100 text-white text-xs hover:bg-primary-blue-200 disabled:opacity-50"
                    :disabled="isDownloading"
                    @click="downloadArtifact('pdf')"
                >
                    <font-awesome-icon :icon="['fas', isDownloading ? 'circle-notch' : 'file-pdf']" class="w-3.5 h-3.5" :class="{ 'animate-spin': isDownloading }" />
                    {{ isDownloading ? 'Downloading...' : 'Download PDF' }}
                </button>
                <button
                    type="button"
                    class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-green-600 text-green-700 text-xs hover:bg-green-50 disabled:opacity-50"
                    :disabled="isDownloading"
                    @click="downloadArtifact('xlsx')"
                >
                    <font-awesome-icon :icon="['fas', isDownloading ? 'circle-notch' : 'file-excel']" class="w-3.5 h-3.5" :class="{ 'animate-spin': isDownloading }" />
                    {{ isDownloading ? 'Downloading...' : 'Download Excel' }}
                </button>
                <span class="text-xs text-gray-400">Check off each item — open the Excel to mark Done / In Progress / Not Done / N/A / Needs Review.</span>
            </div>
            <div v-html="renderedMarkdown" />
        </div>
        <div v-else-if="artifact.kind === 'json' && jsonValue">
            <pre class="text-sm bg-gray-50 p-4 rounded-lg overflow-auto">{{ JSON.stringify(jsonValue, null, 2) }}</pre>
        </div>
        <div v-else-if="artifact.kind === 'csv' && csvRows.length" class="overflow-x-auto">
            <table class="text-sm w-full border-collapse">
                <thead>
                    <tr>
                        <th v-for="(cell, i) in csvRows[0]" :key="i" class="border-b border-gray-200 px-3 py-1.5 text-left text-gray-600 font-medium">
                            {{ cell }}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(row, i) in csvRows.slice(1)" :key="i" class="odd:bg-gray-50">
                        <td v-for="(cell, j) in row" :key="j" class="border-b border-gray-100 px-3 py-1.5 text-gray-700">{{ cell }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div v-else-if="artifact.kind === 'html'" class="text-sm text-gray-500">
            <button v-if="allowDownload" type="button" class="text-primary-blue-100 hover:underline disabled:opacity-50" :disabled="isDownloading" @click="downloadArtifact">
                {{ isDownloading ? 'Downloading...' : 'Download HTML file' }}
            </button>
            <span v-else>Preview only — register to download deliverables.</span>
        </div>
        <div v-else class="flex flex-col items-center justify-center py-12 gap-3">
            <font-awesome-icon :icon="['fas', artifact.kind === 'pptx' ? 'file-powerpoint' : 'file-excel']" class="text-4xl text-gray-300" />
            <p class="text-sm text-gray-500">{{ artifact.title }} · {{ artifact.mimeType }}</p>
            <button
                v-if="allowDownload"
                type="button"
                class="px-4 py-2 rounded-lg bg-primary-blue-100 text-white text-sm hover:bg-primary-blue-200 disabled:opacity-50"
                :disabled="isDownloading"
                @click="downloadArtifact"
            >
                <font-awesome-icon :icon="['fas', isDownloading ? 'circle-notch' : 'download']" class="mr-1" :class="{ 'animate-spin': isDownloading }" />
                {{ isDownloading ? 'Downloading...' : 'Download' }}
            </button>
            <span v-else class="text-sm text-gray-500">Preview only — register to download deliverables.</span>
        </div>
    </div>
</template>
