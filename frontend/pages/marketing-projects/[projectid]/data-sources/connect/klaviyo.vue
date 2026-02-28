<script setup lang="ts">
definePageMeta({ layout: 'project' });

import { useKlaviyo } from '@/composables/useKlaviyo';

const route = useRoute();
const router = useRouter();
const { $swal } = useNuxtApp() as any;

const projectId = parseInt(String(route.params.projectid));
const klaviyo = useKlaviyo();

const state = reactive({
    step: 'form' as 'form' | 'validating' | 'saving',
    dataSourceName: 'Klaviyo Email',
    apiKey: '',
    apiKeyValid: null as boolean | null,   // null = unchecked, true = valid, false = invalid
    apiKeyChecked: false,
    error: null as string | null,
});

// Clear validation state when the user edits the key
watch(() => state.apiKey, () => {
    state.apiKeyValid = null;
    state.apiKeyChecked = false;
    state.error = null;
});

async function validateKey() {
    if (!state.apiKey.trim()) {
        state.error = 'Please enter your Klaviyo private API key.';
        return;
    }

    state.step = 'validating';
    state.error = null;

    const valid = await klaviyo.validateApiKey(state.apiKey);

    state.apiKeyValid = valid;
    state.apiKeyChecked = true;
    state.step = 'form';

    if (!valid) {
        state.error = 'API key is invalid or does not have the required permissions. Please check your Klaviyo Private API key.';
    }
}

async function connectDataSource() {
    if (!state.apiKeyValid) {
        state.error = 'Please validate your API key first.';
        return;
    }

    state.step = 'saving';
    state.error = null;

    try {
        const dataSourceId = await klaviyo.addDataSource({
            name: state.dataSourceName.trim() || 'Klaviyo Email',
            apiKey: state.apiKey,
            projectId,
        });

        if (!dataSourceId) throw new Error('Failed to create Klaviyo data source — no ID returned.');

        await $swal.fire({
            title: 'Klaviyo Connected!',
            html: '<p>Your Klaviyo data source has been created.<br>An initial sync is running in the background.</p>',
            icon: 'success',
            timer: 2500,
            showConfirmButton: false,
        });

        router.push(`/marketing-projects/${projectId}/data-sources`);
    } catch (err: any) {
        state.error = err.message || 'Failed to connect Klaviyo. Please try again.';
        state.step = 'form';
    }
}

useHead({ title: 'Connect Klaviyo Email' });
</script>

<template>
    <div class="min-h-screen bg-gray-50 py-12 px-4">
        <div class="max-w-xl mx-auto">

            <!-- Back link -->
            <NuxtLink
                :to="`/marketing-projects/${projectId}/data-sources`"
                class="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-8">
                <font-awesome-icon :icon="['fas', 'arrow-left']" />
                Back to Data Sources
            </NuxtLink>

            <!-- Card -->
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

                <!-- Header -->
                <div class="bg-[#232F3E] px-8 py-10 flex flex-col items-center gap-4">
                    <img
                        src="/assets/images/klaviyo.png"
                        alt="Klaviyo Email Marketing"
                        class="w-20 h-20 rounded-xl bg-white p-2 shadow" />
                    <h1 class="text-2xl font-bold text-white">Connect Klaviyo Email</h1>
                    <p class="text-white/70 text-sm text-center">
                        Sync campaign sends, opens, clicks, and revenue into the Marketing Hub.
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
                                <span><strong>Campaigns</strong> — sends, opens, clicks, unsubscribes, bounces</span>
                            </li>
                            <li class="flex items-start gap-3 text-sm text-gray-600">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-500 mt-0.5 shrink-0" />
                                <span><strong>Revenue</strong> — placed orders and attributed revenue per campaign</span>
                            </li>
                            <li class="flex items-start gap-3 text-sm text-gray-600">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-500 mt-0.5 shrink-0" />
                                <span><strong>Flows</strong> — automated email sequence performance metrics</span>
                            </li>
                        </ul>
                    </div>

                    <!-- API key instructions -->
                    <div class="bg-gray-50 border border-gray-200 rounded-lg px-4 py-4 text-sm text-gray-700 space-y-2">
                        <p class="font-semibold">How to get your Klaviyo Private API Key:</p>
                        <ol class="list-decimal list-inside space-y-1 text-gray-600 ml-1">
                            <li>Log in to <strong>Klaviyo</strong> → Settings → API Keys</li>
                            <li>Click <strong>Create Private API Key</strong></li>
                            <li>Select <strong>Read-Only Key</strong> and copy it here</li>
                        </ol>
                    </div>

                    <!-- Name field -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1.5">Data Source Name</label>
                        <input
                            v-model="state.dataSourceName"
                            type="text"
                            placeholder="e.g. Klaviyo Email"
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent" />
                    </div>

                    <!-- API key field -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1.5">
                            Klaviyo Private API Key
                        </label>
                        <div class="flex gap-2">
                            <input
                                v-model="state.apiKey"
                                type="password"
                                autocomplete="off"
                                placeholder="pk_••••••••••••••••••••••••••••••••"
                                :class="[
                                    'flex-1 px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent',
                                    state.apiKeyValid === true  ? 'border-green-400 focus:ring-green-400' :
                                    state.apiKeyValid === false ? 'border-red-400 focus:ring-red-400' :
                                    'border-gray-300 focus:ring-gray-900'
                                ]" />
                            <button
                                @click="validateKey"
                                :disabled="state.step === 'validating' || !state.apiKey.trim()"
                                class="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-2">
                                <font-awesome-icon v-if="state.step === 'validating'" :icon="['fas', 'spinner']" class="animate-spin" />
                                <span>{{ state.step === 'validating' ? 'Checking…' : 'Validate Key' }}</span>
                            </button>
                        </div>

                        <!-- Inline validation feedback -->
                        <p v-if="state.apiKeyValid === true" class="mt-1.5 text-xs text-green-600 flex items-center gap-1">
                            <font-awesome-icon :icon="['fas', 'check']" />
                            API key is valid
                        </p>
                        <p v-else-if="state.apiKeyValid === false" class="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                            <font-awesome-icon :icon="['fas', 'xmark']" />
                            Invalid API key — please check and try again
                        </p>
                    </div>

                    <!-- Error -->
                    <div v-if="state.error" class="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                        <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="mr-2" />
                        {{ state.error }}
                    </div>

                    <!-- Connect button -->
                    <button
                        @click="connectDataSource"
                        :disabled="state.step === 'saving' || !state.apiKeyValid || !state.dataSourceName.trim()"
                        class="w-full py-3 px-6 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-3">
                        <font-awesome-icon v-if="state.step === 'saving'" :icon="['fas', 'spinner']" class="animate-spin" />
                        <span>{{ state.step === 'saving' ? 'Connecting…' : 'Connect Klaviyo' }}</span>
                    </button>

                    <p class="text-xs text-gray-400 text-center">
                        Your API key is encrypted and stored securely. It is never sent to third parties.
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>
