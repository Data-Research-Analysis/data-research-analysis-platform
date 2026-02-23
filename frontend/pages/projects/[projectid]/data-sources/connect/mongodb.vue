<script setup lang="ts">
import { ref } from 'vue';
import { useReCaptcha } from "vue-recaptcha-v3";
import { useDataSourceStore } from '@/stores/data_sources';
import { useLoggedInUserStore } from '@/stores/logged_in_user';
import { io, Socket } from 'socket.io-client';
import MongoDBSyncProgress from '@/components/MongoDBSyncProgress.vue';

const dataSourceStore = useDataSourceStore();
const userStore = useLoggedInUserStore();
const recaptcha = useReCaptcha();

const { $swal } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const config = useRuntimeConfig();

// Socket.IO state
let socket: Socket | null = null;
const showProgressModal = ref(false);
const syncProgress = ref<any>(null);

const state = reactive({
    connection_string: '',
    connection_string_error: false,
    loading: false,
    showAlert: false,
    errorMessages: [],
    connectionSuccess: false,
})

// Initialize Socket.IO connection
onMounted(() => {
    if (import.meta.client) {
        initializeSocket();
    }
});

onBeforeUnmount(() => {
    if (socket) {
        socket.disconnect();
    }
});

function initializeSocket() {
    // Connect to Socket.IO server
    const socketUrl = config.public.apiBase || 'http://localhost:3002';
    socket = io(socketUrl, {
        withCredentials: true,
        transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
        console.log('[Socket.IO] Connected:', socket?.id);
    });

    socket.on('disconnect', () => {
        console.log('[Socket.IO] Disconnected');
    });

    // Listen for MongoDB sync progress updates
    socket.on('mongodb-sync-progress', (progress: any) => {
        console.log('[Socket.IO] Sync progress:', progress);
        syncProgress.value = progress;
        
        // Show modal if sync is in progress
        if (progress.status === 'in_progress' || progress.status === 'initializing') {
            showProgressModal.value = true;
        }
    });

    socket.on('serverInitialization', (data: any) => {
        console.log('[Socket.IO] Server initialized:', data);
    });
}

function validateConnectionString(connectionString: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!connectionString || connectionString.trim() === '') {
        errors.push("Connection string is required.");
        return { valid: false, errors };
    }
    
    // Check if it starts with mongodb:// or mongodb+srv://
    if (!connectionString.startsWith('mongodb://') && !connectionString.startsWith('mongodb+srv://')) {
        errors.push("Connection string must start with 'mongodb://' or 'mongodb+srv://'.");
    }
    
    // Check for @ symbol (indicates credentials)
    if (!connectionString.includes('@')) {
        errors.push("Connection string must include credentials with @ symbol (e.g., mongodb://user:pass@host/db).");
    }
    
    // Extract and validate components
    try {
        const urlPattern = /^mongodb(\+srv)?:\/\/([^:]+):([^@]+)@([^\/]+)\/(.+)$/;
        const match = connectionString.match(urlPattern);
        
        if (!match) {
            errors.push("Invalid connection string format. Use: mongodb://user:pass@host:port/db or mongodb+srv://user:pass@host/db");
        } else {
            const [, , username, password, host, database] = match;
            
            if (!username || username.trim() === '') {
                errors.push("Username is required in connection string.");
            }
            
            if (!password || password.trim() === '') {
                errors.push("Password is required in connection string.");
            }
            
            if (!host || host.trim() === '') {
                errors.push("Host is required in connection string.");
            }
            
            if (!database || database.trim() === '') {
                errors.push("Database name is required in connection string.");
            }
        }
    } catch (error) {
        errors.push("Failed to parse connection string.");
    }
    
    return { valid: errors.length === 0, errors };
}

function validateFields() {
    state.errorMessages = [];
    
    const validation = validateConnectionString(state.connection_string);
    
    if (!validation.valid) {
        state.connection_string_error = true;
        state.errorMessages.push(...validation.errors);
    } else {
        state.connection_string_error = false;
    }
}

async function testConnection() {
    state.loading = true;
    state.showAlert = false;
    state.errorMessages = [];
    validateFields();
    
    if (state.connection_string_error) {
        state.showAlert = true;
        state.loading = false;
    } else {
        const recaptchaToken = await getRecaptchaToken(recaptcha, 'mongoConnectForm');
        const token = getAuthToken();
        if (recaptchaToken) {
            const requestBody = {
                data_source_type: "mongodb",
                connection_string: state.connection_string,
                schema: "dra_mongodb",
            };
            
            const requestOptions = {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body: requestBody,
            };
            try {
                const data = await $fetch(`${baseUrl()}/data-source/test-connection`, {
                    method: "POST",
                    ...requestOptions
                });
                state.connectionSuccess = true;
                state.showAlert = true;
                state.errorMessages.push("Connection successful!");
            } catch (error) {
                state.connectionSuccess = false;
                state.showAlert = true;
                state.errorMessages.push(error.data?.message || 'Connection test failed.');
            }
        }
    }
    state.loading = false;
}

async function connectDataSource() {
    state.loading = true;
    state.showAlert = false;
    state.errorMessages = [];
    validateFields();
    
    if (state.connection_string_error) {
        state.showAlert = true;
        state.loading = false;
        return;
    }
    
    const recaptchaToken = await getRecaptchaToken(recaptcha, 'mongoConnectForm');
    const token = getAuthToken();
    if (recaptchaToken) {
        const requestBody = {
            project_id: parseInt(route.params.projectid),
            data_source_type: "mongodb",
            connection_string: state.connection_string,
            schema: "dra_mongodb",
        };
        
        const requestOptions = {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
            body: requestBody,
        };
        try {
            const data = await $fetch(`${baseUrl()}/data-source/add-data-source`, {
                method: "POST",
                ...requestOptions
            });
            
            // Show progress modal immediately
            showProgressModal.value = true;
            syncProgress.value = {
                dataSourceId: data.dataSourceId || 0,
                userId: userStore.loggedInUser?.id || 0,
                status: 'initializing',
                totalCollections: 0,
                processedCollections: 0,
                currentCollection: null,
                totalRecords: 0,
                processedRecords: 0,
                failedRecords: 0,
                percentage: 0,
                estimatedTimeRemaining: null,
                startTime: new Date(),
                lastUpdateTime: new Date(),
            };
            
            state.connectionSuccess = true;
            state.errorMessages.push("Data source created successfully. Sync started...");
            state.loading = false;
            
            await dataSourceStore.retrieveDataSources();
        } catch (error: any) {
            state.connectionSuccess = false;
            state.showAlert = true;
            state.errorMessages.push(error.data?.message || 'Failed to create data source.');
            state.loading = false;
        }
    } else {
        state.loading = false;
    }
}

function goBack() {
    router.push(`/projects/${route.params.projectid}/data-sources`);
}

function handleProgressModalClose() {
    showProgressModal.value = false;
    
    // Navigate back to data sources page if sync completed successfully
    if (syncProgress.value?.status === 'completed') {
        router.push(`/projects/${route.params.projectid}/data-sources`);
    }
}
</script>
<template>
    <div class="min-h-100 flex flex-col ml-4 mr-4 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md">
        <button @click="goBack" class="text-indigo-600 hover:text-indigo-800 mb-4 flex items-center cursor-pointer self-start">
            <font-awesome-icon :icon="['fas', 'chevron-left']" class="w-5 h-5 mr-2" />
            Back
        </button>

        <div class="font-bold text-2xl mb-5">
            Connect MongoDB Data Source
        </div>
        <div class="text-md mb-5">
            Enter your MongoDB connection string below. Supports all MongoDB hosting: Atlas, self-hosted, AWS, Azure, GCP, replica sets, and more.
        </div>
        
        <div v-if="state.showAlert"
            class="w-3/4 self-center text-lg p-5 mb-5 font-bold text-black rounded-lg"
            :class="{ 'bg-green-400': state.connectionSuccess, 'bg-red-400': !state.connectionSuccess }">
            <div v-if="state.connectionSuccess" class="text-2xl">Success!</div>
            <div v-else class="text-2xl">Error!</div>
            <template v-for="message in state.errorMessages">
                <div>{{ message }}</div>
            </template>
        </div>
        
        <!-- Connection String Input -->
        <div class="self-center w-1/2 mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">MongoDB Connection String *</label>
            <input
                v-model="state.connection_string"
                type="text"
                class="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent hover:border-blue-200"
                :class="!state.connection_string_error ? '' : 'bg-red-300 text-black border-red-500'"
                placeholder="mongodb://username:password@host:port/database"
                :disabled="state.loading"
            />
            <div class="text-xs text-gray-600 mt-2 space-y-1">
                <p class="font-semibold">Supported formats:</p>
                <p><strong>Standard:</strong> <code class="bg-gray-100 px-1 py-0.5 rounded text-xs">mongodb://user:pass@host:27017/database</code></p>
                <p><strong>Atlas/SRV:</strong> <code class="bg-gray-100 px-1 py-0.5 rounded text-xs">mongodb+srv://user:pass@cluster.mongodb.net/database</code></p>
                <p><strong>Self-hosted:</strong> <code class="bg-gray-100 px-1 py-0.5 rounded text-xs">mongodb://admin:pass@192.168.1.50:27017/mydb</code></p>
                <p><strong>Replica Set:</strong> <code class="bg-gray-100 px-1 py-0.5 rounded text-xs">mongodb://user:pass@host1:27017,host2:27017/db?replicaSet=rs0</code></p>
                <p class="text-gray-500 italic mt-2">Works with MongoDB Atlas, AWS DocumentDB, Azure Cosmos DB, self-hosted, and any MongoDB-compatible service.</p>
            </div>
        </div>
        
        <div class="flex flex-row self-center w-1/2 gap-5 mt-6">
            <div
                @click="!state.loading && testConnection()"
                class="h-10 text-center items-center self-center p-2 font-bold shadow-md select-none bg-gray-500 hover:bg-gray-600 cursor-pointer text-white flex-1 rounded-lg"
                :class="{ 'opacity-50 cursor-not-allowed': state.loading }">
                Test Connection
            </div>
            <div
                @click="!state.loading && connectDataSource()"
                class="h-10 text-center items-center self-center p-2 font-bold shadow-md select-none bg-primary-blue-100 hover:bg-primary-blue-200 cursor-pointer text-white flex-1 rounded-lg"
                :class="{ 'opacity-50 cursor-not-allowed': state.loading }">
                Connect Data Source
            </div>
        </div>
    </div>
    
    <!-- Progress Modal -->
    <MongoDBSyncProgress
        :is-visible="showProgressModal"
        :progress="syncProgress"
        :allow-close="true"
        @close="handleProgressModalClose"
    />
</template>