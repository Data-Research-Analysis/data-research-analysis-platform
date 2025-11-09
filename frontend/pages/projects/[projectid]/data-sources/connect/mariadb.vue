<script setup>
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

async function getToken() {
    state.loading = true;
    const response = await getGeneratedToken();
    state.token = response.token;
    state.loading = false;
}
function validateFields() {
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
        const recaptchaToken = await getRecaptchaToken(recaptcha, 'mariadbConnectionForm');
        const token = getAuthToken();
        if (recaptchaToken) {
            const requestOptions = {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body: JSON.stringify({
                    data_source_type: "mariadb",
                    host: state.host,
                    port: state.port,
                    schema: state.schema,
                    database_name: state.database_name,
                    username: state.username,
                    password: state.password,
                }),
            };
            const response = await fetch(`${baseUrl()}/data-source/test-connection`, requestOptions);
            if (response.status === 200) {
                state.connectionSuccess = true;
                state.showAlert = true;
                const data = await response.json();
                state.errorMessages.push("Connection successful!");
            } else {
             state.connectionSuccess = false;
                state.showAlert = true;
                const data = await response.json();
                state.errorMessages.push(data.message);
            }
        }
    }
    state.loading = false;
}
async function connectAndSave() {
    state.loading = true;
    state.showAlert = false;
    state.errorMessages = [];
    validateFields();
    if (state.host_error || state.port_error || state.database_name_error || state.username_error || state.password_error) {
        state.showAlert = true;
        state.loading = false;
    } else {
        const recaptchaToken = await getRecaptchaToken(recaptcha, 'mysqlConnectionForm');
        const token = getAuthToken();
        if (recaptchaToken) {
            const requestOptions = {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "Authorization-Type": "auth",
                },
                body: JSON.stringify({
                    data_source_type: "mysql",
                    host: state.host,
                    port: state.port,
                    schema: state.schema,
                    database_name: state.database_name,
                    username: state.username,
                    password: state.password,
                    project_id: route.params.projectid,
                }),
            };
            const response = await fetch(`${baseUrl()}/data-source/add-data-source`, requestOptions);
            if (response.status === 200) {
                state.connectionSuccess = true;
                state.showAlert = true;
                const data = await response.json();
                state.errorMessages.push("Connection successful!");
                await dataSourceStore.retrieveDataSources();
                router.push(`/projects/${route.params.projectid}/data-sources`);
            } else {
             state.connectionSuccess = false;
                state.showAlert = true;
                const data = await response.json();
                state.errorMessages.push(data.message);
            }
        }
    }
    state.loading = false;
}
onMounted(async () => {
    await getToken();
})
</script>
<template>
    <div class="min-h-100 flex flex-col ml-4 mr-4 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md">
        <div class="font-bold text-2xl mb-5">
            Connect to MariaDB Database
        </div>
        <div class="text-md mb-10">
            Please provide in the following details to the MariaDB instance of the data source that you want to connect to.
        </div>
        <div v-if="state.showAlert"
            class="w-3/4 self-center text-lg p-5 mb-5 font-bold text-black"
            :class="{ 'bg-green-400': state.connectionSuccess, 'bg-red-400': !state.connectionSuccess }">
            <div v-if="state.connectionSuccess" class="text-2xl">Success!</div>
            <div v-else class="text-2xl">Error!</div>
            <template v-for="message in state.errorMessages">
                <div>{{ message }}</div>
            </template>
        </div>
        <input
            v-model="state.host"
            type="text"
            class="self-center w-1/2 p-5 border border-primary-blue-100 border-solid hover:border-blue-200 mb-5 shadow-md"
            :class="!state.host_error ? '' : 'bg-red-300 text-black'"
            placeholder="Host"
            :disabled="state.loading"
        />
        <input
            v-model="state.port"
            type="text"
            class="self-center w-1/2 p-5 border border-primary-blue-100 border-solid hover:border-blue-200 mb-5 shadow-md"
            :class="!state.port_error ? '' : 'bg-red-300 text-black'"
            placeholder="Port"
            :disabled="state.loading"
        />
        <input
            v-model="state.schema"
            type="text"
            class="self-center w-1/2 p-5 border border-primary-blue-100 border-solid hover:border-blue-200 mb-5 shadow-md"
            :class="!state.schema_error ? '' : 'bg-red-300 text-black'"
            placeholder="Schema"
            :disabled="state.loading"
        />
        <input
            v-model="state.database_name"
            type="text"
            class="self-center w-1/2 p-5 border border-primary-blue-100 border-solid hover:border-blue-200 mb-5 shadow-md"
            :class="!state.database_name_error ? '' : 'bg-red-300 text-black'"
            placeholder="Database Name"
            :disabled="state.loading"
        />
        <input
            v-model="state.username"
            type="text"
            class="self-center w-1/2 p-5 border border-primary-blue-100 border-solid hover:border-blue-200 mb-5 shadow-md"
            :class="!state.username_error ? '' : 'bg-red-300 text-black'"
            placeholder="Username"
            :disabled="state.loading"
        />
        <div class="relative self-center w-1/2">
            <input
                v-model="state.password"
                :type="state.showPassword ? 'text' : 'password'"
                class="w-full p-5 pr-12 border border-primary-blue-100 border-solid hover:border-blue-200 mb-5 shadow-md"
                :class="!state.password_error ? '' : 'bg-red-300 text-black'"
                placeholder="Password"
                :disabled="state.loading"
            />
            <button
                type="button"
                @click="state.showPassword = !state.showPassword"
                class="absolute right-3 top-5 text-gray-600 hover:text-gray-800"
                :disabled="state.loading">
                <font-awesome :icon="state.showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'" class="text-lg" />
            </button>
        </div>
        <spinner v-if="state.loading"/>
        <div v-else class="flex flex-row justify-center">
            <div
                class="w-1/4 text-center self-center mb-5 p-2 m-2 bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md"
                @click="connectAndSave"
            >
                Connect &amp; Save Connection Details
            </div>
            <div
                class="w-1/4 text-center self-center mb-5 p-2 m-2 bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md"
                @click="testConnection"
            >
                Test Connection
            </div>
        </div>
    </div>
</template>