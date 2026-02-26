<template>
    <div class="space-y-6">
        <!-- Action Buttons -->
        <div class="flex items-center justify-between bg-white rounded-lg shadow p-4">
            <div class="text-sm text-gray-600">
                <span class="font-medium">Last analyzed:</span> 
                <span v-if="latestReport">{{ formatDate(latestReport.createdAt) }}</span>
                <span v-else>Never</span>
            </div>
            <button
                @click="runAnalysis"
                :disabled="isAnalyzing"
                class="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer transition-colors duration-200 flex items-center gap-2"
            >
                <span v-if="isAnalyzing" class="animate-spin">⚙️</span>
                <span v-else>🔍</span>
                <span>{{ isAnalyzing ? 'Analyzing...' : 'Run Analysis' }}</span>
            </button>
        </div>

        <!-- Overall Quality Score - Hero Section -->
        <div v-if="latestReport" class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg p-8 border border-blue-100">
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
        <div v-if="latestReport">
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
        <div v-if="latestReport">
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

        <!-- Issues Summary -->
        <div v-if="latestReport && latestReport.issues && latestReport.issues.length > 0" class="space-y-4">
            <!-- Clean Data Button - Prominent -->
            <div class="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 shadow-md">
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-800 mb-2">
                            {{ latestReport.issues.length }} {{ latestReport.issues.length === 1 ? 'Issue' : 'Issues' }} Found in Your Data
                        </h3>
                        <p class="text-sm text-gray-600">
                            Click below to automatically clean your data. This will fix all detected problems.
                        </p>
                    </div>
                    <button
                        @click="autoCleanAll"
                        :disabled="isCleaning"
                        class="px-8 py-3 bg-green-600 text-white text-lg font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer transition-colors duration-200 flex items-center gap-3 shadow-lg hover:shadow-xl"
                    >
                        <span v-if="isCleaning" class="animate-spin text-2xl">⚙️</span>
                        <span v-else class="text-2xl">✨</span>
                        <span>{{ isCleaning ? 'Cleaning Data...' : 'Clean My Data' }}</span>
                    </button>
                </div>
            </div>

            <!-- Issues List - Simple Display -->
            <div class="bg-white rounded-lg shadow">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h3 class="text-lg font-semibold text-gray-800">Problems Detected</h3>
                    <p class="text-sm text-gray-600 mt-1">
                        These issues will be automatically fixed when you clean your data.
                    </p>
                </div>
                <div class="divide-y divide-gray-200">
                    <div 
                        v-for="(issue, index) in latestReport.issues" 
                        :key="index"
                        class="px-6 py-4"
                    >
                        <div class="flex items-start gap-4">
                            <div class="flex-shrink-0 mt-1">
                                <span class="text-2xl">
                                    {{ getIssueIcon(issue.type) }}
                                </span>
                            </div>
                            <div class="flex-1">
                                <div class="flex items-center gap-2 mb-1">
                                    <span class="text-base font-medium text-gray-800">{{ getSimpleIssueTitle(issue.type) }}</span>
                                    <span v-if="issue.affectedRows" class="text-sm text-gray-500">
                                        ({{ formatNumber(issue.affectedRows) }} {{ issue.affectedRows === 1 ? 'row' : 'rows' }})
                                    </span>
                                </div>
                                <p class="text-sm text-gray-600">{{ getSimpleDescription(issue) }}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- No Issues State -->
        <div v-else-if="latestReport && (!latestReport.issues || latestReport.issues.length === 0)" class="bg-white rounded-lg shadow p-12 text-center">
            <div class="text-6xl mb-4">✅</div>
            <h3 class="text-xl font-semibold text-gray-800 mb-2">Your Data Looks Great!</h3>
            <p class="text-gray-600">No quality issues detected. Your data is clean and ready to use.</p>
        </div>

        <!-- Empty State -->
        <div v-if="!latestReport && !isAnalyzing" class="bg-white rounded-lg shadow p-12 text-center">
            <div class="text-6xl mb-4">🔍</div>
            <h3 class="text-xl font-semibold text-gray-800 mb-2">Check Your Data Quality</h3>
            <p class="text-gray-600 mb-6">Run an analysis to see how clean your data is and identify any problems.</p>
            <button
                @click="runAnalysis"
                class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors duration-200 inline-flex items-center gap-2"
            >
                <span>🔍</span>
                <span>Analyze My Data</span>
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getAuthToken } from '~/composables/AuthToken';

const props = defineProps<{
    dataModelId: number;
}>();

const latestReport = ref<any>(null);
const isAnalyzing = ref(false);
const isCleaning = ref(false);

onMounted(async () => {
    await loadLatestReport();
});

async function loadLatestReport() {
    try {
        const token = getAuthToken();
        if (!token) return;

        const config = useRuntimeConfig();
        const data = await $fetch(`${config.public.apiBase}/data-quality/report/${props.dataModelId}/latest`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth'
            },
            credentials: 'include'
        });

        latestReport.value = data;
    } catch (error) {
        console.error('Error loading quality report:', error);
    }
}

async function runAnalysis() {
    isAnalyzing.value = true;
    try {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Authentication required');
        }

        const config = useRuntimeConfig();
        const result = await $fetch(`${config.public.apiBase}/data-quality/analyze/${props.dataModelId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth'
            },
            credentials: 'include'
        }) as any;

        latestReport.value = result.report;
        
        // Show success notification
        const { $swal } = useNuxtApp() as any;
        $swal.fire({
            title: 'Analysis Complete',
            text: `Quality Score: ${result.report.qualityScore}/100`,
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
        });
    } catch (error: any) {
        console.error('Error running analysis:', error);
        const { $swal } = useNuxtApp() as any;
        $swal.fire({
            title: 'Analysis Error',
            text: error?.data?.message || error?.message || 'Failed to run analysis',
            icon: 'error'
        });
    } finally {
        isAnalyzing.value = false;
    }
}

async function autoCleanAll() {
    const { $swal } = useNuxtApp() as any;
    
    const issueCount = latestReport.value?.issues?.length || 0;
    const currentScore = latestReport.value?.qualityScore || 0;
    const estimatedScore = Math.min(100, currentScore + 20); // Rough estimate
    
    // Create simple, marketing-friendly issue summary
    const issueSummary = getIssueSummary();
    
    const result = await $swal.fire({
        title: 'Clean Your Data?',
        html: `
            <div class="text-left">
                <p class="mb-4 text-base">We found <strong>${issueCount}</strong> ${issueCount === 1 ? 'issue' : 'issues'} that can be automatically fixed:</p>
                <div class="bg-gray-50 rounded-lg p-4 mb-4">
                    ${issueSummary}
                </div>
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <p class="text-blue-900 font-medium mb-2">📈 Expected Improvement</p>
                    <p class="text-blue-800 text-sm">Your quality score should improve from <strong>${currentScore}</strong> to approximately <strong>${estimatedScore}</strong>.</p>
                </div>
                <p class="text-sm text-gray-600">This action will permanently modify your data to fix the issues listed above.</p>
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Yes, Clean My Data',
        cancelButtonText: 'Not Now',
        width: '600px'
    });

    if (!result.isConfirmed) return;

    isCleaning.value = true;
    const cleaningStartTime = Date.now();
    
    try {
        const token = getAuthToken();
        const config = useRuntimeConfig();
        
        // Apply cleaning rules for all issues
        const cleaningConfig = {
            cleaningType: 'auto',
            rules: latestReport.value.issues || []
        };

        await $fetch(`${config.public.apiBase}/data-quality/clean/${props.dataModelId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth'
            },
            body: { cleaningConfig },
            credentials: 'include'
        });

        // Reload report to get new quality score
        const previousScore = latestReport.value.qualityScore;
        await loadLatestReport();
        const newScore = latestReport.value?.qualityScore || previousScore;
        const improvement = newScore - previousScore;

        $swal.fire({
            title: '✨ Data Cleaned Successfully!',
            html: `
                <div class="text-center">
                    <p class="text-lg mb-4">Your data quality has been improved.</p>
                    <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                        <p class="text-green-900 font-semibold mb-2">Quality Score</p>
                        <p class="text-4xl font-bold text-green-600">${previousScore} → ${newScore}</p>
                        ${improvement > 0 ? `<p class="text-green-700 mt-2">+${improvement} points improvement</p>` : ''}
                    </div>
                    <p class="text-sm text-gray-600">Fixed ${issueCount} ${issueCount === 1 ? 'issue' : 'issues'} in ${Math.ceil((Date.now() - cleaningStartTime) / 1000)} seconds</p>
                </div>
            `,
            icon: 'success',
            confirmButtonText: 'Great!',
            confirmButtonColor: '#10b981'
        });
    } catch (error: any) {
        console.error('Error auto-cleaning:', error);
        $swal.fire({
            title: 'Cleaning Failed',
            text: error?.data?.message || 'Failed to clean your data. Please try again or contact support.',
            icon: 'error'
        });
    } finally {
        isCleaning.value = false;
    }
}

function getIssueSummary(): string {
    const issues = latestReport.value?.issues || [];
    const typeCounts: Record<string, number> = {};
    
    // Count issues by simple type
    issues.forEach((issue: any) => {
        const simpleType = getSimpleIssueTitle(issue.type);
        typeCounts[simpleType] = (typeCounts[simpleType] || 0) + 1;
    });
    
    // Generate HTML list
    return Object.entries(typeCounts)
        .map(([type, count]) => `<p class="text-gray-700 mb-1">• ${count} ${type} ${count === 1 ? 'issue' : 'issues'}</p>`)
        .join('');
}

function getSimpleIssueTitle(issueType: string): string {
    const type = issueType?.toLowerCase() || '';
    
    if (type.includes('duplicate')) return 'Duplicate Customer Records';
    if (type.includes('null') || type.includes('missing')) return 'Missing Information';
    if (type.includes('format') || type.includes('inconsist')) return 'Formatting Problems';
    if (type.includes('invalid') || type.includes('type')) return 'Invalid Data';
    if (type.includes('outlier') || type.includes('anomal')) return 'Unusual Values';
    
    return issueType;
}

function getSimpleDescription(issue: any): string {
    const type = issue.type?.toLowerCase() || '';
    const column = issue.column;
    
    if (type.includes('duplicate')) {
        return `Found duplicate entries in ${column}. We'll keep the most recent record.`;
    }
    if (type.includes('null') || type.includes('missing')) {
        return `Some ${column} values are blank. We'll fill them with appropriate defaults.`;
    }
    if (type.includes('format') || type.includes('inconsist')) {
        return `${column} has inconsistent formatting. We'll standardize the format.`;
    }
    if (type.includes('invalid') || type.includes('type')) {
        return `Some ${column} values don't match the expected format. We'll correct them.`;
    }
    if (type.includes('outlier') || type.includes('anomal')) {
        return `${column} has some unusual values that may be errors.`;
    }
    
    return issue.description || `Issue detected in ${column}`;
}

function getIssueIcon(issueType: string): string {
    const type = issueType?.toLowerCase() || '';
    
    if (type.includes('duplicate')) return '👥';
    if (type.includes('null') || type.includes('missing')) return '📝';
    if (type.includes('format') || type.includes('inconsist')) return '🔤';
    if (type.includes('invalid') || type.includes('type')) return '⚠️';
    if (type.includes('outlier') || type.includes('anomal')) return '📊';
    
    return '🔍';
}

function getScoreColorClass(score: number): string {
    if (score >= 80) return 'border-green-500';
    if (score >= 60) return 'border-yellow-500';
    return 'border-red-500';
}

function getScoreTextColor(score: number): string {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
}

function getScoreEmoji(score: number): string {
    if (score >= 90) return '🌟';
    if (score >= 80) return '✅';
    if (score >= 70) return '👍';
    if (score >= 60) return '⚠️';
    return '❌';
}

function getSeverityClass(severity: string): string {
    switch (severity?.toLowerCase()) {
        case 'critical':
            return 'bg-red-100 text-red-800';
        case 'high':
            return 'bg-orange-100 text-orange-800';
        case 'medium':
            return 'bg-yellow-100 text-yellow-800';
        case 'low':
            return 'bg-blue-100 text-blue-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

function formatDate(date: string | Date): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
}

function formatNumber(num: number): string {
    if (num === null || num === undefined) return '0';
    return num.toLocaleString();
}
</script>
