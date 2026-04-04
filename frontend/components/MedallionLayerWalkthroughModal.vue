<script setup lang="ts">
const props = defineProps<{
    isOpen: boolean;
}>();

const emit = defineEmits<{
    (e: 'close', dontShowAgain: boolean): void;
}>();

const state = reactive({
    dontShowAgain: false,
});

function handleClose() {
    emit('close', state.dontShowAgain);
}

// Close on ESC key
function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && props.isOpen) {
        handleClose();
    }
}

onMounted(() => {
    if (import.meta.client) {
        window.addEventListener('keydown', handleKeydown);
    }
});

onUnmounted(() => {
    if (import.meta.client) {
        window.removeEventListener('keydown', handleKeydown);
    }
});
</script>

<template>
    <overlay-dialog v-if="isOpen" @close="handleClose" :enable-scrolling="true">
        <template #overlay>
            <div class="medallion-walkthrough">
                <!-- Header -->
                <header class="mb-6 text-center">
                    <h2 class="text-3xl font-bold text-gray-900 mb-2">
                        Understanding Data Quality Layers
                    </h2>
                    <p class="text-lg text-gray-600">
                        Think of your data like organizing a library
                    </p>
                </header>

                <!-- Scrollable Body -->
                <div class="walkthrough-body space-y-6">
                    <!-- Raw Data Section -->
                    <section class="layer-section bg-gray-50 border-2 border-gray-200 rounded-xl p-6">
                        <div class="flex items-start gap-4 mb-4">
                            <div class="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-gray-200 rounded-full">
                                <font-awesome-icon :icon="['fas', 'box']" class="text-gray-700 text-xl" />
                            </div>
                            <div class="flex-1">
                                <div class="flex items-center gap-2 mb-2">
                                    <h3 class="text-xl font-bold text-gray-900">Raw Data</h3>
                                    <span class="px-3 py-1 bg-gray-200 text-gray-800 text-xs font-semibold rounded-full">Bronze</span>
                                </div>
                                <p class="text-base text-gray-700 italic mb-4">
                                    "Like books arriving at a library - they're all there, but still in boxes, 
                                    unsorted, with duplicates, and some might have torn pages."
                                </p>
                            </div>
                        </div>

                        <div class="space-y-4 ml-16">
                            <div>
                                <h4 class="font-semibold text-gray-900 mb-2">What it is:</h4>
                                <p class="text-gray-700">
                                    Your data exactly as it comes from the source - nothing changed, 
                                    nothing fixed. It's your safety backup.
                                </p>
                            </div>

                            <div>
                                <h4 class="font-semibold text-gray-900 mb-2">When to use:</h4>
                                <ul class="space-y-1 text-gray-700">
                                    <li class="flex items-start gap-2">
                                        <span class="text-green-600 mt-1">✓</span>
                                        <span>Just connected a new data source</span>
                                    </li>
                                    <li class="flex items-start gap-2">
                                        <span class="text-green-600 mt-1">✓</span>
                                        <span>Want to see everything before cleaning</span>
                                    </li>
                                    <li class="flex items-start gap-2">
                                        <span class="text-green-600 mt-1">✓</span>
                                        <span>Need the original data for reference</span>
                                    </li>
                                </ul>
                            </div>

                            <div>
                                <h4 class="font-semibold text-gray-900 mb-2">Marketing/Sales Examples:</h4>
                                <ul class="space-y-1 text-gray-700 list-disc list-inside">
                                    <li>Customer list with duplicate emails</li>
                                    <li>Sales records with missing dates</li>
                                    <li>Campaign data exactly as exported from Google Ads</li>
                                </ul>
                            </div>

                            <div class="bg-red-50 border border-red-200 rounded-lg p-3">
                                <h4 class="font-semibold text-red-900 mb-2">Common Mistakes to Avoid:</h4>
                                <ul class="space-y-1 text-red-700 text-sm">
                                    <li class="flex items-start gap-2">
                                        <span class="mt-0.5">❌</span>
                                        <span>Building reports directly from raw data (it might have errors!)</span>
                                    </li>
                                    <li class="flex items-start gap-2">
                                        <span class="mt-0.5">❌</span>
                                        <span>Using raw data in dashboards (audience won't understand it)</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    <!-- Clean Data Section -->
                    <section class="layer-section bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
                        <div class="flex items-start gap-4 mb-4">
                            <div class="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-blue-200 rounded-full">
                                <font-awesome-icon :icon="['fas', 'broom']" class="text-blue-700 text-xl" />
                            </div>
                            <div class="flex-1">
                                <div class="flex items-center gap-2 mb-2">
                                    <h3 class="text-xl font-bold text-gray-900">Clean Data</h3>
                                    <span class="px-3 py-1 bg-blue-200 text-blue-800 text-xs font-semibold rounded-full">Silver</span>
                                </div>
                                <p class="text-base text-gray-700 italic mb-4">
                                    "Like books that are now on shelves - organized by topic, 
                                    duplicates removed, and damaged ones repaired or marked."
                                </p>
                            </div>
                        </div>

                        <div class="space-y-4 ml-16">
                            <div>
                                <h4 class="font-semibold text-gray-900 mb-2">What it is:</h4>
                                <p class="text-gray-700">
                                    Your data after you've cleaned it up - removed duplicates, 
                                    fixed errors, filtered out what you don't need.
                                </p>
                            </div>

                            <div>
                                <h4 class="font-semibold text-gray-900 mb-2">When to use:</h4>
                                <ul class="space-y-1 text-gray-700">
                                    <li class="flex items-start gap-2">
                                        <span class="text-green-600 mt-1">✓</span>
                                        <span>Applied filters or removed unwanted records</span>
                                    </li>
                                    <li class="flex items-start gap-2">
                                        <span class="text-green-600 mt-1">✓</span>
                                        <span>Fixed column names or data formats</span>
                                    </li>
                                    <li class="flex items-start gap-2">
                                        <span class="text-green-600 mt-1">✓</span>
                                        <span>Removed duplicate entries</span>
                                    </li>
                                    <li class="flex items-start gap-2">
                                        <span class="text-green-600 mt-1">✓</span>
                                        <span>Standardized values (e.g., all dates same format)</span>
                                    </li>
                                </ul>
                            </div>

                            <div>
                                <h4 class="font-semibold text-gray-900 mb-2">Marketing/Sales Examples:</h4>
                                <ul class="space-y-1 text-gray-700 list-disc list-inside">
                                    <li>Customer list with duplicates removed</li>
                                    <li>Sales data with only completed purchases (refunds filtered out)</li>
                                    <li>Campaign data with invalid clicks removed</li>
                                </ul>
                            </div>

                            <div class="bg-red-50 border border-red-200 rounded-lg p-3">
                                <h4 class="font-semibold text-red-900 mb-2">Common Mistakes to Avoid:</h4>
                                <ul class="space-y-1 text-red-700 text-sm">
                                    <li class="flex items-start gap-2">
                                        <span class="mt-0.5">❌</span>
                                        <span>Calling it "clean" when you only renamed columns (that's still raw!)</span>
                                    </li>
                                    <li class="flex items-start gap-2">
                                        <span class="mt-0.5">❌</span>
                                        <span>Skipping this layer and jumping straight to reports (you'll miss important prep)</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    <!-- Business Ready Section -->
                    <section class="layer-section bg-green-50 border-2 border-green-200 rounded-xl p-6">
                        <div class="flex items-start gap-4 mb-4">
                            <div class="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-green-200 rounded-full">
                                <font-awesome-icon :icon="['fas', 'chart-line']" class="text-green-700 text-xl" />
                            </div>
                            <div class="flex-1">
                                <div class="flex items-center gap-2 mb-2">
                                    <h3 class="text-xl font-bold text-gray-900">Business Ready</h3>
                                    <span class="px-3 py-1 bg-green-200 text-green-800 text-xs font-semibold rounded-full">Gold</span>
                                </div>
                                <p class="text-base text-gray-700 italic mb-4">
                                    "Like a curated reading list created from your library - 
                                    summarized topics, organized by theme, ready for your audience."
                                </p>
                            </div>
                        </div>

                        <div class="space-y-4 ml-16">
                            <div>
                                <h4 class="font-semibold text-gray-900 mb-2">What it is:</h4>
                                <p class="text-gray-700">
                                    Your final reports and summaries - data that's been grouped, 
                                    calculated, and is ready to share with your team or clients.
                                </p>
                            </div>

                            <div>
                                <h4 class="font-semibold text-gray-900 mb-2">When to use:</h4>
                                <ul class="space-y-1 text-gray-700">
                                    <li class="flex items-start gap-2">
                                        <span class="text-green-600 mt-1">✓</span>
                                        <span>Created calculations (totals, averages, counts)</span>
                                    </li>
                                    <li class="flex items-start gap-2">
                                        <span class="text-green-600 mt-1">✓</span>
                                        <span>Grouped data by categories (by month, by region, by product)</span>
                                    </li>
                                    <li class="flex items-start gap-2">
                                        <span class="text-green-600 mt-1">✓</span>
                                        <span>Combined multiple clean datasets into one report</span>
                                    </li>
                                    <li class="flex items-start gap-2">
                                        <span class="text-green-600 mt-1">✓</span>
                                        <span>Ready to display in a dashboard</span>
                                    </li>
                                </ul>
                            </div>

                            <div>
                                <h4 class="font-semibold text-gray-900 mb-2">Marketing/Sales Examples:</h4>
                                <ul class="space-y-1 text-gray-700 list-disc list-inside">
                                    <li>Total sales per month by region</li>
                                    <li>Average customer lifetime value by segment</li>
                                    <li>Monthly campaign performance summary with ROI calculated</li>
                                </ul>
                            </div>

                            <div class="bg-red-50 border border-red-200 rounded-lg p-3">
                                <h4 class="font-semibold text-red-900 mb-2">Common Mistakes to Avoid:</h4>
                                <ul class="space-y-1 text-red-700 text-sm">
                                    <li class="flex items-start gap-2">
                                        <span class="mt-0.5">❌</span>
                                        <span>Creating summaries without cleaning first (garbage in = garbage out!)</span>
                                    </li>
                                    <li class="flex items-start gap-2">
                                        <span class="mt-0.5">❌</span>
                                        <span>Using "Business Ready" for data that's only filtered (use Clean Data instead)</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    <!-- Quick Decision Guide -->
                    <section class="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-300 rounded-xl p-6">
                        <h3 class="text-xl font-bold text-gray-900 mb-4 text-center">
                            📋 Quick Decision Guide
                        </h3>
                        <p class="text-gray-700 mb-4 text-center font-medium">
                            Still not sure which layer to choose?
                        </p>
                        
                        <div class="bg-white rounded-lg p-4 mb-4">
                            <p class="text-gray-900 font-semibold mb-3">Ask yourself:</p>
                            <ul class="space-y-2 text-gray-700">
                                <li class="flex items-start gap-2">
                                    <span class="font-semibold">→</span>
                                    <span>"Is this exactly what came from the source?" <span class="font-semibold text-gray-900">→ Raw Data</span></span>
                                </li>
                                <li class="flex items-start gap-2">
                                    <span class="font-semibold">→</span>
                                    <span>"Did I clean, filter, or fix anything?" <span class="font-semibold text-blue-700">→ Clean Data</span></span>
                                </li>
                                <li class="flex items-start gap-2">
                                    <span class="font-semibold">→</span>
                                    <span>"Did I create calculations or summaries?" <span class="font-semibold text-green-700">→ Business Ready</span></span>
                                </li>
                            </ul>
                        </div>

                        <div class="bg-blue-100 border border-blue-300 rounded-lg p-4">
                            <p class="text-blue-900">
                                <span class="font-semibold">💡 Pro Tip:</span> Most of your work will move through all three layers:<br>
                                <span class="font-medium">Start Raw → Clean it → Summarize to Business Ready</span>
                            </p>
                        </div>
                    </section>

                    <!-- Action Section -->
                    <div class="mt-8 pt-6 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <label class="flex items-center gap-2 cursor-pointer text-gray-700">
                            <input 
                                v-model="state.dontShowAgain" 
                                type="checkbox" 
                                class="w-4 h-4 text-primary-blue-600 rounded focus:ring-2 focus:ring-primary-blue-500"
                            />
                            <span class="text-sm">Don't show this again</span>
                        </label>
                        <button 
                            @click="handleClose"
                            class="px-6 py-2.5 bg-primary-blue-600 hover:bg-primary-blue-700 text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-blue-500 focus:ring-offset-2"
                        >
                            Got it!
                        </button>
                    </div>
                </div>
            </div>
        </template>
    </overlay-dialog>
</template>
