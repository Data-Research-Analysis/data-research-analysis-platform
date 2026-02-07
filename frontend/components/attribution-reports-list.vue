<template>
    <div class="space-y-6">
        <!-- Reports Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div
                v-for="report in reports"
                :key="report.id"
                class="bg-white rounded-lg shadow border border-gray-200 hover:shadow-lg transition-shadow duration-200 cursor-pointer"
                @click="emit('view', report)"
            >
                <div class="p-6">
                    <!-- Report Header -->
                    <div class="flex items-start justify-between mb-4">
                        <div class="flex-1">
                            <h3 class="text-lg font-semibold text-gray-800 mb-1">
                                {{ report.reportName }}
                            </h3>
                            <p class="text-sm text-gray-500">
                                {{ formatDateRange(report.dateRangeStart, report.dateRangeEnd) }}
                            </p>
                        </div>
                        <button
                            @click.stop="emit('delete', report.id)"
                            class="text-gray-400 hover:text-red-600 transition-colors duration-200 p-1"
                            title="Delete report"
                        >
                            🗑️
                        </button>
                    </div>

                    <!-- Attribution Model Badge -->
                    <div class="mb-4">
                        <span class="px-2 py-1 text-xs font-medium rounded-full" :class="getModelBadgeClass(report.attributionModel)">
                            {{ getModelLabel(report.attributionModel) }}
                        </span>
                    </div>

                    <!-- Key Metrics -->
                    <div class="space-y-3">
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-600">Conversions</span>
                            <span class="text-lg font-bold text-gray-900">
                                {{ report.totalConversions.toLocaleString() }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-600">Revenue</span>
                            <span class="text-lg font-bold text-green-600">
                                ${{ report.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
                            </span>
                        </div>
                        <div v-if="report.avgConversionRate" class="flex items-center justify-between">
                            <span class="text-sm text-gray-600">Conversion Rate</span>
                            <span class="text-lg font-bold text-blue-600">
                                {{ report.avgConversionRate.toFixed(2) }}%
                            </span>
                        </div>
                    </div>

                    <!-- Top Channels Preview -->
                    <div v-if="report.channelBreakdown && report.channelBreakdown.length > 0" class="mt-4 pt-4 border-t border-gray-200">
                        <p class="text-xs font-medium text-gray-600 mb-2">Top Channels:</p>
                        <div class="space-y-1">
                            <div
                                v-for="channel in report.channelBreakdown.slice(0, 3)"
                                :key="channel.channelName"
                                class="flex items-center justify-between text-xs"
                            >
                                <span class="text-gray-700 truncate">{{ channel.channelName }}</span>
                                <span class="text-gray-900 font-medium">
                                    ${{ channel.revenue.toLocaleString('en-US', { minimumFractionDigits: 0 }) }}
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Report Metadata -->
                    <div class="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
                        <span>Created {{ formatDate(report.createdAt) }}</span>
                        <button
                            @click.stop="emit('view', report)"
                            class="text-blue-600 hover:text-blue-700 font-medium"
                        >
                            View Details →
                        </button>
                    </div>
                </div>
            </div>

            <!-- Generate New Report Card -->
            <button
                @click="emit('generate')"
                class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow hover:shadow-lg transition-shadow duration-200 p-6 text-white flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-blue-400 hover:border-blue-300"
            >
                <div class="text-6xl mb-4">📊</div>
                <h3 class="text-xl font-semibold mb-2">Generate New Report</h3>
                <p class="text-sm opacity-90">Create an attribution analysis report</p>
            </button>
        </div>

        <!-- Empty State -->
        <div v-if="reports.length === 0 && !loading" class="bg-white rounded-lg shadow p-12 text-center">
            <div class="text-6xl mb-4">📊</div>
            <h3 class="text-xl font-semibold text-gray-800 mb-2">No Reports Yet</h3>
            <p class="text-gray-600 mb-6">
                Generate your first attribution report to analyze marketing performance
            </p>
            <button
                @click="emit('generate')"
                class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 inline-flex items-center gap-2"
            >
                <span>📊</span>
                <span>Generate Report</span>
            </button>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="flex items-center justify-center py-12">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { IAttributionReport, AttributionModel } from '~/stores/attribution';

interface Props {
    reports: IAttributionReport[];
    loading?: boolean;
}

interface Emits {
    (e: 'view', report: IAttributionReport): void;
    (e: 'delete', reportId: number): void;
    (e: 'generate'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

function getModelLabel(model: AttributionModel): string {
    const labels: Record<AttributionModel, string> = {
        'first_touch': 'First Touch',
        'last_touch': 'Last Touch',
        'linear': 'Linear',
        'time_decay': 'Time Decay',
        'u_shaped': 'U-Shaped'
    };
    return labels[model] || model;
}

function getModelBadgeClass(model: AttributionModel): string {
    const classes: Record<AttributionModel, string> = {
        'first_touch': 'bg-blue-100 text-blue-800',
        'last_touch': 'bg-green-100 text-green-800',
        'linear': 'bg-purple-100 text-purple-800',
        'time_decay': 'bg-orange-100 text-orange-800',
        'u_shaped': 'bg-pink-100 text-pink-800'
    };
    return classes[model] || 'bg-gray-100 text-gray-800';
}

function formatDateRange(start: string, end: string): string {
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}
</script>
