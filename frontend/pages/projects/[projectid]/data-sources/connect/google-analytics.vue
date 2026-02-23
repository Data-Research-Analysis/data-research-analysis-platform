<script setup lang="ts">
import { useGoogleOAuth } from '@/composables/useGoogleOAuth';
import { useGoogleAnalytics } from '@/composables/useGoogleAnalytics';
import type { IGoogleAnalyticsProperty } from '~/types/IGoogleAnalytics';

const route = useRoute();
const router = useRouter();
const { $swal } = useNuxtApp() as any;

const oauth = useGoogleOAuth();
const analytics = useGoogleAnalytics();

const projectId = route.params.projectid as string;

const state = reactive({
    // Step tracking
    currentStep: 1,
    
    // OAuth state
    isAuthenticated: false,
    accessToken: '',
    refreshToken: '',
    tokenExpiry: '',
    
    // Property selection
    properties: [] as IGoogleAnalyticsProperty[],
    selectedProperty: null as IGoogleAnalyticsProperty | null,
    loadingProperties: false,
    
    // Configuration
    dataSourceName: '',
    syncFrequency: 'weekly' as 'hourly' | 'daily' | 'weekly' | 'manual',
    
    // UI state
    loading: false,
    error: null as string | null,
    showAlert: false,
    connecting: false,
    navigating: false
});

// Check if coming from OAuth callback
onMounted(async () => {
    const stepParam = route.query.step as string;
    
    // Check for stored OAuth session
    const tokens = await oauth.getStoredTokens();
    if (tokens) {
        state.isAuthenticated = true;
        state.accessToken = tokens.access_token;
        state.refreshToken = tokens.refresh_token || '';
        state.tokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : '';
        
        // If step 2, load properties
        if (stepParam === '2') {
            state.currentStep = 2;
            await loadProperties();
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
        await oauth.initiateAuth(projectId);
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
 * Step 2: Load Google Analytics Properties
 */
async function loadProperties() {
    try {
        state.loadingProperties = true;
        state.error = null;
        
        const properties = await analytics.listProperties(state.accessToken);
        state.properties = properties;
        
        if (properties.length === 0) {
            state.error = 'No Google Analytics properties found. Please create a GA4 property first.';
        }
    } catch (error: any) {
        state.error = error.message || 'Failed to load properties';
        $swal.fire({
            title: 'Error Loading Properties',
            text: state.error,
            icon: 'error'
        });
    } finally {
        state.loadingProperties = false;
    }
}

/**
 * Select a property and move to configuration
 */
function selectProperty(property: IGoogleAnalyticsProperty) {
    state.selectedProperty = property;
    state.dataSourceName = property.displayName || 'Google Analytics';
    state.currentStep = 3;
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
 * Validate configuration before connecting
 */
function validateConfiguration(): boolean {
    if (!state.dataSourceName.trim()) {
        state.error = 'Please enter a data source name';
        return false;
    }
    
    if (state.dataSourceName.length < 3) {
        state.error = 'Data source name must be at least 3 characters';
        return false;
    }
    
    return true;
}

/**
 * Final step: Connect and sync
 */
async function connectAndSync() {
    if (!validateConfiguration()) {
        $swal.fire({
            title: 'Validation Error',
            text: state.error,
            icon: 'warning'
        });
        return;
    }
    
    try {
        state.connecting = true;
        state.error = null;
        
        const config = {
            name: state.dataSourceName,
            property_id: state.selectedProperty!.name,
            access_token: state.accessToken,
            refresh_token: state.refreshToken,
            token_expiry: state.tokenExpiry,
            project_id: parseInt(projectId),
            sync_frequency: state.syncFrequency,
            account_name: state.selectedProperty!.displayName
        };
        
        const dataSourceId = await analytics.addDataSource(config);
        
        if (dataSourceId !== null) {
            // Clear stored tokens (async)
            await oauth.clearTokens();
            
            // Show syncing message
            $swal.fire({
                title: 'Syncing Data...',
                text: 'Please wait while we sync your Google Analytics data.',
                icon: 'info',
                allowOutsideClick: false,
                showConfirmButton: false,
                didOpen: () => {
                    $swal.showLoading();
                }
            });
            
            // Trigger initial sync
            const syncSuccess = await analytics.syncNow(dataSourceId);
            
            if (syncSuccess) {
                await $swal.fire({
                    title: 'Connected Successfully!',
                    text: 'Your Google Analytics data has been synced and is ready to use.',
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
            router.push(`/projects/${projectId}`);
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
            <h1 class="text-4xl font-bold text-gray-900 mb-2">Connect Google Analytics</h1>
            <p class="text-base text-gray-600">Import your website analytics data into the platform</p>
        </div>

        <!-- Step Indicator -->
        <div class="flex items-center justify-center mb-12 sm:mb-8">
            <div 
                class="flex flex-col items-center gap-2" 
                :class="{ 'text-indigo-600': state.currentStep >= 1 }"
            >
                <div class="w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300" :class="state.currentStep > 1 ? 'bg-green-500 text-white' : state.currentStep >= 1 ? 'bg-primary-blue-100 text-white' : 'bg-gray-300 text-gray-600'">1</div>
                <div class="text-sm font-medium sm:text-xs" :class="state.currentStep >= 1 ? 'text-indigo-600' : 'text-gray-600'">Authenticate</div>
            </div>
            <div class="w-20 h-0.5 mx-4 transition-all duration-300 sm:w-10" :class="state.currentStep > 1 ? 'bg-green-500' : 'bg-gray-300'"></div>
            <div 
                class="flex flex-col items-center gap-2" 
                :class="{ 'text-indigo-600': state.currentStep >= 2 }"
            >
                <div class="w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300" :class="state.currentStep > 2 ? 'bg-green-500 text-white' : state.currentStep >= 2 ? 'bg-primary-blue-100 text-white' : 'bg-gray-300 text-gray-600'">2</div>
                <div class="text-sm font-medium sm:text-xs" :class="state.currentStep >= 2 ? 'text-indigo-600' : 'text-gray-600'">Select Property</div>
            </div>
            <div class="w-20 h-0.5 mx-4 transition-all duration-300 sm:w-10" :class="state.currentStep > 2 ? 'bg-green-500' : 'bg-gray-300'"></div>
            <div 
                class="flex flex-col items-center gap-2" 
                :class="{ 'text-indigo-600': state.currentStep >= 3 }"
            >
                <div class="w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300" :class="state.currentStep >= 3 ? 'bg-primary-blue-100 text-white' : 'bg-gray-300 text-gray-600'">3</div>
                <div class="text-sm font-medium sm:text-xs" :class="state.currentStep >= 3 ? 'text-indigo-600' : 'text-gray-600'">Configure</div>
            </div>
        </div>

        <!-- Step 1: Authentication -->
        <div v-if="state.currentStep === 1" class="animate-fade-in">
            <div class="bg-white rounded-xl p-8 shadow-sm border border-indigo-200 sm:p-6">
                <h2 class="text-2xl font-semibold text-gray-900 mb-6">Step 1: Authenticate with Google</h2>
                
                <div class="mb-8">
                    <p class="text-base text-gray-700 mb-4">Connect your Google account to access Analytics data:</p>
                    <ul class="list-none p-0">
                        <li class="py-2 text-gray-800">✓ Secure OAuth 2.0 authentication</li>
                        <li class="py-2 text-gray-800">✓ Read-only access to your data</li>
                        <li class="py-2 text-gray-800">✓ No passwords stored</li>
                        <li class="py-2 text-gray-800">✓ Revoke access anytime</li>
                    </ul>
                </div>

                <button 
                    @click="initiateGoogleSignIn" 
                    class="flex items-center justify-center gap-3 w-full max-w-[300px] mx-auto mb-6 px-6 py-4 bg-white border-2 border-gray-300 rounded-lg text-base font-semibold text-gray-700 cursor-pointer transition-all duration-200 hover:border-gray-400 hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
                    :disabled="state.loading"
                >
                    <font-awesome-icon :icon="['fab', 'google']" class="w-6 h-6 text-[#4285F4]" />
                    <span v-if="!state.loading">Sign in with Google</span>
                    <span v-else>Redirecting...</span>
                </button>

            </div>
        </div>

        <!-- Step 2: Property Selection -->
        <div v-if="state.currentStep === 2" class="animate-fade-in">
            <div class="bg-white rounded-xl p-8 shadow-sm border border-indigo-200 sm:p-6">
                <h2 class="text-2xl font-semibold text-gray-900 mb-6">Step 2: Select Analytics Property</h2>

                <div v-if="state.loadingProperties" class="text-center py-12 px-6">
                    <div class="w-12 h-12 border-4 border-gray-300 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p>Loading your Google Analytics properties...</p>
                </div>

                <div v-else-if="state.properties.length === 0" class="text-center py-12 px-6">
                    <p class="text-gray-600">{{ state.error || 'No properties found' }}</p>
                    <a href="https://analytics.google.com" target="_blank" class="inline-block px-6 py-3 text-base font-medium border-0 cursor-pointer transition-all duration-200 bg-primary-blue-100 text-white hover:bg-primary-blue-300 hover:-translate-y-0.5 hover:shadow-lg mt-4">
                        Create GA4 Property
                    </a>
                </div>

                <div v-else class="flex flex-col gap-3 mb-6">
                    <div 
                        v-for="property in state.properties" 
                        :key="property.name"
                        class="flex items-center gap-4 p-5 border-2 rounded-lg cursor-pointer transition-all duration-200"
                        :class="state.selectedProperty?.name === property.name ? 'border-primary-blue-100 bg-blue-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'"
                        @click="selectProperty(property)"
                    >
                        <div class="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                            <font-awesome-icon :icon="['fas', 'chart-line']" class="w-6 h-6 text-indigo-600" />
                        </div>
                        <div class="flex-1">
                            <h3 class="text-base font-semibold text-gray-900 m-0 mb-1">{{ property.displayName }}</h3>
                            <p class="text-sm text-gray-600 m-0">{{ property.name }}</p>
                        </div>
                        <div class="">
                            <font-awesome-icon v-if="state.selectedProperty?.name === property.name" :icon="['fas', 'check']" class="w-6 h-6 text-indigo-600" />
                        </div>
                    </div>
                </div>

                <div class="flex gap-3 justify-end mt-8 sm:flex-col">
                    <button @click="goBack" class="px-6 py-3 text-base font-medium border-0 cursor-pointer transition-all duration-200 bg-gray-300 text-gray-700 hover:bg-gray-400 sm:w-full">
                        ← Back
                    </button>
                </div>
            </div>
        </div>

        <!-- Step 3: Configuration -->
        <div v-if="state.currentStep === 3" class="animate-fade-in">
            <div class="bg-white rounded-xl p-8 shadow-sm border border-indigo-200 sm:p-6">
                <h2 class="text-2xl font-semibold text-gray-900 mb-6">Step 3: Configure Data Sync</h2>

                <div class="mb-6">
                    <label for="datasource-name" class="block text-sm font-semibold text-gray-800 mb-2">Data Source Name *</label>
                    <input 
                        id="datasource-name"
                        v-model="state.dataSourceName" 
                        type="text"
                        class="w-full px-4 py-3 text-base border-2 rounded-lg transition-all duration-200 focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                        :class="state.error && !state.dataSourceName ? 'border-red-500' : 'border-gray-300'"
                        placeholder="e.g., My Website Analytics"
                    />
                    <small class="block mt-1 text-xs text-gray-600">This name will appear in your data sources list</small>
                </div>

                <div class="mb-6">
                    <label class="block text-sm font-semibold text-gray-800 mb-2">Sync Frequency</label>
                    <div class="flex flex-col gap-3">
                        <label class="flex items-center gap-2 p-3 border-2 border-gray-300 rounded-lg cursor-pointer transition-all duration-200 hover:border-gray-400 hover:bg-gray-50">
                            <input type="radio" v-model="state.syncFrequency" value="manual" class="cursor-pointer" />
                            <span>Manual (sync on demand)</span>
                        </label>
                        <label class="flex items-center gap-2 p-3 border-2 border-gray-300 rounded-lg cursor-pointer transition-all duration-200 hover:border-gray-400 hover:bg-gray-50">
                            <input type="radio" v-model="state.syncFrequency" value="daily" class="cursor-pointer" />
                            <span>Daily (every night at 2 AM)</span>
                        </label>
                        <label class="flex items-center gap-2 p-3 border-2 border-gray-300 rounded-lg cursor-pointer transition-all duration-200 hover:border-gray-400 hover:bg-gray-50">
                            <input type="radio" v-model="state.syncFrequency" value="weekly" class="cursor-pointer" />
                            <span>Weekly (every Sunday at 2 AM)</span>
                        </label>
                        <label class="flex items-center gap-2 p-3 border-2 border-gray-300 rounded-lg cursor-pointer transition-all duration-200 hover:border-gray-400 hover:bg-gray-50">
                            <input type="radio" v-model="state.syncFrequency" value="hourly" class="cursor-pointer" />
                            <span>Hourly</span>
                        </label>
                    </div>
                </div>

                <div class="p-5 bg-indigo-50 rounded-lg mb-6">
                    <h4 class="text-base font-semibold text-gray-900 mb-4">📊 Data Reports Included</h4>
                    <div class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2">
                        <div class="text-sm text-gray-800">✓ Traffic Overview</div>
                        <div class="text-sm text-gray-800">✓ Page Performance</div>
                        <div class="text-sm text-gray-800">✓ User Acquisition</div>
                        <div class="text-sm text-gray-800">✓ Geographic Data</div>
                        <div class="text-sm text-gray-800">✓ Device & Technology</div>
                        <div class="text-sm text-gray-800">✓ Events</div>
                    </div>
                </div>

                <div class="p-5 bg-gray-50 rounded-lg mb-6">
                    <h4 class="text-sm font-semibold text-gray-600 mb-3">Selected Property</h4>
                    <div>
                        <p><strong>{{ state.selectedProperty?.displayName }}</strong></p>
                        <p class="text-gray-600 text-sm">{{ state.selectedProperty?.name }}</p>
                    </div>
                </div>

                <div class="flex gap-3 justify-end mt-8 sm:flex-col">
                    <button @click="goBack" class="px-6 py-3 text-base font-medium border-0 cursor-pointer transition-all duration-200 bg-gray-300 text-gray-700 hover:bg-gray-400 disabled:opacity-60 disabled:cursor-not-allowed sm:w-full rounded-lg" :disabled="state.connecting">
                        ← Back
                    </button>
                    <button @click="connectAndSync" class="px-6 py-3 text-base font-medium border-0 cursor-pointer transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed bg-primary-blue-100 text-white hover:bg-primary-blue-300 hover:-translate-y-0.5 hover:shadow-lg sm:w-full rounded-lg" :disabled="state.connecting">
                        <span v-if="!state.connecting">Connect & Sync →</span>
                        <span v-else>Connecting...</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
