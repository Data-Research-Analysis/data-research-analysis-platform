<template>
  <div
    class="relative flex items-start px-5 py-4 border-b border-gray-200 cursor-pointer transition-colors hover:bg-gray-50 last:border-b-0 group"
    :class="{ 'bg-blue-50': !notification.isRead }"
    @click="$emit('click')"
  >
    <!-- Unread indicator bar -->
    <div v-if="!notification.isRead" class="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
    
    <!-- Icon -->
    <div class="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center mr-3 text-lg" :class="getIconClass(notification.type)">
      <font-awesome-icon :icon="getIcon(notification.type)" />
    </div>

    <!-- Content -->
    <div class="flex-1 min-w-0">
      <h4 class="m-0 mb-1 text-sm text-gray-900 leading-tight" :class="{ 'font-semibold': !notification.isRead, 'font-medium': notification.isRead }">{{ notification.title }}</h4>
      <p class="m-0 mb-1.5 text-[13px] text-gray-500 leading-relaxed line-clamp-2">{{ notification.message }}</p>
      <span class="text-xs text-gray-400">{{ formatTime(notification.createdAt) }}</span>
    </div>

    <!-- Delete button -->
    <button
      @click.stop="$emit('delete')"
      class="flex-shrink-0 bg-transparent border-none text-gray-400 cursor-pointer p-1 rounded transition-all opacity-0 group-hover:opacity-100 ml-2 hover:bg-red-100 hover:text-red-500"
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
    [NotificationType.PROJECT_INVITATION]: 'bg-blue-100 text-blue-500',
    [NotificationType.PROJECT_MEMBER_ADDED]: 'bg-green-100 text-green-500',
    [NotificationType.PROJECT_MEMBER_REMOVED]: 'bg-gray-100 text-gray-500',
    [NotificationType.DATA_SOURCE_SYNC_COMPLETE]: 'bg-green-100 text-green-500',
    [NotificationType.DATA_SOURCE_SYNC_FAILED]: 'bg-red-100 text-red-500',
    [NotificationType.DASHBOARD_SHARED]: 'bg-purple-100 text-purple-500',
    [NotificationType.DASHBOARD_COMMENT]: 'bg-blue-100 text-blue-500',
    [NotificationType.SYSTEM_UPDATE]: 'bg-blue-100 text-blue-500',
    [NotificationType.ACCOUNT_UPDATE]: 'bg-gray-100 text-gray-500',
    [NotificationType.SUBSCRIPTION_EXPIRING]: 'bg-orange-100 text-orange-500',
    [NotificationType.PAYMENT_RECEIVED]: 'bg-green-100 text-green-500',
    [NotificationType.PAYMENT_FAILED]: 'bg-red-100 text-red-500',
    [NotificationType.SECURITY_ALERT]: 'bg-red-100 text-red-500'
  };

  return classMap[type] || 'bg-gray-100 text-gray-500';
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

