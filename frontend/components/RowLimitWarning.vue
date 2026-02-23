<script setup>
const props = defineProps({
    rowsReturned: {
        type: Number,
        required: true,
    },
    rowLimit: {
        type: Number,
        required: true,
    },
    tierName: {
        type: String,
        default: 'FREE',
    },
    wasLimited: {
        type: Boolean,
        default: false,
    },
    isBlocking: {
        type: Boolean,
        default: false,
    },
});

const router = useRouter();

function handleUpgrade() {
    if (import.meta.client) {
        router.push('/pricing'); // Adjust route as needed
    }
}

const limitPercentage = computed(() => {
    if (props.rowLimit === -1) return 0; // Unlimited
    return Math.min((props.rowsReturned / props.rowLimit) * 100, 100);
});

const showWarning = computed(() => {
    return props.wasLimited && props.rowLimit !== -1;
});

const formattedRowsReturned = computed(() => {
    return props.rowsReturned.toLocaleString();
});

const formattedRowLimit = computed(() => {
    if (props.rowLimit === -1) return 'Unlimited';
    return props.rowLimit.toLocaleString();
});

// Computed properties for blocking state
const borderColor = computed(() => props.isBlocking ? 'border-red-500' : 'border-yellow-400');
const bgColor = computed(() => props.isBlocking ? 'bg-red-50' : 'bg-yellow-50');
const iconColor = computed(() => props.isBlocking ? 'text-red-500' : 'text-yellow-400');
const textColor = computed(() => props.isBlocking ? 'text-red-800' : 'text-yellow-800');
const descColor = computed(() => props.isBlocking ? 'text-red-700' : 'text-yellow-700');
const buttonColor = computed(() => props.isBlocking ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-600 hover:bg-yellow-700');
const progressBg = computed(() => props.isBlocking ? 'bg-red-200' : 'bg-yellow-200');
const progressBar = computed(() => props.isBlocking ? 'bg-red-600' : 'bg-yellow-600');
</script>

<template>
    <div
        v-if="showWarning"
        :class="[
            bgColor,
            'border-l-4',
            borderColor,
            'p-4 mb-4 rounded-md shadow-sm'
        ]"
    >
        <div class="flex items-start">
            <div class="flex-shrink-0">
                <font-awesome-icon v-if="!isBlocking" :icon="['fas', 'triangle-exclamation']" class="h-5 w-5" :class="iconColor" />
                <font-awesome-icon v-else :icon="['fas', 'shield']" class="h-5 w-5" :class="iconColor" />
            </div>
            <div class="ml-3 flex-1">
                <h3 class="text-sm font-medium" :class="textColor">
                    {{ isBlocking ? 'Save Blocked - Row Limit Exceeded' : 'Row Limit Reached' }}
                </h3>
                <div class="mt-2 text-sm" :class="descColor">
                    <p>
                        <template v-if="isBlocking">
                            Cannot save data model. Your query returns <span class="font-semibold">{{ formattedRowsReturned }}</span> rows,
                            but your <span class="font-semibold">{{ tierName }}</span> tier limit is <span class="font-semibold">{{ formattedRowLimit }}</span> rows.
                        </template>
                        <template v-else>
                            Showing <span class="font-semibold">{{ formattedRowsReturned }}</span> of potentially more rows 
                            ({{ tierName }} tier limit: <span class="font-semibold">{{ formattedRowLimit }}</span> rows per query)
                        </template>
                    </p>
                    <p class="mt-1">
                        <template v-if="isBlocking">
                            Modify your query to reduce the number of rows or upgrade to a higher tier to save this data model.
                        </template>
                        <template v-else>
                            Your query returned results that exceeded your current subscription tier limit. 
                            Upgrade to a higher tier to access more data.
                        </template>
                    </p>
                </div>
                <div class="mt-3">
                    <button
                        @click="handleUpgrade"
                        :class="[
                            'inline-flex items-center px-4 py-2 text-white text-sm font-medium rounded-md transition-colors',
                            buttonColor
                        ]"
                    >
                        <font-awesome-icon :icon="['fas', 'arrow-trend-up']" class="mr-2 h-4 w-4" />
                        Upgrade Plan
                    </button>
                </div>
            </div>
        </div>
        
        <!-- Progress bar -->
        <div class="mt-4">
            <div class="flex justify-between text-xs mb-1" :class="descColor">
                <span>Row usage</span>
                <span>{{ Math.round(limitPercentage) }}%</span>
            </div>
            <div class="w-full rounded-full h-2" :class="progressBg">
                <div
                    class="h-2 rounded-full transition-all duration-300"
                    :class="progressBar"
                    :style="{ width: `${limitPercentage}%` }"
                ></div>
            </div>
        </div>
    </div>
</template>
