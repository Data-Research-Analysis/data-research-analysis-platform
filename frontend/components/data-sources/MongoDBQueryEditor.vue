<script setup lang="ts">
import { reactive, watch, onMounted } from 'vue';

const props = defineProps({
    modelValue: {
        type: Object,
        required: true,
        default: () => ({ collection: '', pipeline: '[]' })
    },
    collections: {
        type: Array,
        default: () => []
    }
});

const emit = defineEmits(['update:modelValue', 'run-query']);

const state = reactive({
    collection: props.modelValue.collection || '',
    pipeline: props.modelValue.pipeline || '[]',
    jsonError: null as string | null
});

// Sync from props
watch(() => props.modelValue, (newVal) => {
    if (newVal) {
        if (newVal.collection !== state.collection) state.collection = newVal.collection;
        // Don't overwrite pipeline if user is typing, only if prop changes externally drastically? 
        // For now, strict sync might overwrite user input if not careful. 
        // Better to just initialize and emit updates.
    }
}, { deep: true });

function update() {
    state.jsonError = null;
    try {
        if (state.pipeline) {
             JSON.parse(state.pipeline);
        }
    } catch (e: any) {
        state.jsonError = e.message;
    }

    emit('update:modelValue', {
        collection: state.collection,
        pipeline: state.pipeline
    });
}

function runQuery() {
    if (!state.jsonError) {
        emit('run-query');
    }
}
</script>

<template>
    <div class="flex flex-col gap-6 p-4 bg-white border border-gray-200 rounded-lg">
        <div class="flex flex-col">
            <label class="block text-sm font-medium text-gray-700 mb-2">Collection Name</label>
            <div class="relative">
                <input
                    v-model="state.collection"
                    @input="update"
                    type="text"
                    list="collections-list"
                    class="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent"
                    placeholder="Enter or select collection name..."
                />
                <!-- Datalist for collections autocomplete -->
                <datalist id="collections-list">
                    <option v-for="col in collections" :key="col" :value="col">{{ col }}</option>
                </datalist>
            </div>
            <p class="text-xs text-gray-500 mt-1">
                Type the name of the MongoDB collection you want to query.
            </p>
        </div>

        <div class="flex flex-col flex-1">
            <label class="block text-sm font-medium text-gray-700 mb-2">Aggregation Pipeline (JSON)</label>
            <div class="relative flex-1">
                <textarea
                    v-model="state.pipeline"
                    @input="update"
                    class="w-full h-64 p-3 font-mono text-sm border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-primary-blue-100 focus:border-transparent"
                    :class="{'border-red-500 focus:ring-red-200': state.jsonError}"
                    placeholder='[
  { "$match": { "status": "active" } },
  { "$group": { "_id": "$category", "count": { "$sum": 1 } } }
]'
                ></textarea>
                <div v-if="state.jsonError" class="absolute bottom-2 left-2 right-2 bg-red-100 text-red-700 px-2 py-1 rounded text-xs">
                    Invalid JSON: {{ state.jsonError }}
                </div>
            </div>
            <p class="text-xs text-gray-500 mt-1">
                Enter a standard MongoDB aggregation pipeline as a JSON array.
            </p>
        </div>

        <div class="flex justify-end">
            <button
                @click="runQuery"
                :disabled="!!state.jsonError || !state.collection"
                class="px-6 py-2 bg-primary-blue-100 text-white font-semibold rounded-lg shadow hover:bg-primary-blue-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                <font-awesome icon="fas fa-play" class="mr-2" />
                Run Pipeline
            </button>
        </div>
    </div>
</template>
