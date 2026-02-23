<template>
  <div class="network-selector">
    <div class="mb-4">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Select Google Ad Manager Network
      </label>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Choose the Ad Manager network you want to connect
      </p>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="py-8 text-center">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading networks...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="py-4 px-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <p class="text-sm text-red-700 dark:text-red-400">{{ error }}</p>
      <button
        @click="retryLoad"
        class="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 underline"
      >
        Try again
      </button>
    </div>

    <!-- Empty state -->
    <div v-else-if="networks.length === 0" class="py-8 text-center">
      <font-awesome-icon :icon="['fas', 'inbox']" class="mx-auto h-12 w-12 text-gray-400" />
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">No networks found</p>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-500">
        Make sure you have access to at least one Google Ad Manager network
      </p>
    </div>

    <!-- Networks list -->
    <div v-else class="space-y-2">
      <!-- Search box -->
      <div v-if="networks.length > 5" class="mb-4">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search networks..."
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
        />
      </div>

      <!-- Network cards -->
      <div
        v-for="network in filteredNetworks"
        :key="network.networkCode"
        @click="selectNetwork(network)"
        class="p-4 border rounded-lg cursor-pointer transition-all duration-200"
        :class="{
          'border-blue-500 bg-blue-50 dark:bg-blue-900/20': selectedNetwork?.networkCode === network.networkCode,
          'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700': selectedNetwork?.networkCode !== network.networkCode
        }"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center">
              <input
                type="radio"
                :checked="selectedNetwork?.networkCode === network.networkCode"
                class="mr-3 text-blue-600 focus:ring-blue-500"
                @click.stop
              />
              <div>
                <h3 class="text-base font-medium text-gray-900 dark:text-white">
                  {{ network.displayName }}
                </h3>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Network Code: {{ network.networkCode }}
                </p>
                <div v-if="network.timeZone || network.currencyCode" class="flex gap-4 mt-2">
                  <span v-if="network.timeZone" class="text-xs text-gray-500 dark:text-gray-400">
                    <font-awesome-icon :icon="['fas', 'clock']" class="inline w-3 h-3 mr-1" />
                    {{ network.timeZone }}
                  </span>
                  <span v-if="network.currencyCode" class="text-xs text-gray-500 dark:text-gray-400">
                    <font-awesome-icon :icon="['fas', 'coins']" class="inline w-3 h-3 mr-1" />
                    {{ network.currencyCode }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div v-if="selectedNetwork?.networkCode === network.networkCode" class="ml-4">
            <font-awesome-icon :icon="['fas', 'circle-check']" class="w-6 h-6 text-blue-600" />
          </div>
        </div>
      </div>

      <!-- Network count -->
      <p class="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center">
        {{ filteredNetworks.length }} of {{ networks.length }} network{{ networks.length !== 1 ? 's' : '' }}
        {{ searchQuery ? 'matching search' : 'available' }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { IGAMNetwork } from '~/types/IGoogleAdManager';

interface Props {
  networks: IGAMNetwork[];
  isLoading?: boolean;
  error?: string | null;
  modelValue?: IGAMNetwork | null;
}

interface Emits {
  (e: 'update:modelValue', value: IGAMNetwork | null): void;
  (e: 'retry'): void;
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  error: null,
  modelValue: null
});

const emit = defineEmits<Emits>();

const searchQuery = ref('');
const selectedNetwork = computed(() => props.modelValue);

const filteredNetworks = computed(() => {
  if (!searchQuery.value) {
    return props.networks;
  }
  
  const query = searchQuery.value.toLowerCase();
  return props.networks.filter(network => 
    network.displayName.toLowerCase().includes(query) ||
    network.networkCode.toLowerCase().includes(query)
  );
});

const selectNetwork = (network: IGAMNetwork) => {
  emit('update:modelValue', network);
};

const retryLoad = () => {
  emit('retry');
};
</script>

<style scoped>
/* Add any additional styles if needed */
</style>
