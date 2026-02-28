<script setup lang="ts">

definePageMeta({ layout: 'marketing-project' });
import { useGoogleOAuth } from '@/composables/useGoogleOAuth';
import { useGoogleAdManager } from '@/composables/useGoogleAdManager';
import type { IGAMNetwork, IGAMReportType } from '~/types/IGoogleAdManager';

const route = useRoute();
const router = useRouter();
const { $swal } = useNuxtApp() as any;

const oauth = useGoogleOAuth();
const gam = useGoogleAdManager();

const projectId = route.params.projectid as string;

const state = reactive({
    // Step tracking
    currentStep: 1,

    // OAuth state
    isAuthenticated: false,
    accessToken: '',
    refreshToken: '',
    tokenExpiry: '',

    // Network selection
    networks: [] as IGAMNetwork[],
    selectedNetwork: null as IGAMNetwork | null,
    loadingNetworks: false,

    // Configuration
    dataSourceName: '',
    selectedReportTypes: [] as string[],
    reportTypes: [] as IGAMReportType[],
    dateRange: 'last_30_days' as string,
    customStartDate: '',
    customEndDate: '',
    syncFrequency: 'daily' as 'daily' | 'weekly' | 'manual',

    // UI state
    loading: false,
    error: null as string | null,
    showAlert: false,
    connecting: false,
    navigating: false
});

// Load report types on mount
onMounted(async () => {
    const stepParam = route.query.step as string;
    state.reportTypes = gam.getReportTypes();

    // Check for stored OAuth session
    const tokens = await oauth.getStoredTokens();
    if (tokens) {
        state.isAuthenticated = true;
        state.accessToken = tokens.access_token;
        state.refreshToken = tokens.refresh_token || '';
        state.tokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : '';

        // If step 2, load networks
        if (stepParam === '2') {
            state.currentStep = 2;
            await loadNetworks();
        }
    }
});

/**
 * Step 1: Initiate Google Sign-In
 */
async function initiateGoogleSignIn() {
    try {
        state.loading = true;
        state.error = null;
        
        // Pass 'ad_manager' as service type to request GAM scopes
        await oauth.initiateAuth(projectId, 'ad_manager');
    } catch (error: any) {
        state.error = error.message || 'Failed to start authentication';
        $swal.fire({
            title: 'Authentication Error',
            text: state.error,
            icon: 'error'
        });
    } finally {
        state.loading = false;
    }
}

/**
 * Step 2: Load Google Ad Manager Networks
 */
async function loadNetworks() {
    try {
        state.loadingNetworks = true;
        state.error = null;

        const networks = await gam.listNetworks(state.accessToken);
        state.networks = networks;

        if (networks.length === 0) {
            state.error = 'No Google Ad Manager networks found. Please ensure you have access to at least one network.';
        }
    } catch (error: any) {
        state.error = error.message || 'Failed to load networks';
        $swal.fire({
            title: 'Error Loading Networks',
            text: state.error,
            icon: 'error'
        });
    } finally {
        state.loadingNetworks = false;
    }
}

/**
 * Retry loading networks
 */
async function retryLoadNetworks() {
    await loadNetworks();
}

/**
 * Select a network and move to configuration
 */
function selectNetwork(network: IGAMNetwork) {
    state.selectedNetwork = network;
    state.dataSourceName = `${network.displayName} Ad Manager`;

    state.currentStep = 3;
}

/**
 * Handle network selection from NetworkSelector component
 */
function onNetworkSelected(network: IGAMNetwork | null) {
    if (network) {
        selectNetwork(network);
    }
}

/**
 * Toggle report type selection
 */
function toggleReportType(reportId: string) {
    const index = state.selectedReportTypes.indexOf(reportId);
    if (index > -1) {
        state.selectedReportTypes.splice(index, 1);
    } else {
        state.selectedReportTypes.push(reportId);
    }
}

/**
 * Get date range based on selection
 */
function getDateRange(): { startDate: string; endDate: string } {
    if (state.dateRange === 'custom') {
        return {
            startDate: state.customStartDate,
            endDate: state.customEndDate
        };
    }

    const presets = gam.getDateRangePresets();
    const preset = presets.find(p => p.value === state.dateRange);

    if (preset) {
        return {
            startDate: preset.startDate,
            endDate: preset.endDate
        };
    }

    // Default to last 30 days
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);

    return {
        startDate: gam.formatDateISO(start),
        endDate: gam.formatDateISO(end)
    };
}

/**
 * Go back to previous step
 */
function goBack() {
    if (state.currentStep > 1) {
        state.currentStep--;
    }
}

/**
 * Move to next step with validation
 */
function nextStep() {
    if (state.currentStep === 3 && !validate()) {
        return;
    }
    if (state.currentStep < 4) {
        state.currentStep++;
    }
}

/**
 * Validate configuration (consolidated)
 */
function validate(): boolean {
    state.error = null;

    // Validate data source name
    if (!state.dataSourceName?.trim()) {
        state.error = 'Please enter a data source name';
        return false;
    }

    // Validate report types
    if (state.selectedReportTypes.length === 0) {
        state.error = 'Please select at least one report type';
        return false;
    }

    // Validate custom date range if selected
    if (state.dateRange === 'custom') {
        if (!state.customStartDate || !state.customEndDate) {
            state.error = 'Please select both start and end dates';
            return false;
        }

        const validation = gam.validateDateRange(state.customStartDate, state.customEndDate);
        if (!validation.isValid) {
            state.error = validation.error || 'Invalid date range';
            return false;
        }
    }

    return true;
}

/**
 * Cancel and return to data sources
 */
function cancel() {
    state.navigating = true;
    router.push(`/projects/${projectId}/data-sources`);
}

/**
 * Connect data source
 */
async function connect() {
    if (!validate()) {
        return;
    }

    try {
        state.connecting = true;
        state.error = null;

        const { startDate, endDate } = getDateRange();

        const config = {
            name: state.dataSourceName,
            network_code: state.selectedNetwork!.networkCode,
            network_id: state.selectedNetwork!.networkId,
            network_name: state.selectedNetwork!.displayName,
            report_types: state.selectedReportTypes,
            start_date: startDate,
            end_date: endDate,
            access_token: state.accessToken,
            refresh_token: state.refreshToken,
            token_expiry: state.tokenExpiry,
            project_id: parseInt(projectId),
            sync_frequency: state.syncFrequency
        };

        const dataSourceId = await gam.addDataSource(config);

        if (dataSourceId) {
            // Clear stored tokens
            await oauth.clearTokens();

            // Show syncing message
            $swal.fire({
                title: 'Syncing Data...',
                text: 'Please wait while we sync your Google Ad Manager data.',
                icon: 'info',
                allowOutsideClick: false,
                showConfirmButton: false,
                didOpen: () => {
                    $swal.showLoading();
                }
            });

            // Trigger initial sync
            const syncSuccess = await gam.syncNow(dataSourceId);

            if (syncSuccess) {
                await $swal.fire({
                    title: 'Connected Successfully!',
                    text: 'Your Google Ad Manager data has been synced and is ready to use.',
                    icon: 'success',
                    timer: 2000
                });
            } else {
                await $swal.fire({
                    title: 'Connected with Warning',
                    text: 'Data source added but initial sync failed. You can manually sync from the data sources page.',
                    icon: 'warning',
                    timer: 3000
                });
            }

            // Redirect to data sources list
            router.push(`/projects/${projectId}/data-sources`);
        } else {
            throw new Error('Failed to add data source');
        }
    } catch (error: any) {
        state.error = error.message || 'Failed to connect data source';
        $swal.fire({
            title: 'Connection Failed',
            text: state.error,
            icon: 'error'
        });
    } finally {
        state.connecting = false;
    }
}
</script>

<template>
    <!-- Loading/Navigating State -->
    <div v-if="state.navigating" class="max-w-[900px] mx-auto py-10 px-5">
        <div class="animate-pulse">
            <div class="h-10 bg-gray-300 rounded w-3/4 mx-auto mb-4"></div>
            <div class="h-6 bg-gray-200 rounded w-1/2 mx-auto mb-12"></div>
            
            <div class="bg-white rounded-lg border border-gray-200 p-8 mb-6">
                <div class="space-y-4">
                    <div class="h-4 bg-gray-200 rounded w-full"></div>
                    <div class="h-4 bg-gray-200 rounded w-5/6"></div>
                    <div class="h-4 bg-gray-200 rounded w-4/5"></div>
                </div>
            </div>
            
            <div class="flex justify-between">
                <div class="h-10 bg-gray-300 rounded w-24"></div>
                <div class="h-10 bg-gray-300 rounded w-32"></div>
            </div>
        </div>
    </div>

    <!-- Main Content -->
    <div v-else class="max-w-[900px] mx-auto py-10 px-5 sm:py-6 sm:px-4">
        <button @click="cancel" class="text-indigo-600 hover:text-indigo-800 mb-4 flex items-center cursor-pointer">
            <font-awesome-icon :icon="['fas', 'chevron-left']" class="w-5 h-5 mr-2" />
            Back
        </button>

        <div class="text-center mb-10">
            <h1 class="text-4xl font-bold text-gray-900 mb-2">Connect Google Ad Manager</h1>
            <p class="text-base text-gray-600">Import your ad revenue and performance data</p>
        </div>

        <!-- Step Indicator -->
        <div class="flex items-center justify-center mb-12 sm:mb-8">
            <div class="flex flex-col items-center gap-2" :class="{ 'text-indigo-600': state.currentStep >= 1 }">
                <div class="w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300"
                    :class="state.currentStep > 1 ? 'bg-green-500 text-white' : state.currentStep >= 1 ? 'bg-primary-blue-100 text-white' : 'bg-gray-300 text-gray-600'">
                    1</div>
                <div class="text-sm font-medium sm:text-xs"
                    :class="state.currentStep >= 1 ? 'text-indigo-600' : 'text-gray-600'">Authenticate</div>
            </div>
            <div class="w-16 h-0.5 mx-2 transition-all duration-300 sm:w-8"
                :class="state.currentStep > 1 ? 'bg-green-500' : 'bg-gray-300'"></div>
            <div class="flex flex-col items-center gap-2" :class="{ 'text-indigo-600': state.currentStep >= 2 }">
                <div class="w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300"
                    :class="state.currentStep > 2 ? 'bg-green-500 text-white' : state.currentStep >= 2 ? 'bg-primary-blue-100 text-white' : 'bg-gray-300 text-gray-600'">
                    2</div>
                <div class="text-sm font-medium sm:text-xs"
                    :class="state.currentStep >= 2 ? 'text-indigo-600' : 'text-gray-600'">Select Network</div>
            </div>
            <div class="w-16 h-0.5 mx-2 transition-all duration-300 sm:w-8"
                :class="state.currentStep > 2 ? 'bg-green-500' : 'bg-gray-300'"></div>
            <div class="flex flex-col items-center gap-2" :class="{ 'text-indigo-600': state.currentStep >= 3 }">
                <div class="w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300"
                    :class="state.currentStep > 3 ? 'bg-green-500 text-white' : state.currentStep >= 3 ? 'bg-primary-blue-100 text-white' : 'bg-gray-300 text-gray-600'">
                    3</div>
                <div class="text-sm font-medium sm:text-xs"
                    :class="state.currentStep >= 3 ? 'text-indigo-600' : 'text-gray-600'">Configure</div>
            </div>
            <div class="w-16 h-0.5 mx-2 transition-all duration-300 sm:w-8"
                :class="state.currentStep > 3 ? 'bg-green-500' : 'bg-gray-300'"></div>
            <div class="flex flex-col items-center gap-2" :class="{ 'text-indigo-600': state.currentStep >= 4 }">
                <div class="w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300"
                    :class="state.currentStep >= 4 ? 'bg-primary-blue-100 text-white' : 'bg-gray-300 text-gray-600'">4</div>
                <div class="text-sm font-medium sm:text-xs"
                    :class="state.currentStep >= 4 ? 'text-indigo-600' : 'text-gray-600'">Confirm</div>
            </div>
        </div>

        <!-- Step 1: Authentication -->
        <div v-if="state.currentStep === 1" class="animate-fade-in">
            <div class="bg-white rounded-xl p-8 shadow-sm border border-indigo-200 sm:p-6">
                <h2 class="text-2xl font-semibold text-gray-900 mb-6">Step 1: Authenticate with Google</h2>

                <div class="mb-8">
                    <p class="text-base text-gray-700 mb-4">Connect your Google account to access Ad Manager data:</p>
                    <ul class="list-none p-0">
                        <li class="py-2 text-gray-800">✓ Secure OAuth 2.0 authentication</li>
                        <li class="py-2 text-gray-800">✓ Read-only access to your network data</li>
                        <li class="py-2 text-gray-800">✓ No passwords stored</li>
                        <li class="py-2 text-gray-800">✓ Revoke access anytime</li>
                    </ul>
                </div>

                <button @click="initiateGoogleSignIn"
                    class="flex items-center justify-center gap-3 w-full max-w-[300px] mx-auto mb-6 px-6 py-4 bg-white border-2 border-gray-300 rounded-lg text-base font-semibold text-gray-700 cursor-pointer transition-all duration-200 hover:border-gray-400 hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
                    :disabled="state.loading">
                    <font-awesome-icon :icon="['fab', 'google']" class="w-6 h-6 text-[#4285F4]" />
                    <span v-if="!state.loading">Sign in with Google</span>
                    <span v-else>Redirecting...</span>
                </button>

            </div>
        </div>

        <!-- Step 2: Network Selection -->
        <div v-if="state.currentStep === 2" class="animate-fade-in">
            <div class="bg-white rounded-xl p-8 shadow-sm border border-indigo-200 sm:p-6">
                <h2 class="text-2xl font-semibold text-gray-900 mb-6">Step 2: Select Ad Manager Network</h2>

                <NetworkSelector :networks="state.networks" :is-loading="state.loadingNetworks" :error="state.error"
                    :model-value="state.selectedNetwork" @update:model-value="onNetworkSelected"
                    @retry="retryLoadNetworks" />

                <div class="flex gap-3 justify-end mt-8 sm:flex-col">
                    <button @click="goBack"
                        class="px-6 py-3 text-base font-medium border-0 cursor-pointer transition-all duration-200 bg-gray-300 text-gray-700 hover:bg-gray-400 sm:w-full rounded-lg">
                        ← Back
                    </button>
                </div>
            </div>
        </div>

        <!-- Step 3: Configuration -->
        <div v-if="state.currentStep === 3" class="animate-fade-in">
            <div class="bg-white rounded-xl p-8 shadow-sm border border-indigo-200 sm:p-6">
                <h2 class="text-2xl font-semibold text-gray-900 mb-6">Step 3: Configure Data Sync</h2>

                <!-- Data Source Name -->
                <div class="mb-6">
                    <label for="datasource-name" class="block text-sm font-semibold text-gray-800 mb-2">Data Source Name
                        *</label>
                    <input id="datasource-name" v-model="state.dataSourceName" type="text"
                        class="w-full px-4 py-3 text-base border-2 rounded-lg transition-all duration-200 focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                        :class="state.error && !state.dataSourceName ? 'border-red-500' : 'border-gray-300'"
                        placeholder="e.g., My Ad Network Revenue" />
                    <small class="block mt-1 text-xs text-gray-600">This name will appear in your data sources
                        list</small>
                </div>

                <!-- Report Types -->
                <div class="mb-6">
                    <label class="block text-sm font-semibold text-gray-800 mb-2">Select Report Types *</label>
                    <div class="flex flex-col gap-3">
                        <label v-for="reportType in state.reportTypes" :key="reportType.id"
                            class="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all duration-200"
                            :class="state.selectedReportTypes.includes(reportType.id) ? 'border-primary-blue-100 bg-blue-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'">
                            <input type="checkbox" :checked="state.selectedReportTypes.includes(reportType.id)"
                                @change="toggleReportType(reportType.id)" class="mt-1 cursor-pointer" />
                            <div class="flex-1">
                                <div class="font-semibold text-gray-900">{{ reportType.name }}</div>
                                <div class="text-sm text-gray-600 mt-1">{{ reportType.description }}</div>
                            </div>
                        </label>
                    </div>
                </div>

                <!-- Date Range -->
                <div class="mb-6">
                    <label class="block text-sm font-semibold text-gray-800 mb-2">Date Range *</label>
                    <select v-model="state.dateRange"
                        class="w-full px-4 py-3 text-base border-2 border-gray-300 rounded-lg transition-all duration-200 focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100">
                        <option value="last_7_days">Last 7 Days</option>
                        <option value="last_30_days">Last 30 Days</option>
                        <option value="last_90_days">Last 90 Days</option>
                        <option value="last_6_months">Last 6 Months</option>
                        <option value="last_year">Last Year</option>
                        <option value="custom">Custom Range</option>
                    </select>
                </div>

                <!-- Custom Date Range -->
                <div v-if="state.dateRange === 'custom'" class="mb-6 grid grid-cols-2 gap-4">
                    <div>
                        <label for="start-date" class="block text-sm font-semibold text-gray-800 mb-2">Start Date
                            *</label>
                        <input id="start-date" v-model="state.customStartDate" type="date"
                            class="w-full px-4 py-3 text-base border-2 border-gray-300 rounded-lg transition-all duration-200 focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100" />
                    </div>
                    <div>
                        <label for="end-date" class="block text-sm font-semibold text-gray-800 mb-2">End Date *</label>
                        <input id="end-date" v-model="state.customEndDate" type="date"
                            class="w-full px-4 py-3 text-base border-2 border-gray-300 rounded-lg transition-all duration-200 focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100" />
                    </div>
                </div>

                <!-- Sync Frequency -->
                <div class="mb-6">
                    <label class="block text-sm font-semibold text-gray-800 mb-2">Sync Frequency</label>
                    <div class="flex flex-col gap-3">
                        <label
                            class="flex items-center gap-2 p-3 border-2 border-gray-300 rounded-lg cursor-pointer transition-all duration-200 hover:border-gray-400 hover:bg-gray-50">
                            <input type="radio" v-model="state.syncFrequency" value="manual" class="cursor-pointer" />
                            <span>Manual (sync on demand)</span>
                        </label>
                        <label
                            class="flex items-center gap-2 p-3 border-2 border-gray-300 rounded-lg cursor-pointer transition-all duration-200 hover:border-gray-400 hover:bg-gray-50">
                            <input type="radio" v-model="state.syncFrequency" value="daily" class="cursor-pointer" />
                            <span>Daily (every night at 2 AM)</span>
                        </label>
                        <label
                            class="flex items-center gap-2 p-3 border-2 border-gray-300 rounded-lg cursor-pointer transition-all duration-200 hover:border-gray-400 hover:bg-gray-50">
                            <input type="radio" v-model="state.syncFrequency" value="weekly" class="cursor-pointer" />
                            <span>Weekly (every Sunday at 2 AM)</span>
                        </label>
                    </div>
                </div>



                <div class="flex gap-3 justify-end mt-8 sm:flex-col">
                    <button @click="goBack"
                        class="px-6 py-3 text-base font-medium border-0 cursor-pointer transition-all duration-200 bg-gray-300 text-gray-700 hover:bg-gray-400 sm:w-full rounded-lg">
                        ← Back
                    </button>
                    <button @click="nextStep"
                        class="px-6 py-3 text-base font-medium border-0 cursor-pointer transition-all duration-200 bg-primary-blue-100 text-white hover:bg-primary-blue-300 hover:-translate-y-0.5 hover:shadow-lg sm:w-full rounded-lg">
                        Continue →
                    </button>
                </div>
            </div>
        </div>

        <!-- Step 4: Confirmation -->
        <div v-if="state.currentStep === 4" class="animate-fade-in">
            <div class="bg-white rounded-xl p-8 shadow-sm border border-indigo-200 sm:p-6">
                <h2 class="text-2xl font-semibold text-gray-900 mb-6">Step 4: Review & Confirm</h2>

                <div class="space-y-6 mb-8">
                    <!-- Network Info -->
                    <div class="p-5 bg-gray-50 rounded-lg">
                        <h4 class="text-sm font-semibold text-gray-600 mb-3">Network</h4>
                        <div>
                            <p class="font-semibold text-gray-900">{{ state.selectedNetwork?.displayName }}</p>
                            <p class="text-sm text-gray-600">Network Code: {{ state.selectedNetwork?.networkCode }}</p>
                            <p class="text-sm text-gray-600">Currency: {{ state.selectedNetwork?.currencyCode }}</p>
                        </div>
                    </div>

                    <!-- Data Source Name -->
                    <div class="p-5 bg-gray-50 rounded-lg">
                        <h4 class="text-sm font-semibold text-gray-600 mb-3">Data Source Name</h4>
                        <p class="text-gray-900">{{ state.dataSourceName }}</p>
                    </div>

                    <!-- Selected Reports -->
                    <div class="p-5 bg-gray-50 rounded-lg">
                        <h4 class="text-sm font-semibold text-gray-600 mb-3">Report Types ({{
                            state.selectedReportTypes.length }})</h4>
                        <div class="grid grid-cols-1 gap-2">
                            <div v-for="reportId in state.selectedReportTypes" :key="reportId" class="text-gray-800">
                                ✓ {{state.reportTypes.find(r => r.id === reportId)?.name}}
                            </div>
                        </div>
                    </div>

                    <!-- Date Range -->
                    <div class="p-5 bg-gray-50 rounded-lg">
                        <h4 class="text-sm font-semibold text-gray-600 mb-3">Date Range</h4>
                        <p class="text-gray-900">
                            {{ gam.formatDateISO(new Date(getDateRange().startDate)) }}
                            to
                            {{ gam.formatDateISO(new Date(getDateRange().endDate)) }}
                        </p>
                    </div>

                    <!-- Sync Frequency -->
                    <div class="p-5 bg-gray-50 rounded-lg">
                        <h4 class="text-sm font-semibold text-gray-600 mb-3">Sync Frequency</h4>
                        <p class="text-gray-900">{{ gam.getSyncFrequencyText(state.syncFrequency) }}</p>
                    </div>
                </div>

                <div class="p-5 bg-indigo-50 rounded-lg mb-8">
                    <p class="text-sm text-gray-800">
                        <strong>Note:</strong> The initial sync may take several minutes depending on the amount of
                        data.
                        You can continue working while the sync completes in the background.
                    </p>
                </div>

                <div class="flex gap-3 justify-end mt-8 sm:flex-col">
                    <button @click="goBack"
                        class="px-6 py-3 text-base font-medium border-0 cursor-pointer transition-all duration-200 bg-gray-300 text-gray-700 hover:bg-gray-400 disabled:opacity-60 disabled:cursor-not-allowed sm:w-full rounded-lg"
                        :disabled="state.connecting">
                        ← Back
                    </button>
                    <button @click="connect"
                        class="px-6 py-3 text-base font-medium border-0 cursor-pointer transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed bg-primary-blue-100 text-white hover:bg-primary-blue-300 hover:-translate-y-0.5 hover:shadow-lg sm:w-full rounded-lg"
                        :disabled="state.connecting">
                        <span v-if="!state.connecting">Connect & Sync →</span>
                        <span v-else>Connecting...</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
