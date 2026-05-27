<template>
    <div class="max-w-[800px] mx-auto">
        <div class="text-center mb-8">
            <h2 class="m-0 mb-2 text-2xl font-bold text-gray-900">Connect Your Sources</h2>
            <p class="m-0 text-[0.95rem] text-gray-500 leading-relaxed">
                Authenticate each of your selected data sources to proceed.
            </p>
        </div>

        <div class="flex flex-col gap-4">
            <SourceAuthCard
                v-for="source in resolvedSources"
                :key="source.id"
                :source="source"
                :status="authStatuses[source.id]?.status || 'idle'"
                :default-expanded="!allConnected || authStatuses[source.id]?.status !== 'connected'"
            >
                <!-- OAuth Sources -->
                <OAuthConnectCard
                    v-if="source.connectionMethod === 'oauth'"
                    :source="source"
                    :project-id="projectId"
                    @status-change="(status: any, data: any) => handleStatusChange(source.id, status, data)"
                />

                <!-- Database Sources -->
                <DatabaseConnectCard
                    v-else-if="source.connectionMethod === 'database_credentials'"
                    :source="source"
                    :project-id="projectId"
                    @status-change="(status: any, data: any) => handleStatusChange(source.id, status, data)"
                />

                <!-- File Upload Sources -->
                <FileUploadCard
                    v-else-if="source.connectionMethod === 'file_upload'"
                    :source="source"
                    :project-id="projectId"
                    @status-change="(status: any, data: any) => handleStatusChange(source.id, status, data)"
                />

                <!-- API Key Sources (fallback) -->
                <div v-else class="pt-4">
                    <p class="m-0 mb-3 text-sm text-gray-500">
                        Enter your API key or credentials for {{ source.name }}.
                    </p>
                    <div class="flex gap-2 flex-col sm:flex-row">
                        <input
                            v-model="apiKeyValues[source.id]"
                            type="password"
                            class="flex-1 py-2.5 px-3 border border-gray-300 rounded-lg text-sm font-inherit text-gray-900 focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)]"
                            :placeholder="`Enter API key for ${source.name}`"
                        />
                        <button
                            class="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 border-none rounded-lg bg-indigo-500 text-white text-sm font-semibold font-inherit cursor-pointer transition-colors hover:not(:disabled):bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            type="button"
                            :disabled="!apiKeyValues[source.id]?.trim()"
                            @click="handleApiKeySubmit(source.id)"
                        >
                            <i class="fas fa-key"></i>
                            Verify
                        </button>
                    </div>
                </div>
            </SourceAuthCard>
        </div>

        <!-- Summary -->
        <div v-if="resolvedSources.length > 0" class="mt-6 text-center">
            <div class="h-1.5 bg-gray-200 rounded overflow-hidden mb-2">
                <div
                    class="h-full rounded bg-gradient-to-r from-indigo-500 to-emerald-500 transition-[width] duration-400"
                    :style="{ width: `${connectedPercentage}%` }"
                ></div>
            </div>
            <p class="m-0 text-[0.85rem] text-gray-500 font-medium">
                {{ connectedCount }} of {{ resolvedSources.length }} sources connected
            </p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { CONNECTION_SOURCES, type ConnectionSource } from '~/constants/connectionSources';
import SourceAuthCard from './SourceAuthCard.vue';
import type { AuthStatus } from './SourceAuthCard.vue';
import OAuthConnectCard from './OAuthConnectCard.vue';
import DatabaseConnectCard from './DatabaseConnectCard.vue';
import FileUploadCard from './FileUploadCard.vue';

interface AuthStatusEntry {
    status: AuthStatus;
    data?: any;
}

const props = defineProps<{
    selectedSourceIds: string[];
}>();

const emit = defineEmits<{
    'auth-complete': [statuses: Record<string, AuthStatusEntry>];
    'update:canProceed': [canProceed: boolean];
}>();

const route = useRoute();
const projectId = computed(() => route.params.projectid as string);

const resolvedSources = computed<ConnectionSource[]>(() => {
    return props.selectedSourceIds
        .map((id) => CONNECTION_SOURCES.find((s) => s.id === id))
        .filter(Boolean) as ConnectionSource[];
});

const authStatuses = ref<Record<string, AuthStatusEntry>>({});
const apiKeyValues = ref<Record<string, string>>({});

// Initialize statuses
watch(
    () => props.selectedSourceIds,
    (ids) => {
        for (const id of ids) {
            if (!authStatuses.value[id]) {
                authStatuses.value[id] = { status: 'idle' };
            }
        }
        // Remove entries for deselected sources
        for (const key of Object.keys(authStatuses.value)) {
            if (!ids.includes(key)) {
                delete authStatuses.value[key];
            }
        }
    },
    { immediate: true }
);

const connectedCount = computed(() =>
    Object.values(authStatuses.value).filter((s) => s.status === 'connected').length
);

const connectedPercentage = computed(() =>
    resolvedSources.value.length > 0
        ? (connectedCount.value / resolvedSources.value.length) * 100
        : 0
);

const allConnected = computed(
    () =>
        resolvedSources.value.length > 0 &&
        connectedCount.value === resolvedSources.value.length
);

function handleStatusChange(
    sourceId: string,
    status: AuthStatus,
    data?: any
) {
    authStatuses.value[sourceId] = { status, data };

    // Emit canProceed when all sources are connected
    emit('update:canProceed', allConnected.value);

    // Emit full auth completion when all connected
    if (allConnected.value) {
        emit('auth-complete', { ...authStatuses.value });
    }
}

function handleApiKeySubmit(sourceId: string) {
    // For API key sources, mark as connected once submitted
    handleStatusChange(sourceId, 'connected', {
        sourceId,
        apiKey: apiKeyValues.value[sourceId],
    });
}
</script>