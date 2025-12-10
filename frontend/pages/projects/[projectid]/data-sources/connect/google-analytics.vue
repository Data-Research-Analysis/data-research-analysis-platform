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
    connecting: false
});

// Check if coming from OAuth callback
onMounted(async () => {
    const stepParam = route.query.step as string;
    
    // Check for stored OAuth tokens
    const tokens = oauth.getStoredTokens();
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
        
        const success = await analytics.addDataSource(config);
        
        if (success) {
            // Clear stored tokens
            oauth.clearTokens();
            
            // Show success message
            await $swal.fire({
                title: 'Connected Successfully!',
                text: 'Your Google Analytics data source has been added and initial sync is starting.',
                icon: 'success',
                timer: 2000
            });
            
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

/**
 * Cancel and go back
 */
function cancel() {
    router.push(`/projects/${projectId}/data-sources`);
}
</script>

<template>
    <div class="google-analytics-connector">
        <div class="connector-header">
            <h1>Connect Google Analytics</h1>
            <p>Import your website analytics data into the platform</p>
        </div>

        <!-- Step Indicator -->
        <div class="step-indicator">
            <div 
                class="step" 
                :class="{ active: state.currentStep === 1, completed: state.currentStep > 1 }"
            >
                <div class="step-number">1</div>
                <div class="step-label">Authenticate</div>
            </div>
            <div class="step-line" :class="{ active: state.currentStep > 1 }"></div>
            <div 
                class="step" 
                :class="{ active: state.currentStep === 2, completed: state.currentStep > 2 }"
            >
                <div class="step-number">2</div>
                <div class="step-label">Select Property</div>
            </div>
            <div class="step-line" :class="{ active: state.currentStep > 2 }"></div>
            <div 
                class="step" 
                :class="{ active: state.currentStep === 3 }"
            >
                <div class="step-number">3</div>
                <div class="step-label">Configure</div>
            </div>
        </div>

        <!-- Step 1: Authentication -->
        <div v-if="state.currentStep === 1" class="step-content">
            <div class="step-card">
                <h2>Step 1: Authenticate with Google</h2>
                
                <div class="auth-info">
                    <p>Connect your Google account to access Analytics data:</p>
                    <ul>
                        <li>✓ Secure OAuth 2.0 authentication</li>
                        <li>✓ Read-only access to your data</li>
                        <li>✓ No passwords stored</li>
                        <li>✓ Revoke access anytime</li>
                    </ul>
                </div>

                <button 
                    @click="initiateGoogleSignIn" 
                    class="google-signin-btn"
                    :disabled="state.loading"
                >
                    <svg class="google-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    </svg>
                    <span v-if="!state.loading">Sign in with Google</span>
                    <span v-else>Redirecting...</span>
                </button>

                <div class="action-buttons">
                    <button @click="cancel" class="btn btn-secondary">
                        Cancel
                    </button>
                </div>
            </div>
        </div>

        <!-- Step 2: Property Selection -->
        <div v-if="state.currentStep === 2" class="step-content">
            <div class="step-card">
                <h2>Step 2: Select Analytics Property</h2>

                <div v-if="state.loadingProperties" class="loading-state">
                    <div class="spinner"></div>
                    <p>Loading your Google Analytics properties...</p>
                </div>

                <div v-else-if="state.properties.length === 0" class="empty-state">
                    <p>{{ state.error || 'No properties found' }}</p>
                    <a href="https://analytics.google.com" target="_blank" class="btn btn-primary">
                        Create GA4 Property
                    </a>
                </div>

                <div v-else class="properties-list">
                    <div 
                        v-for="property in state.properties" 
                        :key="property.name"
                        class="property-card"
                        :class="{ selected: state.selectedProperty?.name === property.name }"
                        @click="selectProperty(property)"
                    >
                        <div class="property-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M3 3v18h18"/>
                                <path d="m19 9-5 5-4-4-3 3"/>
                            </svg>
                        </div>
                        <div class="property-info">
                            <h3>{{ property.displayName }}</h3>
                            <p>{{ property.name }}</p>
                        </div>
                        <div class="property-select">
                            <svg v-if="state.selectedProperty?.name === property.name" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>
                    </div>
                </div>

                <div class="action-buttons">
                    <button @click="goBack" class="btn btn-secondary">
                        ← Back
                    </button>
                </div>
            </div>
        </div>

        <!-- Step 3: Configuration -->
        <div v-if="state.currentStep === 3" class="step-content">
            <div class="step-card">
                <h2>Step 3: Configure Data Sync</h2>

                <div class="form-group">
                    <label for="datasource-name">Data Source Name *</label>
                    <input 
                        id="datasource-name"
                        v-model="state.dataSourceName" 
                        type="text"
                        class="form-control"
                        placeholder="e.g., My Website Analytics"
                        :class="{ error: state.error && !state.dataSourceName }"
                    />
                    <small>This name will appear in your data sources list</small>
                </div>

                <div class="form-group">
                    <label>Sync Frequency</label>
                    <div class="radio-group">
                        <label class="radio-option">
                            <input type="radio" v-model="state.syncFrequency" value="manual" />
                            <span>Manual (sync on demand)</span>
                        </label>
                        <label class="radio-option">
                            <input type="radio" v-model="state.syncFrequency" value="daily" />
                            <span>Daily (every night at 2 AM)</span>
                        </label>
                        <label class="radio-option">
                            <input type="radio" v-model="state.syncFrequency" value="weekly" />
                            <span>Weekly (every Sunday at 2 AM)</span>
                        </label>
                        <label class="radio-option">
                            <input type="radio" v-model="state.syncFrequency" value="hourly" />
                            <span>Hourly</span>
                        </label>
                    </div>
                </div>

                <div class="info-box">
                    <h4>📊 Data Reports Included</h4>
                    <div class="reports-grid">
                        <div class="report-item">✓ Traffic Overview</div>
                        <div class="report-item">✓ Page Performance</div>
                        <div class="report-item">✓ User Acquisition</div>
                        <div class="report-item">✓ Geographic Data</div>
                        <div class="report-item">✓ Device & Technology</div>
                        <div class="report-item">✓ Events</div>
                    </div>
                </div>

                <div class="selected-property-summary">
                    <h4>Selected Property</h4>
                    <div class="summary-content">
                        <p><strong>{{ state.selectedProperty?.displayName }}</strong></p>
                        <p class="text-muted">{{ state.selectedProperty?.name }}</p>
                    </div>
                </div>

                <div class="action-buttons">
                    <button @click="goBack" class="btn btn-secondary" :disabled="state.connecting">
                        ← Back
                    </button>
                    <button @click="cancel" class="btn btn-secondary" :disabled="state.connecting">
                        Cancel
                    </button>
                    <button @click="connectAndSync" class="btn btn-primary" :disabled="state.connecting">
                        <span v-if="!state.connecting">Connect & Sync →</span>
                        <span v-else>Connecting...</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.google-analytics-connector {
    max-width: 900px;
    margin: 0 auto;
    padding: 40px 20px;
}

.connector-header {
    text-align: center;
    margin-bottom: 40px;
}

.connector-header h1 {
    font-size: 32px;
    font-weight: 700;
    color: #1a202c;
    margin-bottom: 8px;
}

.connector-header p {
    font-size: 16px;
    color: #718096;
}

/* Step Indicator */
.step-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 48px;
}

.step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
}

.step-number {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #e2e8f0;
    color: #718096;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    transition: all 0.3s;
}

.step.active .step-number {
    background: #667eea;
    color: white;
}

.step.completed .step-number {
    background: #48bb78;
    color: white;
}

.step-label {
    font-size: 14px;
    color: #718096;
    font-weight: 500;
}

.step.active .step-label {
    color: #667eea;
}

.step-line {
    width: 80px;
    height: 2px;
    background: #e2e8f0;
    margin: 0 16px;
    transition: all 0.3s;
}

.step-line.active {
    background: #48bb78;
}

/* Step Cards */
.step-content {
    animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.step-card {
    background: white;
    border-radius: 12px;
    padding: 32px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.step-card h2 {
    font-size: 24px;
    font-weight: 600;
    color: #1a202c;
    margin-bottom: 24px;
}

/* Authentication */
.auth-info {
    margin-bottom: 32px;
}

.auth-info p {
    font-size: 16px;
    color: #4a5568;
    margin-bottom: 16px;
}

.auth-info ul {
    list-style: none;
    padding: 0;
}

.auth-info li {
    padding: 8px 0;
    color: #2d3748;
}

.google-signin-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    width: 100%;
    max-width: 300px;
    margin: 0 auto 24px;
    padding: 16px 24px;
    background: white;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    color: #4a5568;
    cursor: pointer;
    transition: all 0.2s;
}

.google-signin-btn:hover:not(:disabled) {
    border-color: #cbd5e0;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
}

.google-signin-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.google-icon {
    width: 24px;
    height: 24px;
}

/* Properties List */
.loading-state,
.empty-state {
    text-align: center;
    padding: 48px 24px;
}

.spinner {
    width: 48px;
    height: 48px;
    border: 4px solid #e2e8f0;
    border-top-color: #667eea;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 16px;
}

.properties-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 24px;
}

.property-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
}

.property-card:hover {
    border-color: #cbd5e0;
    background: #f7fafc;
}

.property-card.selected {
    border-color: #667eea;
    background: #eef2ff;
}

.property-icon {
    width: 48px;
    height: 48px;
    background: #edf2f7;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.property-icon svg {
    width: 24px;
    height: 24px;
    color: #667eea;
    stroke-width: 2;
}

.property-info {
    flex: 1;
}

.property-info h3 {
    font-size: 16px;
    font-weight: 600;
    color: #1a202c;
    margin: 0 0 4px;
}

.property-info p {
    font-size: 14px;
    color: #718096;
    margin: 0;
}

.property-select svg {
    width: 24px;
    height: 24px;
    color: #667eea;
    stroke-width: 3;
}

/* Form Groups */
.form-group {
    margin-bottom: 24px;
}

.form-group label {
    display: block;
    font-size: 14px;
    font-weight: 600;
    color: #2d3748;
    margin-bottom: 8px;
}

.form-control {
    width: 100%;
    padding: 12px 16px;
    font-size: 16px;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    transition: all 0.2s;
}

.form-control:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-control.error {
    border-color: #f56565;
}

.form-group small {
    display: block;
    margin-top: 4px;
    font-size: 13px;
    color: #718096;
}

.radio-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.radio-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
}

.radio-option:hover {
    border-color: #cbd5e0;
    background: #f7fafc;
}

.radio-option input[type="radio"] {
    cursor: pointer;
}

.info-box {
    padding: 20px;
    background: #eef2ff;
    border-radius: 8px;
    margin-bottom: 24px;
}

.info-box h4 {
    font-size: 16px;
    font-weight: 600;
    color: #1a202c;
    margin-bottom: 16px;
}

.reports-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 8px;
}

.report-item {
    font-size: 14px;
    color: #2d3748;
}

.selected-property-summary {
    padding: 20px;
    background: #f7fafc;
    border-radius: 8px;
    margin-bottom: 24px;
}

.selected-property-summary h4 {
    font-size: 14px;
    font-weight: 600;
    color: #718096;
    margin-bottom: 12px;
}

.text-muted {
    color: #718096;
    font-size: 14px;
}

/* Action Buttons */
.action-buttons {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 32px;
}

.btn {
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 500;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
}

.btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.btn-primary {
    background: #667eea;
    color: white;
}

.btn-primary:hover:not(:disabled) {
    background: #5568d3;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-secondary {
    background: #e2e8f0;
    color: #4a5568;
}

.btn-secondary:hover:not(:disabled) {
    background: #cbd5e0;
}

/* Responsive */
@media (max-width: 768px) {
    .google-analytics-connector {
        padding: 24px 16px;
    }
    
    .step-indicator {
        margin-bottom: 32px;
    }
    
    .step-line {
        width: 40px;
    }
    
    .step-label {
        font-size: 12px;
    }
    
    .step-card {
        padding: 24px;
    }
    
    .action-buttons {
        flex-direction: column;
    }
    
    .btn {
        width: 100%;
    }
}
</style>
