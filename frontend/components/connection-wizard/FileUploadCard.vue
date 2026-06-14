<template>
    <div class="pt-4">
        <!-- Drop Zone -->
        <div
            v-if="!uploadedFile"
            class="relative border-2 border-dashed border-gray-300 rounded-xl p-10 px-6 text-center cursor-pointer transition-all duration-200 bg-gray-50 hover:border-indigo-500 hover:bg-violet-50"
            :class="{
                'border-indigo-500 bg-violet-100': isDragOver,
                'border-red-300 bg-red-50': !!errorMessage,
            }"
            @dragover.prevent="isDragOver = true"
            @dragleave.prevent="isDragOver = false"
            @drop.prevent="handleDrop"
            @click="triggerFileInput"
        >
            <input
                ref="fileInputRef"
                type="file"
                :accept="acceptTypes"
                class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                @change="handleFileSelect"
            />
            <div class="relative pointer-events-none">
                <i class="fas fa-cloud-upload-alt text-[2.5rem] text-gray-400 mb-3 block"></i>
                <p class="m-0 mb-1 text-[0.95rem] text-gray-700">
                    <strong>Click to upload</strong> or drag and drop
                </p>
                <p class="m-0 text-[0.8rem] text-gray-400">
                    {{ acceptHint }}
                </p>
            </div>
        </div>

        <!-- Upload Progress / Selected File -->
        <div v-if="uploadedFile" class="flex flex-wrap sm:flex-nowrap items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-xl">
            <div class="text-2xl text-gray-500 shrink-0">
                <i :class="fileIcon"></i>
            </div>
            <div class="basis-[calc(100%-3.5rem)] sm:basis-auto flex-1 min-w-0">
                <p class="m-0 text-sm font-semibold text-gray-900 overflow-hidden text-ellipsis whitespace-nowrap">{{ uploadedFile.name }}</p>
                <p class="mt-0.5 text-xs text-gray-400">{{ formatFileSize(uploadedFile.size) }}</p>
                <!-- Upload Progress Bar -->
                <div v-if="uploading" class="mt-2 h-1 bg-gray-200 rounded overflow-hidden">
                    <div
                        class="h-full bg-indigo-500 rounded transition-[width] duration-300 ease-linear"
                        :style="{ width: `${uploadProgress}%` }"
                    ></div>
                </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
                <button
                    v-if="!uploading && !uploadComplete"
                    class="inline-flex items-center justify-center gap-1 py-2 px-4 border-none rounded text-[0.8rem] font-semibold font-inherit cursor-pointer transition-all duration-150 bg-indigo-500 text-white hover:not(:disabled):bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    type="button"
                    @click="handleUpload"
                >
                    <i class="fas fa-upload"></i>
                    Upload
                </button>
                <span v-if="uploadComplete" class="inline-flex items-center gap-1 text-[0.8rem] font-semibold text-emerald-600">
                    <i class="fas fa-check-circle"></i>
                    Uploaded
                </span>
                <button
                    class="inline-flex items-center justify-center gap-1 py-1.5 px-2 border-none rounded text-[0.8rem] font-semibold font-inherit cursor-pointer transition-all duration-150 bg-gray-100 text-gray-500 hover:not(:disabled):bg-gray-200 hover:not(:disabled):text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    type="button"
                    :disabled="uploading"
                    @click="handleRemove"
                >
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>

        <!-- Error -->
        <div v-if="errorMessage" class="flex items-center gap-2 mt-3 py-2.5 px-3.5 bg-red-50 border border-red-200 rounded-lg text-[0.825rem] text-red-600">
            <i class="fas fa-exclamation-triangle shrink-0"></i>
            <span>{{ errorMessage }}</span>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { ConnectionSource } from '~/constants/connectionSources';

const props = defineProps<{
    source: ConnectionSource;
    projectId: string;
}>();

const emit = defineEmits<{
    'status-change': [status: 'idle' | 'loading' | 'connected' | 'error', data?: any];
}>();

const fileInputRef = ref<HTMLInputElement | null>(null);
const isDragOver = ref(false);
const uploading = ref(false);
const uploadComplete = ref(false);
const uploadProgress = ref(0);
const uploadedFile = ref<File | null>(null);
const errorMessage = ref<string | null>(null);

const acceptTypes = computed(() => {
    if (props.source.id === 'pdf') return '.pdf';
    return '.xlsx,.xls,.csv';
});

const acceptHint = computed(() => {
    if (props.source.id === 'pdf') return 'PDF files up to 50MB';
    return 'Excel (.xlsx, .xls) or CSV files up to 50MB';
});

const fileIcon = computed(() => {
    if (!uploadedFile.value) return '';
    const name = uploadedFile.value.name.toLowerCase();
    if (name.endsWith('.pdf')) return 'fas fa-file-pdf text-red-600';
    if (name.endsWith('.csv')) return 'fas fa-file-csv text-green-600';
    return 'fas fa-file-excel text-green-600';
});

function triggerFileInput() {
    fileInputRef.value?.click();
}

function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) {
        selectFile(input.files[0]);
    }
}

function handleDrop(event: DragEvent) {
    isDragOver.value = false;
    const files = event.dataTransfer?.files;
    if (files?.[0]) {
        selectFile(files[0]);
    }
}

function selectFile(file: File) {
    errorMessage.value = null;
    uploadComplete.value = false;

    // Validate file type
    const name = file.name.toLowerCase();
    const isValidType = props.source.id === 'pdf'
        ? name.endsWith('.pdf')
        : (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv'));

    if (!isValidType) {
        errorMessage.value = `Invalid file type. ${acceptHint.value}`;
        return;
    }

    // Validate file size (50MB)
    if (file.size > 50 * 1024 * 1024) {
        errorMessage.value = 'File is too large. Maximum size is 50MB.';
        return;
    }

    uploadedFile.value = file;
    emit('status-change', 'idle');
}

async function handleUpload() {
    if (!uploadedFile.value) return;

    uploading.value = true;
    uploadProgress.value = 0;
    errorMessage.value = null;
    emit('status-change', 'loading');

    try {
        const formData = new FormData();
        formData.append('file', uploadedFile.value);
        formData.append('data_source_type', props.source.id === 'pdf' ? 'pdf' : 'excel');

        const token = localStorage.getItem('auth_token') || '';

        // Simulate progress for now (actual upload may not report progress)
        const progressInterval = setInterval(() => {
            if (uploadProgress.value < 90) {
                uploadProgress.value += 10;
            }
        }, 200);

        const config = useRuntimeConfig();
        const apiBase = config.public?.apiBase || 'http://localhost:8080';

        const response = await $fetch(`${apiBase}/data-source/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth',
            },
            body: formData,
        });

        clearInterval(progressInterval);
        uploadProgress.value = 100;
        uploadComplete.value = true;

        emit('status-change', 'connected', {
            sourceId: props.source.id,
            fileName: uploadedFile.value.name,
            response,
        });
    } catch (error: any) {
        uploadProgress.value = 0;
        errorMessage.value = error?.data?.message || error?.message || 'Upload failed. Please try again.';
        emit('status-change', 'error', { error: errorMessage.value });
    } finally {
        uploading.value = false;
    }
}

function handleRemove() {
    uploadedFile.value = null;
    uploadComplete.value = false;
    uploadProgress.value = 0;
    errorMessage.value = null;
    if (fileInputRef.value) {
        fileInputRef.value.value = '';
    }
    emit('status-change', 'idle');
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
</script>