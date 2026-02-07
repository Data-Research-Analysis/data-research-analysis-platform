<template>
    <div class="bg-white rounded-lg shadow p-6">
        <!-- Header -->
        <div class="flex items-center justify-between mb-6">
            <div>
                <h3 class="text-lg font-semibold text-gray-800">Generate Attribution Report</h3>
                <p class="text-sm text-gray-600 mt-1">Analyze channel performance with different attribution models</p>
            </div>
            <button
                v-if="!showForm"
                @click="showForm = true"
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
                <span>📊</span>
                <span>New Report</span>
            </button>
        </div>

        <!-- Report Generation Form -->
        <div v-if="showForm" class="border border-gray-200 rounded-lg p-6 mb-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Date Range -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                    <input
                        v-model="reportParams.startDate"
                        type="date"
                        :max="reportParams.endDate"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                    <input
                        v-model="reportParams.endDate"
                        type="date"
                        :min="reportParams.startDate"
                        :max="today"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>

                <!-- Attribution Model -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Attribution Model</label>
                    <select
                        v-model="reportParams.attributionModel"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="first_touch">First Touch (100% to first)</option>
                        <option value="last_touch">Last Touch (100% to last)</option>
                        <option value="linear">Linear (Equal distribution)</option>
                        <option value="time_decay">Time Decay (Exponential)</option>
                        <option value="u_shaped">U-Shaped (40-20-40)</option>
                    </select>
                </div>

                <!-- Report Type -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
                    <select
                        v-model="reportParams.reportType"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="channel_performance">Channel Performance</option>
                        <option value="roi_report">ROI Analysis</option>
                        <option value="journey_map">Customer Journey Map</option>
                        <option value="funnel_analysis">Funnel Analysis</option>
                    </select>
                </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex items-center gap-3 mt-6">
                <button
                    @click="generateReport"
                    :disabled="isGenerating || !isFormValid"
                    class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                    <span v-if="isGenerating">⏳</span>
                    <span v-else>📊</span>
                    <span>{{ isGenerating ? 'Generating...' : 'Generate Report' }}</span>
                </button>
                
                <button
                    @click="cancelForm"
                    :disabled="isGenerating"
                    class="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 transition-colors"
                >
                    Cancel
                </button>
            </div>
        </div>

        <!-- Generated Report Display -->
        <div v-if="generatedReport" class="border border-gray-200 rounded-lg overflow-hidden">
            <!-- Report Header -->
            <div class="bg-gray-50 border-b border-gray-200 px-6 py-4">
                <div class="flex items-center justify-between">
                    <div>
                        <h4 class="font-semibold text-gray-800">{{ getReportTitle(generatedReport.reportType) }}</h4>
                        <p class="text-sm text-gray-600 mt-1">
                            {{ formatDate(generatedReport.dateRangeStart) }} - {{ formatDate(generatedReport.dateRangeEnd) }}
                            • {{ getModelName(generatedReport.attributionModel) }}
                        </p>
                    </div>
                    <button
                        @click="exportToCSV"
                        class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                        <span>📥</span>
                        <span>Export CSV</span>
                    </button>
                </div>
            </div>

            <!-- Summary Metrics -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-white">
                <div class="text-center">
                    <p class="text-sm text-gray-600 mb-1">Total Conversions</p>
                    <p class="text-2xl font-bold text-gray-800">{{ generatedReport.totalConversions }}</p>
                </div>
                <div class="text-center">
                    <p class="text-sm text-gray-600 mb-1">Total Revenue</p>
                    <p class="text-2xl font-bold text-green-600">${{ formatNumber(generatedReport.totalRevenue) }}</p>
                </div>
                <div class="text-center">
                    <p class="text-sm text-gray-600 mb-1">Avg Touchpoints</p>
                    <p class="text-2xl font-bold text-blue-600">{{ generatedReport.avgTouchpointsPerConversion?.toFixed(1) || '0' }}</p>
                </div>
                <div class="text-center">
                    <p class="text-sm text-gray-600 mb-1">Avg Time to Convert</p>
                    <p class="text-2xl font-bold text-purple-600">{{ formatHours(generatedReport.avgTimeToConversionHours) }}</p>
                </div>
            </div>

            <!-- Channel Breakdown Table -->
            <div v-if="generatedReport.channelBreakdown && generatedReport.channelBreakdown.length > 0" class="p-6 border-t border-gray-200">
                <h5 class="font-semibold text-gray-800 mb-4">Channel Performance</h5>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Channel</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Conversions</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Value</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            <tr v-for="(channel, index) in generatedReport.channelBreakdown" :key="index">
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {{ channel.name }}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">
                                    {{ channel.conversions }}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">
                                    ${{ formatNumber(channel.revenue) }}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">
                                    ${{ formatNumber(Number(channel.revenue) / Number(channel.conversions)) }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Top Conversion Paths -->
            <div v-if="generatedReport.topPaths && generatedReport.topPaths.length > 0" class="p-6 border-t border-gray-200">
                <h5 class="font-semibold text-gray-800 mb-4">Top Conversion Paths</h5>
                <div class="space-y-3">
                    <div v-for="(path, idx) in generatedReport.topPaths" :key="idx" class="flex items-center gap-4">
                        <div class="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                            {{ (idx as number) + 1 }}
                        </div>
                        <div class="flex-1">
                            <p class="text-sm text-gray-800">{{ path.path }}</p>
                        </div>
                        <div class="flex-shrink-0 text-sm font-medium text-gray-700">
                            {{ path.conversions }} conversions
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Empty State -->
        <div v-if="!showForm && !generatedReport" class="text-center py-12">
            <div class="text-6xl mb-4">📊</div>
            <h4 class="text-lg font-semibold text-gray-800 mb-2">No Report Generated Yet</h4>
            <p class="text-gray-600 mb-4">Generate your first attribution report to analyze channel performance</p>
            <button
                @click="showForm = true"
                class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
                Generate Report
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
// Props
const props = defineProps<{
    projectId: number;
    dataModelId: number;
}>();

// State
const showForm = ref(false);
const isGenerating = ref(false);
const generatedReport = ref<any>(null);

// Get today's date for max date constraint
const today = computed(() => {
    const date = new Date();
    return date.toISOString().split('T')[0];
});

// Default to last 30 days
const defaultStartDate = computed(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
});

const reportParams = ref({
    startDate: defaultStartDate.value,
    endDate: today.value,
    attributionModel: 'first_touch',
    reportType: 'channel_performance'
});

// Form validation
const isFormValid = computed(() => {
    return reportParams.value.startDate && 
           reportParams.value.endDate && 
           reportParams.value.attributionModel && 
           reportParams.value.reportType;
});

// Helper functions
function getAuthToken(): string | null {
    if (import.meta.client) {
        return localStorage.getItem('jwt_token');
    }
    return null;
}

function formatNumber(value: number): string {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
    });
}

function formatHours(hours: number | null | undefined): string {
    if (!hours) return '0h';
    if (hours < 24) return `${hours.toFixed(1)}h`;
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    return `${days}d ${remainingHours}h`;
}

function getReportTitle(reportType: string): string {
    const titles: Record<string, string> = {
        'channel_performance': 'Channel Performance Report',
        'roi_report': 'ROI Analysis Report',
        'journey_map': 'Customer Journey Map',
        'funnel_analysis': 'Funnel Analysis Report'
    };
    return titles[reportType] || reportType;
}

function getModelName(model: string): string {
    const names: Record<string, string> = {
        'first_touch': 'First Touch Model',
        'last_touch': 'Last Touch Model',
        'linear': 'Linear Model',
        'time_decay': 'Time Decay Model',
        'u_shaped': 'U-Shaped Model'
    };
    return names[model] || model;
}

// Generate report
async function generateReport() {
    isGenerating.value = true;
    try {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Authentication required');
        }

        const config = useRuntimeConfig();
        const { $swal } = useNuxtApp() as any;

        const response = await $fetch(`${config.public.apiBase}/attribution/reports`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                projectId: props.projectId,
                reportType: reportParams.value.reportType,
                attributionModel: reportParams.value.attributionModel,
                startDate: reportParams.value.startDate,
                endDate: reportParams.value.endDate
            })
        });

        if (response && (response as any).success) {
            generatedReport.value = (response as any).data;
            showForm.value = false;
            
            await $swal.fire({
                title: 'Report Generated!',
                text: 'Your attribution report is ready.',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            throw new Error('Failed to generate report');
        }
    } catch (error) {
        console.error('Error generating report:', error);
        const { $swal } = useNuxtApp() as any;
        await $swal.fire({
            title: 'Error',
            text: error instanceof Error ? error.message : 'Failed to generate report',
            icon: 'error'
        });
    } finally {
        isGenerating.value = false;
    }
}

// Export to CSV
function exportToCSV() {
    if (!generatedReport.value || !generatedReport.value.channelBreakdown) return;

    // Build CSV content
    const headers = ['Channel', 'Conversions', 'Revenue', 'Average Value'];
    const rows = generatedReport.value.channelBreakdown.map((channel: any) => [
        channel.name,
        channel.conversions,
        channel.revenue,
        (Number(channel.revenue) / Number(channel.conversions)).toFixed(2)
    ]);

    let csvContent = headers.join(',') + '\n';
    rows.forEach((row: any[]) => {
        csvContent += row.join(',') + '\n';
    });

    // Add summary
    csvContent += '\nSummary\n';
    csvContent += `Total Conversions,${generatedReport.value.totalConversions}\n`;
    csvContent += `Total Revenue,${generatedReport.value.totalRevenue}\n`;
    csvContent += `Average Touchpoints,${generatedReport.value.avgTouchpointsPerConversion || 0}\n`;
    csvContent += `Average Time to Convert (hours),${generatedReport.value.avgTimeToConversionHours || 0}\n`;

    // Create download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `attribution_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function cancelForm() {
    showForm.value = false;
    // Reset to defaults
    reportParams.value = {
        startDate: defaultStartDate.value,
        endDate: today.value,
        attributionModel: 'first_touch',
        reportType: 'channel_performance'
    };
}
</script>
