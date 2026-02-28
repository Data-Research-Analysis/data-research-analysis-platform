<script setup lang="ts">
/**
 * OAuth callback landing page for HubSpot.
 *
 * The backend /hubspot/callback handler exchanges the OAuth code for tokens and
 * then redirects the browser here with the token payload:
 *   /connect/hubspot?tokens=<base64url>&state=<state>
 *
 * This page decodes the tokens, extracts the projectId from state, shows a
 * "name your data source" form, and calls POST /hubspot/add to complete setup.
 */
definePageMeta({ layout: 'default' });

import { useHubSpot } from '@/composables/useHubSpot';

const route = useRoute();
const router = useRouter();
const config = useRuntimeConfig();
const { $swal } = useNuxtApp() as any;
const hubspot = useHubSpot();

interface ParsedTokens {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    portal_id: string;
    state: string;
}

const state = reactive({
    step: 'loading' as 'loading' | 'form' | 'saving' | 'error',
    error: null as string | null,
    tokens: null as ParsedTokens | null,
    projectId: null as number | null,
    dataSourceName: 'HubSpot CRM',
});

onMounted(() => {
    const tokenPayload = route.query.tokens as string | undefined;
    const stateParam = route.query.state as string | undefined;

    if (!tokenPayload) {
        state.step = 'error';
        state.error = 'No token data received from HubSpot. Please try connecting again.';
        return;
    }

    const parsed = hubspot.parseCallbackTokens(tokenPayload);
    if (!parsed) {
        state.step = 'error';
        state.error = 'Failed to decode HubSpot tokens. Please try connecting again.';
        return;
    }

    state.tokens = parsed;

    // Recover projectId from the state parameter we encoded before the redirect
    const stateValue = stateParam || parsed.state || '';
    if (stateValue) {
        try {
            const decoded = JSON.parse(atob(stateValue.replace(/-/g, '+').replace(/_/g, '/')));
            state.projectId = decoded.projectId ?? null;
        } catch {
            // State may be a plain random string — projectId not recoverable
        }
    }

    // Pre-populate name with portal info if available
    if (parsed.portal_id) {
        state.dataSourceName = `HubSpot CRM (Portal ${parsed.portal_id})`;
    }

    state.step = 'form';
});

async function saveDataSource() {
    if (!state.tokens) return;

    state.step = 'saving';

    try {
        const dataSourceId = await hubspot.addDataSource({
            name: state.dataSourceName.trim() || 'HubSpot CRM',
            accessToken: state.tokens.access_token,
            refreshToken: state.tokens.refresh_token,
            expiresAt: state.tokens.expires_at,
            portalId: state.tokens.portal_id,
            projectId: state.projectId ?? 0,
        });

        if (!dataSourceId) throw new Error('Failed to create data source — no ID returned.');

        await $swal.fire({
            title: 'HubSpot Connected!',
            html: '<p>Your HubSpot CRM data source has been created.<br>An initial sync is running in the background.</p>',
            icon: 'success',
            timer: 2500,
            showConfirmButton: false,
        });

        // Navigate back to the project data sources page, or home if projectId unknown
        if (state.projectId) {
            router.push(`/projects/${state.projectId}/data-sources`);
        } else {
            router.push('/');
        }
    } catch (err: any) {
        state.step = 'error';
        state.error = err.message || 'Failed to save HubSpot data source. Please try again.';
    }
}

useHead({ title: 'HubSpot CRM — Finalise Connection' });
</script>

<template>
    <div class="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <div class="w-full max-w-md">

            <!-- Loading -->
            <div v-if="state.step === 'loading'" class="bg-white rounded-xl shadow-sm border border-gray-200 p-10 flex flex-col items-center gap-4">
                <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-3xl text-[#FF7A59]" />
                <p class="text-gray-600 text-sm">Processing HubSpot authorisation…</p>
            </div>

            <!-- Error -->
            <div v-else-if="state.step === 'error'" class="bg-white rounded-xl shadow-sm border border-red-200 p-10 flex flex-col items-center gap-4 text-center">
                <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="text-3xl text-red-500" />
                <h2 class="font-semibold text-gray-900">Connection Failed</h2>
                <p class="text-sm text-gray-600">{{ state.error }}</p>
                <NuxtLink to="/" class="mt-2 text-sm text-blue-600 hover:underline">Return to home</NuxtLink>
            </div>

            <!-- Form -->
            <div v-else class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

                <!-- Header -->
                <div class="bg-[#FF7A59] px-8 py-8 flex flex-col items-center gap-3">
                    <img src="/assets/images/hubspot.png" alt="HubSpot" class="w-14 h-14 rounded-lg bg-white p-1.5 shadow" />
                    <h1 class="text-xl font-bold text-white">HubSpot Authorised</h1>
                    <p class="text-white/80 text-xs text-center">Name your data source to complete the setup</p>
                </div>

                <!-- Form body -->
                <div class="px-8 py-8 space-y-6">

                    <!-- Portal info -->
                    <div v-if="state.tokens?.portal_id" class="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800 flex items-center gap-2">
                        <font-awesome-icon :icon="['fas', 'check']" />
                        <span>Connected to HubSpot Portal <strong>{{ state.tokens.portal_id }}</strong></span>
                    </div>

                    <!-- Name field -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1.5">Data Source Name</label>
                        <input
                            v-model="state.dataSourceName"
                            type="text"
                            placeholder="e.g. HubSpot CRM"
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF7A59] focus:border-transparent" />
                    </div>

                    <!-- Project notice when projectId unknown -->
                    <div v-if="!state.projectId" class="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-800">
                        <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="mr-2" />
                        Project context could not be detected. The data source will still be created — you can assign it to a project afterwards.
                    </div>

                    <!-- Save button -->
                    <button
                        @click="saveDataSource"
                        :disabled="state.step === 'saving' || !state.dataSourceName.trim()"
                        class="w-full py-3 px-6 bg-[#FF7A59] hover:bg-[#e86e4f] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-3">
                        <font-awesome-icon v-if="state.step === 'saving'" :icon="['fas', 'spinner']" class="animate-spin" />
                        <span>{{ state.step === 'saving' ? 'Saving…' : 'Save & Start Sync' }}</span>
                    </button>
                </div>
            </div>

        </div>
    </div>
</template>
