<script setup lang="ts">
const planChannels = [
    { name: 'Google Ads', type: 'Search', budget: '$8,000/mo', status: 'On target', statusIcon: 'fas fa-circle-check', statusClass: 'text-green-600 bg-green-50', icon: 'fas fa-magnifying-glass', iconClass: 'bg-blue-50 text-primary-blue-100' },
    { name: 'Meta', type: 'Social', budget: '$6,000/mo', status: '12% under target', statusIcon: 'fas fa-triangle-exclamation', statusClass: 'text-amber-600 bg-amber-50', icon: 'fas fa-users', iconClass: 'bg-purple-50 text-purple-500' },
    { name: 'LinkedIn', type: 'B2B', budget: '$3,000/mo', status: 'On target', statusIcon: 'fas fa-circle-check', statusClass: 'text-green-600 bg-green-50', icon: 'fas fa-briefcase', iconClass: 'bg-teal-50 text-teal-500' },
    { name: 'TikTok', type: 'Video', budget: '$2,000/mo', status: 'Live', statusIcon: 'fas fa-play', statusClass: 'text-blue-600 bg-blue-50', icon: 'fas fa-play', iconClass: 'bg-rose-50 text-rose-500' },
];
</script>
<template>
    <div class="bg-primary-blue-100 w-full h-full py-16 px-6">
        <div class="max-w-7xl mx-auto">
            <h2 class="text-white text-center font-bold text-4xl mb-4">
                Track your plan on the channels you already run
            </h2>
            <p class="text-blue-100 text-center text-lg mb-10 max-w-2xl mx-auto">
                Your plan says where to spend. Campaign Intelligence tells you how it performed — channel by channel.
            </p>

            <!-- Plan Preview Card -->
            <div class="max-w-3xl mx-auto bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
                <div class="flex items-center justify-between px-5 py-2.5 border-b border-gray-100">
                    <div>
                        <div class="flex items-center gap-2">
                            <p class="text-sm font-semibold text-gray-700">Your channel-by-channel plan</p>
                            <span class="text-[10px] font-semibold uppercase tracking-wide rounded-full bg-gray-100 text-gray-500 px-2 py-0.5">Example</span>
                        </div>
                        <p class="text-xs text-gray-400">Planned vs. actuals · last 30 days</p>
                    </div>
                    <span class="text-xs font-semibold rounded-full px-2.5 py-1 bg-green-50 text-green-600">$19,000/mo planned</span>
                </div>
                <div class="divide-y divide-gray-100">
                    <div
                        v-for="(channel, index) in planChannels"
                        :key="index"
                        class="flex items-center gap-3 px-5 py-1.5"
                    >
                        <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" :class="channel.iconClass">
                            <font-awesome :icon="channel.icon" class="text-sm" />
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="font-semibold text-primary-blue-100 leading-tight">{{ channel.name }}</p>
                            <p class="text-xs text-gray-400 leading-tight">{{ channel.type }}</p>
                        </div>
                        <span class="text-sm font-semibold text-gray-700 flex-shrink-0">{{ channel.budget }}</span>
                        <span class="inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5 flex-shrink-0" :class="channel.statusClass">
                            <font-awesome :icon="channel.statusIcon" class="text-[10px]" />
                            {{ channel.status }}
                        </span>
                    </div>
                </div>
            </div>

            <!-- Logo Strip -->
            <div class="max-w-3xl mx-auto mt-8">
                <p class="text-center text-sm text-blue-100 mb-3">
                    Connected via OAuth — campaign results report back automatically.
                </p>
                <div class="flex flex-wrap items-center justify-center gap-3">
                    <img loading="lazy" decoding="async" src="/assets/images/google-ads.webp" class="w-16 bg-white rounded-lg p-2 shadow-lg" alt="Google Ads" title="Google Ads" />
                    <img loading="lazy" decoding="async" src="/assets/images/google-analytics.webp" class="w-16 bg-white rounded-lg p-2 shadow-lg" alt="Google Analytics" title="Google Analytics" />
                    <img loading="lazy" decoding="async" src="/assets/images/meta.webp" class="w-16 bg-white rounded-lg p-2 shadow-lg" alt="Meta Ads Manager" title="Meta Ads Manager" />
                </div>
            </div>
        </div>
    </div>
</template>
