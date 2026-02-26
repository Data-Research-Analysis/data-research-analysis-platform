<template>
    <div class="container mx-auto px-4 py-8">
        <!-- Header -->
        <div class="mb-8">
            <div class="flex items-center justify-between mb-4">
                <div>
                    <h1 class="text-3xl font-bold text-gray-800">Data Quality Dashboard</h1>
                    <p class="text-gray-600 mt-2">{{ dataModel?.name || 'Loading...' }}</p>
                </div>
                <button
                    @click="startAnalysis"
                    :disabled="isAnalyzing"
                    class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-2"
                >
                    <span v-if="isAnalyzing" class="animate-spin">⚙️</span>
                    <span v-else>🔍</span>
                    <span>{{ isAnalyzing ? 'Analyzing...' : 'Start AI Analysis' }}</span>
                </button>
            </div>
        </div>

        <!-- Quality Score Card -->
        <div v-if="latestReport" class="space-y-6 mb-8">
            <!-- Overall Quality Score - Hero Section -->
            <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg p-8 border border-blue-100">
                <div class="flex items-center justify-between">
                    <div>
                        <h2 class="text-gray-600 text-lg font-semibold mb-2">Overall Data Quality Score</h2>
                        <div class="flex items-baseline gap-3">
                            <p class="text-6xl font-bold" :class="getScoreTextColor(latestReport.qualityScore)">
                                {{ latestReport.qualityScore }}
                            </p>
                            <span class="text-3xl text-gray-400">/100</span>
                        </div>
                        <p class="text-sm text-gray-600 mt-2">
                            Weighted: completeness (35%), validity (30%), uniqueness (20%), consistency (15%)
                        </p>
                        <p class="text-xs text-gray-500 mt-1">
                            Priorities: complete customer data for targeting, accurate contact info to prevent wasted spend, deduplicated records
                        </p>
                    </div>
                    <div class="text-8xl">
                        {{ getScoreEmoji(latestReport.qualityScore) }}
                    </div>
                </div>
            </div>

            <!-- Quality Dimension Scores -->
            <div>
                <h3 class="text-lg font-semibold text-gray-800 mb-4">Quality Dimensions</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <!-- Completeness -->
                    <div class="bg-white rounded-lg shadow p-5 hover:shadow-md transition-shadow">
                        <div class="flex items-center gap-2 mb-3">
                            <span class="text-2xl">✅</span>
                            <p class="text-gray-600 text-sm font-semibold">Completeness</p>
                        </div>
                        <div class="flex items-baseline gap-2 mb-3">
                            <p class="text-3xl font-bold text-blue-600">{{ latestReport.completenessScore }}</p>
                            <p class="text-sm text-gray-500">/100</p>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2 mb-2">
                            <div 
                                class="bg-blue-600 h-2 rounded-full transition-all duration-500"
                                :style="{ width: `${latestReport.completenessScore}%` }"
                            ></div>
                        </div>
                        <p class="text-xs text-gray-500">Percentage of non-null values</p>
                    </div>

                    <!-- Uniqueness -->
                    <div class="bg-white rounded-lg shadow p-5 hover:shadow-md transition-shadow">
                        <div class="flex items-center gap-2 mb-3">
                            <span class="text-2xl">🔑</span>
                            <p class="text-gray-600 text-sm font-semibold">Uniqueness</p>
                        </div>
                        <div class="flex items-baseline gap-2 mb-3">
                            <p class="text-3xl font-bold text-purple-600">{{ latestReport.uniquenessScore }}</p>
                            <p class="text-sm text-gray-500">/100</p>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2 mb-2">
                            <div 
                                class="bg-purple-600 h-2 rounded-full transition-all duration-500"
                                :style="{ width: `${latestReport.uniquenessScore}%` }"
                            ></div>
                        </div>
                        <p class="text-xs text-gray-500">Records without duplicates</p>
                    </div>

                    <!-- Validity -->
                    <div class="bg-white rounded-lg shadow p-5 hover:shadow-md transition-shadow">
                        <div class="flex items-center gap-2 mb-3">
                            <span class="text-2xl">🎯</span>
                            <p class="text-gray-600 text-sm font-semibold">Validity</p>
                        </div>
                        <div class="flex items-baseline gap-2 mb-3">
                            <p class="text-3xl font-bold text-green-600">{{ latestReport.validityScore }}</p>
                            <p class="text-sm text-gray-500">/100</p>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2 mb-2">
                            <div 
                                class="bg-green-600 h-2 rounded-full transition-all duration-500"
                                :style="{ width: `${latestReport.validityScore}%` }"
                            ></div>
                        </div>
                        <p class="text-xs text-gray-500">Valid formats (emails, phones, dates, types)</p>
                    </div>

                    <!-- Consistency -->
                    <div class="bg-white rounded-lg shadow p-5 hover:shadow-md transition-shadow">
                        <div class="flex items-center gap-2 mb-3">
                            <span class="text-2xl">🔄</span>
                            <p class="text-gray-600 text-sm font-semibold">Consistency</p>
                        </div>
                        <div class="flex items-baseline gap-2 mb-3">
                            <p class="text-3xl font-bold text-orange-600">{{ latestReport.consistencyScore || 0 }}</p>
                            <p class="text-sm text-gray-500">/100</p>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2 mb-2">
                            <div 
                                class="bg-orange-600 h-2 rounded-full transition-all duration-500"
                                :style="{ width: `${latestReport.consistencyScore || 0}%` }"
                            ></div>
                        </div>
                        <p class="text-xs text-gray-500">Uniform formatting & patterns</p>
                    </div>
                </div>
            </div>

            <!-- Data Statistics -->
            <div>
                <h3 class="text-lg font-semibold text-gray-800 mb-4">Data Statistics</h3>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <!-- Total Rows -->
                    <div class="bg-white rounded-lg shadow p-5 hover:shadow-md transition-shadow border-l-4 border-blue-500">
                        <p class="text-gray-600 text-xs font-medium mb-2">TOTAL ROWS</p>
                        <p class="text-3xl font-bold text-gray-800">{{ formatNumber(latestReport.totalRows) }}</p>
                        <p class="text-xs text-gray-500 mt-2">Records analyzed</p>
                    </div>

                    <!-- Duplicate Records -->
                    <div class="bg-white rounded-lg shadow p-5 hover:shadow-md transition-shadow border-l-4" 
                         :class="latestReport.duplicateCount > 0 ? 'border-red-500' : 'border-green-500'">
                        <p class="text-gray-600 text-xs font-medium mb-2">DUPLICATES</p>
                        <p class="text-3xl font-bold" :class="latestReport.duplicateCount > 0 ? 'text-red-600' : 'text-green-600'">
                            {{ formatNumber(latestReport.duplicateCount) }}
                        </p>
                        <p class="text-xs text-gray-500 mt-2">
                            {{ latestReport.duplicateCount > 0 ? 'Need cleaning' : 'No duplicates found' }}
                        </p>
                    </div>

                    <!-- Null Values -->
                    <div class="bg-white rounded-lg shadow p-5 hover:shadow-md transition-shadow border-l-4"
                         :class="latestReport.nullCount > 0 ? 'border-yellow-500' : 'border-green-500'">
                        <p class="text-gray-600 text-xs font-medium mb-2">NULL VALUES</p>
                        <p class="text-3xl font-bold" :class="latestReport.nullCount > 0 ? 'text-yellow-600' : 'text-green-600'">
                            {{ formatNumber(latestReport.nullCount) }}
                        </p>
                        <p class="text-xs text-gray-500 mt-2">
                            {{ latestReport.nullCount > 0 ? 'Missing data points' : 'All fields populated' }}
                        </p>
                    </div>

                    <!-- Outliers -->
                    <div class="bg-white rounded-lg shadow p-5 hover:shadow-md transition-shadow border-l-4"
                         :class="latestReport.outlierCount > 0 ? 'border-orange-500' : 'border-green-500'">
                        <p class="text-gray-600 text-xs font-medium mb-2">OUTLIERS</p>
                        <p class="text-3xl font-bold" :class="latestReport.outlierCount > 0 ? 'text-orange-600' : 'text-green-600'">
                            {{ formatNumber(latestReport.outlierCount) }}
                        </p>
                        <p class="text-xs text-gray-500 mt-2">
                            {{ latestReport.outlierCount > 0 ? 'Unusual values detected' : 'No anomalies' }}
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Issues List -->
        <div v-if="latestReport && latestReport.issues && latestReport.issues.length > 0" class="bg-white rounded-lg shadow mb-8">
            <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 class="text-xl font-semibold text-gray-800">Quality Issues ({{ latestReport.issues.length }})</h2>
                <button
                    @click="showAutoCleaning = true"
                    class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center gap-2"
                >
                    <span>✨</span>
                    <span>Auto-Clean All</span>
                </button>
            </div>
            <div class="divide-y divide-gray-200">
                <div 
                    v-for="(issue, index) in latestReport.issues" 
                    :key="index"
                    class="px-6 py-4 hover:bg-gray-50 transition-colors duration-150"
                >
                    <div class="flex items-start justify-between">
                        <div class="flex-1">
                            <div class="flex items-center gap-2 mb-2">
                                <span class="px-2 py-1 rounded text-xs font-medium" :class="getSeverityClass(issue.severity)">
                                    {{ issue.severity }}
                                </span>
                                <span class="text-sm font-medium text-gray-800">{{ issue.type }}</span>
                            </div>
                            <p class="text-gray-600 text-sm mb-2">{{ issue.description }}</p>
                            <div class="flex items-center gap-4 text-xs text-gray-500">
                                <span>Column: <span class="font-mono">{{ issue.column }}</span></span>
                                <span>Affected Rows: {{ issue.affectedRows }}</span>
                            </div>
                        </div>
                        <button
                            @click="fixIssue(issue)"
                            :disabled="isFixing"
                            class="ml-4 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 transition-colors duration-200"
                        >
                            Fix
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- No Issues State -->
        <div v-else-if="latestReport && (!latestReport.issues || latestReport.issues.length === 0)" class="bg-white rounded-lg shadow p-12 text-center">
            <div class="text-6xl mb-4">✅</div>
            <h3 class="text-xl font-semibold text-gray-800 mb-2">No Quality Issues Found</h3>
            <p class="text-gray-600">Your data model looks great!</p>
        </div>

        <!-- Auto-Cleaning Modal -->
        <div v-if="showAutoCleaning" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click="showAutoCleaning = false">
            <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6" @click.stop>
                <h3 class="text-2xl font-bold text-gray-800 mb-4">Auto-Clean Data Quality Issues</h3>
                <p class="text-gray-600 mb-6">
                    The AI will generate SQL cleaning operations for all detected issues. You can preview and approve each operation.
                </p>
                
                <div v-if="cleaningProgress" class="mb-6">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-sm font-medium text-gray-700">{{ cleaningProgress.message }}</span>
                        <span class="text-sm text-gray-500">{{ cleaningProgress.current }}/{{ cleaningProgress.total }}</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div 
                            class="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            :style="{ width: `${(cleaningProgress.current / cleaningProgress.total) * 100}%` }"
                        ></div>
                    </div>
                </div>

                <div class="flex justify-end gap-3">
                    <button
                        @click="showAutoCleaning = false"
                        :disabled="isAutoCleaning"
                        class="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-colors duration-200"
                    >
                        Cancel
                    </button>
                    <button
                        @click="executeAutoCleaning"
                        :disabled="isAutoCleaning"
                        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors duration-200 flex items-center gap-2"
                    >
                        <span v-if="isAutoCleaning" class="animate-spin">⚙️</span>
                        <span>{{ isAutoCleaning ? 'Processing...' : 'Start Auto-Clean' }}</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Cleaning History -->
        <div v-if="cleaningHistory && cleaningHistory.length > 0" class="bg-white rounded-lg shadow">
            <div class="px-6 py-4 border-b border-gray-200">
                <h2 class="text-xl font-semibold text-gray-800">Cleaning History</h2>
            </div>
            <div class="divide-y divide-gray-200">
                <div 
                    v-for="entry in cleaningHistory" 
                    :key="entry.id"
                    class="px-6 py-4 hover:bg-gray-50 transition-colors duration-150"
                >
                    <div class="flex items-center justify-between mb-2">
                        <span class="font-medium text-gray-800">{{ entry.rule_type }}</span>
                        <span class="text-sm text-gray-500">{{ formatDate(entry.executed_at) }}</span>
                    </div>
                    <div class="text-sm text-gray-600 mb-2">
                        <span class="font-medium">Rows Affected:</span> {{ entry.rows_affected }}
                    </div>
                    <details class="text-xs">
                        <summary class="cursor-pointer text-blue-600 hover:text-blue-700">View SQL</summary>
                        <pre class="mt-2 p-3 bg-gray-50 rounded border border-gray-200 overflow-x-auto">{{ entry.sql_executed }}</pre>
                    </details>
                </div>
            </div>
        </div>

        <!-- Empty State -->
        <div v-if="!latestReport && !isAnalyzing" class="bg-white rounded-lg shadow p-12 text-center">
            <div class="text-6xl mb-4">🔍</div>
            <h3 class="text-xl font-semibold text-gray-800 mb-2">No Quality Analysis Yet</h3>
            <p class="text-gray-600 mb-6">Start an AI-powered quality analysis to identify issues in your data model.</p>
            <button
                @click="startAnalysis"
                class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 inline-flex items-center gap-2"
            >
                <span>🔍</span>
                <span>Start Analysis</span>
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const config = useRuntimeConfig();

// Data refs
const dataModel = ref<any>(null);
const latestReport = ref<any>(null);
const cleaningHistory = ref<any[]>([]);
const isAnalyzing = ref(false);
const isFixing = ref(false);
const showAutoCleaning = ref(false);
const isAutoCleaning = ref(false);
const cleaningProgress = ref<{ message: string; current: number; total: number } | null>(null);

// Get data model ID from route
const dataModelId = computed(() => {
    return parseInt(route.params.id as string);
});

// Fetch data model details
async function fetchDataModel() {
    try {
        const token = import.meta.client ? localStorage.getItem('auth_token') : null;
        if (!token) {
            router.push('/login');
            return;
        }

        const response = await $fetch(`${config.public.apiBase}/data-models/${dataModelId.value}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth'
            },
            credentials: 'include'
        });

        dataModel.value = response.data;
    } catch (error) {
        console.error('Error fetching data model:', error);
    }
}

// Fetch latest quality report
async function fetchLatestReport() {
    try {
        const token = import.meta.client ? localStorage.getItem('auth_token') : null;
        if (!token) return;

        const response = await $fetch(`${config.public.apiBase}/data-quality/report/${dataModelId.value}/latest`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth'
            },
            credentials: 'include'
        });

        if (response.success) {
            latestReport.value = response.data;
        }
    } catch (error) {
        console.error('Error fetching quality report:', error);
    }
}

// Fetch cleaning history
async function fetchCleaningHistory() {
    try {
        const token = import.meta.client ? localStorage.getItem('auth_token') : null;
        if (!token) return;

        const response = await $fetch(`${config.public.apiBase}/data-quality/history/${dataModelId.value}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth'
            },
            credentials: 'include'
        });

        if (response.success) {
            cleaningHistory.value = response.data;
        }
    } catch (error) {
        console.error('Error fetching cleaning history:', error);
    }
}

// Start AI quality analysis
async function startAnalysis() {
    isAnalyzing.value = true;
    try {
        const token = import.meta.client ? localStorage.getItem('auth_token') : null;
        if (!token) {
            router.push('/login');
            return;
        }

        const response = await $fetch(`${config.public.apiBase}/data-quality/analyze/${dataModelId.value}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth'
            },
            credentials: 'include'
        });

        if (response.success) {
            latestReport.value = response.data;
            await fetchCleaningHistory();
        }
    } catch (error) {
        console.error('Error starting analysis:', error);
    } finally {
        isAnalyzing.value = false;
    }
}

// Fix individual issue
async function fixIssue(issue: any) {
    isFixing.value = true;
    try {
        const token = import.meta.client ? localStorage.getItem('auth_token') : null;
        if (!token) return;

        const response = await $fetch(`${config.public.apiBase}/data-quality/clean/${dataModelId.value}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth'
            },
            body: {
                ruleType: issue.type,
                options: { column: issue.column }
            },
            credentials: 'include'
        });

        if (response.success) {
            // Refresh report and history
            await fetchLatestReport();
            await fetchCleaningHistory();
        }
    } catch (error) {
        console.error('Error fixing issue:', error);
    } finally {
        isFixing.value = false;
    }
}

// Execute auto-cleaning for all issues
async function executeAutoCleaning() {
    isAutoCleaning.value = true;
    cleaningProgress.value = {
        message: 'Starting auto-clean...',
        current: 0,
        total: latestReport.value.issues.length
    };

    try {
        const token = import.meta.client ? localStorage.getItem('auth_token') : null;
        if (!token) return;

        for (let i = 0; i < latestReport.value.issues.length; i++) {
            const issue = latestReport.value.issues[i];
            cleaningProgress.value = {
                message: `Fixing ${issue.type}...`,
                current: i + 1,
                total: latestReport.value.issues.length
            };

            await $fetch(`${config.public.apiBase}/data-quality/clean/${dataModelId.value}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth'
                },
                body: {
                    ruleType: issue.type,
                    options: { column: issue.column }
                },
                credentials: 'include'
            });
        }

        // Refresh data
        await fetchLatestReport();
        await fetchCleaningHistory();
        
        showAutoCleaning.value = false;
        cleaningProgress.value = null;
    } catch (error) {
        console.error('Error during auto-cleaning:', error);
    } finally {
        isAutoCleaning.value = false;
    }
}

// Helper functions
function getScoreColorClass(score: number) {
    if (score >= 90) return 'border-green-500';
    if (score >= 70) return 'border-yellow-500';
    return 'border-red-500';
}

function getScoreTextColor(score: number) {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
}

function getScoreEmoji(score: number) {
    if (score >= 90) return '✅';
    if (score >= 70) return '⚠️';
    return '❌';
}

function getSeverityClass(severity: string) {
    const classes = {
        high: 'bg-red-100 text-red-800',
        medium: 'bg-yellow-100 text-yellow-800',
        low: 'bg-blue-100 text-blue-800'
    };
    return classes[severity as keyof typeof classes] || classes.low;
}

function formatDate(dateString: string) {
    if (!import.meta.client) return dateString;
    return new Date(dateString).toLocaleString();
}

function formatNumber(num: number): string {
    if (num === null || num === undefined) return '0';
    return num.toLocaleString();
}

// Initialize on mount (client-side only)
onMounted(() => {
    if (import.meta.client) {
        fetchDataModel();
        fetchLatestReport();
        fetchCleaningHistory();
    }
});
</script>
