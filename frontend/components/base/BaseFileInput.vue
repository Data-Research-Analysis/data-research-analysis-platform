<script setup lang="ts">
interface Props {
    accept?: string;
    multiple?: boolean;
    error?: string | boolean;
    disabled?: boolean;
    dragAndDrop?: boolean;
    maxSize?: number; // in MB
}

const props = withDefaults(defineProps<Props>(), {
    multiple: false,
    disabled: false,
    dragAndDrop: true,
    error: false,
});

const emit = defineEmits<{
    'update:files': [files: FileList | null];
    'change': [event: Event];
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);
const selectedFiles = ref<FileList | null>(null);

function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    selectedFiles.value = target.files;
    emit('update:files', target.files);
    emit('change', event);
}

function triggerFileInput() {
    if (!props.disabled) {
        fileInput.value?.click();
    }
}

function onDragOver(event: DragEvent) {
    if (!props.disabled && props.dragAndDrop) {
        event.preventDefault();
        isDragging.value = true;
    }
}

function onDragLeave() {
    isDragging.value = false;
}

function onDrop(event: DragEvent) {
    if (!props.disabled && props.dragAndDrop) {
        event.preventDefault();
        isDragging.value = false;
        
        const files = event.dataTransfer?.files;
        if (files && fileInput.value) {
            fileInput.value.files = files;
            selectedFiles.value = files;
            emit('update:files', files);
        }
    }
}

const fileNames = computed(() => {
    if (!selectedFiles.value) return [];
    return Array.from(selectedFiles.value).map(f => f.name);
});
</script>

<template>
    <div>
        <input
            ref="fileInput"
            type="file"
            :accept="accept"
            :multiple="multiple"
            :disabled="disabled"
            @change="handleFileChange"
            class="hidden"
        />
        
        <div
            v-if="dragAndDrop"
            @click="triggerFileInput"
            @dragover="onDragOver"
            @dragleave="onDragLeave"
            @drop="onDrop"
            class="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all"
            :class="[
                isDragging ? 'border-primary-blue-100 bg-blue-50' : 'border-gray-300 hover:border-gray-400',
                error && 'border-red-500 bg-red-50',
                disabled && 'opacity-50 cursor-not-allowed bg-gray-100'
            ]"
        >
            <font-awesome-icon :icon="['fas', 'cloud-arrow-up']" class="text-4xl text-gray-400 mb-3" />
            <p class="text-sm text-gray-600 mb-1">
                <span class="font-semibold text-primary-blue-100">Click to upload</span> or drag and drop
            </p>
            <p v-if="accept" class="text-xs text-gray-500">{{ accept }}</p>
            <p v-if="maxSize" class="text-xs text-gray-500 mt-1">Max size: {{ maxSize }}MB</p>
        </div>
        
        <button
            v-else
            type="button"
            @click="triggerFileInput"
            :disabled="disabled"
            class="px-4 py-2 border border-gray-300 rounded-lg shadow-sm font-medium text-gray-700
                   hover:bg-gray-50 focus:ring-2 focus:ring-primary-blue-100 
                   disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
            Choose File{{ multiple ? 's' : '' }}
        </button>
        
        <!-- Selected files list -->
        <div v-if="fileNames.length > 0" class="mt-2 space-y-1">
            <div
                v-for="(name, index) in fileNames"
                :key="index"
                class="text-sm text-gray-600 flex items-center gap-2"
            >
                <font-awesome-icon :icon="['fas', 'file']" class="text-gray-400" />
                <span class="truncate">{{ name }}</span>
            </div>
        </div>
        
        <!-- Error message -->
        <p v-if="error && typeof error === 'string'" class="mt-1 text-sm text-red-500">
            {{ error }}
        </p>
    </div>
</template>
