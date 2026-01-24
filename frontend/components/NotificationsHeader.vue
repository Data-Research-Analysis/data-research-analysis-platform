<template>
  <div class="mb-8">
    <!-- Back Button -->
    <button
      @click="goBack"
      class="mb-4 flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
    >
      <font-awesome-icon :icon="['fas', 'arrow-left']" />
      <span>Back</span>
    </button>

    <!-- Title & Stats -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">Notifications</h1>
        <p class="mt-1 text-sm text-gray-500">
          <span v-if="unreadCount > 0" class="font-medium text-blue-600">
            {{ unreadCount }} unread
          </span>
          <span v-else class="text-gray-400">
            All caught up!
          </span>
          <span class="mx-2">·</span>
          <span>{{ totalCount }} total</span>
        </p>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-3">
        <button
          @click="emit('mark-all-read')"
          :disabled="!hasUnread || loading"
          class="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <font-awesome-icon :icon="['fas', 'check-double']" class="mr-2" />
          Mark All Read
        </button>

        <button
          @click="emit('clear-all')"
          :disabled="totalCount === 0 || loading"
          class="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <font-awesome-icon :icon="['fas', 'trash']" class="mr-2" />
          Clear All
        </button>
      </div>
    </div>

    <!-- Keyboard Shortcuts Hint -->
    <div class="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
      <p class="text-xs text-blue-700">
        <font-awesome-icon :icon="['fas', 'keyboard']" class="mr-2" />
        <span class="font-medium">Keyboard shortcuts:</span>
        <kbd class="ml-2 px-1.5 py-0.5 bg-white rounded border border-blue-200">j</kbd> / 
        <kbd class="px-1.5 py-0.5 bg-white rounded border border-blue-200">k</kbd> navigate,
        <kbd class="ml-1 px-1.5 py-0.5 bg-white rounded border border-blue-200">Enter</kbd> open,
        <kbd class="ml-1 px-1.5 py-0.5 bg-white rounded border border-blue-200">r</kbd> mark as read
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
const router = useRouter();

defineProps<{
  unreadCount: number;
  totalCount: number;
  hasUnread: boolean;
  loading: boolean;
}>();

const emit = defineEmits<{
  'mark-all-read': [];
  'clear-all': [];
}>();

function goBack() {
  // Check if there's history to go back to
  if (window.history.length > 1) {
    router.back();
  } else {
    // Fallback to projects page if no history
    router.push('/projects');
  }
}
</script>
