<script setup lang="ts">
import { useDataSourceStore } from '@/stores/data_sources';
import type { ILinkedInAdAccount, ILinkedInOAuthSyncConfig } from '~/types/ILinkedInAds';

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
    refreshToken: '',
    expiresAt: 0,

    // Account selection
    accounts: [] as ILinkedInAdAccount[],
    selectedAccount: null as ILinkedInAdAccount | null,
    loadingAccounts: false,

    // Configuration
    dataSourceName: '',
    dateRange: 'last_30_days' as string,
    customStartDate: '',
    customEndDate: '',

    // UI state
    loading: false,
    error: null as string | null,
    connecting: false,
    hasTestAccounts: false,
});

// Check for OAuth token stored by /connect/linkedin-ads landing page
onMounted(async () => {
    if (import.meta.client) {
        const storedToken = localStorage.getItem('linkedin_ads_oauth_token');
        if (storedToken) {
            try {
                const tokenData = JSON.parse(storedToken);
                localStorage.removeItem('linkedin_ads_oauth_token');
                state.isAuthenticated = true;
                state.accessToken = tokenData.access_token;
                state.refreshToken = tokenData.refresh_token || '';
                state.expiresAt = tokenData.expires_at || 0;
                state.currentStep = 2;
                await loadAdAccounts();
            } catch (e) {
                localStorage.removeItem('linkedin_ads_oauth_token');
            }
        }
    }
});

/**
 * Step 1: Initiate LinkedIn OAuth
 */
async function initiateLinkedInOAuth() {
    try {
        state.loading = true;
        state.error = null;

        await dataSourcesStore.initiateLinkedInOAuth(projectId);
        // Execution stops here — the browser navigates to LinkedIn's OAuth page.
    } catch (error: any) {
        state.error = error.message || 'Failed to start LinkedIn OAuth';
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
 * Step 2: Load LinkedIn Ad Accounts
 */
async function loadAdAccounts() {
    try {
        state.loadingAccounts = true;
        state.error = null;

        const result = await dataSourcesStore.listLinkedInAdAccounts(state.accessToken);
        state.accounts = result.accounts || [];
        state.hasTestAccounts = result.hasTestAccounts;

        if (result.accounts.length === 0) {
            state.error = 'No LinkedIn ad accounts found. Please ensure you have access to at least one account.';
            $swal.fire({
                title: 'No Accounts Found',
                icon: 'warning',
                html: '<p>Please ensure you:</p><ul class="text-left ml-4 mt-2"><li>• Have a LinkedIn Campaign Manager account</li><li>• Have at least one ad account with active campaigns</li><li>• Have granted the required <code>r_ads</code> and <code>r_ads_reporting</code> permissions</li></ul>'
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
function selectAccount(account: ILinkedInAdAccount) {
    state.selectedAccount = account;
    state.dataSourceName = `LinkedIn Ads - ${account.name}`;
    state.currentStep = 3;
}

/**
 * Calculate the ISO date range based on the preset selector
 */
function getDateRange(): { startDate: string; endDate: string } {
    const today = new Date();
    const endDate = today.toISOString().split('T')[0];

    if (state.dateRange === 'custom') {
        return { startDate: state.customStartDate, endDate: state.customEndDate };
    }

    const daysMap: Record<string, number> = {
        last_7_days: 7,
        last_30_days: 30,
        last_90_days: 90,
    };

    const days = daysMap[state.dateRange] ?? 30;
    const startDate = new Date(today.getTime() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

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

        state.connecting = true;
        state.error = null;

        const { startDate, endDate } = getDateRange();

        const syncConfig: ILinkedInOAuthSyncConfig = {
            name: state.dataSourceName,
            accessToken: state.accessToken,
            refreshToken: state.refreshToken,
            expiresAt: state.expiresAt,
            adAccountId: state.selectedAccount.id,
            adAccountName: state.selectedAccount.name,
            startDate,
            endDate,
        };

        const dataSourceId = await dataSourcesStore.addLinkedInAdsDataSource(syncConfig, parseInt(projectId));

        if (dataSourceId) {
            $swal.fire({
                title: 'Success!',
                text: 'LinkedIn Ads data source connected. Initial sync is running in the background.',
                icon: 'success',
                timer: 2500,
                showConfirmButton: false
            });

            setTimeout(() => {
                router.push(`/projects/${projectId}/data-sources/${dataSourceId}`);
            }, 2500);
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
 * Navigate back one step (or to the data sources list on step 1)
 */
function goBack() {
    if (state.currentStep > 1) {
        state.currentStep--;
    } else {
        router.push(`/projects/${projectId}/data-sources`);
    }
}

// Human-readable currency/status helpers
function formatAccountStatus(status: string): string {
    const map: Record<string, string> = {
        ACTIVE: 'Active',
        CANCELED: 'Canceled',
        DRAFT: 'Draft',
        PENDING_DELETION: 'Pending Deletion',
        REMOVED: 'Removed',
    };
    return map[status] ?? status;
}

definePageMeta({
    layout: 'marketing-project'
});
</script>

<template>
    <div class="max-w-[900px] mx-auto py-10 px-5 sm:py-6 sm:px-4">
        <button @click="goBack" class="text-indigo-600 hover:text-indigo-800 mb-4 flex items-center cursor-pointer">
            <font-awesome-icon :icon="['fas', 'chevron-left']" class="w-5 h-5 mr-2" />
            Back
        </button>

        <div class="text-center mb-10">
            <h1 class="text-4xl font-bold text-gray-900 mb-2">Connect LinkedIn Ads</h1>
            <p class="text-base text-gray-600">Connect your LinkedIn Campaign Manager account to sync campaigns, creatives, and performance data</p>
        </div>

        <!-- Progress Steps -->
        <!-- Step Indicator -->
        <div class="flex items-center justify-center mb-12 sm:mb-8">
            <div class="flex flex-col items-center gap-2" :class="{ 'text-indigo-600': state.currentStep >= 1 }">
                <div class="w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300" :class="state.currentStep > 1 ? 'bg-green-500 text-white' : state.currentStep >= 1 ? 'bg-primary-blue-100 text-white' : 'bg-gray-300 text-gray-600'">1</div>
                <div class="text-sm font-medium sm:text-xs" :class="state.currentStep >= 1 ? 'text-indigo-600' : 'text-gray-600'">Authenticate</div>
            </div>
            <div class="w-20 h-0.5 mx-4 transition-all duration-300 sm:w-10" :class="state.currentStep > 1 ? 'bg-green-500' : 'bg-gray-300'"></div>
            <div class="flex flex-col items-center gap-2" :class="{ 'text-indigo-600': state.currentStep >= 2 }">
                <div class="w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300" :class="state.currentStep > 2 ? 'bg-green-500 text-white' : state.currentStep >= 2 ? 'bg-primary-blue-100 text-white' : 'bg-gray-300 text-gray-600'">2</div>
                <div class="text-sm font-medium sm:text-xs" :class="state.currentStep >= 2 ? 'text-indigo-600' : 'text-gray-600'">Select Account</div>
            </div>
            <div class="w-20 h-0.5 mx-4 transition-all duration-300 sm:w-10" :class="state.currentStep > 2 ? 'bg-green-500' : 'bg-gray-300'"></div>
            <div class="flex flex-col items-center gap-2" :class="{ 'text-indigo-600': state.currentStep >= 3 }">
                <div class="w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300" :class="state.currentStep >= 3 ? 'bg-primary-blue-100 text-white' : 'bg-gray-300 text-gray-600'">3</div>
                <div class="text-sm font-medium sm:text-xs" :class="state.currentStep >= 3 ? 'text-indigo-600' : 'text-gray-600'">Configure</div>
            </div>
        </div>

        <!-- Error Alert -->
        <div v-if="state.error" class="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
            <div class="flex">
                <div class="flex-shrink-0">
                    <font-awesome-icon :icon="['fas', 'circle-xmark']" class="h-5 w-5 text-red-400" />
                </div>
                <div class="ml-3">
                    <p class="text-sm text-red-700">{{ state.error }}</p>
                </div>
            </div>
        </div>

        <!-- ─── Step 1: Authenticate ──────────────────────────────────────────── -->
        <div v-if="state.currentStep === 1" class="bg-white rounded-lg shadow-sm border border-indigo-200 p-8">
            <div class="text-center max-w-2xl mx-auto">
                <div class="mb-6">
                    <font-awesome-icon :icon="['fas', 'lock']" class="mx-auto h-16 w-16 text-indigo-600" />
                </div>

                <h2 class="text-2xl font-bold text-gray-900 mb-4">Connect to LinkedIn</h2>
                <p class="text-gray-600 mb-8">
                    Sign in with your LinkedIn account to access your Campaign Manager data.<br />
                    We request read-only permissions to your ads and reporting data.
                </p>

                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8 text-left">
                    <h3 class="font-semibold text-blue-900 mb-2">Required Permissions:</h3>
                    <ul class="text-sm text-blue-800 space-y-1">
                        <li>• <strong>r_ads:</strong> Read access to your ad campaigns, campaign groups, and creatives</li>
                        <li>• <strong>r_ads_reporting:</strong> Read access to performance metrics and analytics data</li>
                    </ul>
                </div>

                <button @click="initiateLinkedInOAuth" :disabled="state.loading"
                    class="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-[#0077B5] hover:bg-[#005f91] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    <span v-if="state.loading">
                        <font-awesome-icon icon="spinner" class="animate-spin h-5 w-5 text-white" />
                        Connecting...
                    </span>
                    <span v-else class="flex items-center gap-2">
                        <span class="font-bold text-sm leading-none bg-white text-[#0077B5] rounded px-1">in</span>
                        Connect with LinkedIn
                    </span>
                </button>
            </div>
        </div>

        <!-- ─── Step 2: Select Ad Account ─────────────────────────────────────── -->
        <div v-if="state.currentStep === 2" class="bg-white rounded-lg shadow-sm border border-indigo-200 p-8">
            <h2 class="text-2xl font-bold text-gray-900 mb-6">Select Ad Account</h2>

            <div v-if="state.loadingAccounts" class="text-center py-12">
                <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin h-12 w-12 mx-auto text-indigo-600" />
                <p class="text-gray-600 mt-4">Loading ad accounts...</p>
            </div>

            <div v-else-if="state.accounts?.length > 0" class="space-y-4">
                <!-- Development Tier notice when only test accounts are available -->
                <div v-if="state.hasTestAccounts" class="bg-amber-50 border border-amber-300 rounded-lg p-4 text-sm text-amber-800">
                    <strong>Development Tier:</strong> Your LinkedIn Advertising API access is currently in sandbox mode. Only test accounts are available until LinkedIn approves production access. You can complete the setup with a test account now.
                </div>

                <div v-for="account in state.accounts" :key="account.id"
                    @click="selectAccount(account)"
                    class="border border-gray-300 rounded-lg p-6 hover:border-indigo-500 hover:shadow-md cursor-pointer transition-all">
                    <div class="flex items-center justify-between">
                        <div>
                            <div class="flex items-center gap-2">
                                <h3 class="text-lg font-semibold text-gray-900">{{ account.name }}</h3>
                                <span v-if="account.test" class="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Test Account</span>
                            </div>
                            <p class="text-sm text-gray-500 mt-1">Account ID: {{ account.id }}</p>
                            <div class="flex items-center mt-2 space-x-4">
                                <span :class="{
                                    'text-green-600': account.status === 'ACTIVE',
                                    'text-red-600': account.status !== 'ACTIVE'
                                }" class="text-sm font-medium">
                                    {{ formatAccountStatus(account.status) }}
                                </span>
                                <span class="text-sm text-gray-600">{{ account.currency }}</span>
                                <span class="text-sm text-gray-500 capitalize">{{ account.type?.toLowerCase().replace('_', ' ') }}</span>
                            </div>
                        </div>
                        <font-awesome-icon :icon="['fas', 'chevron-right']" class="w-6 h-6 text-indigo-600" />
                    </div>
                </div>
            </div>

            <div v-else class="text-center py-12 text-gray-500">
                <p>No ad accounts found</p>
            </div>
        </div>

        <!-- ─── Step 3: Configure ──────────────────────────────────────────────── -->
        <div v-if="state.currentStep === 3" class="bg-white rounded-lg shadow-sm border border-indigo-200 p-8">
            <h2 class="text-2xl font-bold text-gray-900 mb-6">Configure Data Source</h2>

            <div class="space-y-6">
                <!-- Data Source Name -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Data Source Name</label>
                    <input v-model="state.dataSourceName" type="text"
                        class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="e.g. LinkedIn Ads - My Company" />
                </div>

                <!-- Selected Account Summary -->
                <div v-if="state.selectedAccount" class="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h4 class="font-semibold text-gray-800 mb-1">Selected Account</h4>
                    <p class="text-sm text-gray-600">{{ state.selectedAccount.name }}</p>
                    <p class="text-xs text-gray-500 mt-1">ID: {{ state.selectedAccount.id }} · {{ state.selectedAccount.currency }}</p>
                </div>

                <!-- What gets synced -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Data to Sync</label>
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-1">
                        <p class="font-medium text-blue-900 mb-1">All of the following will be synced:</p>
                        <li>Ad Accounts — account details, currency, and status</li>
                        <li>Campaign Groups — objective groups with budgets</li>
                        <li>Campaigns — campaign structure and targeting info</li>
                        <li>Creatives — ad creative types and references</li>
                        <li>Campaign Analytics — daily performance metrics (impressions, clicks, spend, conversions)</li>
                        <li>Account Analytics — account-level aggregated performance</li>
                    </div>
                </div>

                <!-- Date Range -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Historical Data Range</label>
                    <select v-model="state.dateRange"
                        class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500">
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
                        <input v-model="state.customStartDate" type="date"
                            class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                        <input v-model="state.customEndDate" type="date"
                            class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                </div>

                <!-- Connect Button -->
                <div class="pt-6 border-t border-gray-200">
                    <button @click="connectDataSource"
                        :disabled="state.connecting || !state.dataSourceName"
                        class="w-full px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">
                        <span v-if="state.connecting" class="flex flex-row items-center justify-center gap-2">
                            <font-awesome-icon icon="spinner" class="animate-spin h-5 w-5 text-white" />
                            Connecting...
                        </span>
                        <span v-else>Connect Data Source</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
