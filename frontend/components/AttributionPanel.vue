<template>
    <div class="space-y-6">
        <!-- Info Banner -->
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div class="flex items-start gap-3">
                <span class="text-2xl">ℹ️</span>
                <div class="flex-1">
                    <h4 class="font-medium text-blue-900 mb-1">Marketing Attribution Tracking</h4>
                    <p class="text-sm text-blue-700">
                        Track user touchpoints across channels, analyze customer journeys, and measure ROI. 
                        Start tracking events to see which marketing channels drive your conversions.
                    </p>
                </div>
            </div>
        </div>

        <!-- Setup Required State -->
        <div v-if="!hasAttributionData" class="bg-white rounded-lg shadow p-12 text-center">
            <div class="text-6xl mb-4">📊</div>
            <h3 class="text-xl font-semibold text-gray-800 mb-2">Attribution Tracking Not Enabled</h3>
            <p class="text-gray-600 mb-6">
                Enable attribution tracking to analyze which marketing channels drive conversions for this data model.
            </p>
            <button
                @click="enableAttribution"
                :disabled="isEnabling"
                class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors duration-200 inline-flex items-center gap-2"
            >
                <span>{{ isEnabling ? '⚙️' : '✨' }}</span>
                <span>{{ isEnabling ? 'Enabling...' : 'Enable Attribution Tracking' }}</span>
            </button>
        </div>

        <!-- Attribution Dashboard -->
        <template v-else>
            <!-- Model Selector -->
            <div class="bg-white rounded-lg shadow p-4">
                <div class="flex items-center justify-between">
                    <div>
                        <label class="text-sm font-medium text-gray-700">Attribution Model:</label>
                        <select
                            v-model="selectedModel"
                            @change="loadMetrics"
                            class="ml-3 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="first_touch">First Touch</option>
                            <option value="last_touch">Last Touch</option>
                            <option value="linear">Linear</option>
                            <option value="time_decay">Time Decay</option>
                            <option value="u_shaped">U-Shaped (40-20-40)</option>
                        </select>
                    </div>
                    <button
                        @click="trackEvent"
                        class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center gap-2"
                    >
                        <span>➕</span>
                        <span>Track Event</span>
                    </button>
                </div>
            </div>

            <!-- Key Metrics -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center justify-between mb-2">
                        <p class="text-gray-600 text-sm font-medium">Total Events</p>
                        <span class="text-2xl">📊</span>
                    </div>
                    <p class="text-3xl font-bold text-gray-800">{{ metrics.totalEvents || 0 }}</p>
                    <p class="text-xs text-gray-500 mt-1">Last 30 days</p>
                </div>

                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center justify-between mb-2">
                        <p class="text-gray-600 text-sm font-medium">Conversions</p>
                        <span class="text-2xl">✅</span>
                    </div>
                    <p class="text-3xl font-bold text-green-600">{{ metrics.conversions || 0 }}</p>
                    <p class="text-xs text-gray-500 mt-1">Conversion rate: {{ metrics.conversionRate || '0' }}%</p>
                </div>

                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center justify-between mb-2">
                        <p class="text-gray-600 text-sm font-medium">Avg. Touchpoints</p>
                        <span class="text-2xl">🎯</span>
                    </div>
                    <p class="text-3xl font-bold text-blue-600">{{ metrics.avgTouchpoints || 0 }}</p>
                    <p class="text-xs text-gray-500 mt-1">Per conversion</p>
                </div>

                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center justify-between mb-2">
                        <p class="text-gray-600 text-sm font-medium">Attribution Value</p>
                        <span class="text-2xl">💰</span>
                    </div>
                    <p class="text-3xl font-bold text-purple-600">${{ formatNumber(metrics.totalValue || 0) }}</p>
                    <p class="text-xs text-gray-500 mt-1">Total attributed</p>
                </div>
            </div>

            <!-- Channel Performance -->
            <div class="bg-white rounded-lg shadow">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h3 class="text-lg font-semibold text-gray-800">Channel Performance</h3>
                    <p class="text-sm text-gray-600 mt-1">{{ selectedModel.replace('_', ' ').toUpperCase() }} attribution model</p>
                </div>
                <div v-if="isLoading" class="p-6 text-center">
                    <div class="animate-spin text-4xl mb-2">⚙️</div>
                    <p class="text-gray-600">Loading channel data...</p>
                </div>
                <div v-else-if="channelPerformance.length > 0" class="p-6">
                    <div class="space-y-4">
                        <div
                            v-for="channel in channelPerformance"
                            :key="channel.id"
                            class="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-150"
                        >
                            <div class="flex-1">
                                <div class="flex items-center gap-3 mb-2">
                                    <span class="text-lg">{{ getChannelIcon(channel.name) }}</span>
                                    <span class="font-medium text-gray-800">{{ channel.name }}</span>
                                </div>
                                <div class="flex items-center gap-4 text-sm text-gray-600">
                                    <span>Touches: {{ channel.touchCount || 0 }}</span>
                                    <span>Conversions: {{ channel.conversions || 0 }}</span>
                                    <span>Value: ${{ formatNumber(channel.attributedValue || 0) }}</span>
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="text-2xl font-bold text-blue-600">{{ channel.attributionScore || 0 }}%</div>
                                <div class="text-xs text-gray-500">Attribution</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div v-else class="p-6 text-center text-gray-500">
                    <div class="text-4xl mb-3">📈</div>
                    <p class="text-lg font-medium text-gray-700 mb-2">No channel data available yet</p>
                    <p class="text-sm text-gray-600">Start tracking events to see channel performance and attribution metrics.</p>
                </div>
            </div>

            <!-- Attribution Report Generator -->
            <AttributionReportGenerator :project-id="projectId" :data-model-id="dataModelId" />

            <!-- AI Assistant -->
            <div class="bg-white rounded-lg shadow overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
                    <div class="flex items-center gap-2">
                        <span class="text-lg">🤖</span>
                        <h3 class="text-lg font-semibold text-gray-800">Attribution AI Assistant</h3>
                    </div>
                    <p class="text-sm text-gray-600 mt-1">Ask about channel performance, optimization strategies, and attribution insights</p>
                </div>
                
                <!-- Chat Messages -->
                <div ref="messagesContainer" class="h-96 overflow-y-auto p-6 space-y-4 bg-gray-50">
                    <div v-if="messages.length === 0" class="text-center py-12">
                        <div class="text-4xl mb-3">💬</div>
                        <p class="text-gray-600 mb-4">Ask me about attribution:</p>
                        <div class="flex flex-wrap gap-2 justify-center max-w-2xl mx-auto">
                            <button
                                v-for="prompt in quickPrompts"
                                :key="prompt"
                                @click="sendQuickPrompt(prompt)"
                                class="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:border-purple-400 transition-colors duration-200"
                            >
                                {{ prompt }}
                            </button>
                        </div>
                    </div>
                    
                    <div v-for="message in messages" :key="message.id" class="flex gap-3" :class="message.role === 'user' ? 'justify-end' : 'justify-start'">
                        <div 
                            class="max-w-[80%] rounded-lg px-4 py-3"
                            :class="message.role === 'user' ? 'bg-purple-600 text-white' : 'bg-white border border-gray-200 text-gray-800'"
                        >
                            <div class="text-sm whitespace-pre-wrap">{{ message.content }}</div>
                            <div class="text-xs mt-2 opacity-70">{{ formatTime(message.timestamp) }}</div>
                        </div>
                    </div>
                    
                    <div v-if="isLoadingMessage" class="flex gap-3">
                        <div class="bg-white border border-gray-200 rounded-lg px-4 py-3">
                            <div class="flex items-center gap-2">
                                <span class="animate-spin">⚙️</span>
                                <span class="text-sm text-gray-600">Analyzing attribution data...</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Input Area -->
                <div class="px-6 py-4 border-t border-gray-200 bg-white">
                    <div class="flex gap-2">
                        <input
                            v-model="userInput"
                            @keyup.enter="sendMessage"
                            type="text"
                            placeholder="Ask about channel performance, ROI, or optimization..."
                            class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            :disabled="isLoadingMessage"
                        />
                        <button
                            @click="sendMessage"
                            :disabled="!userInput.trim() || isLoadingMessage"
                            class="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
                        >
                            Send
                        </button>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { getAuthToken } from '~/composables/AuthToken';

const props = defineProps<{
    dataModelId: number;
    projectId?: number;
}>();

const route = useRoute();
const projectId = computed(() => props.projectId || parseInt(route.params.projectid as string));

const hasAttributionData = ref(false);
const isEnabling = ref(false);
const isLoading = ref(false);
const selectedModel = ref('linear');
const metrics = ref<any>({});
const channelPerformance = ref<any[]>([]);
const messages = ref<Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: Date }>>([]);
const userInput = ref('');
const isLoadingMessage = ref(false);
const messagesContainer = ref<HTMLElement | null>(null);

const quickPrompts = [
    'Which channel drives the most conversions?',
    'Compare first-touch vs last-touch models',
    'How can I optimize budget allocation?',
    'Show me the customer journey analysis'
];

onMounted(async () => {
    await checkAttributionStatus();
});

async function checkAttributionStatus() {
    try {
        const token = getAuthToken();
        if (!token) return;

        const config = useRuntimeConfig();
        const result = await $fetch(`${config.public.apiBase}/attribution/status/${projectId.value}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth'
            },
            credentials: 'include'
        }).catch(() => ({ enabled: false }));

        hasAttributionData.value = (result as any).enabled || false;
        
        if (hasAttributionData.value) {
            await loadMetrics();
        }
    } catch (error) {
        console.error('Error checking attribution status:', error);
        hasAttributionData.value = false;
    }
}

async function enableAttribution() {
    isEnabling.value = true;
    try {
        const { $swal } = useNuxtApp() as any;
        
        const result = await $swal.fire({
            title: 'Enable Attribution Tracking',
            html: `
                <div class="text-left">
                    <p class="mb-3 text-gray-700">Attribution tracking will help you understand which marketing channels drive conversions.</p>
                    <p class="mb-3 text-sm text-gray-600">We'll create 8 default marketing channels to get you started. You can customize them later.</p>
                    <div class="bg-blue-50 border border-blue-200 rounded p-3 mt-4">
                        <p class="text-sm font-medium text-blue-900">Default Channels:</p>
                        <ul class="text-sm text-blue-800 list-disc list-inside mt-2 space-y-1">
                            <li>Organic Search & Paid Search</li>
                            <li>Social Media & Email Marketing</li>
                            <li>Direct Traffic & Referral</li>
                            <li>Display Ads & Other</li>
                        </ul>
                    </div>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Enable Now',
            cancelButtonText: 'Cancel',
            showLoaderOnConfirm: true,
            preConfirm: async () => {
                try {
                    const token = getAuthToken();
                    const config = useRuntimeConfig();
                    
                    const response = await $fetch(`${config.public.apiBase}/attribution/initialize`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Authorization-Type': 'auth',
                            'Content-Type': 'application/json'
                        },
                        credentials: 'include',
                        body: JSON.stringify({
                            projectId: projectId.value
                        })
                    });

                    return response;
                } catch (error) {
                    $swal.showValidationMessage(`Failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    return false;
                }
            },
            allowOutsideClick: () => !$swal.isLoading()
        });
        
        if (result.isConfirmed && result.value && (result.value as any).success) {
            const channelCount = (result.value as any).data?.channelCount || 0;
            
            await $swal.fire({
                title: 'Attribution Enabled!',
                html: `
                    <p class="mb-2">Successfully created <strong>${channelCount} marketing channels</strong>.</p>
                    <p class="text-sm text-gray-600">You can now start tracking events and analyzing channel performance.</p>
                `,
                icon: 'success',
                timer: 3000,
                showConfirmButton: false
            });
            
            hasAttributionData.value = true;
            await loadMetrics();
        }
    } catch (error) {
        console.error('Error enabling attribution:', error);
        const { $swal } = useNuxtApp() as any;
        await $swal.fire({
            title: 'Error',
            text: 'Failed to enable attribution tracking. Please try again.',
            icon: 'error'
        });
    } finally {
        isEnabling.value = false;
    }
}

async function loadMetrics() {
    isLoading.value = true;
    try {
        const token = getAuthToken();
        if (!token) return;

        const config = useRuntimeConfig();
        
        // Get date range (last 30 days)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        // Fetch channel performance
        const channelData = await $fetch(`${config.public.apiBase}/attribution/channel-performance`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth',
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                projectId: projectId.value,
                attributionModel: selectedModel.value,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
            })
        }).catch(() => ({ success: false, data: [] }));

        if ((channelData as any).success && (channelData as any).data) {
            const perfData = (channelData as any).data;
            
            // Calculate aggregate metrics
            const totalEvents = perfData.reduce((sum: number, ch: any) => sum + (ch.totalTouchpoints || 0), 0);
            const conversions = perfData.reduce((sum: number, ch: any) => sum + (ch.totalConversions || 0), 0);
            const totalValue = perfData.reduce((sum: number, ch: any) => sum + (ch.totalRevenue || 0), 0);
            const avgTouchpoints = conversions > 0 ? (totalEvents / conversions).toFixed(1) : '0';
            const conversionRate = totalEvents > 0 ? ((conversions / totalEvents) * 100).toFixed(1) : '0';
            
            metrics.value = {
                totalEvents,
                conversions,
                conversionRate,
                avgTouchpoints: parseFloat(avgTouchpoints),
                totalValue
            };

            // Map channel performance data
            channelPerformance.value = perfData.map((ch: any, index: number) => ({
                id: ch.channelId || index + 1,
                name: ch.channelName || 'Unknown Channel',
                touchCount: ch.totalTouchpoints || 0,
                conversions: ch.totalConversions || 0,
                attributedValue: ch.totalRevenue || 0,
                attributionScore: totalValue > 0 ? Math.round((ch.totalRevenue / totalValue) * 100) : 0
            }));
        } else {
            // No data available
            metrics.value = {
                totalEvents: 0,
                conversions: 0,
                conversionRate: '0',
                avgTouchpoints: 0,
                totalValue: 0
            };
            channelPerformance.value = [];
        }
    } catch (error) {
        console.error('Error loading metrics:', error);
        metrics.value = {
            totalEvents: 0,
            conversions: 0,
            conversionRate: '0',
            avgTouchpoints: 0,
            totalValue: 0
        };
        channelPerformance.value = [];
    } finally {
        isLoading.value = false;
    }
}

async function trackEvent() {
    const { $swal } = useNuxtApp() as any;
    
    const result = await $swal.fire({
        title: 'Track Event',
        html: `
            <div class="text-left space-y-3">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
                    <select id="eventType" class="w-full px-3 py-2 border border-gray-300 rounded-lg">
                        <option value="page_view">Page View</option>
                        <option value="click">Click</option>
                        <option value="form_submit">Form Submit</option>
                        <option value="signup">Sign Up</option>
                        <option value="purchase">Purchase</option>
                        <option value="conversion">Conversion</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Event Name</label>
                    <input id="eventName" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="e.g., Product Page View">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Event Value ($)</label>
                    <input id="eventValue" type="number" class="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="0">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">User Identifier</label>
                    <input id="userIdentifier" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="user@example.com or user_id_123">
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Track Event',
        preConfirm: () => {
            const eventType = (document.getElementById('eventType') as HTMLSelectElement)?.value;
            const eventName = (document.getElementById('eventName') as HTMLInputElement)?.value;
            const eventValue = parseFloat((document.getElementById('eventValue') as HTMLInputElement)?.value) || undefined;
            const userIdentifier = (document.getElementById('userIdentifier') as HTMLInputElement)?.value;
            
            if (!userIdentifier) {
                $swal.showValidationMessage('User identifier is required');
                return false;
            }
            
            return { eventType, eventName, eventValue, userIdentifier };
        }
    });
    
    if (result.isConfirmed && result.value) {
        try {
            const token = getAuthToken();
            const config = useRuntimeConfig();
            
            await $fetch(`${config.public.apiBase}/attribution/track`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    projectId: projectId.value,
                    userIdentifier: result.value.userIdentifier,
                    eventType: result.value.eventType,
                    eventName: result.value.eventName,
                    eventValue: result.value.eventValue,
                    eventTimestamp: new Date().toISOString()
                })
            });
            
            await $swal.fire({
                title: 'Event Tracked!',
                text: 'Your event has been successfully tracked.',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
            
            // Reload metrics
            await loadMetrics();
        } catch (error) {
            console.error('Error tracking event:', error);
            await $swal.fire({
                title: 'Error',
                text: 'Failed to track event. Please try again.',
                icon: 'error'
            });
        }
    }
}

async function sendMessage() {
    if (!userInput.value.trim()) return;

    const userMessage = {
        id: Date.now().toString(),
        role: 'user' as const,
        content: userInput.value,
        timestamp: new Date()
    };

    messages.value.push(userMessage);
    const prompt = userInput.value;
    userInput.value = '';
    isLoadingMessage.value = true;

    await nextTick();
    scrollToBottom();

    try {
        // TODO: Integrate with AI attribution assistant endpoint
        const response = generateAttributionResponse(prompt);
        
        const assistantMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant' as const,
            content: response,
            timestamp: new Date()
        };

        messages.value.push(assistantMessage);
        await nextTick();
        scrollToBottom();
    } catch (error) {
        console.error('Error sending message:', error);
    } finally {
        isLoadingMessage.value = false;
    }
}

function sendQuickPrompt(prompt: string) {
    userInput.value = prompt;
    sendMessage();
}

function generateAttributionResponse(prompt: string): string {
    // Dynamic responses based on actual data
    const topChannel = channelPerformance.value.length > 0 
        ? channelPerformance.value[0] 
        : null;
    
    const totalChannels = channelPerformance.value.length;
    const totalConversions = metrics.value.conversions || 0;
    const hasData = totalConversions > 0 && totalChannels > 0;
    
    if (!hasData) {
        return `You don't have any attribution data yet. Start by:\n1. Tracking events using the "Track Event" button\n2. Ensuring your marketing campaigns use UTM parameters\n3. Marking conversion events when users complete desired actions\n\nOnce you have data, I can provide insights on channel performance, budget optimization, and customer journeys.`;
    }
    
    if (prompt.toLowerCase().includes('most conversions') || prompt.toLowerCase().includes('best channel')) {
        if (topChannel) {
            return `Based on the ${selectedModel.value.replace('_', ' ')} attribution model, ${topChannel.name} is your top performer with ${topChannel.conversions} conversions (${topChannel.attributionScore}% attribution score). It has generated $${formatNumber(topChannel.attributedValue)} in attributed value from ${topChannel.touchCount} touchpoints.`;
        }
    }

    if (prompt.toLowerCase().includes('compare') || prompt.toLowerCase().includes('first-touch') || prompt.toLowerCase().includes('last-touch')) {
        return `Attribution models show how credit is distributed across touchpoints:\n\n• First-touch: 100% credit to initial interaction\n• Last-touch: 100% credit to final touchpoint\n• Linear: Equal credit across all touchpoints\n• Time Decay: More weight to recent interactions\n• U-Shaped: 40% first, 40% last, 20% middle\n\nYour current ${selectedModel.value.replace('_', ' ')} model is ${selectedModel.value === 'linear' ? 'giving equal weight to all touchpoints' : selectedModel.value === 'u_shaped' ? 'emphasizing first and last interactions' : selectedModel.value === 'time_decay' ? 'favoring recent touchpoints' : 'focusing on a specific touchpoint'}. Try switching models to see how attribution changes.`;
    }

    if (prompt.toLowerCase().includes('optimize') || prompt.toLowerCase().includes('budget')) {
        const recommendations: string[] = [];
        channelPerformance.value.slice(0, 3).forEach((ch, idx) => {
            recommendations.push(`${idx + 1}. ${ch.name}: ${ch.attributionScore}% attribution, ${ch.conversions} conversions`);
        });
        
        return `Based on your ${totalConversions} conversions across ${totalChannels} channels, I recommend:\n\n${recommendations.join('\n')}\n\nFocus budget on high-attribution channels with strong conversion rates. Consider testing new channels if you're seeing diminishing returns.`;
    }

    if (prompt.toLowerCase().includes('journey')) {
        const avgTouchpoints = metrics.value.avgTouchpoints || 0;
        return `Your average customer journey includes ${avgTouchpoints} touchpoints before conversion. ${avgTouchpoints > 3 ? 'This multi-touch behavior validates using a model like ' + selectedModel.value.replace('_', ' ') + ' that accounts for the full journey.' : 'With fewer touchpoints, both first-touch and last-touch models may provide similar insights.'}\n\nConsider analyzing specific user journeys to identify common conversion paths.`;
    }

    return `I can help analyze your ${totalConversions} conversions across ${totalChannels} channels using the ${selectedModel.value.replace('_', ' ')} attribution model.\n\nAsk me about:\n• Channel performance and ROI\n• Conversion path analysis\n• Budget optimization\n• Attribution model comparison`;
}

function scrollToBottom() {
    if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
}

function getChannelIcon(channel: string): string {
    const icons: Record<string, string> = {
        'Organic Search': '🔍',
        'Paid Social': '📱',
        'Email': '📧',
        'Direct': '🔗',
        'Referral': '🔗',
        'Paid Search': '💰'
    };
    return icons[channel] || '📊';
}

function formatNumber(num: number): string {
    return num.toLocaleString();
}

function formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
</script>
