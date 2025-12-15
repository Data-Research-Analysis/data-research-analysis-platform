<template>
    <div class="advanced-sync-config">
        <!-- Advanced Configuration Toggle -->
        <div class="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <button
                @click="toggleAdvancedConfig"
                class="flex items-center justify-between w-full text-left"
                type="button"
            >
                <span class="font-semibold text-gray-900">
                    {{ showAdvancedConfig ? '▼' : '▶' }} Advanced Configuration
                </span>
                <span class="text-sm text-gray-600">
                    {{ showAdvancedConfig ? 'Hide' : 'Show' }} advanced options
                </span>
            </button>
        </div>

        <!-- Advanced Configuration Options -->
        <div v-if="showAdvancedConfig" class="space-y-6 animate-fade-in">
            <!-- Date Range Presets -->
            <div>
                <label class="block text-sm font-semibold text-gray-800 mb-2">
                    Date Range Preset *
                </label>
                <select
                    v-model="localConfig.dateRangePreset"
                    @change="onDatePresetChange"
                    class="w-full px-4 py-3 text-base border-2 border-gray-300 rounded-lg transition-all duration-200 focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                >
                    <option
                        v-for="preset in datePresets"
                        :key="preset.id"
                        :value="preset.id"
                    >
                        {{ preset.label }} - {{ preset.description }}
                    </option>
                </select>
                <small v-if="selectedPresetDates" class="block mt-1 text-xs text-gray-600">
                    {{ formatDate(selectedPresetDates.startDate) }} to {{ formatDate(selectedPresetDates.endDate) }}
                </small>
            </div>

            <!-- Custom Date Range (if custom preset selected) -->
            <div v-if="localConfig.dateRangePreset === 'custom'" class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-semibold text-gray-800 mb-2">
                        Custom Start Date *
                    </label>
                    <input
                        v-model="localConfig.startDate"
                        type="date"
                        class="w-full px-4 py-3 text-base border-2 border-gray-300 rounded-lg transition-all duration-200 focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                    />
                </div>
                <div>
                    <label class="block text-sm font-semibold text-gray-800 mb-2">
                        Custom End Date *
                    </label>
                    <input
                        v-model="localConfig.endDate"
                        type="date"
                        class="w-full px-4 py-3 text-base border-2 border-gray-300 rounded-lg transition-all duration-200 focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                    />
                </div>
            </div>

            <!-- Report Field Configuration -->
            <div v-if="localConfig.reportTypes.length > 0">
                <label class="block text-sm font-semibold text-gray-800 mb-2">
                    Custom Report Fields
                </label>
                <div class="space-y-4">
                    <div
                        v-for="reportType in localConfig.reportTypes"
                        :key="reportType"
                        class="p-4 border-2 border-gray-200 rounded-lg"
                    >
                        <h4 class="font-semibold text-gray-900 mb-3">
                            {{ getReportTypeName(reportType) }}
                        </h4>

                        <!-- Dimensions -->
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                Dimensions
                            </label>
                            <div class="space-y-2">
                                <label
                                    v-for="dimension in getAvailableDimensions(reportType)"
                                    :key="dimension"
                                    class="flex items-center gap-2"
                                >
                                    <input
                                        type="checkbox"
                                        :checked="isDimensionSelected(reportType, dimension)"
                                        @change="toggleDimension(reportType, dimension)"
                                        class="cursor-pointer"
                                    />
                                    <span class="text-sm text-gray-700">{{ formatFieldName(dimension) }}</span>
                                </label>
                            </div>
                        </div>

                        <!-- Metrics -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                Metrics
                            </label>
                            <div class="space-y-2">
                                <label
                                    v-for="metric in getAvailableMetrics(reportType)"
                                    :key="metric"
                                    class="flex items-center gap-2"
                                >
                                    <input
                                        type="checkbox"
                                        :checked="isMetricSelected(reportType, metric)"
                                        @change="toggleMetric(reportType, metric)"
                                        class="cursor-pointer"
                                    />
                                    <span class="text-sm text-gray-700">{{ formatFieldName(metric) }}</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Sync Frequency -->
            <div>
                <label class="block text-sm font-semibold text-gray-800 mb-2">
                    Sync Frequency
                </label>
                <select
                    v-model="localConfig.frequency.type"
                    @change="onFrequencyTypeChange"
                    class="w-full px-4 py-3 text-base border-2 border-gray-300 rounded-lg transition-all duration-200 focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                >
                    <option value="manual">Manual (on demand)</option>
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                </select>

                <!-- Frequency Details -->
                <div v-if="localConfig.frequency.type === 'hourly'" class="mt-3">
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        Every X hours
                    </label>
                    <input
                        v-model.number="localConfig.frequency.interval"
                        type="number"
                        min="1"
                        max="24"
                        class="w-full px-4 py-3 text-base border-2 border-gray-300 rounded-lg"
                    />
                </div>

                <div v-if="localConfig.frequency.type === 'daily'" class="mt-3 grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Hour (0-23)</label>
                        <input
                            v-model.number="localConfig.frequency.hour"
                            type="number"
                            min="0"
                            max="23"
                            class="w-full px-4 py-3 text-base border-2 border-gray-300 rounded-lg"
                        />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Minute (0-59)</label>
                        <input
                            v-model.number="localConfig.frequency.minute"
                            type="number"
                            min="0"
                            max="59"
                            class="w-full px-4 py-3 text-base border-2 border-gray-300 rounded-lg"
                        />
                    </div>
                </div>

                <div v-if="localConfig.frequency.type === 'weekly'" class="mt-3 grid grid-cols-3 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Day of Week</label>
                        <select
                            v-model.number="localConfig.frequency.dayOfWeek"
                            class="w-full px-4 py-3 text-base border-2 border-gray-300 rounded-lg"
                        >
                            <option :value="0">Sunday</option>
                            <option :value="1">Monday</option>
                            <option :value="2">Tuesday</option>
                            <option :value="3">Wednesday</option>
                            <option :value="4">Thursday</option>
                            <option :value="5">Friday</option>
                            <option :value="6">Saturday</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Hour (0-23)</label>
                        <input
                            v-model.number="localConfig.frequency.hour"
                            type="number"
                            min="0"
                            max="23"
                            class="w-full px-4 py-3 text-base border-2 border-gray-300 rounded-lg"
                        />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Minute (0-59)</label>
                        <input
                            v-model.number="localConfig.frequency.minute"
                            type="number"
                            min="0"
                            max="59"
                            class="w-full px-4 py-3 text-base border-2 border-gray-300 rounded-lg"
                        />
                    </div>
                </div>

                <div v-if="localConfig.frequency.type === 'monthly'" class="mt-3 grid grid-cols-3 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Day of Month</label>
                        <input
                            v-model.number="localConfig.frequency.dayOfMonth"
                            type="number"
                            min="1"
                            max="31"
                            class="w-full px-4 py-3 text-base border-2 border-gray-300 rounded-lg"
                        />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Hour (0-23)</label>
                        <input
                            v-model.number="localConfig.frequency.hour"
                            type="number"
                            min="0"
                            max="23"
                            class="w-full px-4 py-3 text-base border-2 border-gray-300 rounded-lg"
                        />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Minute (0-59)</label>
                        <input
                            v-model.number="localConfig.frequency.minute"
                            type="number"
                            min="0"
                            max="59"
                            class="w-full px-4 py-3 text-base border-2 border-gray-300 rounded-lg"
                        />
                    </div>
                </div>

                <small v-if="localConfig.frequency.type !== 'manual'" class="block mt-2 text-xs text-gray-600">
                    Schedule: {{ formatFrequency(localConfig.frequency) }}
                </small>
            </div>

            <!-- Sync Options -->
            <div class="space-y-3">
                <label class="flex items-center gap-2 cursor-pointer">
                    <input
                        v-model="localConfig.incrementalSync"
                        type="checkbox"
                        class="cursor-pointer"
                    />
                    <span class="text-sm text-gray-700">Enable Incremental Sync</span>
                </label>

                <label class="flex items-center gap-2 cursor-pointer">
                    <input
                        v-model="localConfig.deduplication"
                        type="checkbox"
                        class="cursor-pointer"
                    />
                    <span class="text-sm text-gray-700">Enable Data Deduplication</span>
                </label>

                <label class="flex items-center gap-2 cursor-pointer">
                    <input
                        v-model="localConfig.dataValidation"
                        type="checkbox"
                        class="cursor-pointer"
                    />
                    <span class="text-sm text-gray-700">Enable Data Validation</span>
                </label>
            </div>

            <!-- Max Records -->
            <div>
                <label class="block text-sm font-semibold text-gray-800 mb-2">
                    Max Records Per Report
                </label>
                <input
                    v-model.number="localConfig.maxRecordsPerReport"
                    type="number"
                    min="100"
                    max="1000000"
                    step="100"
                    class="w-full px-4 py-3 text-base border-2 border-gray-300 rounded-lg transition-all duration-200 focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
                />
                <small class="block mt-1 text-xs text-gray-600">
                    Limit the number of records fetched per report (100-1,000,000)
                </small>
            </div>

            <!-- Notifications -->
            <div class="space-y-3">
                <h4 class="font-semibold text-gray-900">Email Notifications</h4>

                <label class="flex items-center gap-2 cursor-pointer">
                    <input
                        v-model="localConfig.notifyOnComplete"
                        type="checkbox"
                        class="cursor-pointer"
                    />
                    <span class="text-sm text-gray-700">Notify on sync completion</span>
                </label>

                <label class="flex items-center gap-2 cursor-pointer">
                    <input
                        v-model="localConfig.notifyOnFailure"
                        type="checkbox"
                        class="cursor-pointer"
                    />
                    <span class="text-sm text-gray-700">Notify on sync failure</span>
                </label>

                <div v-if="localConfig.notifyOnComplete || localConfig.notifyOnFailure" class="mt-3">
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        Notification Emails
                    </label>
                    <div class="space-y-2">
                        <div
                            v-for="(email, index) in localConfig.notificationEmails"
                            :key="index"
                            class="flex gap-2"
                        >
                            <input
                                v-model="localConfig.notificationEmails[index]"
                                type="email"
                                placeholder="email@example.com"
                                class="flex-1 px-4 py-2 text-base border-2 border-gray-300 rounded-lg"
                            />
                            <button
                                @click="removeEmail(index)"
                                type="button"
                                class="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                            >
                                ✕
                            </button>
                        </div>
                        <button
                            @click="addEmail"
                            type="button"
                            class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                        >
                            + Add Email
                        </button>
                    </div>
                </div>
            </div>

            <!-- Validation Errors -->
            <div v-if="validationErrors.length > 0" class="p-4 bg-red-50 border border-red-200 rounded-lg">
                <h4 class="font-semibold text-red-900 mb-2">Configuration Errors:</h4>
                <ul class="list-disc list-inside space-y-1">
                    <li v-for="(error, index) in validationErrors" :key="index" class="text-sm text-red-700">
                        {{ error }}
                    </li>
                </ul>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useAdvancedSyncConfig, type AdvancedSyncConfig, type SyncFrequency } from '~/composables/useAdvancedSyncConfig';

const props = defineProps<{
    modelValue: AdvancedSyncConfig;
    reportTypes: string[];
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: AdvancedSyncConfig): void;
}>();

const advancedConfig = useAdvancedSyncConfig();
const showAdvancedConfig = ref(false);
const validationErrors = ref<string[]>([]);
const localConfig = ref<AdvancedSyncConfig>({ ...props.modelValue });

// Initialize
onMounted(async () => {
    await advancedConfig.initialize();
});

// Computed
const datePresets = computed(() => advancedConfig.datePresets.value);
const selectedPresetDates = computed(() => {
    if (localConfig.value.dateRangePreset) {
        return advancedConfig.getDatesForPreset(localConfig.value.dateRangePreset);
    }
    return null;
});

// Watch for changes and emit
watch(localConfig, (newValue) => {
    emit('update:modelValue', newValue);
    validateConfiguration();
}, { deep: true });

// Watch for report types changes from parent
watch(() => props.reportTypes, (newTypes) => {
    localConfig.value.reportTypes = newTypes;
});

// Methods
function toggleAdvancedConfig() {
    showAdvancedConfig.value = !showAdvancedConfig.value;
}

function onDatePresetChange() {
    if (localConfig.value.dateRangePreset !== 'custom') {
        const dates = advancedConfig.getDatesForPreset(localConfig.value.dateRangePreset || '');
        if (dates) {
            localConfig.value.startDate = dates.startDate;
            localConfig.value.endDate = dates.endDate;
        }
    }
}

function onFrequencyTypeChange() {
    // Reset frequency details when type changes
    if (!localConfig.value.frequency) {
        localConfig.value.frequency = { type: 'manual' };
    }

    if (localConfig.value.frequency.type === 'hourly') {
        localConfig.value.frequency.interval = 1;
    } else if (localConfig.value.frequency.type === 'daily') {
        localConfig.value.frequency.hour = 0;
        localConfig.value.frequency.minute = 0;
    } else if (localConfig.value.frequency.type === 'weekly') {
        localConfig.value.frequency.dayOfWeek = 1;
        localConfig.value.frequency.hour = 0;
        localConfig.value.frequency.minute = 0;
    } else if (localConfig.value.frequency.type === 'monthly') {
        localConfig.value.frequency.dayOfMonth = 1;
        localConfig.value.frequency.hour = 0;
        localConfig.value.frequency.minute = 0;
    }
}

function getReportTypeName(reportType: string): string {
    const names: Record<string, string> = {
        revenue: 'Revenue Report',
        inventory: 'Inventory Report',
        orders: 'Orders Report',
        geography: 'Geography Report',
        device: 'Device Report'
    };
    return names[reportType] || reportType;
}

function getAvailableDimensions(reportType: string): string[] {
    return advancedConfig.getDimensionsForReport(reportType);
}

function getAvailableMetrics(reportType: string): string[] {
    return advancedConfig.getMetricsForReport(reportType);
}

function isDimensionSelected(reportType: string, dimension: string): boolean {
    const config = localConfig.value.reportFieldConfigs?.find(c => c.reportType === reportType);
    return config?.dimensions.includes(dimension) || false;
}

function isMetricSelected(reportType: string, metric: string): boolean {
    const config = localConfig.value.reportFieldConfigs?.find(c => c.reportType === reportType);
    return config?.metrics.includes(metric) || false;
}

function toggleDimension(reportType: string, dimension: string) {
    if (!localConfig.value.reportFieldConfigs) {
        localConfig.value.reportFieldConfigs = [];
    }

    let config = localConfig.value.reportFieldConfigs.find(c => c.reportType === reportType);
    if (!config) {
        config = { reportType, dimensions: [], metrics: [] };
        localConfig.value.reportFieldConfigs.push(config);
    }

    const index = config.dimensions.indexOf(dimension);
    if (index > -1) {
        config.dimensions.splice(index, 1);
    } else {
        config.dimensions.push(dimension);
    }
}

function toggleMetric(reportType: string, metric: string) {
    if (!localConfig.value.reportFieldConfigs) {
        localConfig.value.reportFieldConfigs = [];
    }

    let config = localConfig.value.reportFieldConfigs.find(c => c.reportType === reportType);
    if (!config) {
        config = { reportType, dimensions: [], metrics: [] };
        localConfig.value.reportFieldConfigs.push(config);
    }

    const index = config.metrics.indexOf(metric);
    if (index > -1) {
        config.metrics.splice(index, 1);
    } else {
        config.metrics.push(metric);
    }
}

function formatFieldName(field: string): string {
    return field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatFrequency(frequency: SyncFrequency): string {
    return advancedConfig.formatFrequency(frequency);
}

function addEmail() {
    if (!localConfig.value.notificationEmails) {
        localConfig.value.notificationEmails = [];
    }
    localConfig.value.notificationEmails.push('');
}

function removeEmail(index: number) {
    localConfig.value.notificationEmails?.splice(index, 1);
}

async function validateConfiguration() {
    const result = await advancedConfig.validateConfig(localConfig.value);
    validationErrors.value = result.errors;
}
</script>

<style scoped>
.animate-fade-in {
    animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>
