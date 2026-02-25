<script setup lang="ts">

definePageMeta({ layout: 'marketing-project' });
import { useReCaptcha } from "vue-recaptcha-v3";
import { useDataSourceStore } from '@/stores/data_sources';
const dataSourceStore = useDataSourceStore();
const recaptcha = useReCaptcha();

const { $swal } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const state = reactive({
    host: '',
    port: '',
    schema: '',
    database_name: '',
    username: '',
    password: '',
    host_error: false,
    port_error: false,
    schema_error: false,
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
    if (!validate(state.schema, "", [validateRequired])) {
        state.schema_error = true;
        state.errorMessages.push("Please enter a valid schema.");
    } else {
        state.schema_error = false;
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

async function testConnection() {
    state.loading = true;
    state.showAlert = false;
    state.errorMessages = [];
    validateFields();
    if (state.host_error || state.port_error || state.database_name_error || state.username_error || state.password_error) {
        state.showAlert = true;
        state.loading = false;
    } else {
        const recaptchaToken = await getRecaptchaToken(recaptcha, 'mysqlConnectForm');
        const token = getAuthToken();
        if (recaptchaToken) {
            const requestOptions = {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body: {
                    data_source_type: "mysql",
                    host: state.host,
                    port: state.port,
                    schema: state.schema,
                    database_name: state.database_name,
                    username: state.username,
                    password: state.password,
                },
            };
            try {
                const data = await $fetch(`${baseUrl()}/data-source/test-connection`, {
                    method: "POST",
                    ...requestOptions
                });
                state.connectionSuccess = true;
                state.showAlert = true;
                state.errorMessages.push("Connection successful!");
            } catch (error: any) {
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
    if (state.host_error || state.port_error || state.database_name_error || state.username_error || state.password_error) {
        state.showAlert = true;
        state.loading = false;
        return;
    }
    
    const recaptchaToken = await getRecaptchaToken(recaptcha, 'mysqlConnectForm');
    const token = getAuthToken();
    if (recaptchaToken) {
        const requestOptions = {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
            body: {
                project_id: parseInt(route.params.projectid),
                data_source_type: "mysql",
                host: state.host,
                port: state.port,
                schema: state.schema,
                database_name: state.database_name,
                username: state.username,
                password: state.password,
            },
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
                router.push(`/marketing-projects/${route.params.projectid}`);
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

function goBack() {
    router.push(`/marketing-projects/${route.params.projectid}/data-sources`);
}
</script>
<template>
    <div class="max-w-[900px] mx-auto py-10 px-5 sm:py-6 sm:px-4">
        <button @click="goBack" class="text-indigo-600 hover:text-indigo-800 mb-4 flex items-center cursor-pointer">
            <font-awesome-icon :icon="['fas', 'chevron-left']" class="w-5 h-5 mr-2" />
            Back
        </button>

        <div class="text-center mb-10">
            <h1 class="text-4xl font-bold text-gray-900 mb-2">Connect MySQL Data Source</h1>
            <p class="text-base text-gray-600">Enter the connection details for your MySQL database.</p>
        </div>

        <div class="bg-white rounded-xl p-8 shadow-sm border border-indigo-200 sm:p-6 flex flex-col">
        <div v-if="state.showAlert"
            class="mb-6 rounded-lg p-4 text-base font-bold text-black"
            :class="{ 'bg-green-400': state.connectionSuccess, 'bg-red-400': !state.connectionSuccess }">
            <div v-if="state.connectionSuccess" class="text-2xl">Success!</div>
            <div v-else class="text-2xl">Error!</div>
            <template v-for="message in state.errorMessages">
                <div>{{ message }}</div>
            </template>
        </div>
        
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
                placeholder="Enter port number (e.g., 3306)"
                :disabled="state.loading"
            />
        </div>
        
        <div class="self-center w-1/2 mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">Schema</label>
            <input
                v-model="state.schema"
                type="text"
                class="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent hover:border-blue-200"
                :class="!state.schema_error ? '' : 'bg-red-300 text-black border-red-500'"
                placeholder="Enter schema name"
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
        
        <div class="flex gap-3 justify-center mt-6">
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
    </div>
</template>
