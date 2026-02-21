<script setup lang="ts">
import { useDataSourceStore } from '@/stores/data_sources';
import type { IMetaAdAccount, IMetaSyncConfig } from '~/types/IMetaAds';

const route = useRoute();
const router = useRouter();
const { $swal } = useNuxtApp() as any;
const dataSourcesStore = useDataSourceStore();

const projectId = route.params.projectid as string;

const state = reactive({
    // Step tracking
    currentStep: 1,

    // OAuth state
    isAuthenticated: false,
    accessToken: '',
    tokenExpiry: '',

    // Account selection
    accounts: [] as IMetaAdAccount[],
    selectedAccount: null as IMetaAdAccount | null,
    loadingAccounts: false,

    // Configuration
    dataSourceName: '',
    selectedReportTypes: ['campaigns', 'adsets', 'ads', 'insights'] as string[],
    dateRange: 'last_30_days' as string,
    customStartDate: '',
    customEndDate: '',

    // UI state
    loading: false,
    error: null as string | null,
    connecting: false
});

const reportTypeOptions = [
    { id: 'campaigns', name: 'Campaigns', description: 'Campaign-level data (name, status, budget, objective)' },
    { id: 'adsets', name: 'Ad Sets', description: 'Ad set-level data (targeting, schedule, bid strategy)' },
    { id: 'ads', name: 'Ads', description: 'Individual ads (creative, status, preview URL)' },
    { id: 'insights', name: 'Insights', description: 'Performance metrics (impressions, clicks, spend, conversions)' }
];

// Check for OAuth callback on mount
onMounted(async () => {
    // Check if returning from OAuth callback page (token stored in localStorage)
    if (import.meta.client) {
        const storedToken = localStorage.getItem('meta_ads_oauth_token');
        if (storedToken) {
            try {
                const tokenData = JSON.parse(storedToken);
                localStorage.removeItem('meta_ads_oauth_token');
                state.isAuthenticated = true;
                state.accessToken = tokenData.access_token;
                state.tokenExpiry = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
                state.currentStep = 2;
                await loadAdAccounts();
            } catch (e) {
                localStorage.removeItem('meta_ads_oauth_token');
            }
        }
    }
});

/**
 * Step 1: Initiate Meta OAuth
 */
async function initiateMetaOAuth() {
    try {
        state.loading = true;
        state.error = null;

        await dataSourcesStore.initiateMetaOAuth(projectId);
    } catch (error: any) {
        state.error = error.message || 'Failed to start Meta OAuth';
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
 * Handle OAuth callback from Meta
 */
async function handleOAuthCallback(code: string, state_param: string) {
    try {
        state.loading = true;
        state.error = null;

        // Exchange code for tokens via backend
        const response = await $fetch('/meta-ads/callback', {
            method: 'GET',
            baseURL: useRuntimeConfig().public.BACKEND_URL,
            query: { code, state: state_param }
        }) as any;

        if (response.success) {
            state.isAuthenticated = true;
            state.accessToken = response.access_token;
            state.tokenExpiry = new Date(Date.now() + response.expires_in * 1000).toISOString();

            // Move to account selection step
            state.currentStep = 2;
            await loadAdAccounts();

            // Clean URL
            router.replace({
                path: route.path,
                query: {}
            });
        } else {
            throw new Error(response.error || 'Failed to complete OAuth');
        }
    } catch (error: any) {
        state.error = error.message || 'Failed to handle OAuth callback';
        $swal.fire({
            title: 'OAuth Error',
            text: state.error,
            icon: 'error'
        });
    } finally {
        state.loading = false;
    }
}

/**
 * Step 2: Load Meta Ad Accounts
 */
async function loadAdAccounts() {
    try {
        state.loadingAccounts = true;
        state.error = null;

        const accounts = await dataSourcesStore.listMetaAdAccounts(state.accessToken);
        state.accounts = accounts;

        if (accounts.length === 0) {
            state.error = 'No Meta ad accounts found. Please ensure you have access to at least one account in Business Manager.';
            $swal.fire({
                title: 'No Accounts Found',
                text: state.error,
                icon: 'warning',
                html: '<p>Please ensure you:</p><ul class="text-left ml-4 mt-2"><li>• Have a Business Manager account</li><li>• Have at least one ad account</li><li>• Have granted ads_read and business_management permissions</li></ul>'
            });
        }
    } catch (error: any) {
        state.error = error.message || 'Failed to load ad accounts';
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
function selectAccount(account: IMetaAdAccount) {
    state.selectedAccount = account;
    state.dataSourceName = `Meta Ads - ${account.name}`;
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
 * Calculate date range based on preset
 */
function getDateRange() {
    const today = new Date();
    const endDate = today.toISOString().split('T')[0];
    let startDate: string;

    switch (state.dateRange) {
        case 'last_7_days':
            startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            break;
        case 'last_30_days':
            startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            break;
        case 'last_90_days':
            startDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            break;
        case 'custom':
            startDate = state.customStartDate;
            return { startDate, endDate: state.customEndDate };
        default:
            startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }

    return { startDate, endDate };
}

/**
 * Final step: Connect and save data source
 */
async function connectDataSource() {
    try {
        if (!state.selectedAccount) {
            throw new Error('No account selected');
        }

        if (state.selectedReportTypes.length === 0) {
            throw new Error('Please select at least one report type');
        }

        state.connecting = true;
        state.error = null;

        const { startDate, endDate } = getDateRange();

        const syncConfig: IMetaSyncConfig = {
            name: state.dataSourceName,
            adAccountId: state.selectedAccount.id,
            accessToken: state.accessToken,
            syncTypes: state.selectedReportTypes,
            startDate: startDate,
            endDate: endDate
        };

        const success = await dataSourcesStore.addMetaAdsDataSource(syncConfig, parseInt(projectId));

        if (success) {
            $swal.fire({
                title: 'Success!',
                text: 'Meta Ads data source connected successfully',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });

            // Redirect back to data sources list
            setTimeout(() => {
                router.push(`/projects/${projectId}/data-sources`);
            }, 2000);
        } else {
            throw new Error('Failed to create data source');
        }
    } catch (error: any) {
        state.error = error.message || 'Failed to connect data source';
        $swal.fire({
            title: 'Connection Error',
            text: state.error,
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
    } else {
        router.push(`/projects/${projectId}/data-sources`);
    }
}

definePageMeta({
    layout: 'default'
});
</script>

<template>
    <div class="container mx-auto p-6">
        <!-- Header -->
        <div class="mb-8">
            <button @click="goBack" class="text-indigo-600 hover:text-indigo-800 mb-4 flex items-center">
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
                Back
            </button>

            <h1 class="text-3xl font-bold text-gray-900">Connect Meta (Facebook) Ads</h1>
            <p class="text-gray-600 mt-2">Connect your Meta Ads account to sync campaigns, ads, and performance data</p>
        </div>

        <!-- Progress Steps -->
        <div class="mb-8">
            <div class="flex items-center justify-center space-x-4">
                <div v-for="step in 3" :key="step" class="flex items-center">
                    <div :class="{
                        'bg-indigo-600 text-white': state.currentStep >= step,
                        'bg-gray-300 text-gray-600': state.currentStep < step
                    }" class="w-10 h-10 rounded-full flex items-center justify-center font-semibold">
                        {{ step }}
                    </div>
                    <div v-if="step < 3" class="w-16 h-1" :class="{
                        'bg-indigo-600': state.currentStep > step,
                        'bg-gray-300': state.currentStep <= step
                    }"></div>
                </div>
            </div>
            <div class="flex justify-center mt-4 space-x-28">
                <span class="text-sm font-medium">Authenticate</span>
                <span class="text-sm font-medium">Select Account</span>
                <span class="text-sm font-medium">Configure</span>
            </div>
        </div>

        <!-- Error Alert -->
        <div v-if="state.error" class="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
            <div class="flex">
                <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                    </svg>
                </div>
                <div class="ml-3">
                    <p class="text-sm text-red-700">{{ state.error }}</p>
                </div>
            </div>
        </div>

        <!-- Step 1: Authentication -->
        <tab-content-panel v-if="state.currentStep === 1" class="bg-white rounded-lg shadow-sm p-8">
            <div class="text-center max-w-2xl mx-auto">
                <div class="mb-6">
                    <svg class="mx-auto h-16 w-16 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>

                <h2 class="text-2xl font-bold text-gray-900 mb-4">Connect to Meta</h2>
                <p class="text-gray-600 mb-8">
                    Sign in with your Meta (Facebook) account to access your ad accounts.<br />
                    We'll request permissions to read your ads and performance data.
                </p>

                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8 text-left">
                    <h3 class="font-semibold text-blue-900 mb-2">Required Permissions:</h3>
                    <ul class="text-sm text-blue-800 space-y-1">
                        <li>• <strong>ads_read:</strong> Read access to your ads, campaigns, and performance data</li>
                        <li>• <strong>business_management:</strong> Access to ad accounts in Business Manager</li>
                    </ul>
                </div>

                <button @click="initiateMetaOAuth" :disabled="state.loading" class="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                    <span v-if="state.loading">
                        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Connecting...
                    </span>
                    <span v-else>
                        Connect with Meta
                    </span>
                </button>
            </div>
        </tab-content-panel>

        <!-- Step 2: Account Selection -->
        <tab-content-panel v-if="state.currentStep === 2" class="bg-white rounded-lg shadow-sm p-8">
            <h2 class="text-2xl font-bold text-gray-900 mb-6">Select Ad Account</h2>

            <div v-if="state.loadingAccounts" class="text-center py-12">
                <svg class="animate-spin h-12 w-12 mx-auto text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p class="text-gray-600 mt-4">Loading ad accounts...</p>
            </div>

            <div v-else-if="state.accounts.length > 0" class="space-y-4">
                <div v-for="account in state.accounts" :key="account.id" @click="selectAccount(account)" class="border border-gray-300 rounded-lg p-6 hover:border-indigo-500 hover:shadow-md cursor-pointer transition-all">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="text-lg font-semibold text-gray-900">{{ account.name }}</h3>
                            <p class="text-sm text-gray-500 mt-1">ID: {{ account.account_id }}</p>
                            <div class="flex items-center mt-2 space-x-4">
                                <span :class="{
                                    'text-green-600': account.account_status === 1,
                                    'text-red-600': account.account_status !== 1
                                }" class="text-sm font-medium">
                                    {{ account.account_status === 1 ? 'Active' : 'Inactive' }}
                                </span>
                                <span class="text-sm text-gray-600">{{ account.currency }}</span>
                            </div>
                        </div>
                        <svg class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                </div>
            </div>

            <div v-else class="text-center py-12 text-gray-500">
                <p>No ad accounts found</p>
            </div>
        </tab-content-panel>

        <!-- Step 3: Configuration -->
        <tab-content-panel v-if="state.currentStep === 3" class="bg-white rounded-lg shadow-sm p-8">
            <h2 class="text-2xl font-bold text-gray-900 mb-6">Configure Data Source</h2>

            <div class="space-y-6">
                <!-- Data Source Name -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Data Source Name</label>
                    <input v-model="state.dataSourceName" type="text" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g. Meta Ads - My Account" />
                </div>

                <!-- Report Types -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Data to Sync</label>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div v-for="reportType in reportTypeOptions" :key="reportType.id" @click="toggleReportType(reportType.id)" :class="{
                            'border-indigo-500 bg-indigo-50': state.selectedReportTypes.includes(reportType.id),
                            'border-gray-300': !state.selectedReportTypes.includes(reportType.id)
                        }" class="border-2 rounded-lg p-4 cursor-pointer hover:shadow-md transition-all">
                            <div class="flex items-start">
                                <input type="checkbox" :checked="state.selectedReportTypes.includes(reportType.id)" class="mt-1 mr-3" />
                                <div>
                                    <h4 class="font-semibold text-gray-900">{{ reportType.name }}</h4>
                                    <p class="text-sm text-gray-600 mt-1">{{ reportType.description }}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Date Range -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                    <select v-model="state.dateRange" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500">
                        <option value="last_7_days">Last 7 Days</option>
                        <option value="last_30_days">Last 30 Days</option>
                        <option value="last_90_days">Last 90 Days</option>
                        <option value="custom">Custom Range</option>
                    </select>
                </div>

                <!-- Custom Date Range -->
                <div v-if="state.dateRange === 'custom'" class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                        <input v-model="state.customStartDate" type="date" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                        <input v-model="state.customEndDate" type="date" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                </div>

                <!-- Connect Button -->
                <div class="pt-6 border-t border-gray-200">
                    <button @click="connectDataSource" :disabled="state.connecting || !state.dataSourceName || state.selectedReportTypes.length === 0" class="w-full px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">
                        <span v-if="state.connecting">
                            <svg class="animate-spin inline-block -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Connecting...
                        </span>
                        <span v-else>
                            Connect Data Source
                        </span>
                    </button>
                </div>
            </div>
        </tab-content-panel>
    </div>
</template>
