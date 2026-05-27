<template>
    <div class="pt-4">
        <!-- Already connected state -->
        <div v-if="isConnected" class="flex items-center justify-between py-3 px-4 bg-green-50 border border-green-200 rounded-lg">
            <div class="flex items-center gap-2 text-green-600 text-sm font-medium">
                <i class="fas fa-check-circle text-base"></i>
                <span>Connected to {{ source.name }}</span>
            </div>
            <button
                class="py-1.5 px-3 border border-gray-200 rounded-md bg-white text-gray-500 text-xs font-medium font-inherit cursor-pointer transition-all duration-150 hover:border-red-300 hover:text-red-600 hover:bg-red-50"
                type="button"
                @click="handleDisconnect"
            >
                Disconnect
            </button>
        </div>

        <!-- Not connected state -->
        <div v-else class="flex flex-col gap-3">
            <p class="text-sm text-gray-500 leading-relaxed">
                {{ description }}
            </p>
            <button
                class="inline-flex items-center justify-center gap-2 py-3 px-6 border-none rounded-lg bg-blue-600 text-white text-[0.95rem] font-semibold font-inherit cursor-pointer transition-colors self-start hover:not(:disabled):bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed sm:w-auto w-full"
                type="button"
                :disabled="connecting"
                @click="handleConnect"
            >
                <i v-if="connecting" class="fas fa-spinner fa-spin"></i>
                <i v-else :class="source.icon"></i>
                {{ connecting ? 'Redirecting...' : `Connect with ${source.name}` }}
            </button>
        </div>

        <!-- Error message -->
        <div v-if="errorMessage" class="flex items-center gap-2 mt-3 py-2.5 px-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-xs">
            <i class="fas fa-exclamation-triangle shrink-0"></i>
            <span>{{ errorMessage }}</span>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { ConnectionSource } from '~/constants/connectionSources';
import type { AuthStatus } from './SourceAuthCard.vue';

const props = defineProps<{
    source: ConnectionSource;
    projectId: string;
}>();

const emit = defineEmits<{
    'status-change': [status: AuthStatus, data?: any];
}>();

const connecting = ref(false);
const isConnected = ref(false);
const errorMessage = ref('');

const description = computed(() => {
    const descriptions: Record<string, string> = {
        google_ads: 'Connect your Google Ads account to import campaign, ad group, and keyword performance data.',
        meta_ads: 'Connect your Meta Ads account to import Facebook and Instagram ad campaign data.',
        linkedin_ads: 'Connect your LinkedIn Ads account to import advertising campaign and lead data.',
        google_analytics: 'Connect your Google Analytics account to import website traffic and user behavior data.',
        hubspot: 'Connect your HubSpot account to import CRM contacts, deals, and marketing data.',
        klaviyo: 'Connect your Klaviyo account to import email campaigns and subscriber engagement data.',
    };
    return descriptions[props.source.id] || `Connect your ${props.source.name} account to import data.`;
});

// Check for existing connection on mount
onMounted(async () => {
    await checkConnectionStatus();
});

async function checkConnectionStatus() {
    try {
        const config = useRuntimeConfig();
        const { $fetch } = useNuxtApp() as any;
        const response: any = await $fetch(
            `${config.public.apiBase}/data-sources/connections/check/${props.source.id}/${props.projectId}`
        );
        if (response?.connected) {
            isConnected.value = true;
            emit('status-change', 'connected', response);
        }
    } catch {
        // Not connected or error — that's fine
    }
}

async function handleConnect() {
    connecting.value = true;
    errorMessage.value = '';

    try {
        // Redirect to the existing connect page for this source
        const connectRoute = `/projects/${props.projectId}/data-sources/connect/${props.source.connectRoute}`;
        window.location.href = connectRoute;
    } catch (error: any) {
        errorMessage.value = error.message || 'Failed to connect. Please try again.';
        connecting.value = false;
    }
}

function handleDisconnect() {
    isConnected.value = false;
    emit('status-change', 'idle');
}
</script>