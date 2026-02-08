<script setup lang="ts">
import { useReCaptcha } from "vue-recaptcha-v3";
import { useDataSourceStore } from '@/stores/data_sources';
const dataSourceStore = useDataSourceStore();
const recaptcha = useReCaptcha();

const { $swal } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const state = reactive({
    useConnectionString: true,
    connection_string: '',
    host: '',
    port: '',
    database_name: '',
    username: '',
    password: '',
    connection_string_error: false,
    host_error: false,
    port_error: false,
    database_name_error: false,
    username_error: false,
    password_error: false,
    loading: false,
    showAlert: false,
    errorMessages: [],
    connectionSuccess: false,
    showPassword: false,
})

function validateFields() {
    state.errorMessages = [];
    
    if (state.useConnectionString) {
        // Validate connection string
        if (!validate(state.connection_string, "", [validateRequired])) {
            state.connection_string_error = true;
            state.errorMessages.push("Please enter a valid connection string.");
        } else {
            state.connection_string_error = false;
        }
    } else {
        // Validate individual fields
        state.connection_string_error = false;
        if (!validate(state.host, "", [validateRequired])) {
            state.host_error = true;
            state.errorMessages.push("Please enter a valid host.");
        } else {
            state.host_error = false;
        }
        if (!validate(state.port, "", [validateRequired])) {
            state.port_error = true;
            state.errorMessages.push("Please enter a valid port.");
        } else {
            state.port_error = false;
        }
        if (!validate(state.database_name, "", [validateRequired])) {
            state.database_name_error = true;
            state.errorMessages.push("Please enter a valid database name.");
        } else {
            state.database_name_error = false;
        }
        if (!validate(state.username, "", [validateRequired])) {
            state.username_error = true;
            state.errorMessages.push("Please enter a valid username.");
        } else {
            state.username_error = false;
        }
        if (!validate(state.password, "", [validateRequired])) {
            state.password_error = true;
            state.errorMessages.push("Please enter a valid password.");
        } else {
            state.password_error = false;
        }
    }
}

async function testConnection() {
    state.loading = true;
    state.showAlert = false;
    state.errorMessages = [];
    validateFields();
    const hasErrors = state.useConnectionString 
        ? state.connection_string_error 
        : (state.host_error || state.port_error || state.database_name_error || state.username_error || state.password_error);
    
    if (hasErrors) {
        state.showAlert = true;
        state.loading = false;
    } else {
        const recaptchaToken = await getRecaptchaToken(recaptcha, 'mongoConnectForm');
        const token = getAuthToken();
        if (recaptchaToken) {
            const requestBody = state.useConnectionString ? {
                data_source_type: "mongodb",
                connection_string: state.connection_string,
                schema: "dra_mongodb",
            } : {
                data_source_type: "mongodb",
                host: state.host,
                port: state.port,
                schema: "dra_mongodb",
                database_name: state.database_name,
                username: state.username,
                password: state.password,
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
    const hasErrors = state.useConnectionString 
        ? state.connection_string_error 
        : (state.host_error || state.port_error || state.database_name_error || state.username_error || state.password_error);
    
    if (hasErrors) {
        state.showAlert = true;
        state.loading = false;
        return;
    }
    
    const recaptchaToken = await getRecaptchaToken(recaptcha, 'mongoConnectForm');
    const token = getAuthToken();
    if (recaptchaToken) {
        const requestBody = state.useConnectionString ? {
            project_id: parseInt(route.params.projectid),
            data_source_type: "mongodb",
            connection_string: state.connection_string,
            schema: "dra_mongodb",
        } : {
            project_id: parseInt(route.params.projectid),
            data_source_type: "mongodb",
            host: state.host,
            port: state.port,
            schema: "dra_mongodb",
            database_name: state.database_name,
            username: state.username,
            password: state.password,
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
            state.connectionSuccess = true;
            state.showAlert = true;
            state.errorMessages.push(data.message);
            await dataSourceStore.retrieveDataSources();
            setTimeout(() => {
                router.push(`/projects/${route.params.projectid}`);
            }, 2000);
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
</script>
<template>
    <div class="min-h-100 flex flex-col ml-4 mr-4 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md">
        <div class="font-bold text-2xl mb-5">
            Connect MongoDB Data Source
        </div>
        <div class="text-md mb-5">
            Enter the connection details for your MongoDB data source.
        </div>
        
        <!-- Toggle between Connection String and Individual Fields -->
        <div class="self-center w-1/2 mb-6">
            <div class="flex items-center justify-center gap-4 p-3 bg-gray-100 rounded-lg">
                <button
                    @click="state.useConnectionString = true"
                    class="px-4 py-2 rounded-lg font-medium transition-colors"
                    :class="state.useConnectionString ? 'bg-primary-blue-100 text-white' : 'bg-white text-gray-700 hover:bg-gray-200'"
                    :disabled="state.loading">
                    Connection String
                </button>
                <button
                    @click="state.useConnectionString = false"
                    class="px-4 py-2 rounded-lg font-medium transition-colors"
                    :class="!state.useConnectionString ? 'bg-primary-blue-100 text-white' : 'bg-white text-gray-700 hover:bg-gray-200'"
                    :disabled="state.loading">
                    Individual Fields
                </button>
            </div>
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
        
        <!-- Connection String Mode -->
        <template v-if="state.useConnectionString">
            <div class="self-center w-1/2 mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Connection String</label>
                <input
                    v-model="state.connection_string"
                    type="text"
                    class="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent hover:border-blue-200"
                    :class="!state.connection_string_error ? '' : 'bg-red-300 text-black border-red-500'"
                    placeholder="mongodb+srv://username:password@cluster0.mongodb.net/database"
                    :disabled="state.loading"
                />
                <p class="text-xs text-gray-500 mt-1">Example: mongodb+srv://&lt;username&gt;:&lt;password&gt;:&lt;hostname&gt;/&lt;database-name&gt;</p>
            </div>
        </template>
        
        <!-- Individual Fields Mode -->
        <template v-else>
            <div class="self-center w-1/2 mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Host</label>
                <input
                    v-model="state.host"
                    type="text"
                    class="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent hover:border-blue-200"
                    :class="!state.host_error ? '' : 'bg-red-300 text-black border-red-500'"
                    placeholder="Enter host address"
                    :disabled="state.loading"
                />
            </div>
            
            <div class="self-center w-1/2 mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Port</label>
                <input
                    v-model="state.port"
                    type="text"
                    class="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent hover:border-blue-200"
                    :class="!state.port_error ? '' : 'bg-red-300 text-black border-red-500'"
                    placeholder="Enter port number (e.g., 27017)"
                    :disabled="state.loading"
                />
            </div>
            
            <div class="self-center w-1/2 mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Database Name</label>
                <input
                    v-model="state.database_name"
                    type="text"
                    class="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent hover:border-blue-200"
                    :class="!state.database_name_error ? '' : 'bg-red-300 text-black border-red-500'"
                    placeholder="Enter database name"
                    :disabled="state.loading"
                />
            </div>
            
            <div class="self-center w-1/2 mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Username</label>
                <input
                    v-model="state.username"
                    type="text"
                    class="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent hover:border-blue-200"
                    :class="!state.username_error ? '' : 'bg-red-300 text-black border-red-500'"
                    placeholder="Enter username"
                    :disabled="state.loading"
                />
            </div>
            
            <div class="self-center w-1/2 mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <div class="relative">
                    <input
                        v-model="state.password"
                        :type="state.showPassword ? 'text' : 'password'"
                        class="w-full p-3 pr-12 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent hover:border-blue-200"
                        :class="!state.password_error ? '' : 'bg-red-300 text-black border-red-500'"
                        placeholder="Enter password"
                        :disabled="state.loading"
                    />
                    <button
                        type="button"
                        @click="state.showPassword = !state.showPassword"
                        class="absolute right-3 top-3 text-gray-600 hover:text-gray-800"
                        :disabled="state.loading">
                        <font-awesome :icon="state.showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'" class="text-lg cursor-pointer" />
                    </button>
                </div>
            </div>
        </template>
        
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
</template>