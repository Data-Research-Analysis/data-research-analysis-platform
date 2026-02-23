<script setup lang="ts">
import { useGoogleOAuth } from '@/composables/useGoogleOAuth';
import { useGoogleAds } from '@/composables/useGoogleAds';
import type { IGoogleAdsAccount, IGoogleAdsReportTypeDefinition } from '~/types/IGoogleAds';

const route = useRoute();
const router = useRouter();
const { $swal } = useNuxtApp() as any;

const oauth = useGoogleOAuth();
const ads = useGoogleAds();

const projectId = route.params.projectid as string;

const state = reactive({
    // Step tracking
    currentStep: 1,

    // OAuth state
    isAuthenticated: false,
    accessToken: '',
    refreshToken: '',
    tokenExpiry: '',

    // Account selection
    accounts: [] as IGoogleAdsAccount[],
    selectedAccount: null as IGoogleAdsAccount | null,
    selectedClientAccount: null as string | null, // For manager accounts
    loadingAccounts: false,

    // Configuration
    dataSourceName: '',
    selectedReportTypes: [] as string[],
    reportTypes: [] as IGoogleAdsReportTypeDefinition[],
    dateRange: 'last_30_days' as string,
    customStartDate: '',
    customEndDate: '',

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
    state.reportTypes = ads.getReportTypes();

    // Check for stored OAuth session
    const tokens = await oauth.getStoredTokens();
    if (tokens) {
        state.isAuthenticated = true;
        state.accessToken = tokens.access_token;
        state.refreshToken = tokens.refresh_token || '';
        state.tokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : '';

        // If step 2, load accounts
        if (stepParam === '2') {
            state.currentStep = 2;
            await loadAccounts();
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

        // Pass 'google_ads' as service type
        await oauth.initiateAuth(projectId, 'google_ads');
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
 * Step 2: Load Google Ads Accounts
 */
async function loadAccounts() {
    try {
        state.loadingAccounts = true;
        state.error = null;

        const accounts = await ads.listAccounts(state.accessToken);
        state.accounts = accounts;

        if (accounts.length === 0) {
            state.error = 'No Google Ads accounts found. Please ensure you have access to at least one account.';
            $swal.fire({
                title: 'No Accounts Found',
                text: state.error,
                icon: 'warning'
            });
        }
    } catch (error: any) {
        state.error = error.message || 'Failed to load accounts';
        $swal.fire({
            title: 'Error Loading Accounts',
            text: state.error,
            icon: 'error'
        });
    } finally {
        state.loadingAccounts = false;
    }
}

/**
 * Step 3: Select account and proceed to configuration
 */
function selectAccount(account: IGoogleAdsAccount) {
    state.selectedAccount = account;
    state.dataSourceName = `Google Ads - ${account.descriptiveName}`;
    
    // If it's a manager account, don't auto-proceed - let user select client first
    if (account.isManager && account.clientAccounts && account.clientAccounts.length > 0) {
        state.selectedClientAccount = null;
        return; // Stay on step 2 to allow client selection
    }
    
    // Check if this is a test token limited account
    if (account.descriptiveName.includes('Test Token - Limited Access')) {
        $swal.fire({
            title: 'Test Developer Token',
            html: `
                <p class="mb-2">This account has limited access with your current developer token.</p>
                <p class="mb-2"><strong>Data sync may fail</strong> if this is not a test account.</p>
                <p>To access production accounts, apply for Basic or Standard access at:</p>
                <a href="https://ads.google.com/aw/apicenter" target="_blank" class="text-indigo-600 hover:underline">Google Ads API Center</a>
            `,
            icon: 'warning',
            confirmButtonText: 'Continue Anyway'
        });
    }
    
    state.currentStep = 3;
}

/**
 * Select a client account under a manager
 */
function selectClientAccount(clientAccount: any) {
    if (!state.selectedAccount) return;
    
    state.selectedClientAccount = clientAccount.customerId;
    state.dataSourceName = `Google Ads - ${clientAccount.descriptiveName}`;
    state.currentStep = 3;
}

/**
 * Proceed to configuration after selecting manager or client
 */
function proceedToConfiguration() {
    if (!state.selectedAccount) return;
    
    if (state.selectedAccount.isManager && !state.selectedClientAccount) {
        $swal.fire({
            title: 'Select a Client Account',
            text: 'Please select a specific client account to sync, or continue to sync all clients.',
            icon: 'warning'
        });
        return;
    }
    
    state.currentStep = 3;
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
function getDateRange() {
    const presets = ads.getDateRangePresets();
    if (state.dateRange === 'custom') {
        return {
            startDate: state.customStartDate,
            endDate: state.customEndDate
        };
    }

    const preset = presets.find(p => p.value === state.dateRange);
    return preset ? {
        startDate: preset.startDate,
        endDate: preset.endDate
    } : presets[0]; // Default to last 30 days
}

/**
 * Validate configuration before connecting
 */
function validateConfiguration(): boolean {
    if (!state.dataSourceName.trim()) {
        $swal.fire({
            title: 'Missing Name',
            text: 'Please provide a name for this data source',
            icon: 'warning'
        });
        return false;
    }

    if (state.selectedReportTypes.length === 0) {
        $swal.fire({
            title: 'No Reports Selected',
            text: 'Please select at least one report type',
            icon: 'warning'
        });
        return false;
    }

    if (state.dateRange === 'custom') {
        const validation = ads.validateDateRange(state.customStartDate, state.customEndDate);
        if (!validation.isValid) {
            $swal.fire({
                title: 'Invalid Date Range',
                text: validation.error,
                icon: 'error'
            });
            return false;
        }
    }

    return true;
}

/**
 * Step 4: Connect and sync data source
 */
async function connectDataSource() {
    if (!validateConfiguration()) return;
    if (!state.selectedAccount) return;

    try {
        state.connecting = true;
        state.error = null;

        const dateRange = getDateRange();

        // Show progress dialog (don't await - continue execution)
        $swal.fire({
            title: 'Connecting...',
            html: `
                <div class="text-left">
                    <p class="mb-2">✓ Validating credentials</p>
                    <p class="mb-2 text-gray-400">○ Creating data source</p>
                    <p class="text-gray-400">○ Syncing data</p>
                </div>
            `,
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => {
                $swal.showLoading();
            }
        });

        // Add data source
        const dataSourceConfig = {
            name: state.dataSourceName,
            customerId: state.selectedClientAccount || state.selectedAccount.customerId, // Use client if selected
            managerCustomerId: state.selectedClientAccount ? state.selectedAccount.customerId : undefined, // Include manager ID if client selected
            accessToken: state.accessToken,
            refreshToken: state.refreshToken,
            reportTypes: state.selectedReportTypes,
            startDate: dateRange.startDate,
            endDate: dateRange.endDate
        };

        console.log('[Wizard] Calling addDataSource with config:', dataSourceConfig);
        const dataSourceId = await ads.addDataSource(dataSourceConfig);

        if (!dataSourceId) {
            throw new Error('Failed to create data source - no ID returned');
        }
        
        console.log('[Wizard] Data source created successfully:', dataSourceId);

        // Update progress
        $swal.update({
            html: `
                <div class="text-left">
                    <p class="mb-2 text-green-600">✓ Credentials validated</p>
                    <p class="mb-2 text-green-600">✓ Data source created</p>
                    <p class="text-gray-400">○ Syncing data...</p>
                </div>
            `
        });

        // Trigger initial sync
        console.log('[Wizard] Triggering initial sync...');
        const syncSuccess = await ads.syncNow(dataSourceId);
        console.log('[Wizard] Sync result:', syncSuccess);

        // Final progress update
        $swal.update({
            html: `
                <div class="text-left">
                    <p class="mb-2 text-green-600">✓ Credentials validated</p>
                    <p class="mb-2 text-green-600">✓ Data source created</p>
                    <p class="mb-2 ${syncSuccess ? 'text-green-600' : 'text-yellow-600'}">
                        ${syncSuccess ? '✓' : '⚠'} Initial sync ${syncSuccess ? 'completed' : 'queued'}
                    </p>
                </div>
            `
        });

        // Show success message
        await $swal.fire({
            title: 'Success!',
            html: `
                <p class="mb-4">Your Google Ads data source has been connected.</p>
                <p class="text-sm text-gray-600">
                    ${syncSuccess
                    ? 'Data is now available in the AI Data Modeler.'
                    : 'Initial sync is in progress. Data will be available shortly.'}
                </p>
            `,
            icon: 'success',
            confirmButtonText: 'View Data Sources'
        });

        // Navigate back to data sources page
        await router.push(`/projects/${projectId}`);

    } catch (error: any) {
        console.error('[Wizard] Connection error:', error);
        state.error = error.message || 'Failed to connect data source';

        await $swal.fire({
            title: 'Connection Failed',
            html: `
                <p class="mb-2">Failed to connect Google Ads account:</p>
                <p class="text-sm text-red-600">${state.error}</p>
            `,
            icon: 'error'
        });
    } finally {
        state.connecting = false;
    }
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
 * Cancel and return to data sources
 */
function cancel() {
    state.navigating = true;
    router.push(`/projects/${projectId}/data-sources`);
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
            <h1 class="text-4xl font-bold text-gray-900 mb-2">Connect Google Ads</h1>
            <p class="text-base text-gray-600">Import your Google Ads campaign data for analysis</p>
        </div>

        <!-- Step Indicator -->
        <div class="flex items-center justify-center mb-12 sm:mb-8">
            <div class="flex flex-col items-center gap-2" :class="{ 'text-indigo-600': state.currentStep >= 1 }">
                <div class="w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300" 
                     :class="state.currentStep > 1 ? 'bg-green-500 text-white' : state.currentStep >= 1 ? 'bg-primary-blue-100 text-white' : 'bg-gray-300 text-gray-600'">1</div>
                <div class="text-sm font-medium sm:text-xs" :class="state.currentStep >= 1 ? 'text-primary-blue-100' : 'text-gray-600'">Authenticate</div>
            </div>
            <div class="w-20 h-0.5 mx-4 transition-all duration-300 sm:w-10" :class="state.currentStep > 1 ? 'bg-green-500' : 'bg-gray-300'"></div>
            <div class="flex flex-col items-center gap-2" :class="{ 'text-indigo-600': state.currentStep >= 2 }">
                <div class="w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300" 
                     :class="state.currentStep > 2 ? 'bg-green-500 text-white' : state.currentStep >= 2 ? 'bg-primary-blue-100 text-white' : 'bg-gray-300 text-gray-600'">2</div>
                <div class="text-sm font-medium sm:text-xs" :class="state.currentStep >= 2 ? 'text-primary-blue-100' : 'text-gray-600'">Select Account</div>
            </div>
            <div class="w-20 h-0.5 mx-4 transition-all duration-300 sm:w-10" :class="state.currentStep > 2 ? 'bg-green-500' : 'bg-gray-300'"></div>
            <div class="flex flex-col items-center gap-2" :class="{ 'text-indigo-600': state.currentStep >= 3 }">
                <div class="w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300" 
                     :class="state.currentStep >= 3 ? 'bg-primary-blue-100 text-white' : 'bg-gray-300 text-gray-600'">3</div>
                <div class="text-sm font-medium sm:text-xs" :class="state.currentStep >= 3 ? 'text-primary-blue-100' : 'text-gray-600'">Configure</div>
            </div>
        </div>



        <!-- Step 1: Authentication -->
        <div v-if="state.currentStep === 1" class="animate-fade-in">
            <div class="bg-white rounded-xl p-8 shadow-sm border border-indigo-200 sm:p-6">
                <h2 class="text-2xl font-semibold text-gray-900 mb-6">Step 1: Authenticate with Google</h2>
                
                <div class="mb-8">
                    <p class="text-base text-gray-700 mb-4">Connect your Google account to access Ads data:</p>
                    <ul class="list-none p-0">
                        <li class="py-2 text-gray-800">✓ Secure OAuth 2.0 authentication</li>
                        <li class="py-2 text-gray-800">✓ Read-only access to your data</li>
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

        <!-- Step 2: Account Selection -->
        <div v-if="state.currentStep === 2" class="animate-fade-in">
            <div class="bg-white rounded-xl p-8 shadow-sm border border-indigo-200 sm:p-6">
                <h2 class="text-2xl font-semibold text-gray-900 mb-6">Step 2: Select Google Ads Account</h2>

                <div v-if="state.loadingAccounts" class="text-center py-12 px-6">
                    <div class="w-12 h-12 border-4 border-gray-300 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p>Loading your Google Ads accounts...</p>
                </div>

                <div v-else-if="state.accounts.length === 0" class="text-center py-12 px-6">
                    <p class="text-gray-600">{{ state.error || 'No accounts found' }}</p>
                </div>

                <div v-else class="flex flex-col gap-4 mb-6">
                    <div v-for="account in state.accounts" :key="account.customerId" class="border-2 rounded-lg"
                        :class="state.selectedAccount?.customerId === account.customerId ? 'border-primary-blue-100 bg-blue-50' : 'border-gray-300'">
                        <!-- Main Account Row -->
                        <div class="flex items-center gap-4 p-5 cursor-pointer transition-all duration-200"
                            :class="!account.isManager && 'hover:bg-gray-50'"
                            @click="!account.isManager && selectAccount(account)">
                            <div class="flex-1">
                                <div class="flex items-center gap-2 mb-1">
                                    <h3 class="text-base font-semibold text-gray-900 m-0">{{ account.descriptiveName }}</h3>
                                    <span v-if="account.isManager" class="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                                        Manager Account
                                    </span>
                                </div>
                                <p class="text-sm text-gray-600 m-0">Customer ID: {{ account.customerId }}</p>
                                <p class="text-xs text-gray-500 m-0 mt-1">{{ account.currencyCode }} • {{ account.timeZone }}</p>
                                <p v-if="account.isManager && account.clientAccounts" class="text-xs text-purple-600 m-0 mt-1">
                                    {{ account.clientAccounts.length }} client account(s) - select one below
                                </p>
                            </div>
                            <div v-if="!account.isManager">
                                <font-awesome-icon v-if="state.selectedAccount?.customerId === account.customerId && !state.selectedClientAccount" :icon="['fas', 'check']" class="w-6 h-6 text-indigo-600" />
                            </div>
                        </div>

                        <!-- Client Accounts (for manager accounts) -->
                        <div v-if="account.isManager && account.clientAccounts && account.clientAccounts.length > 0" 
                            class="border-t border-gray-200 bg-gray-50 p-4">
                            <p class="text-sm font-medium text-gray-700 mb-3">Select a client account:</p>
                            <div class="flex flex-col gap-2">
                                <div v-for="client in account.clientAccounts" :key="client.customerId"
                                    class="flex items-center gap-3 p-3 border rounded cursor-pointer transition-all duration-200"
                                    :class="state.selectedClientAccount === client.customerId 
                                        ? 'border-indigo-500 bg-indigo-50' 
                                        : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'"
                                    @click="selectAccount(account); selectClientAccount(client)">
                                    <div class="flex-1">
                                        <p class="text-sm font-medium text-gray-900 m-0">{{ client.descriptiveName }}</p>
                                        <p class="text-xs text-gray-600 m-0">ID: {{ client.customerId }}</p>
                                    </div>
                                    <div>
                                        <font-awesome-icon v-if="state.selectedClientAccount === client.customerId" :icon="['fas', 'check']" class="w-5 h-5 text-indigo-600" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="flex gap-3 justify-end mt-8 sm:flex-col">
                    <button @click="goBack" class="px-6 py-3 text-base font-medium border-0 cursor-pointer transition-all duration-200 bg-gray-300 text-gray-700 hover:bg-gray-400 sm:w-full rounded-lg">
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
                    <label for="datasource-name" class="block text-sm font-semibold text-gray-800 mb-2">Data Source Name *</label>
                    <input id="datasource-name" v-model="state.dataSourceName" type="text"
                        class="w-full px-4 py-3 text-base border-2 rounded-lg transition-all duration-200 focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                        :class="state.error && !state.dataSourceName ? 'border-red-500' : 'border-gray-300'"
                        placeholder="e.g., Google Ads - Main Account" />
                    <small class="block mt-1 text-xs text-gray-600">This name will appear in your data sources list</small>
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
                        <option value="last_30_days">Last 30 Days</option>
                        <option value="last_90_days">Last 90 Days</option>
                        <option value="custom">Custom Range</option>
                    </select>
                </div>

                <!-- Custom Date Range -->
                <div v-if="state.dateRange === 'custom'" class="mb-6 grid grid-cols-2 gap-4">
                    <div>
                        <label for="start-date" class="block text-sm font-semibold text-gray-800 mb-2">Start Date *</label>
                        <input id="start-date" v-model="state.customStartDate" type="date"
                            class="w-full px-4 py-3 text-base border-2 border-gray-300 rounded-lg transition-all duration-200 focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100" />
                    </div>
                    <div>
                        <label for="end-date" class="block text-sm font-semibold text-gray-800 mb-2">End Date *</label>
                        <input id="end-date" v-model="state.customEndDate" type="date"
                            class="w-full px-4 py-3 text-base border-2 border-gray-300 rounded-lg transition-all duration-200 focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100" />
                    </div>
                </div>

                <!-- Selected Account Summary -->
                <div class="p-5 bg-gray-50 rounded-lg mb-6">
                    <h4 class="text-sm font-semibold text-gray-600 mb-3">Selected Account</h4>
                    <div v-if="state.selectedClientAccount && state.selectedAccount?.clientAccounts">
                        <p class="text-sm text-gray-600 mb-1">Manager: {{ state.selectedAccount?.descriptiveName }}</p>
                        <p><strong>{{ state.selectedAccount?.clientAccounts.find(c => c.customerId === state.selectedClientAccount)?.descriptiveName }}</strong></p>
                        <p class="text-gray-600 text-sm">Customer ID: {{ state.selectedClientAccount }}</p>
                    </div>
                    <div v-else>
                        <p><strong>{{ state.selectedAccount?.descriptiveName }}</strong></p>
                        <p class="text-gray-600 text-sm">Customer ID: {{ state.selectedAccount?.customerId }}</p>
                    </div>
                </div>

                <!-- Actions -->
                <div class="flex gap-3 justify-end mt-8 sm:flex-col">
                    <button @click="goBack" class="px-6 py-3 text-base font-medium border-0 cursor-pointer transition-all duration-200 bg-gray-300 text-gray-700 hover:bg-gray-400 disabled:opacity-60 disabled:cursor-not-allowed sm:w-full rounded-lg" :disabled="state.connecting">
                        ← Back
                    </button>
                    <button @click="connectDataSource" class="px-6 py-3 text-base font-medium border-0 cursor-pointer transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed bg-primary-blue-100 text-white hover:bg-primary-blue-300 hover:-translate-y-0.5 hover:shadow-lg sm:w-full rounded-lg" :disabled="state.connecting">
                        <span v-if="!state.connecting">Connect & Sync →</span>
                        <span v-else>Connecting...</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
