<template>
  <div
    class="notification-item"
    :class="{ 'unread': !notification.isRead }"
    @click="$emit('click')"
  >
    <!-- Icon -->
    <div class="notification-icon">
      <font-awesome-icon :icon="getIcon(notification.type)" :class="getIconClass(notification.type)" />
    </div>

    <!-- Content -->
    <div class="notification-content">
      <h4 class="notification-title">{{ notification.title }}</h4>
      <p class="notification-message">{{ notification.message }}</p>
      <span class="notification-time">{{ formatTime(notification.createdAt) }}</span>
    </div>

    <!-- Delete button -->
    <button
      @click.stop="$emit('delete')"
      class="delete-btn"
      aria-label="Delete notification"
      type="button"
    >
      <font-awesome-icon :icon="['fas', 'times']" />
    </button>
  </div>
</template>

<script setup lang="ts">
import type { INotificationData } from '~/types/INotification';
import { NotificationType } from '~/types/INotification';

const props = defineProps<{
  notification: INotificationData
}>();

const emit = defineEmits<{
  click: []
  delete: []
}>();

function getIcon(type: NotificationType): string[] {
  const iconMap: Record<NotificationType, string[]> = {
    [NotificationType.PROJECT_INVITATION]: ['fas', 'user-plus'],
    [NotificationType.PROJECT_MEMBER_ADDED]: ['fas', 'users'],
    [NotificationType.PROJECT_MEMBER_REMOVED]: ['fas', 'user-minus'],
    [NotificationType.DATA_SOURCE_SYNC_COMPLETE]: ['fas', 'check-circle'],
    [NotificationType.DATA_SOURCE_SYNC_FAILED]: ['fas', 'exclamation-triangle'],
    [NotificationType.DASHBOARD_SHARED]: ['fas', 'share'],
    [NotificationType.DASHBOARD_COMMENT]: ['fas', 'comment'],
    [NotificationType.SYSTEM_UPDATE]: ['fas', 'info-circle'],
    [NotificationType.ACCOUNT_UPDATE]: ['fas', 'user-cog'],
    [NotificationType.SUBSCRIPTION_EXPIRING]: ['fas', 'clock'],
    [NotificationType.PAYMENT_RECEIVED]: ['fas', 'dollar-sign'],
    [NotificationType.PAYMENT_FAILED]: ['fas', 'exclamation-circle'],
    [NotificationType.SECURITY_ALERT]: ['fas', 'shield-alt']
  };

  return iconMap[type] || ['fas', 'bell'];
}

function getIconClass(type: NotificationType): string {
  const classMap: Record<NotificationType, string> = {
    [NotificationType.PROJECT_INVITATION]: 'icon-blue',
    [NotificationType.PROJECT_MEMBER_ADDED]: 'icon-green',
    [NotificationType.PROJECT_MEMBER_REMOVED]: 'icon-gray',
    [NotificationType.DATA_SOURCE_SYNC_COMPLETE]: 'icon-green',
    [NotificationType.DATA_SOURCE_SYNC_FAILED]: 'icon-red',
    [NotificationType.DASHBOARD_SHARED]: 'icon-purple',
    [NotificationType.DASHBOARD_COMMENT]: 'icon-blue',
    [NotificationType.SYSTEM_UPDATE]: 'icon-blue',
    [NotificationType.ACCOUNT_UPDATE]: 'icon-gray',
    [NotificationType.SUBSCRIPTION_EXPIRING]: 'icon-orange',
    [NotificationType.PAYMENT_RECEIVED]: 'icon-green',
    [NotificationType.PAYMENT_FAILED]: 'icon-red',
    [NotificationType.SECURITY_ALERT]: 'icon-red'
  };

  return classMap[type] || 'icon-gray';
}

function formatTime(date: Date | string): string {
  const now = new Date();
  const notificationDate = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - notificationDate.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else {
    return notificationDate.toLocaleDateString();
  }
}
</script>

<style scoped>
.notification-item {
  display: flex;
  align-items: flex-start;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
  cursor: pointer;
  transition: background-color 0.2s;
  position: relative;
}

.notification-item:hover {
  background-color: #f9fafb;
}

.notification-item:last-child {
  border-bottom: none;
}

.notification-item.unread {
  background-color: #eff6ff;
}

.notification-item.unread::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background-color: #3b82f6;
}

.notification-item.unread .notification-title {
  font-weight: 600;
}

/* Icon */
.notification-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  font-size: 18px;
}

.icon-blue {
  background-color: #dbeafe;
  color: #3b82f6;
}

.icon-green {
  background-color: #d1fae5;
  color: #10b981;
}

.icon-red {
  background-color: #fee2e2;
  color: #ef4444;
}

.icon-orange {
  background-color: #ffedd5;
  color: #f59e0b;
}

.icon-purple {
  background-color: #f3e8ff;
  color: #a855f7;
}

.icon-gray {
  background-color: #f3f4f6;
  color: #6b7280;
}

/* Content */
.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-title {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 500;
  color: #111827;
  line-height: 1.4;
}

.notification-message {
  margin: 0 0 6px;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.notification-time {
  font-size: 12px;
  color: #9ca3af;
}

/* Delete button */
.delete-btn {
  flex-shrink: 0;
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
  opacity: 0;
  margin-left: 8px;
}

.notification-item:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  background-color: #fee2e2;
  color: #ef4444;
}
</style>
