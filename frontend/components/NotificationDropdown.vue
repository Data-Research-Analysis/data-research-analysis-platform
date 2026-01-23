<template>
  <div class="fixed bg-white rounded-xl shadow-2xl w-[400px] max-w-[calc(100vw-2rem)] max-h-[600px] flex flex-col overflow-hidden sm:w-[400px]" @click.stop>
    <!-- Header -->
    <div class="px-5 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
      <h3 class="m-0 text-lg font-semibold text-gray-900">Notifications</h3>
      <button
        v-if="hasUnread"
        @click="handleMarkAllRead"
        class="bg-transparent border-none text-blue-500 text-sm font-medium cursor-pointer px-2 py-1 rounded hover:bg-blue-50 transition-colors"
        type="button"
      >
        Mark all as read
      </button>
    </div>

    <!-- Body -->
    <div class="flex-1 overflow-y-auto max-h-[480px] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb:hover]:bg-gray-400">
      <!-- Loading state -->
      <div v-if="loading" class="py-10 px-5 text-center text-gray-500">
        <div class="w-8 h-8 border-3 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-3"></div>
        <p class="m-0">Loading notifications...</p>
      </div>

      <!-- Empty state -->
      <div v-else-if="notifications.length === 0" class="py-15 px-5 text-center text-gray-500">
        <font-awesome-icon :icon="['fas', 'bell-slash']" class="text-5xl text-gray-300 mb-4" />
        <p class="m-0 mb-1 text-base font-medium text-gray-700">No notifications</p>
        <span class="text-sm text-gray-400">You're all caught up!</span>
      </div>

      <!-- Notifications list -->
      <div v-else class="flex flex-col">
        <NotificationItem
          v-for="notification in notifications"
          :key="notification.id"
          :notification="notification"
          @click="handleNotificationClick(notification)"
          @delete="handleDelete(notification.id)"
        />
      </div>
    </div>

    <!-- Footer -->
    <div class="py-3 px-5 border-t border-gray-200 text-center bg-gray-50">
      <NuxtLink to="/notifications" class="text-blue-500 no-underline text-sm font-medium hover:text-blue-600 hover:underline transition-colors" @click="$emit('close')">
        View all notifications
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useNotificationStore } from '~/stores/notifications';
import type { INotificationData } from '~/types/INotification';

const emit = defineEmits<{
  close: []
}>();

const notificationStore = useNotificationStore();
const { notifications, loading, hasUnread } = storeToRefs(notificationStore);

onMounted(async () => {
  // Fetch latest notifications when dropdown opens
  await notificationStore.fetchNotifications(1, 10);
});

async function handleMarkAllRead() {
  try {
    await notificationStore.markAllAsRead();
  } catch (error) {
    console.error('Failed to mark all as read:', error);
  }
}

async function handleNotificationClick(notification: INotificationData) {
  // Mark as read if unread
  if (!notification.isRead) {
    try {
      await notificationStore.markAsRead(notification.id);
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  }

  // Navigate to link if exists
  if (notification.link) {
    emit('close');
    navigateTo(notification.link);
  }
}

async function handleDelete(notificationId: number) {
  try {
    await notificationStore.deleteNotification(notificationId);
  } catch (error) {
    console.error('Failed to delete notification:', error);
  }
}
</script>