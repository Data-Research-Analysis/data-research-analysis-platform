<script setup lang="ts">
import { useDataSourceStore } from '@/stores/data_sources';
import type { IOAuthTokens } from '~/types/IOAuthTokens';

const route = useRoute();
const router = useRouter();
const dataSourceStore = useDataSourceStore();

const state = reactive({
    loading: true,
    error: "",
    success: false,
    tokens: null as IOAuthTokens | null
});

onMounted(async () => {
    // Extract OAuth callback parameters
    const code = route.query.code as string;
    const stateOAuth = route.query.state as string;
    const error = route.query.error as string;

    // Handle OAuth error (user denied permission)
    if (error) {
        state.error = 'Authentication was cancelled or failed. Please try again.';
        state.loading = false;

        // Redirect back to data sources after 3 seconds
        setTimeout(() => {
            const projectId = getProjectIdFromState(stateOAuth);
            router.push(`/projects/${projectId}`);
        }, 3000);
        return;
    }

    // Validate required parameters
    if (!code || !state) {
        state.error = 'Invalid OAuth callback. Missing required parameters.';
        state.loading = false;
        return;
    }

    try {
        // Exchange authorization code for tokens
        const response = await dataSourceStore.handleGoogleOAuthCallback(code, stateOAuth);

        if (response) {
            state.success = true;

            // Store session ID securely (tokens are stored server-side in Redis)
            if (import.meta.client && response.session_id) {
                sessionStorage.setItem('ga_oauth_session', response.session_id);
            }

            // Extract service type and project ID from state parameter
            const projectId = getProjectIdFromState(stateOAuth);
            const serviceType = getServiceTypeFromState(stateOAuth);

            // Redirect based on service type
            setTimeout(() => {
                if (serviceType === 'ad_manager') {
                    router.push(`/projects/${projectId}/data-sources/connect/google-ad-manager?step=2`);
                } else if (serviceType === 'google_ads') {
                    router.push(`/projects/${projectId}/data-sources/connect/google-ads?step=2`);
                } else {
                    // Default to analytics
                    router.push(`/projects/${projectId}/data-sources/connect/google-analytics?step=2`);
                }
            }, 1500);
        } else {
            state.error = 'Failed to exchange authorization code. Please try again.';
        }
    } catch (error: any) {
        console.error('OAuth callback error:', error);
        state.error = error.message || 'An unexpected error occurred during authentication.';
    } finally {
        state.loading = false;
    }
});

/**
 * Extract project ID from state parameter
 */
function getProjectIdFromState(stateParam: string): string {
    try {
        const decoded = JSON.parse(atob(stateParam));
        return decoded.project_id || 'unknown';
    } catch {
        // Fallback: try to get from current route or localStorage
        const currentProject = localStorage.getItem('selectedProject');
        if (currentProject) {
            const project = JSON.parse(currentProject);
            return project.id;
        }
        return 'unknown';
    }
}

/**
 * Extract service type from state parameter
 */
function getServiceTypeFromState(stateParam: string): 'analytics' | 'ad_manager' | 'google_ads' {
    try {
        const decoded = JSON.parse(atob(stateParam));
        return decoded.service || 'analytics';
    } catch {
        // Default to analytics if state cannot be decoded
        return 'analytics';
    }
}
</script>

<template>
    <div class="min-h-screen flex items-center justify-center bg-white p-5">
        <div class="bg-white rounded-xl p-12 shadow-2xl max-w-lg w-full text-center sm:p-8">
            <!-- Loading State -->
            <div v-if="state.loading" class="flex flex-col items-center gap-5">
                <div class="w-15 h-15 border-4 border-gray-200 border-t-indigo-500 rounded-full animate-spin"></div>
                <h2 class="text-2xl font-semibold text-gray-900 m-0 sm:text-xl">Completing Authentication...</h2>
                <p class="text-base text-gray-600 m-0 sm:text-sm">Please wait while we verify your Google account</p>
            </div>

            <!-- Success State -->
            <div v-else-if="state.success" class="flex flex-col items-center gap-5">
                <div class="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
                    <font-awesome-icon :icon="['fas', 'check']" class="w-10 h-10 text-white" />
                </div>
                <h2 class="text-2xl font-semibold text-gray-900 m-0 sm:text-xl">Authentication Successful!</h2>
                <p class="text-base text-gray-600 m-0 sm:text-sm">Redirecting to property selection...</p>
            </div>

            <!-- Error State -->
            <div v-else-if="state.error" class="flex flex-col items-center gap-5">
                <div class="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center">
                    <font-awesome-icon :icon="['fas', 'circle-xmark']" class="w-10 h-10 text-white" />
                </div>
                <h2 class="text-2xl font-semibold text-gray-900 m-0 sm:text-xl">Authentication Failed</h2>
                <p class="text-base text-gray-600 m-0 sm:text-sm">{{ state.error }}</p>
                <button @click="router.back()"
                    class="px-6 py-3 text-base font-medium border-0 cursor-pointer transition-all duration-200 mt-4 bg-primary-blue-100 text-white hover:bg-primary-blue-300 hover:-translate-y-0.5 hover:shadow-lg">
                    Go Back
                </button>
            </div>
        </div>
    </div>
</template>
