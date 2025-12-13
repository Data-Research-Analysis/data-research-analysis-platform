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
            router.push(`/projects/${projectId}/data-sources`);
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
            
            // Redirect to property selection
            const projectId = getProjectIdFromState(stateOAuth);
            setTimeout(() => {
                router.push(`/projects/${projectId}/data-sources/connect/google-analytics?step=2`);
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
</script>

<template>
    <div class="oauth-callback-container">
        <div class="oauth-callback-card">
            <!-- Loading State -->
            <div v-if="state.loading" class="callback-state loading">
                <div class="spinner"></div>
                <h2>Completing Authentication...</h2>
                <p>Please wait while we verify your Google account</p>
            </div>

            <!-- Success State -->
            <div v-else-if="state.success" class="callback-state success">
                <div class="success-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
                <h2>Authentication Successful!</h2>
                <p>Redirecting to property selection...</p>
            </div>

            <!-- Error State -->
            <div v-else-if="state.error" class="callback-state error">
                <div class="error-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                </div>
                <h2>Authentication Failed</h2>
                <p>{{ state.error }}</p>
                <button @click="router.back()" class="btn btn-primary">
                    Go Back
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.oauth-callback-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 20px;
}

.oauth-callback-card {
    background: white;
    border-radius: 12px;
    padding: 48px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    max-width: 500px;
    width: 100%;
    text-align: center;
}

.callback-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
}

.callback-state h2 {
    font-size: 24px;
    font-weight: 600;
    color: #1a202c;
    margin: 0;
}

.callback-state p {
    font-size: 16px;
    color: #718096;
    margin: 0;
}

/* Loading Spinner */
.spinner {
    width: 60px;
    height: 60px;
    border: 4px solid #e2e8f0;
    border-top-color: #667eea;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* Success Icon */
.success-icon {
    width: 80px;
    height: 80px;
    background: #48bb78;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: scaleIn 0.5s ease-out;
}

.success-icon svg {
    width: 40px;
    height: 40px;
    color: white;
    stroke-width: 3;
}

@keyframes scaleIn {
    from {
        transform: scale(0);
        opacity: 0;
    }
    to {
        transform: scale(1);
        opacity: 1;
    }
}

/* Error Icon */
.error-icon {
    width: 80px;
    height: 80px;
    background: #f56565;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
}

.error-icon svg {
    width: 40px;
    height: 40px;
    color: white;
}

/* Button */
.btn {
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 500;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 16px;
}

.btn-primary {
    background: #667eea;
    color: white;
}

.btn-primary:hover {
    background: #5568d3;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

/* Responsive */
@media (max-width: 640px) {
    .oauth-callback-card {
        padding: 32px 24px;
    }
    
    .callback-state h2 {
        font-size: 20px;
    }
    
    .callback-state p {
        font-size: 14px;
    }
}
</style>
