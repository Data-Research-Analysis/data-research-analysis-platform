<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRuntimeConfig } from '#app';

const config = useRuntimeConfig();

// State
const activeTab = ref<'overview' | 'channels' | 'journeys' | 'insights'>('overview');
const selectedModel = ref<'first_touch' | 'last_touch' | 'linear' | 'time_decay' | 'u_shaped'>('last_touch');
const dateRange = ref<'7d' | '30d' | '90d'>('30d');
const loading = ref(false);
const error = ref<string | null>(null);

// Data
const channelPerformance = ref<any[]>([]);
const conversionPaths = ref<any[]>([]);
const aiInsights = ref<string>('');

// Attribution model descriptions
const modelDescriptions = {
    first_touch: 'Credits 100% to the first touchpoint that introduced the customer',
    last_touch: 'Credits 100% to the last touchpoint before conversion',
    linear: 'Distributes credit equally across all touchpoints',
    time_decay: 'More credit to touchpoints closer to conversion',
    u_shaped: '40% first + 40% last + 20% distributed to middle touchpoints'
};

// Mock data for display
onMounted(() => {
    loadAttributionData();
});

async function loadAttributionData() {
    loading.value = true;
    error.value = null;
    
    try {
        // TODO: Replace with actual API call
        // const response = await $fetch(`${config.public.apiBase}/attribution/report`, {
        //     method: 'GET',
        //     params: {
        //         model: selectedModel.value,
        //         dateRange: dateRange.value
        //     },
        //     credentials: 'include'
        // });
        
        // Mock data for now
        channelPerformance.value = [
            { channel: 'Organic Search', conversions: 450, revenue: 45000, avgTouch: 2.3 },
            { channel: 'Paid Search', conversions: 320, revenue: 38000, avgTouch: 1.8 },
            { channel: 'Social Media', conversions: 280, revenue: 22000, avgTouch: 3.1 },
            { channel: 'Email', conversions: 190, revenue: 28000, avgTouch: 1.5 },
            { channel: 'Direct', conversions: 150, revenue: 18000, avgTouch: 1.2 },
            { channel: 'Referral', conversions: 90, revenue: 12000, avgTouch: 2.7 }
        ];
        
        conversionPaths.value = [
            { path: ['Organic Search', 'Email', 'Direct'], conversions: 120, revenue: 15000 },
            { path: ['Paid Search', 'Direct'], conversions: 95, revenue: 12000 },
            { path: ['Social Media', 'Organic Search', 'Direct'], conversions: 78, revenue: 9500 },
            { path: ['Email', 'Direct'], conversions: 65, revenue: 9000 },
            { path: ['Organic Search', 'Direct'], conversions: 52, revenue: 6500 }
        ];
        
    } catch (err: any) {
        error.value = err.message || 'Failed to load attribution data';
    } finally {
        loading.value = false;
    }
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0
    }).format(value);
}

function getChannelColor(index: number): string {
    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];
    return colors[index % colors.length];
}
</script>

<template>
    <div class="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-gray-50 to-white">
        <!-- Header -->
        <div class="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
            <div class="flex items-center justify-between mb-4">
                <div>
                    <h3 class="text-lg font-semibold text-gray-800">Marketing Attribution</h3>
                    <p class="text-sm text-gray-600 mt-1">Multi-channel attribution analysis and insights</p>
                </div>
                
                <!-- Date Range Selector -->
                <div class="flex items-center gap-2">
                    <button 
                        v-for="range in ['7d', '30d', '90d']"
                        :key="range"
                        @click="dateRange = range as any; loadAttributionData()"
                        :class="dateRange === range ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
                        class="px-3 py-1.5 text-xs font-medium rounded transition-colors"
                    >
                        {{ range === '7d' ? 'Last 7 Days' : range === '30d' ? 'Last 30 Days' : 'Last 90 Days' }}
                    </button>
                </div>
            </div>
            
            <!-- Attribution Model Selector -->
            <div class="flex items-center gap-2">
                <span class="text-xs font-medium text-gray-600">Attribution Model:</span>
                <div class="flex gap-1">
                    <button 
                        v-for="model in ['first_touch', 'last_touch', 'linear', 'time_decay', 'u_shaped']"
                        :key="model"
                        @click="selectedModel = model as any; loadAttributionData()"
                        :class="selectedModel === model ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'"
                        :title="modelDescriptions[model as keyof typeof modelDescriptions]"
                        class="px-3 py-1 text-xs font-medium rounded transition-colors"
                    >
                        {{ model.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') }}
                    </button>
                </div>
            </div>
            
            <p class="text-xs text-gray-500 mt-2">
                {{ modelDescriptions[selectedModel] }}
            </p>
        </div>
        
        <!-- Tab Navigation -->
        <div class="flex-shrink-0 flex border-b border-gray-200 bg-white px-6">
            <button 
                @click="activeTab = 'overview'"
                :class="activeTab === 'overview' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-800'"
                class="px-4 py-3 font-medium text-sm transition-colors"
            >
                Overview
            </button>
            <button 
                @click="activeTab = 'channels'"
                :class="activeTab === 'channels' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-800'"
                class="px-4 py-3 font-medium text-sm transition-colors"
            >
                Channel Performance
            </button>
            <button 
                @click="activeTab = 'journeys'"
                :class="activeTab === 'journeys' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-800'"
                class="px-4 py-3 font-medium text-sm transition-colors"
            >
                Customer Journeys
            </button>
            <button 
                @click="activeTab = 'insights'"
                :class="activeTab === 'insights' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-800'"
                class="px-4 py-3 font-medium text-sm transition-colors"
            >
                AI Insights
            </button>
        </div>
        
        <!-- Content Area -->
        <div class="flex-1 overflow-y-auto p-6">
            <!-- Loading State -->
            <div v-if="loading" class="flex items-center justify-center h-64">
                <div class="text-center">
                    <div class="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                    <p class="mt-4 text-gray-500 text-sm">Loading attribution data...</p>
                </div>
            </div>
            
            <!-- Error State -->
            <div v-else-if="error" class="flex items-center justify-center h-64">
                <div class="text-center">
                    <div class="text-red-600 text-4xl mb-4">⚠️</div>
                    <p class="text-gray-700 font-medium">{{ error }}</p>
                    <button 
                        @click="loadAttributionData"
                        class="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
            
            <!-- Overview Tab -->
            <div v-else-if="activeTab === 'overview'" class="space-y-6">
                <!-- Key Metrics -->
                <div class="grid grid-cols-4 gap-4">
                    <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                        <div class="text-2xl font-bold text-gray-800">1,480</div>
                        <div class="text-xs text-gray-600 mt-1">Total Conversions</div>
                        <div class="text-xs text-green-600 mt-2">↑ 12.5%</div>
                    </div>
                    <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                        <div class="text-2xl font-bold text-gray-800">$163,000</div>
                        <div class="text-xs text-gray-600 mt-1">Total Revenue</div>
                        <div class="text-xs text-green-600 mt-2">↑ 18.3%</div>
                    </div>
                    <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                        <div class="text-2xl font-bold text-gray-800">$110</div>
                        <div class="text-xs text-gray-600 mt-1">Avg Order Value</div>
                        <div class="text-xs text-green-600 mt-2">↑ 5.2%</div>
                    </div>
                    <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                        <div class="text-2xl font-bold text-gray-800">2.1</div>
                        <div class="text-xs text-gray-600 mt-1">Avg Touchpoints</div>
                        <div class="text-xs text-gray-600 mt-2">→ 0.0%</div>
                    </div>
                </div>
                
                <!-- Channel Performance Chart -->
                <div class="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                    <h4 class="text-sm font-semibold text-gray-800 mb-4">Channel Performance</h4>
                    <div class="space-y-3">
                        <div 
                            v-for="(channel, index) in channelPerformance"
                            :key="channel.channel"
                            class="flex items-center gap-4"
                        >
                            <div class="w-32 text-sm font-medium text-gray-700">{{ channel.channel }}</div>
                            <div class="flex-1">
                                <div class="relative h-8 bg-gray-100 rounded overflow-hidden">
                                    <div 
                                        :class="getChannelColor(index)"
                                        :style="{ width: `${(channel.revenue / 45000) * 100}%` }"
                                        class="absolute inset-y-0 left-0 flex items-center justify-end pr-2 transition-all duration-500"
                                    >
                                        <span class="text-xs font-semibold text-white">{{ formatCurrency(channel.revenue) }}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="w-20 text-right text-sm text-gray-600">{{ channel.conversions }} conv</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Channel Performance Tab -->
            <div v-else-if="activeTab === 'channels'" class="space-y-4">
                <div class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    <table class="w-full">
                        <thead class="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Channel</th>
                                <th class="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Conversions</th>
                                <th class="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Revenue</th>
                                <th class="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Avg Touchpoints</th>
                                <th class="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">ROAS</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200">
                            <tr 
                                v-for="channel in channelPerformance"
                                :key="channel.channel"
                                class="hover:bg-gray-50 transition-colors"
                            >
                                <td class="px-6 py-4 text-sm font-medium text-gray-800">{{ channel.channel }}</td>
                                <td class="px-6 py-4 text-sm text-right text-gray-700">{{ channel.conversions }}</td>
                                <td class="px-6 py-4 text-sm text-right font-semibold text-gray-800">{{ formatCurrency(channel.revenue) }}</td>
                                <td class="px-6 py-4 text-sm text-right text-gray-700">{{ channel.avgTouch }}</td>
                                <td class="px-6 py-4 text-sm text-right text-green-600 font-semibold">3.2x</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- Customer Journeys Tab -->
            <div v-else-if="activeTab === 'journeys'" class="space-y-4">
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <div class="flex items-start gap-2">
                        <font-awesome icon="fas fa-info-circle" class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div class="text-sm text-blue-800">
                            <p class="font-medium">Common Conversion Paths</p>
                            <p class="text-xs mt-1">Most frequent touchpoint sequences leading to conversions</p>
                        </div>
                    </div>
                </div>
                
                <div class="space-y-3">
                    <div 
                        v-for="(journey, index) in conversionPaths"
                        :key="index"
                        class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm"
                    >
                        <div class="flex items-center justify-between mb-2">
                            <div class="text-sm font-semibold text-gray-800">Path {{ index + 1 }}</div>
                            <div class="flex items-center gap-4 text-xs text-gray-600">
                                <span>{{ journey.conversions }} conversions</span>
                                <span class="font-semibold text-gray-800">{{ formatCurrency(journey.revenue) }}</span>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <span 
                                v-for="(step, stepIndex) in journey.path"
                                :key="stepIndex"
                                class="inline-flex items-center gap-1"
                            >
                                <span class="px-3 py-1.5 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                                    {{ step }}
                                </span>
                                <span v-if="stepIndex < journey.path.length - 1" class="text-gray-400">→</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- AI Insights Tab -->
            <div v-else-if="activeTab === 'insights'" class="space-y-4">
                <div class="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg p-6">
                    <div class="flex items-start gap-3 mb-4">
                        <div class="text-3xl">🤖</div>
                        <div class="flex-1">
                            <h4 class="text-lg font-semibold text-gray-800 mb-2">AI-Powered Attribution Insights</h4>
                            <p class="text-sm text-gray-700 mb-4">
                                Coming soon! AI will analyze your attribution data and provide actionable insights:
                            </p>
                            <ul class="text-sm text-gray-700 space-y-2 ml-6">
                                <li class="flex items-start gap-2">
                                    <span class="text-blue-600">•</span>
                                    <span>Identify underperforming channels and optimization opportunities</span>
                                </li>
                                <li class="flex items-start gap-2">
                                    <span class="text-blue-600">•</span>
                                    <span>Predict which touchpoint combinations drive highest ROI</span>
                                </li>
                                <li class="flex items-start gap-2">
                                    <span class="text-blue-600">•</span>
                                    <span>Recommend budget allocation adjustments</span>
                                </li>
                                <li class="flex items-start gap-2">
                                    <span class="text-blue-600">•</span>
                                    <span>Detect anomalies in conversion patterns</span>
                                </li>
                                <li class="flex items-start gap-2">
                                    <span class="text-blue-600">•</span>
                                    <span>Generate natural language reports for stakeholders</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
                
                <div class="bg-white border border-gray-200 rounded-lg p-6">
                    <h5 class="text-sm font-semibold text-gray-800 mb-3">Integration Required</h5>
                    <p class="text-sm text-gray-600 mb-4">
                        To enable attribution tracking, you'll need to:
                    </p>
                    <ol class="text-sm text-gray-700 space-y-2 ml-6">
                        <li>1. Install tracking script on your website</li>
                        <li>2. Configure conversion goals</li>
                        <li>3. Set up UTM parameters for campaigns</li>
                        <li>4. Enable cross-domain tracking (if needed)</li>
                    </ol>
                    <button class="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors">
                        Setup Attribution Tracking
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
