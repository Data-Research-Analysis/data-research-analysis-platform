<template>
    <div class="gam-export-panel">
        <div class="export-header">
            <h3 class="text-lg font-semibold text-gray-900">Export Data</h3>
            <p class="text-sm text-gray-600 mt-1">Export your Google Ad Manager data in various formats</p>
        </div>

        <!-- Export Form -->
        <div class="export-form mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- Format Selection -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Export Format *</label>
                    <select
                        v-model="exportOptions.format"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="csv">CSV</option>
                        <option value="json">JSON</option>
                        <option value="xlsx">Excel (XLSX)</option>
                    </select>
                </div>

                <!-- Report Type -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Report Type *</label>
                    <select
                        v-model="exportOptions.reportType"
                        @change="onReportTypeChange"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="revenue">Revenue</option>
                        <option value="inventory">Inventory</option>
                        <option value="orders">Orders</option>
                        <option value="geography">Geography</option>
                        <option value="device">Device</option>
                    </select>
                </div>

                <!-- Date Range -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                    <input
                        v-model="exportOptions.startDate"
                        type="date"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                    <input
                        v-model="exportOptions.endDate"
                        type="date"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                <!-- Max Records -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Max Records</label>
                    <input
                        v-model.number="exportOptions.limit"
                        type="number"
                        min="1"
                        max="1000000"
                        placeholder="All records"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                <!-- Include Headers -->
                <div class="flex items-center">
                    <label class="flex items-center cursor-pointer">
                        <input
                            v-model="exportOptions.includeHeaders"
                            type="checkbox"
                            class="mr-2 cursor-pointer"
                        />
                        <span class="text-sm text-gray-700">Include column headers</span>
                    </label>
                </div>
            </div>

            <!-- Column Selection -->
            <div v-if="availableColumns.length > 0" class="mt-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Select Columns (optional)</label>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-2 bg-white rounded border border-gray-200">
                    <label
                        v-for="column in availableColumns"
                        :key="column"
                        class="flex items-center text-sm cursor-pointer"
                    >
                        <input
                            type="checkbox"
                            :checked="isColumnSelected(column)"
                            @change="toggleColumn(column)"
                            class="mr-2 cursor-pointer"
                        />
                        <span>{{ formatColumnName(column) }}</span>
                    </label>
                </div>
                <small class="text-xs text-gray-500 mt-1">Leave unselected to export all columns</small>
            </div>

            <!-- Export Button -->
            <div class="mt-4 flex items-center gap-3">
                <button
                    @click="handleExport"
                    :disabled="gamExport.isExporting.value"
                    class="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {{ gamExport.isExporting.value ? 'Exporting...' : 'Export Data' }}
                </button>

                <div v-if="gamExport.isExporting.value" class="flex items-center gap-2">
                    <div class="w-32 bg-gray-200 rounded-full h-2">
                        <div
                            class="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                            :style="{ width: `${gamExport.exportProgress.value}%` }"
                        ></div>
                    </div>
                    <span class="text-sm text-gray-600">{{ gamExport.exportProgress.value }}%</span>
                </div>
            </div>

            <!-- Error Message -->
            <div v-if="gamExport.error.value" class="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                <p class="text-sm text-red-700">{{ gamExport.error.value }}</p>
            </div>
        </div>

        <!-- Export History -->
        <div class="export-history mt-8">
            <div class="flex items-center justify-between mb-4">
                <h4 class="text-md font-semibold text-gray-900">Recent Exports</h4>
                <button
                    @click="loadExportHistory"
                    class="text-sm text-indigo-600 hover:text-indigo-700"
                >
                    🔄 Refresh
                </button>
            </div>

            <div v-if="gamExport.exportHistory.value.length === 0" class="text-center py-8 text-gray-500">
                No exports yet. Create your first export above.
            </div>

            <div v-else class="space-y-2">
                <div
                    v-for="entry in gamExport.exportHistory.value"
                    :key="entry.id"
                    class="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                    <div class="flex-1">
                        <div class="flex items-center gap-2">
                            <span class="text-lg">{{ gamExport.getFormatIcon(entry.format) }}</span>
                            <div>
                                <p class="text-sm font-medium text-gray-900">
                                    {{ entry.reportType }} Report - {{ gamExport.getFormatName(entry.format) }}
                                </p>
                                <p class="text-xs text-gray-500">
                                    {{ gamExport.formatDate(entry.createdAt) }} • 
                                    {{ gamExport.formatFileSize(entry.fileSize) }} • 
                                    {{ entry.recordCount.toLocaleString() }} records
                                </p>
                            </div>
                        </div>
                        <div v-if="entry.status === 'failed'" class="mt-1">
                            <span class="text-xs text-red-600">❌ {{ entry.error }}</span>
                        </div>
                    </div>

                    <div v-if="entry.status === 'completed'" class="flex items-center gap-2">
                        <button
                            @click="handleDownload(entry.fileName)"
                            class="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                        >
                            ⬇️ Download
                        </button>
                        <button
                            @click="handleDelete(entry.fileName)"
                            class="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                        >
                            🗑️
                        </button>
                    </div>

                    <div v-else-if="entry.status === 'pending'" class="text-sm text-gray-500">
                        ⏳ Processing...
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useGAMExport, type ExportFormat, type ExportOptions } from '@/composables/useGAMExport';

const props = defineProps<{
    dataSourceId: number;
    networkCode: string;
}>();

const gamExport = useGAMExport();

const exportOptions = reactive<ExportOptions>({
    dataSourceId: props.dataSourceId,
    format: 'csv' as ExportFormat,
    reportType: 'revenue',
    networkCode: props.networkCode,
    includeHeaders: true
});

const availableColumns = ref<string[]>([]);
const selectedColumns = ref<string[]>([]);

onMounted(async () => {
    await loadExportHistory();
    await loadAvailableColumns();
});

async function loadExportHistory() {
    await gamExport.fetchExportHistory(props.dataSourceId);
}

async function loadAvailableColumns() {
    availableColumns.value = await gamExport.getAvailableColumns(
        exportOptions.reportType,
        props.networkCode
    );
}

async function onReportTypeChange() {
    selectedColumns.value = [];
    await loadAvailableColumns();
}

function isColumnSelected(column: string): boolean {
    return selectedColumns.value.includes(column);
}

function toggleColumn(column: string) {
    const index = selectedColumns.value.indexOf(column);
    if (index > -1) {
        selectedColumns.value.splice(index, 1);
    } else {
        selectedColumns.value.push(column);
    }
}

function formatColumnName(column: string): string {
    return column
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

async function handleExport() {
    const options = {
        ...exportOptions,
        columns: selectedColumns.value.length > 0 ? selectedColumns.value : undefined
    };

    const result = await gamExport.createExport(options);

    if (result.success) {
        // Automatically download the file
        if (result.fileName) {
            await gamExport.downloadExport(result.fileName);
        }
        
        // Reload history
        await loadExportHistory();
        
        // Show success message (you can use a toast/notification library)
        alert(`Export successful! ${result.recordCount} records exported.`);
    }
}

async function handleDownload(fileName: string) {
    await gamExport.downloadExport(fileName);
}

async function handleDelete(fileName: string) {
    if (confirm('Are you sure you want to delete this export?')) {
        const deleted = await gamExport.deleteExport(fileName);
        if (deleted) {
            await loadExportHistory();
        }
    }
}
</script>

<style scoped>
.gam-export-panel {
    @apply w-full;
}
</style>
