<script setup lang="ts">
import { useLeadGeneratorCookie } from '@/utils/leadGeneratorCookie';

const props = defineProps<{
    leadGenerator: {
        id: number;
        title: string;
        description: string | null;
        slug: string;
        is_gated: boolean;
    };
    placementId: number;
    additionalContent?: string | null;
}>();

const emit = defineEmits<{
    closed: [];
    downloaded: [leadGeneratorId: number];
}>();

const config = useRuntimeConfig();
const { $swal } = useNuxtApp();
const { markDownloaded, incrementShownCount } = useLeadGeneratorCookie();

const openDownloading = ref(false);
const gateForm = reactive({
    fullName: '',
    email: '',
    company: '',
    phone: '',
    jobTitle: '',
    submitting: false,
    error: null as string | null,
    submitted: false,
});

const close = () => {
    emit('closed');
};

const downloadOpenPdf = async () => {
    if (!import.meta.client) return;
    openDownloading.value = true;
    try {
        const token = getAuthToken();
        const headers: Record<string, string> = token
            ? { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' }
            : {};
        const blob = await $fetch<any>(`${config.public.apiBase}/lead-generators/${props.leadGenerator.slug}/file`, {
            responseType: 'blob',
            headers,
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${props.leadGenerator.title}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        markDownloaded(props.leadGenerator.id);
        emit('downloaded', props.leadGenerator.id);
    } catch (err) {
        console.error('[lead-generator-modal] download error:', err);
        $swal.fire({ icon: 'error', title: 'Error', text: 'Could not download file.', confirmButtonColor: '#1e3a5f' });
    } finally {
        openDownloading.value = false;
    }
};

const submitGateForm = async () => {
    if (!gateForm.email) {
        gateForm.error = 'Email address is required.';
        return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(gateForm.email)) {
        gateForm.error = 'Please enter a valid email address.';
        return;
    }
    gateForm.error = null;
    gateForm.submitting = true;

    try {
        const response = await $fetch<any>(`${config.public.apiBase}/lead-generators/${props.leadGenerator.slug}/gate`, {
            method: 'POST',
            body: {
                email: gateForm.email,
                fullName: gateForm.fullName || undefined,
                company: gateForm.company || undefined,
                phone: gateForm.phone || undefined,
                jobTitle: gateForm.jobTitle || undefined,
            },
        });

        if (response.success && response.downloadToken) {
            gateForm.submitted = true;
            markDownloaded(props.leadGenerator.id);
            emit('downloaded', props.leadGenerator.id);
            if (import.meta.client) {
                try {
                    const blob = await $fetch<any>(`${config.public.apiBase}/lead-generators/download/${response.downloadToken}`, {
                        responseType: 'blob',
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${props.leadGenerator.title}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                } catch (dlErr) {
                    console.error('[lead-generator-modal] blob download error:', dlErr);
                }
            }
        }
    } catch (err: any) {
        console.error('[lead-generator-modal] gate form error:', err);
        gateForm.error = err?.data?.error || 'Something went wrong. Please try again.';
    } finally {
        gateForm.submitting = false;
    }
};

onMounted(() => {
    incrementShownCount(props.placementId);
});
</script>

<template>
    <overlay-dialog @close="close">
        <template #overlay>
            <div class="mt-5">
                <!-- Header -->
                <div class="pb-4 border-b border-gray-100">
                    <div class="flex items-start gap-3">
                        <div class="flex-shrink-0 w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
                            <font-awesome-icon :icon="['fas', 'file-pdf']" class="text-red-500 text-lg" />
                        </div>
                        <div class="flex-1 min-w-0">
                            <h3 class="text-lg font-bold text-gray-900 leading-tight">{{ leadGenerator.title }}</h3>
                            <span
                                :class="leadGenerator.is_gated ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'"
                                class="inline-block px-2 py-0.5 rounded-full text-xs font-medium mt-1"
                            >
                                {{ leadGenerator.is_gated ? 'Free Download — Registration Required' : 'Free Download' }}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Body: vertical layout -->
                <div class="flex flex-col">
                    <!-- Additional content (top) -->
                    <div v-if="additionalContent && additionalContent.replace(/<[^>]*>/g, '').trim()" class="px-0 py-4 border-b border-gray-100">
                        <div class="prose prose-sm max-w-none" v-html="additionalContent"></div>
                    </div>

                    <!-- Lead generator details + form -->
                    <div class="flex-1 pt-4">
                        <p v-if="leadGenerator.description" class="text-gray-600 text-sm leading-relaxed mb-4">
                            {{ leadGenerator.description }}
                        </p>

                        <!-- Open (non-gated) download -->
                        <div v-if="!leadGenerator.is_gated" class="text-center py-4">
                            <p class="text-gray-500 text-sm mb-4">This resource is free to download — no registration needed.</p>
                            <button
                                @click="downloadOpenPdf"
                                :disabled="openDownloading"
                                class="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-blue-100 text-white rounded-xl font-semibold text-sm hover:bg-primary-blue-80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            >
                                <font-awesome-icon v-if="openDownloading" :icon="['fas', 'spinner']" class="animate-spin" />
                                <font-awesome-icon v-else :icon="['fas', 'download']" />
                                {{ openDownloading ? 'Preparing download...' : 'Download PDF' }}
                            </button>
                        </div>

                        <!-- Gated: success state -->
                        <div v-else-if="gateForm.submitted" class="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                            <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 text-xl" />
                            </div>
                            <h4 class="text-base font-bold text-green-900 mb-1">Your download has started!</h4>
                            <p class="text-sm text-green-700">Check your email for a backup link.</p>
                            <button
                                @click="close"
                                class="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors cursor-pointer"
                            >
                                Close
                            </button>
                        </div>

                        <!-- Gated: form -->
                        <div v-else>
                            <p class="text-sm text-gray-500 mb-4">Fill in your details below to get the free PDF.</p>
                            <form @submit.prevent="submitGateForm" novalidate>
                                <div class="space-y-3">
                                    <div>
                                        <label for="modal-fullName" class="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                                        <input id="modal-fullName" v-model="gateForm.fullName" type="text" placeholder="Jane Smith" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-sm" />
                                    </div>
                                    <div>
                                        <label for="modal-gateEmail" class="block text-sm font-medium text-gray-700 mb-1">Email Address <span class="text-red-500">*</span></label>
                                        <input id="modal-gateEmail" v-model="gateForm.email" type="email" placeholder="jane@company.com" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-sm" required />
                                    </div>
                                    <div class="grid grid-cols-2 gap-3">
                                        <div>
                                            <label for="modal-company" class="block text-sm font-medium text-gray-700 mb-1">Company</label>
                                            <input id="modal-company" v-model="gateForm.company" type="text" placeholder="Acme Corp" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-sm" />
                                        </div>
                                        <div>
                                            <label for="modal-jobTitle" class="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                                            <input id="modal-jobTitle" v-model="gateForm.jobTitle" type="text" placeholder="Data Analyst" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-sm" />
                                        </div>
                                    </div>
                                    <div>
                                        <label for="modal-phone" class="block text-sm font-medium text-gray-700 mb-1">Phone <span class="text-gray-400 font-normal">(optional)</span></label>
                                        <input id="modal-phone" v-model="gateForm.phone" type="tel" placeholder="+1 555 000 1234" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-sm" />
                                    </div>
                                </div>

                                <div v-if="gateForm.error" class="mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700">
                                    <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="mr-1" />
                                    {{ gateForm.error }}
                                </div>

                                <button
                                    type="submit"
                                    :disabled="gateForm.submitting"
                                    class="mt-4 w-full py-2.5 bg-primary-blue-100 text-white rounded-xl font-semibold text-sm hover:bg-primary-blue-80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                >
                                    <font-awesome-icon v-if="gateForm.submitting" :icon="['fas', 'spinner']" class="animate-spin mr-2" />
                                    {{ gateForm.submitting ? 'Submitting...' : 'Get Free PDF' }}
                                </button>

                                <p class="text-xs text-gray-400 text-center mt-3">We respect your privacy. Unsubscribe at any time.</p>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </template>
    </overlay-dialog>
</template>
