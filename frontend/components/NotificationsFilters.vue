<template>
  <div class="mb-6">
    <!-- Filter Tabs -->
    <div class="flex flex-col sm:flex-row gap-4">
      <!-- Read Status Filter -->
      <div class="flex-1">
        <label class="block text-sm font-medium text-gray-700 mb-2">Status</label>
        <div class="flex bg-white rounded-lg shadow-sm border border-gray-200 p-1">
          <button
            v-for="option in statusOptions"
            :key="option.value"
            @click="emit('update:filter', option.value as 'all' | 'unread' | 'read')"
            :class="[
              'flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer',
              filter === option.value
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            ]"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <!-- Type Filter -->
      <div class="flex-1">
        <label class="block text-sm font-medium text-gray-700 mb-2">Type</label>
        <select
          :value="type"
          @change="emit('update:type', ($event.target as HTMLSelectElement).value as NotificationType | 'all')"
          class="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option
            v-for="option in notificationTypes"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NotificationType } from '~/types/INotification';

const emit = defineEmits<{
  'update:filter': ['all' | 'unread' | 'read'];
  'update:type': [NotificationType | 'all'];
}>();

defineProps<{
  filter: 'all' | 'unread' | 'read';
  type: NotificationType | 'all';
  notificationTypes: Array<{ value: string; label: string }>;
}>();

const statusOptions = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' }
];
</script>
