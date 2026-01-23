<template>
  <div class="notification-dropdown" @click.stop>
    <!-- Header -->
    <div class="dropdown-header">
      <h3 class="header-title">Notifications</h3>
      <button
        v-if="hasUnread"
        @click="handleMarkAllRead"
        class="mark-all-read-btn"
        type="button"
      >
        Mark all as read
      </button>
    </div>

    <!-- Body -->
    <div class="dropdown-body">
      <!-- Loading state -->
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading notifications...</p>
      </div>

      <!-- Empty state -->
      <div v-else-if="notifications.length === 0" class="empty-state">
        <font-awesome-icon :icon="['fas', 'bell-slash']" class="empty-icon" />
        <p>No notifications</p>
        <span class="empty-subtitle">You're all caught up!</span>
      </div>

      <!-- Notifications list -->
      <div v-else class="notifications-list">
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
    <div class="dropdown-footer">
      <NuxtLink to="/notifications" class="view-all-link" @click="$emit('close')">
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

<style scoped>
.notification-dropdown {
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  width: 400px;
  max-height: 600px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Header */
.dropdown-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f9fafb;
}

.header-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.mark-all-read-btn {
  background: none;
  border: none;
  color: #3b82f6;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.mark-all-read-btn:hover {
  background-color: rgba(59, 130, 246, 0.1);
}

/* Body */
.dropdown-body {
  flex: 1;
  overflow-y: auto;
  max-height: 480px;
}

.dropdown-body::-webkit-scrollbar {
  width: 6px;
}

.dropdown-body::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.dropdown-body::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.dropdown-body::-webkit-scrollbar-thumb:hover {
  background: #a1a1a1;
}

/* Loading state */
.loading-state {
  padding: 40px 20px;
  text-align: center;
  color: #6b7280;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Empty state */
.empty-state {
  padding: 60px 20px;
  text-align: center;
  color: #6b7280;
}

.empty-icon {
  font-size: 48px;
  color: #d1d5db;
  margin-bottom: 16px;
}

.empty-state p {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 500;
  color: #374151;
}

.empty-subtitle {
  font-size: 14px;
  color: #9ca3af;
}

/* Notifications list */
.notifications-list {
  display: flex;
  flex-direction: column;
}

/* Footer */
.dropdown-footer {
  padding: 12px 20px;
  border-top: 1px solid #e5e7eb;
  text-align: center;
  background: #f9fafb;
}

.view-all-link {
  color: #3b82f6;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: color 0.2s;
}

.view-all-link:hover {
  color: #2563eb;
  text-decoration: underline;
}

/* Responsive */
@media (max-width: 480px) {
  .notification-dropdown {
    width: calc(100vw - 32px);
    max-width: 400px;
  }
}
</style>
