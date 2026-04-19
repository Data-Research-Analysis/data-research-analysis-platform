<script setup lang="ts">
definePageMeta({ layout: 'default' });
const { $swal } = useNuxtApp();
const config = useRuntimeConfig();
const router = useRouter();

interface State {
    submitting: boolean;
    error: string | null;
    slugManuallyEdited: boolean;
    title: string;
    slug: string;
    description: string;
    isGated: boolean;
    pdfFile: File | null;
    dragOver: boolean;
}
const state = reactive<State>({
    submitting: false,
    error: null,
    slugManuallyEdited: false,
    title: '',
    slug: '',
    description: '',
    isGated: true,
    pdfFile: null,
    dragOver: false,
});

const pdfInput = ref<HTMLInputElement | null>(null);

const resourcePreviewUrl = computed(() => {
    const base = config.public.siteUrl || 'https://www.dataresearchanalysis.com';
    return `${base}/resources/${state.slug || 'your-slug'}`;
});

const generateSlug = (text: string): string => {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/[\s]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-|-$/g, '');
};

watch(() => state.title, (newTitle) => {
    if (!state.slugManuallyEdited) {
        state.slug = generateSlug(newTitle);
    }
});

const onSlugInput = (e: Event): void => {
    state.slugManuallyEdited = true;
    state.slug = generateSlug((e.target as HTMLInputElement).value);
};

const validateAndSetPdf = (file: File | undefined): void => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
        ($swal).fire({ icon: 'error', title: 'Invalid file', text: 'Only PDF files are accepted.', confirmButtonColor: '#1e3a5f' });
        if (pdfInput.value) pdfInput.value.value = '';
        state.pdfFile = null;
        return;
    }
    state.pdfFile = file;
};

const onFileChange = (e: Event): void => validateAndSetPdf((e.target as HTMLInputElement).files?.[0]);

const onDrop = (e: DragEvent): void => {
    e.preventDefault();
    state.dragOver = false;
    validateAndSetPdf(e.dataTransfer?.files[0]);
};

const submitForm = async () => {
    if (!state.title.trim()) {
        ($swal).fire({ icon: 'warning', title: 'Required', text: 'Title is required.', confirmButtonColor: '#1e3a5f' });
        return;
    }
    if (!state.slug.trim()) {
        ($swal).fire({ icon: 'warning', title: 'Required', text: 'Slug is required.', confirmButtonColor: '#1e3a5f' });
        return;
    }
    if (!state.pdfFile) {
        ($swal).fire({ icon: 'warning', title: 'Required', text: 'A PDF file is required.', confirmButtonColor: '#1e3a5f' });
        return;
    }

    state.submitting = true;
    state.error = null;

    try {
        const token = getAuthToken();
        const formData = new FormData();
        formData.append('title', state.title.trim());
        formData.append('slug', state.slug.trim());
        formData.append('description', state.description.trim());
        formData.append('isGated', String(state.isGated));
        formData.append('pdf', state.pdfFile);

        const response = await $fetch(`${config.public.apiBase}/admin/lead-generators/add`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' },
            body: formData,
        });

        if (response.success) {
            await ($swal).fire({ icon: 'success', title: 'Created!', text: 'Lead generator created successfully.', confirmButtonColor: '#1e3a5f' });
            router.push('/admin/lead-generators');
        }
    } catch (err) {
        console.error('[create lead-generator] error:', err);
        const msg = err?.data?.error || 'Failed to create lead generator.';
        state.error = msg;
        ($swal).fire({ icon: 'error', title: 'Error', text: msg, confirmButtonColor: '#1e3a5f' });
    } finally {
        state.submitting = false;
    }
};
</script>

<template>
    <div class="flex flex-row">
        <sidebar-admin class="w-1/6" />
        <div class="w-5/6 bg-gray-50 min-h-screen">
            <div class="ml-4 mr-4 md:ml-10 md:mr-10 mt-6 mb-16">

                <!-- Header -->
                <div class="flex items-center gap-4 mb-6">
                    <NuxtLink to="/admin/lead-generators" class="text-gray-500 hover:text-gray-700 transition-colors">
                        <font-awesome-icon :icon="['fas', 'arrow-left']" />
                    </NuxtLink>
                    <div>
                        <h1 class="text-2xl font-bold text-gray-900">Add Lead Generator</h1>
                        <p class="text-sm text-gray-500 mt-0.5">Upload a PDF and configure it as open or gated</p>
                    </div>
                </div>

                <!-- Form -->
                <div class="bg-white shadow rounded-lg p-8 max-w-2xl">
                    <form @submit.prevent="submitForm" novalidate>

                        <!-- Title -->
                        <div class="mb-5">
                            <label for="title" class="block text-sm font-medium text-gray-700 mb-1">Title <span class="text-red-500">*</span></label>
                            <input
                                id="title"
                                v-model="state.title"
                                type="text"
                                placeholder="e.g. The Ultimate Guide to Data Analytics"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-sm"
                                required
                            />
                        </div>

                        <!-- Slug -->
                        <div class="mb-5">
                            <label for="slug" class="block text-sm font-medium text-gray-700 mb-1">Slug <span class="text-red-500">*</span></label>
                            <input
                                id="slug"
                                :value="state.slug"
                                @input="onSlugInput"
                                type="text"
                                placeholder="auto-generated-from-title"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-sm font-mono"
                                required
                            />
                            <p class="text-xs text-gray-400 mt-1">
                                Public URL: <span class="text-primary-blue-100 font-mono">{{ resourcePreviewUrl }}</span>
                            </p>
                        </div>

                        <!-- Description -->
                        <div class="mb-5">
                            <label for="description" class="block text-sm font-medium text-gray-700 mb-1">Description <span class="text-gray-400 font-normal">(optional)</span></label>
                            <textarea
                                id="description"
                                v-model="state.description"
                                rows="4"
                                placeholder="A brief description shown on the resource landing page..."
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-sm resize-vertical"
                            />
                        </div>

                        <!-- Gated toggle -->
                        <div class="mb-5">
                            <div class="flex items-start gap-3">
                                <button
                                    type="button"
                                    @click="state.isGated = !state.isGated"
                                    :class="state.isGated ? 'bg-primary-blue-100' : 'bg-gray-300'"
                                    class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus:outline-none mt-0.5"
                                >
                                    <span
                                        :class="state.isGated ? 'translate-x-5' : 'translate-x-0'"
                                        class="pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200"
                                    />
                                </button>
                                <div>
                                    <p class="text-sm font-medium text-gray-700">Gated PDF</p>
                                    <p class="text-xs text-gray-500 mt-0.5">
                                        When enabled, visitors must submit their contact details to receive a one-time download link via email.
                                        When disabled, the PDF is freely downloadable.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <!-- PDF Upload -->
                        <div class="mb-7">
                            <label class="block text-sm font-medium text-gray-700 mb-1">PDF File <span class="text-red-500">*</span></label>
                            <div
                                :class="state.dragOver ? 'border-primary-blue-100 bg-blue-50' : 'border-gray-300 hover:border-primary-blue-100'"
                                class="border-2 border-dashed rounded-lg p-6 text-center transition-colors"
                                @dragover.prevent="state.dragOver = true"
                                @dragenter.prevent="state.dragOver = true"
                                @dragleave.prevent="state.dragOver = false"
                                @drop="onDrop"
                            >
                                <input
                                    ref="pdfInput"
                                    type="file"
                                    accept=".pdf,application/pdf"
                                    @change="onFileChange"
                                    class="hidden"
                                    id="pdf-upload"
                                />
                                <label for="pdf-upload" class="cursor-pointer">
                                    <font-awesome-icon v-if="!state.pdfFile" :icon="['fas', 'file-pdf']" class="text-gray-300 text-4xl mb-2" />
                                    <font-awesome-icon v-else :icon="['fas', 'file-pdf']" class="text-red-500 text-4xl mb-2" />
                                    <p v-if="!state.pdfFile" class="text-sm text-gray-500">Click to browse or drag and drop</p>
                                    <p v-else class="text-sm font-medium text-gray-900">{{ state.pdfFile.name }}</p>
                                    <p class="text-xs text-gray-400 mt-1">PDF only, max 50MB</p>
                                </label>
                            </div>
                        </div>

                        <!-- Actions -->
                        <div class="flex items-center gap-3">
                            <button
                                type="submit"
                                :disabled="state.submitting"
                                class="px-6 py-2.5 bg-primary-blue-100 text-white rounded-lg hover:bg-primary-blue-80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium cursor-pointer"
                            >
                                <font-awesome-icon v-if="state.submitting" :icon="['fas', 'spinner']" class="animate-spin mr-2" />
                                {{ state.submitting ? 'Creating...' : 'Create Lead Generator' }}
                            </button>
                            <NuxtLink to="/admin/lead-generators" class="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                                Cancel
                            </NuxtLink>
                        </div>

                    </form>
                </div>

            </div>
        </div>
    </div>
</template>
