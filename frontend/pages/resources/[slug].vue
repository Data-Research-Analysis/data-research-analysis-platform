<script setup>
definePageMeta({ layout: 'default' });
const config = useRuntimeConfig();
const route = useRoute();
const slug = computed(() => route.params.slug);

// Gate form state
const gateForm = reactive({
    fullName: '',
    email: '',
    company: '',
    phone: '',
    jobTitle: '',
    submitting: false,
    error: null,
    submitted: false,
});

// Open PDF download state
const openDownloading = ref(false);

// Fetch lead generator metadata — use useAsyncData's returned data ref so SSR state hydrates correctly on the client
const { data: leadGenerator, error: fetchError } = await useAsyncData(
    `lead-generator-${slug.value}`,
    async () => {
        try {
            const response = await $fetch(
                `${config.public.apiBase}/lead-generators/${slug.value}`
            );
            if (response.success && response.data) {
                return response.data;
            }
            return null;
        } catch {
            return null;
        }
    }
);

if (!leadGenerator.value) {
    throw createError({ statusCode: 404, statusMessage: 'Resource not found', fatal: true });
}

// SEO meta — reactive so it updates when leadGenerator hydrates
useHead({
    title: computed(() => leadGenerator.value ? `${leadGenerator.value.title} | Data Research Analysis` : 'Resource'),
    meta: [
        {
            name: 'description',
            content: computed(() => leadGenerator.value?.description || 'Download this free resource from Data Research Analysis.'),
        },
        {
            property: 'og:title',
            content: computed(() => leadGenerator.value?.title || 'Resource'),
        },
        {
            property: 'og:description',
            content: computed(() => leadGenerator.value?.description || 'Download this free resource from Data Research Analysis.'),
        },
    ],
});

// Fire-and-forget view tracking on mount
onMounted(() => {
    $fetch(`${config.public.apiBase}/lead-generators/${slug.value}/view`, { method: 'POST' }).catch(() => {});
});

// Open PDF: stream to browser as blob download
const downloadOpenPdf = async () => {
    if (!import.meta.client) return;
    openDownloading.value = true;
    try {
        const token = getAuthToken();
        const headers = token
            ? { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' }
            : {};
        const blob = await $fetch(`${config.public.apiBase}/lead-generators/${slug.value}/file`, {
            responseType: 'blob',
            headers,
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${leadGenerator.value?.title || 'download'}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error('[resources/slug] open download error:', err);
    } finally {
        openDownloading.value = false;
    }
};

// Gated PDF: submit form, receive token, trigger download
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
        const response = await $fetch(`${config.public.apiBase}/lead-generators/${slug.value}/gate`, {
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
            // Immediately download as a blob using the frontend-specific token (separate from the email token)
            if (import.meta.client) {
                try {
                    const blob = await $fetch(`${config.public.apiBase}/lead-generators/download/${response.downloadToken}`, {
                        responseType: 'blob',
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${leadGenerator.value?.title || 'download'}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                } catch (dlErr) {
                    console.error('[resources/slug] immediate blob download error:', dlErr);
                }
            }
        }
    } catch (err) {
        console.error('[resources/slug] gate form error:', err);
        gateForm.error = err?.data?.error || 'Something went wrong. Please try again.';
    } finally {
        gateForm.submitting = false;
    }
};
</script>

<template>
    <div class="max-w-3xl mx-auto px-4 py-12">

        <div v-if="leadGenerator">

            <!-- Breadcrumb -->
            <nav class="flex items-center gap-2 text-sm text-gray-500 mb-6">
                <NuxtLink to="/" class="hover:text-gray-700 transition-colors">Home</NuxtLink>
                <font-awesome-icon :icon="['fas', 'chevron-right']" class="text-xs" />
                <NuxtLink to="/resources" class="hover:text-gray-700 transition-colors">Resources</NuxtLink>
                <font-awesome-icon :icon="['fas', 'chevron-right']" class="text-xs" />
                <span class="text-gray-700 truncate">{{ leadGenerator.title }}</span>
            </nav>

            <!-- Hero section -->
            <div class="mb-8">
                <div class="flex items-start gap-4 mb-4">
                    <div class="flex-shrink-0 w-14 h-14 bg-red-50 rounded-xl flex items-center justify-center">
                        <font-awesome-icon :icon="['fas', 'file-pdf']" class="text-red-500 text-2xl" />
                    </div>
                    <div class="flex-1 min-w-0">
                        <span :class="leadGenerator.is_gated ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'" class="inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-2">
                            {{ leadGenerator.is_gated ? 'Free Download — Registration Required' : 'Free Download' }}
                        </span>
                        <h1 class="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">{{ leadGenerator.title }}</h1>
                    </div>
                </div>
                <p v-if="leadGenerator.description" class="text-gray-600 text-base leading-relaxed">{{ leadGenerator.description }}</p>
            </div>

            <!-- Open (non-gated) download card -->
            <div v-if="!leadGenerator.is_gated" class="bg-white shadow rounded-2xl p-8 text-center">
                <p class="text-gray-600 mb-6">This resource is free to download — no registration needed.</p>
                <button
                    @click="downloadOpenPdf"
                    :disabled="openDownloading"
                    class="inline-flex items-center gap-2 px-8 py-3 bg-primary-blue-100 text-white rounded-xl font-semibold text-base hover:bg-primary-blue-80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                    <font-awesome-icon v-if="openDownloading" :icon="['fas', 'spinner']" class="animate-spin" />
                    <font-awesome-icon v-else :icon="['fas', 'download']" />
                    {{ openDownloading ? 'Preparing download...' : 'Download PDF' }}
                </button>
            </div>

            <!-- Gated: success state -->
            <div v-else-if="gateForm.submitted" class="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
                <div class="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 text-2xl" />
                </div>
                <h2 class="text-xl font-bold text-green-900 mb-2">Your download has started!</h2>
                <p class="text-green-700">Check your email for a copy of the download link in case your download doesn't begin automatically.</p>
            </div>

            <!-- Gated: gate form -->
            <div v-else class="bg-white shadow rounded-2xl p-8">
                <h2 class="text-lg font-bold text-gray-900 mb-1">Get your free copy</h2>
                <p class="text-sm text-gray-500 mb-6">Fill in your details below and we'll send the PDF straight to your inbox.</p>

                <form @submit.prevent="submitGateForm" novalidate>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

                        <!-- Full Name -->
                        <div>
                            <label for="fullName" class="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                            <input id="fullName" v-model="gateForm.fullName" type="text" placeholder="Jane Smith" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-sm" />
                        </div>

                        <!-- Email (required) -->
                        <div>
                            <label for="gateEmail" class="block text-sm font-medium text-gray-700 mb-1">Email Address <span class="text-red-500">*</span></label>
                            <input id="gateEmail" v-model="gateForm.email" type="email" placeholder="jane@company.com" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-sm" required />
                        </div>

                        <!-- Company -->
                        <div>
                            <label for="company" class="block text-sm font-medium text-gray-700 mb-1">Company</label>
                            <input id="company" v-model="gateForm.company" type="text" placeholder="Acme Corp" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-sm" />
                        </div>

                        <!-- Job Title -->
                        <div>
                            <label for="jobTitle" class="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                            <input id="jobTitle" v-model="gateForm.jobTitle" type="text" placeholder="Data Analyst" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-sm" />
                        </div>

                        <!-- Phone -->
                        <div class="md:col-span-2">
                            <label for="phone" class="block text-sm font-medium text-gray-700 mb-1">Phone <span class="text-gray-400 font-normal">(optional)</span></label>
                            <input id="phone" v-model="gateForm.phone" type="tel" placeholder="+1 555 000 1234" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue-100 text-sm" />
                        </div>

                    </div>

                    <!-- Error -->
                    <div v-if="gateForm.error" class="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                        <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="mr-2" />
                        {{ gateForm.error }}
                    </div>

                    <button
                        type="submit"
                        :disabled="gateForm.submitting"
                        class="w-full py-3 bg-primary-blue-100 text-white rounded-xl font-semibold text-base hover:bg-primary-blue-80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                        <font-awesome-icon v-if="gateForm.submitting" :icon="['fas', 'spinner']" class="animate-spin mr-2" />
                        {{ gateForm.submitting ? 'Submitting...' : 'Get Free PDF' }}
                    </button>

                    <p class="text-xs text-gray-400 text-center mt-3">We respect your privacy. Unsubscribe at any time.</p>
                </form>
            </div>

        </div>
    </div>
</template>
