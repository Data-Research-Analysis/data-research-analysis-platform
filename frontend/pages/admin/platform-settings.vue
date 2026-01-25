<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';

interface PlatformSetting {
    key: string;
    value: string;
    type: string;
    category: string;
    description: string;
    isEditable: boolean;
    updatedAt: string;
}

interface SettingsByCategory {
    [category: string]: PlatformSetting[];
}

interface ApiResponse<T = any> {
    success: boolean;
    data: T;
    message?: string;
}

const settings = ref<SettingsByCategory>({});
const activeCategory = ref<string>('retention');
const loading = ref(true);
const saving = ref<string | null>(null);
const error = ref<string | null>(null);
const successMessage = ref<string | null>(null);

const categories = computed(() => Object.keys(settings.value));

async function fetchSettings() {
    loading.value = true;
    error.value = null;
    
    try {
        const token = getAuthToken();
        const response = await $fetch<ApiResponse<SettingsByCategory>>(`${baseUrl()}/admin/platform-settings`, {
            method: 'GET',
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
        });
        
        if (response.success) {
            settings.value = response.data;
            // Set first category as active if none selected
            if (!activeCategory.value && categories.value.length > 0) {
                activeCategory.value = categories.value[0];
            }
        }
    } catch (err: any) {
        error.value = err.data?.message || 'Failed to load platform settings';
        console.error('Error fetching settings:', err);
    } finally {
        loading.value = false;
    }
}

async function updateSetting(setting: PlatformSetting, newValue: string | boolean) {
    saving.value = setting.key;
    error.value = null;
    successMessage.value = null;
    
    try {
        const token = getAuthToken();
        const response = await $fetch<ApiResponse<PlatformSetting>>(`${baseUrl()}/admin/platform-settings/${setting.key}`, {
            method: 'PUT',
            headers: {
                "Authorization": `Bearer ${token}`,
                "Authorization-Type": "auth",
            },
            body: { value: newValue },
        });
        
        if (response.success) {
            // Update local state
            setting.value = response.data.value;
            setting.updatedAt = response.data.updatedAt;
            successMessage.value = `${setting.key} updated successfully`;
            
            // Clear success message after 3 seconds
            setTimeout(() => {
                successMessage.value = null;
            }, 3000);
        }
    } catch (err: any) {
        error.value = err.data?.message || `Failed to update ${setting.key}`;
        console.error('Error updating setting:', err);
    } finally {
        saving.value = null;
    }
}

function getCategoryLabel(category: string): string {
    return category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ');
}

function formatValue(setting: PlatformSetting): string {
    if (setting.type === 'boolean') {
        return setting.value === 'true' ? 'Enabled' : 'Disabled';
    }
    return setting.value;
}

function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
}

onMounted(() => {
    fetchSettings();
});
</script>

<template>
    <div class="flex flex-row w-full min-h-screen bg-gray-50">
        <sidebar-admin class="w-1/6" />
        
        <div class="flex flex-col w-5/6 p-8">
            <!-- Header -->
            <div class="mb-8">
                <h1 class="text-3xl font-bold text-gray-800 mb-2">Platform Settings</h1>
                <p class="text-gray-600">Configure platform-wide settings for account retention, notifications, and security</p>
            </div>

            <!-- Success Message -->
            <div v-if="successMessage" class="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg flex items-center">
                <font-awesome icon="fas fa-check-circle" class="mr-2" />
                {{ successMessage }}
            </div>

            <!-- Error Message -->
            <div v-if="error" class="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center">
                <font-awesome icon="fas fa-exclamation-circle" class="mr-2" />
                {{ error }}
            </div>

            <!-- Loading State -->
            <div v-if="loading" class="flex justify-center items-center py-20">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>

            <!-- Category Tabs -->
            <div v-else class="bg-white rounded-lg shadow-md">
                <div class="border-b border-gray-200">
                    <div class="flex space-x-4 px-6">
                        <button
                            v-for="category in categories"
                            :key="category"
                            @click="activeCategory = category"
                            :class="[
                                'px-4 py-3 font-semibold border-b-2 transition-colors cursor-pointer',
                                activeCategory === category
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-600 hover:text-gray-800'
                            ]"
                        >
                            {{ getCategoryLabel(category) }}
                        </button>
                    </div>
                </div>

                <!-- Settings List -->
                <div class="p-6">
                    <div v-if="settings[activeCategory]" class="space-y-6">
                        <div
                            v-for="setting in settings[activeCategory]"
                            :key="setting.key"
                            class="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                        >
                            <div class="flex items-start justify-between">
                                <div class="flex-1">
                                    <div class="flex items-center mb-2">
                                        <h3 class="text-lg font-semibold text-gray-800">{{ setting.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) }}</h3>
                                        <span
                                            v-if="!setting.isEditable"
                                            class="ml-3 px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded"
                                        >
                                            Read Only
                                        </span>
                                    </div>
                                    <p class="text-sm text-gray-600 mb-3">{{ setting.description }}</p>
                                    
                                    <!-- Boolean Setting -->
                                    <div v-if="setting.type === 'boolean'" class="flex items-center space-x-3">
                                        <label class="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                :checked="setting.value === 'true'"
                                                @change="(e) => updateSetting(setting, (e.target as HTMLInputElement).checked)"
                                                :disabled="!setting.isEditable || saving === setting.key"
                                                class="sr-only peer"
                                            />
                                            <div class="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                        </label>
                                        <span class="text-sm font-medium text-gray-700">{{ formatValue(setting) }}</span>
                                    </div>

                                    <!-- Number Setting -->
                                    <div v-else-if="setting.type === 'number'" class="flex items-center space-x-3">
                                        <input
                                            type="number"
                                            :value="setting.value"
                                            @blur="(e) => updateSetting(setting, (e.target as HTMLInputElement).value)"
                                            @keyup.enter="(e) => updateSetting(setting, (e.target as HTMLInputElement).value)"
                                            :disabled="!setting.isEditable || saving === setting.key"
                                            :min="setting.key === 'data_retention_days' ? 1 : undefined"
                                            :max="setting.key === 'data_retention_days' ? 365 : undefined"
                                            class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                        />
                                        <span v-if="setting.key === 'data_retention_days'" class="text-sm text-gray-600">days (1-365)</span>
                                    </div>

                                    <!-- String Setting -->
                                    <div v-else class="flex items-center space-x-3">
                                        <input
                                            type="text"
                                            :value="setting.value"
                                            @blur="(e) => updateSetting(setting, (e.target as HTMLInputElement).value)"
                                            @keyup.enter="(e) => updateSetting(setting, (e.target as HTMLInputElement).value)"
                                            :disabled="!setting.isEditable || saving === setting.key"
                                            class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                        />
                                    </div>

                                    <p class="mt-2 text-xs text-gray-500">Last updated: {{ formatDate(setting.updatedAt) }}</p>
                                </div>

                                <!-- Saving Indicator -->
                                <div v-if="saving === setting.key" class="ml-4">
                                    <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div v-else class="text-center py-8 text-gray-500">
                        No settings available in this category
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Additional custom styles if needed */
</style>
