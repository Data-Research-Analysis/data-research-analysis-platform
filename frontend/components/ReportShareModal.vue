<script setup lang="ts">
import { useReports, type IReport } from '@/composables/useReports';

const props = defineProps<{
    report: IReport;
    projectId: number;
}>();

const emit = defineEmits<{
    close: [];
    updated: [report: IReport];
}>();

const reports = useReports();
const { $swal } = useNuxtApp();

const state = reactive({
    loading: false,
    expiryDays: 30,
    copied: false,
});

const publicUrl = computed(() => {
    if (!props.report.share_key) return null;
    if (import.meta.client) {
        return `${window.location.origin}/public-report/${props.report.share_key}`;
    }
    return null;
});

const expiryOptions = [
    { label: '7 days', value: 7 },
    { label: '30 days', value: 30 },
    { label: '90 days', value: 90 },
    { label: '1 year', value: 365 },
];

async function generate() {
    state.loading = true;
    const result = await reports.generateShareKey(props.report.id, props.projectId, state.expiryDays);
    state.loading = false;
    if (result) {
        emit('updated', { ...props.report, share_key: result.key, share_expires_at: result.expiresAt });
    } else {
        $swal.fire('Error', 'Could not generate share link. Please try again.', 'error');
    }
}

async function revoke() {
    const { value: confirmed } = await $swal.fire({
        title: 'Revoke share link?',
        text: 'Anyone with the current link will no longer be able to access this report.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Yes, revoke it',
    });
    if (!confirmed) return;
    state.loading = true;
    const ok = await reports.revokeShareKey(props.report.id, props.projectId);
    state.loading = false;
    if (ok) {
        emit('updated', { ...props.report, share_key: null, share_expires_at: null });
    } else {
        $swal.fire('Error', 'Could not revoke share link.', 'error');
    }
}

async function copyLink() {
    if (!publicUrl.value || !import.meta.client) return;

    let success = false;
    try {
        await navigator.clipboard.writeText(publicUrl.value);
        success = true;
    } catch {
        // Fallback for HTTP / non-secure contexts where clipboard API is unavailable
        const textarea = document.createElement('textarea');
        textarea.value = publicUrl.value;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        success = document.execCommand('copy');
        document.body.removeChild(textarea);
    }

    if (success) {
        state.copied = true;
        setTimeout(() => { state.copied = false; }, 2000);
        $swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Link copied to clipboard',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true,
        });
    }
}

function formatExpiry(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
</script>

<template>
    <div
        class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        @click.self="emit('close')"
    >
        <div class="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <!-- Header -->
            <div class="flex justify-between items-center mb-5">
                <div>
                    <h3 class="text-lg font-bold text-gray-900">Share Report</h3>
                    <p class="text-sm text-gray-500 mt-0.5">Generate a public link anyone can view.</p>
                </div>
                <button
                    class="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                    @click="emit('close')"
                >
                    <font-awesome-icon :icon="['fas', 'xmark']" class="text-lg" />
                </button>
            </div>

            <!-- Active link -->
            <div v-if="report.share_key && publicUrl" class="mb-5">
                <label class="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Public Link</label>
                <div class="flex items-center gap-2">
                    <input
                        :value="publicUrl"
                        readonly
                        class="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700 truncate focus:outline-none"
                    />
                    <button
                        class="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors cursor-pointer"
                        :class="state.copied
                            ? 'border-green-300 bg-green-50 text-green-700'
                            : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'"
                        @click="copyLink"
                    >
                        <font-awesome-icon :icon="['fas', state.copied ? 'check' : 'copy']" />
                        {{ state.copied ? 'Copied!' : 'Copy' }}
                    </button>
                </div>
                <p v-if="report.share_expires_at" class="text-xs text-gray-400 mt-1.5">
                    <font-awesome-icon :icon="['fas', 'clock']" class="mr-1" />
                    Expires {{ formatExpiry(report.share_expires_at) }}
                </p>
            </div>

            <!-- No link yet -->
            <div v-else class="mb-5 p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-center">
                <font-awesome-icon :icon="['fas', 'link']" class="text-3xl text-gray-300 mb-2" />
                <p class="text-sm text-gray-500">No public link generated yet.</p>
            </div>

            <!-- Expiry selector + actions -->
            <div class="flex items-end gap-3">
                <div class="flex-1">
                    <label class="block text-xs font-medium text-gray-600 mb-1">
                        {{ report.share_key ? 'Replace link — expires in' : 'Link expires in' }}
                    </label>
                    <select
                        v-model="state.expiryDays"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue-300 focus:border-transparent"
                    >
                        <option v-for="opt in expiryOptions" :key="opt.value" :value="opt.value">
                            {{ opt.label }}
                        </option>
                    </select>
                </div>
                <button
                    class="inline-flex items-center gap-2 px-4 py-2 bg-primary-blue-300 hover:bg-primary-blue-100 text-white rounded-lg transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    :disabled="state.loading"
                    @click="generate"
                >
                    <font-awesome-icon
                        :icon="['fas', state.loading ? 'spinner' : 'link']"
                        :class="{ 'animate-spin': state.loading }"
                    />
                    {{ report.share_key ? 'Replace Link' : 'Generate Link' }}
                </button>
            </div>

            <!-- Revoke -->
            <div v-if="report.share_key" class="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                <button
                    class="inline-flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors cursor-pointer disabled:opacity-50"
                    :disabled="state.loading"
                    @click="revoke"
                >
                    <font-awesome-icon :icon="['fas', 'ban']" />
                    Revoke link
                </button>
            </div>
        </div>
    </div>
</template>
