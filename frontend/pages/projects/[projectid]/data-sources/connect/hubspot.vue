<script setup lang="ts">
definePageMeta({ layout: 'marketing-project' });

import { useHubSpot } from '@/composables/useHubSpot';

const route = useRoute();
const router = useRouter();
const { $swal } = useNuxtApp() as any;

const projectId = parseInt(String(route.params.projectid));
const hubspot = useHubSpot();

const state = reactive({
    loading: false,
    error: null as string | null,
});

async function connectWithHubSpot() {
    try {
        state.loading = true;
        state.error = null;
        await hubspot.startOAuthFlow(projectId);
        // Browser navigates away to HubSpot — execution stops here.
    } catch (err: any) {
        state.error = err.message || 'Failed to start HubSpot OAuth';
        state.loading = false;
        $swal.fire({
            title: 'Connection Error',
            text: state.error,
            icon: 'error',
        });
    }
}

useHead({ title: 'Connect HubSpot CRM' });
</script>

<template>
    <div class="min-h-screen bg-gray-50 py-12 px-4">
        <div class="max-w-xl mx-auto">

            <!-- Back link -->
            <NuxtLink
                :to="`/projects/${projectId}/data-sources`"
                class="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-8">
                <font-awesome-icon :icon="['fas', 'arrow-left']" />
                Back to Data Sources
            </NuxtLink>

            <!-- Card -->
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

                <!-- Header banner -->
                <div class="bg-[#FF7A59] px-8 py-10 flex flex-col items-center gap-4">
                    <img
                        src="/assets/images/hubspot.png"
                        alt="HubSpot CRM"
                        class="w-20 h-20 rounded-xl bg-white p-2 shadow" />
                    <h1 class="text-2xl font-bold text-white">Connect HubSpot CRM</h1>
                    <p class="text-white/80 text-sm text-center">
                        Sync contacts, deals, and pipeline data to unlock pipeline value metrics in the Marketing Hub.
                    </p>
                </div>

                <!-- Body -->
                <div class="px-8 py-8 space-y-6">

                    <!-- What gets synced -->
                    <div>
                        <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">What will be synced</h2>
                        <ul class="space-y-2">
                            <li class="flex items-start gap-3 text-sm text-gray-600">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-500 mt-0.5 shrink-0" />
                                <span><strong>Contacts</strong> — email, lifecycle stage, UTM source/campaign/medium</span>
                            </li>
                            <li class="flex items-start gap-3 text-sm text-gray-600">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-500 mt-0.5 shrink-0" />
                                <span><strong>Deals</strong> — pipeline stage, amount, close date, won/lost status</span>
                            </li>
                            <li class="flex items-start gap-3 text-sm text-gray-600">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-500 mt-0.5 shrink-0" />
                                <span><strong>Pipeline Snapshot</strong> — daily open pipeline value and closed-won revenue</span>
                            </li>
                        </ul>
                    </div>

                    <!-- Permissions notice -->
                    <div class="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-sm text-orange-800">
                        <font-awesome-icon :icon="['fas', 'circle-info']" class="mr-2" />
                        You will be asked to authorise read-only access to your HubSpot CRM data. No data will be written to your HubSpot account.
                    </div>

                    <!-- Error -->
                    <div v-if="state.error" class="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                        <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="mr-2" />
                        {{ state.error }}
                    </div>

                    <!-- CTA -->
                    <button
                        @click="connectWithHubSpot"
                        :disabled="state.loading"
                        class="w-full py-3 px-6 bg-[#FF7A59] hover:bg-[#e86e4f] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-3 cursor-pointer">
                        <font-awesome-icon v-if="state.loading" :icon="['fas', 'spinner']" class="animate-spin" />
                        <font-awesome-icon v-else :icon="['fas', 'arrow-right']" />
                        <span>{{ state.loading ? 'Redirecting to HubSpot…' : 'Connect with HubSpot' }}</span>
                    </button>

                    <p class="text-xs text-gray-400 text-center">
                        You will be redirected to HubSpot to complete authorisation. Your credentials are never stored by this platform.
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>
