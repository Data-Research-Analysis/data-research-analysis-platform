<template>
    <div class="space-y-6">
        <!-- Journey List -->
        <div v-for="journey in journeys" :key="journey.userIdentifier" class="bg-white rounded-lg shadow border border-gray-200">
            <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                    <h3 class="text-lg font-semibold text-gray-800">
                        User: {{ journey.userIdentifier }}
                    </h3>
                    <p class="text-sm text-gray-500 mt-1">
                        {{ formatDate(journey.journeyStart) }} → {{ formatDate(journey.journeyEnd) }}
                        <span class="mx-2">•</span>
                        {{ journey.journeyDurationHours.toFixed(1) }} hours
                    </p>
                </div>
                <div class="text-right">
                    <p class="text-sm text-gray-600">
                        {{ journey.totalTouchpoints }} touchpoints
                    </p>
                    <p class="text-sm font-semibold text-green-600">
                        ${{ journey.totalRevenue.toFixed(2) }} revenue
                    </p>
                </div>
            </div>

            <div class="p-6">
                <!-- Timeline -->
                <div class="relative">
                    <!-- Timeline Line -->
                    <div class="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-300"></div>

                    <!-- Touchpoints -->
                    <div class="space-y-4">
                        <div
                            v-for="(touchpoint, index) in journey.touchpoints"
                            :key="touchpoint.eventId"
                            class="relative pl-16"
                        >
                            <!-- Timeline Dot -->
                            <div class="absolute left-4 top-2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow"></div>

                            <!-- Touchpoint Content -->
                            <div class="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                <div class="flex items-start justify-between">
                                    <div class="flex-1">
                                        <div class="flex items-center gap-2 mb-1">
                                            <span class="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                                {{ touchpoint.eventType }}
                                            </span>
                                            <span class="text-sm font-medium text-gray-900">
                                                {{ touchpoint.channelName }}
                                            </span>
                                            <span class="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs">
                                                {{ touchpoint.channelCategory }}
                                            </span>
                                        </div>
                                        <p v-if="touchpoint.pageUrl" class="text-xs text-gray-600 truncate max-w-md">
                                            {{ touchpoint.pageUrl }}
                                        </p>
                                    </div>
                                    <span class="text-xs text-gray-500 whitespace-nowrap ml-4">
                                        {{ formatTime(touchpoint.timestamp) }}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- Conversions -->
                        <div
                            v-for="conversion in journey.conversions"
                            :key="`conv-${conversion.eventId}`"
                            class="relative pl-16"
                        >
                            <!-- Conversion Dot -->
                            <div class="absolute left-3.5 top-2 w-5 h-5 bg-green-500 rounded-full border-2 border-white shadow flex items-center justify-center">
                                <span class="text-white text-xs font-bold">✓</span>
                            </div>

                            <!-- Conversion Content -->
                            <div class="bg-green-50 rounded-lg p-4 border-2 border-green-200">
                                <div class="flex items-start justify-between mb-3">
                                    <div>
                                        <div class="flex items-center gap-2 mb-1">
                                            <span class="px-2 py-0.5 bg-green-600 text-white rounded text-xs font-medium">
                                                CONVERSION
                                            </span>
                                            <span class="font-semibold text-gray-900">
                                                {{ conversion.eventName }}
                                            </span>
                                        </div>
                                        <p class="text-lg font-bold text-green-600">
                                            ${{ conversion.conversionValue.toFixed(2) }}
                                        </p>
                                    </div>
                                    <span class="text-xs text-gray-500 whitespace-nowrap">
                                        {{ formatTime(conversion.timestamp) }}
                                    </span>
                                </div>

                                <!-- Attribution Breakdown -->
                                <div v-if="conversion.attributedChannels && conversion.attributedChannels.length > 0" class="mt-3 pt-3 border-t border-green-200">
                                    <p class="text-xs font-medium text-gray-600 mb-2">Attribution:</p>
                                    <div class="space-y-1">
                                        <div
                                            v-for="(attr, attrIndex) in conversion.attributedChannels"
                                            :key="attrIndex"
                                            class="flex items-center justify-between text-xs"
                                        >
                                            <span class="text-gray-700">{{ attr.channelName }}</span>
                                            <div class="flex items-center gap-2">
                                                <div class="w-16 bg-gray-200 rounded-full h-1.5">
                                                    <div
                                                        class="bg-green-500 h-1.5 rounded-full"
                                                        :style="{ width: `${attr.weight * 100}%` }"
                                                    ></div>
                                                </div>
                                                <span class="text-gray-600 w-12 text-right">
                                                    {{ (attr.weight * 100).toFixed(0) }}%
                                                </span>
                                                <span class="text-green-600 font-medium w-16 text-right">
                                                    ${{ attr.attributedValue.toFixed(2) }}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Journey Summary -->
                <div class="mt-6 pt-6 border-t border-gray-200 grid grid-cols-3 gap-4 text-center">
                    <div>
                        <p class="text-2xl font-bold text-gray-800">{{ journey.totalTouchpoints }}</p>
                        <p class="text-sm text-gray-600 mt-1">Touchpoints</p>
                    </div>
                    <div>
                        <p class="text-2xl font-bold text-gray-800">{{ journey.conversions.length }}</p>
                        <p class="text-sm text-gray-600 mt-1">Conversions</p>
                    </div>
                    <div>
                        <p class="text-2xl font-bold text-green-600">${{ journey.totalRevenue.toFixed(2) }}</p>
                        <p class="text-sm text-gray-600 mt-1">Total Value</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Load More Button -->
        <div v-if="journeys.length > 0" class="text-center">
            <button
                @click="emit('load-more')"
                :disabled="loading"
                class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors duration-200"
            >
                {{ loading ? 'Loading...' : 'Load More Journeys' }}
            </button>
        </div>

        <!-- Empty State -->
        <div v-if="journeys.length === 0 && !loading" class="text-center py-12 text-gray-500">
            <div class="text-6xl mb-4">🗺️</div>
            <p class="text-lg mb-2">No customer journeys available</p>
            <p class="text-sm">Track events to see individual customer paths</p>
        </div>

        <!-- Loading State -->
        <div v-if="loading && journeys.length === 0" class="flex items-center justify-center py-12">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { ICustomerJourney } from '~/stores/attribution';

interface Props {
    journeys: ICustomerJourney[];
    loading?: boolean;
}

interface Emits {
    (e: 'load-more'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
}
</script>
