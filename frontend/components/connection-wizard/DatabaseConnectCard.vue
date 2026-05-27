<template>
    <div class="pt-4">
        <form class="flex flex-col gap-3.5" @submit.prevent="handleTestConnection">
            <!-- MongoDB: Connection String -->
            <div v-if="source.id === 'mongodb'" class="flex flex-col gap-1 w-full">
                <label class="text-xs font-semibold text-gray-700" :for="`conn-string-${source.id}`">
                    Connection String
                </label>
                <textarea
                    :id="`conn-string-${source.id}`"
                    v-model="form.connectionString"
                    class="py-2.5 px-3 border border-gray-300 rounded-lg text-sm font-mono text-gray-900 bg-white transition-[border-color,box-shadow] focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] disabled:bg-gray-50 disabled:text-gray-500 resize-y font-inherit"
                    rows="3"
                    placeholder="mongodb://username:password@host:port/database"
                    :disabled="isConnected"
                ></textarea>
                <p class="m-0 text-[0.7rem] text-gray-400">
                    Include authentication credentials in the connection string.
                </p>
            </div>

            <!-- SQL databases: Individual fields -->
            <template v-else>
                <div class="flex gap-3 flex-col sm:flex-row">
                    <div class="flex flex-col gap-1 flex-1 min-w-0">
                        <label class="text-xs font-semibold text-gray-700" :for="`host-${source.id}`">Host</label>
                        <input
                            :id="`host-${source.id}`"
                            v-model="form.host"
                            type="text"
                            class="py-2.5 px-3 border border-gray-300 rounded-lg text-sm font-inherit text-gray-900 bg-white transition-[border-color,box-shadow] focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] disabled:bg-gray-50 disabled:text-gray-500"
                            placeholder="e.g. localhost or db.example.com"
                            :disabled="isConnected"
                        />
                    </div>
                    <div class="flex flex-col gap-1 w-24 shrink-0">
                        <label class="text-xs font-semibold text-gray-700" :for="`port-${source.id}`">Port</label>
                        <input
                            :id="`port-${source.id}`"
                            v-model="form.port"
                            type="text"
                            class="py-2.5 px-3 border border-gray-300 rounded-lg text-sm font-inherit text-gray-900 bg-white transition-[border-color,box-shadow] focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] disabled:bg-gray-50 disabled:text-gray-500"
                            :placeholder="defaultPort"
                            :disabled="isConnected"
                        />
                    </div>
                </div>

                <div class="flex flex-col gap-1 w-full">
                    <label class="text-xs font-semibold text-gray-700" :for="`database-${source.id}`">Database Name</label>
                    <input
                        :id="`database-${source.id}`"
                        v-model="form.database"
                        type="text"
                        class="py-2.5 px-3 border border-gray-300 rounded-lg text-sm font-inherit text-gray-900 bg-white transition-[border-color,box-shadow] focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] disabled:bg-gray-50 disabled:text-gray-500"
                        placeholder="Enter database name"
                        :disabled="isConnected"
                    />
                </div>

                <div class="flex gap-3 flex-col sm:flex-row">
                    <div class="flex flex-col gap-1 flex-1 min-w-0">
                        <label class="text-xs font-semibold text-gray-700" :for="`username-${source.id}`">Username</label>
                        <input
                            :id="`username-${source.id}`"
                            v-model="form.username"
                            type="text"
                            class="py-2.5 px-3 border border-gray-300 rounded-lg text-sm font-inherit text-gray-900 bg-white transition-[border-color,box-shadow] focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] disabled:bg-gray-50 disabled:text-gray-500"
                            placeholder="Database username"
                            :disabled="isConnected"
                        />
                    </div>
                    <div class="flex flex-col gap-1 flex-1 min-w-0">
                        <label class="text-xs font-semibold text-gray-700" :for="`password-${source.id}`">Password</label>
                        <div class="relative">
                            <input
                                :id="`password-${source.id}`"
                                v-model="form.password"
                                :type="showPassword ? 'text' : 'password'"
                                class="py-2.5 px-3 pr-10 border border-gray-300 rounded-lg text-sm font-inherit text-gray-900 bg-white transition-[border-color,box-shadow] focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] disabled:bg-gray-50 disabled:text-gray-500 w-full"
                                placeholder="Database password"
                                :disabled="isConnected"
                            />
                            <button
                                type="button"
                                class="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent border-none text-gray-400 cursor-pointer p-1 hover:text-gray-500"
                                @click="showPassword = !showPassword"
                            >
                                <i :class="showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </template>

            <!-- Action Buttons -->
            <div v-if="!isConnected" class="pt-2">
                <button
                    type="submit"
                    class="inline-flex items-center justify-center gap-2 py-2.5 px-5 border-none rounded-lg text-sm font-semibold font-inherit cursor-pointer transition-all duration-200 bg-indigo-500 text-white hover:not(:disabled):bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    :disabled="testing || !isFormValid"
                >
                    <i v-if="testing" class="fas fa-spinner fa-spin"></i>
                    <i v-else class="fas fa-plug"></i>
                    {{ testing ? 'Testing Connection…' : 'Test Connection' }}
                </button>
            </div>
        </form>

        <!-- Connection Test Result -->
        <div v-if="isConnected" class="flex items-center justify-between py-3">
            <div class="flex items-center gap-3">
                <i class="fas fa-check-circle text-2xl text-emerald-500"></i>
                <div>
                    <p class="m-0 text-[0.95rem] font-semibold text-emerald-600">Connection Successful</p>
                    <p class="mt-0.5 mb-0 text-xs text-gray-500 font-mono">
                        {{ source.name }} — {{ connectionDetail }}
                    </p>
                </div>
            </div>
            <button
                class="inline-flex items-center justify-center gap-2 py-2 px-4 border-none rounded-lg text-xs font-semibold font-inherit cursor-pointer transition-all duration-200 bg-gray-100 text-gray-700 hover:bg-gray-200"
                type="button"
                @click="handleReconnect"
            >
                <i class="fas fa-redo"></i>
                Reconfigure
            </button>
        </div>

        <!-- Error Message -->
        <div v-if="errorMessage" class="flex items-center gap-2 mt-3 py-2.5 px-3.5 bg-red-50 border border-red-200 rounded-lg text-[0.825rem] text-red-600">
            <i class="fas fa-exclamation-triangle shrink-0"></i>
            <span>{{ errorMessage }}</span>
            <button
                class="ml-auto inline-flex items-center gap-1 py-1 px-2 border-none rounded bg-red-600 text-white text-xs font-semibold font-inherit cursor-pointer shrink-0 hover:bg-red-700"
                type="button"
                @click="handleRetry"
            >
                <i class="fas fa-redo"></i>
                Retry
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { ConnectionSource } from '~/constants/connectionSources';

const props = defineProps<{
    source: ConnectionSource;
    projectId: string;
}>();

const emit = defineEmits<{
    'status-change': [status: 'idle' | 'loading' | 'connected' | 'error', data?: any];
}>();

const { $fetch } = useNuxtApp() as any;

const defaultPort = computed(() => {
    switch (props.source.id) {
        case 'postgresql': return '5432';
        case 'mysql': return '3306';
        case 'mariadb': return '3306';
        case 'mongodb': return '27017';
        default: return '5432';
    }
});

const form = reactive({
    host: '',
    port: '',
    database: '',
    username: '',
    password: '',
    connectionString: '',
});

const showPassword = ref(false);
const testing = ref(false);
const isConnected = ref(false);
const errorMessage = ref<string | null>(null);
const connectionDetail = ref('');

const isFormValid = computed(() => {
    if (props.source.id === 'mongodb') {
        return !!form.connectionString.trim();
    }
    return !!(form.host.trim() && form.database.trim() && form.username.trim());
});

function getAuthHeaders() {
    const token = localStorage.getItem('auth_token') || '';
    const orgId = localStorage.getItem('organizationId') || '';
    const workspaceId = localStorage.getItem('workspaceId') || '';
    return {
        'Authorization': `Bearer ${token}`,
        'Authorization-Type': 'auth',
        ...(orgId ? { 'x-organization-id': orgId } : {}),
        ...(workspaceId ? { 'x-workspace-id': workspaceId } : {}),
    };
}

function getApiBase() {
    const config = useRuntimeConfig();
    return config.public?.apiBase || 'http://localhost:8080';
}

async function handleTestConnection() {
    if (!isFormValid.value) return;

    testing.value = true;
    errorMessage.value = null;
    emit('status-change', 'loading');

    try {
        const body: Record<string, any> = {
            data_source_type: props.source.id === 'mongodb' ? 'mongodb' : props.source.id,
        };

        if (props.source.id === 'mongodb') {
            body.connection_string = form.connectionString;
        } else {
            body.host = form.host;
            body.port = form.port || defaultPort.value;
            body.database_name = form.database;
            body.username = form.username;
            body.password = form.password;
        }

        const data = await $fetch(`${getApiBase()}/data-source/test-connection`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body,
        });

        isConnected.value = true;
        connectionDetail.value = props.source.id === 'mongodb'
            ? form.connectionString.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@')
            : `${form.host || 'localhost'}:${form.port || defaultPort.value}/${form.database}`;

        emit('status-change', 'connected', {
            sourceId: props.source.id,
            credentials: body,
        });
    } catch (error: any) {
        isConnected.value = false;
        errorMessage.value = error?.data?.message || error?.message || 'Connection test failed. Please check your credentials and try again.';
        emit('status-change', 'error', { error: errorMessage.value });
    } finally {
        testing.value = false;
    }
}

function handleReconnect() {
    isConnected.value = false;
    connectionDetail.value = '';
    emit('status-change', 'idle');
}

function handleRetry() {
    errorMessage.value = null;
    handleTestConnection();
}
</script>