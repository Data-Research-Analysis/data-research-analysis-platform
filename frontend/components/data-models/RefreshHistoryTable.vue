<template>
  <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
    <div class="px-4 py-3 border-b border-gray-200 bg-gray-50">
      <h3 class="text-lg font-semibold text-gray-900">Refresh History</h3>
      <p class="text-xs text-gray-500 mt-1">Last 20 refresh attempts</p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="p-8 text-center">
      <font-awesome icon="fas fa-spinner" class="animate-spin text-2xl text-gray-400" />
      <p class="text-sm text-gray-500 mt-2">Loading history...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="!history || history.length === 0" class="p-8 text-center">
      <font-awesome icon="fas fa-history" class="text-3xl text-gray-300 mb-2" />
      <p class="text-sm text-gray-600 font-medium">No Refresh History</p>
      <p class="text-xs text-gray-500 mt-1">This model hasn't been refreshed yet</p>
    </div>

    <!-- Table -->
    <div v-else class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Started
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Duration
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Rows
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Triggered By
            </th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Error
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="record in history" :key="record.id" class="hover:bg-gray-50">
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
              {{ formatDateTime(record.started_at) }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
              <RefreshStatusBadge :status="record.status.toLowerCase()" />
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
              {{ formatDuration(record.duration_ms) }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
              <div class="flex items-center gap-2">
                <span>{{ formatNumber(record.rows_after) }}</span>
                <span 
                  v-if="record.rows_changed !== 0"
                  :class="record.rows_changed > 0 ? 'text-green-600' : 'text-red-600'"
                  class="text-xs font-medium">
                  ({{ record.rows_changed > 0 ? '+' : '' }}{{ formatNumber(record.rows_changed) }})
                </span>
              </div>
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
              <span class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                <font-awesome :icon="getTriggerIcon(record.triggered_by)" class="text-xs" />
                {{ record.triggered_by }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-500">
              <div v-if="record.error_message" class="max-w-xs truncate" :title="record.error_message">
                {{ record.error_message }}
              </div>
              <span v-else class="text-gray-400">-</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  history?: any[];
  loading?: boolean;
}>();

function formatDateTime(date: string): string {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDuration(ms?: number): string {
  if (!ms) return 'N/A';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

function formatNumber(num?: number): string {
  if (num === undefined || num === null) return 'N/A';
  return new Intl.NumberFormat().format(num);
}

function getTriggerIcon(trigger: string): string {
  const icons: Record<string, string> = {
    user: 'fas fa-user',
    cascade: 'fas fa-sync',
    schedule: 'fas fa-clock',
    api: 'fas fa-code'
  };
  return icons[trigger] || 'fas fa-question';
}
</script>
