<template>
    <template v-if="show">
        <!-- Backdrop -->
        <div class="fixed top-0 left-0 bg-black h-lvh w-full opacity-50 z-10"></div>
        
        <!-- Dialog Container -->
        <div 
            class="fixed left-1/2 -translate-x-1/2 w-full max-w-md mx-4 bg-white opacity-100 z-15 p-10 shadow-lg max-h-[80vh] rounded-lg overflow-y-auto"
            style="top: 200px;"
        >
            <!-- Close button -->
            <div class="flex flex-row justify-end items-center -mt-5 mb-5">
                <font-awesome icon="fas fa-times" class="text-2xl hover:text-gray-500 cursor-pointer" @click="$emit('close')"/>
            </div>

            <!-- Header -->
            <div class="mb-4">
                <h3 class="text-xl font-semibold text-gray-900">
                    {{ tierName }} Tier Limit Reached
                </h3>
                <p class="text-sm text-gray-500 mt-1">
                    {{ resourceDisplay }} limit exceeded
                </p>
            </div>

            <!-- Usage Progress Bar -->
            <div class="mb-6">
                <div class="flex justify-between text-sm mb-2">
                    <span class="text-gray-700">Current Usage</span>
                    <span class="font-semibold text-gray-900">
                        {{ currentUsage }} / {{ tierLimit === null ? '∞' : tierLimit }}
                    </span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                        class="bg-red-600 h-2.5 rounded-full transition-all duration-300"
                        :style="{ width: progressWidth }"
                    ></div>
                </div>
            </div>

            <!-- Upgrade Message -->
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p class="text-sm text-blue-800">
                    You've reached your {{ tierName }} tier limit for {{ resourceDisplay }}s. 
                    Upgrade to continue creating more resources.
                </p>
            </div>

            <!-- Upgrade Tiers -->
            <div v-if="upgradeTiers && upgradeTiers.length > 0" class="mb-6">
                <h4 class="text-sm font-medium text-gray-900 mb-3">
                    Available Upgrades
                </h4>
                <div class="space-y-2">
                    <div 
                        v-for="tier in upgradeTiers" 
                        :key="tier.tierName"
                        class="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                    >
                        <div>
                            <span class="font-medium text-gray-900">
                                {{ tier.tierName }}
                            </span>
                            <span class="text-sm text-gray-500 ml-2">
                                {{ tier.limit === null ? 'Unlimited' : `${tier.limit} ${resourceDisplay}s` }}
                            </span>
                        </div>
                        <span class="text-sm font-semibold text-gray-900">
                            ${{ tier.pricePerMonth }}/mo
                        </span>
                    </div>
                </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex gap-3">
                <button
                    @click="handleUpgrade"
                    class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors duration-200 cursor-pointer"
                >
                    Upgrade Now
                </button>
                <button
                    @click="$emit('close')"
                    class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2.5 px-4 rounded-lg transition-colors duration-200 cursor-pointer"
                >
                    Cancel
                </button>
            </div>
        </div>
    </template>
</template>

<script setup lang="ts">
const props = defineProps<{
    show: boolean;
    resource: 'project' | 'data_source' | 'dashboard' | 'ai_generation';
    currentUsage: number;
    tierLimit: number | null;
    tierName: string;
    upgradeTiers?: Array<{
        tierName: string;
        limit: number | null;
        pricePerMonth: number;
    }>;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
}>();

const resourceDisplay = computed(() => {
    const displays: Record<typeof props.resource, string> = {
        'project': 'Project',
        'data_source': 'Data Source',
        'dashboard': 'Dashboard',
        'ai_generation': 'AI Generation'
    };
    return displays[props.resource];
});

const progressWidth = computed(() => {
    if (props.tierLimit === null) return '0%';
    const percentage = Math.min(100, (props.currentUsage / props.tierLimit) * 100);
    return `${percentage}%`;
});

function handleUpgrade() {
    // SSR guard
    if (import.meta.client) {
        window.location.href = '/pricing';
    }
}
</script>
