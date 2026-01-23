<template>
  <div class="min-h-screen bg-gray-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <NotificationsHeader
        :unread-count="unreadCount"
        :total-count="totalNotifications"
        :has-unread="hasUnread"
        :loading="loading"
        @mark-all-read="handleMarkAllRead"
        @clear-all="handleClearAll"
      />

      <!-- Filters -->
      <NotificationsFilters
        v-model:filter="state.currentFilter"
        v-model:type="state.selectedType"
        :notification-types="notificationTypes"
      />

      <!-- Content -->
      <div class="mt-6 bg-white rounded-lg shadow-sm">
        <!-- Loading State -->
        <div v-if="loading && state.currentPage === 1" class="divide-y divide-gray-200">
          <NotificationSkeleton v-for="i in 5" :key="i" />
        </div>

        <!-- Notifications List -->
        <div v-else-if="filteredNotifications.length > 0" class="divide-y divide-gray-200">
          <NotificationItem
            v-for="notification in filteredNotifications"
            :key="notification.id"
            :notification="notification"
            @click="handleNotificationClick(notification)"
            @delete="handleDelete(notification.id)"
          />

          <!-- Load More Button -->
          <div v-if="hasMore" class="p-4 text-center border-t border-gray-200">
            <button
              @click="loadMore"
              :disabled="loading"
              class="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {{ loading ? 'Loading...' : 'Load More' }}
            </button>
          </div>
        </div>

        <!-- Empty State -->
        <NotificationsEmptyState v-else :filter="state.currentFilter" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onBeforeUnmount } from 'vue';
import { useNotificationStore } from '~/stores/notifications';
import type { INotificationData } from '~/types/INotification';
import { NotificationType } from '~/types/INotification';

// Meta tags for SEO
useHead({
  title: 'Notifications - Data Research Analysis',
  meta: [
    { name: 'description', content: 'View and manage your notifications' }
  ]
});

// Store
const notificationStore = useNotificationStore();
const { $swal } = useNuxtApp();

// State
const state = reactive({
  currentFilter: 'all' as 'all' | 'unread' | 'read',
  selectedType: 'all' as NotificationType | 'all',
  currentPage: 1,
  selectedIndex: -1
});

const loading = ref(false);
const totalNotifications = ref(0);
const hasMore = ref(false);

// Computed
const notifications = computed(() => notificationStore.notifications);
const unreadCount = computed(() => notificationStore.unreadCount);
const hasUnread = computed(() => notificationStore.hasUnread);

const notificationTypes = computed(() => [
  { value: 'all', label: 'All Types' },
  { value: NotificationType.PROJECT_INVITATION, label: 'Project Invitations' },
  { value: NotificationType.PROJECT_MEMBER_ADDED, label: 'Member Added' },
  { value: NotificationType.DATA_SOURCE_SYNC_COMPLETE, label: 'Sync Complete' },
  { value: NotificationType.DATA_SOURCE_SYNC_FAILED, label: 'Sync Failed' },
  { value: NotificationType.DASHBOARD_SHARED, label: 'Dashboard Shared' },
  { value: NotificationType.SYSTEM_UPDATE, label: 'System Updates' },
  { value: NotificationType.SECURITY_ALERT, label: 'Security Alerts' }
]);

const filteredNotifications = computed(() => {
  let filtered = notifications.value;

  // Filter by read status
  if (state.currentFilter === 'unread') {
    filtered = filtered.filter(n => !n.isRead);
  } else if (state.currentFilter === 'read') {
    filtered = filtered.filter(n => n.isRead);
  }

  // Filter by type
  if (state.selectedType !== 'all') {
    filtered = filtered.filter(n => n.type === state.selectedType);
  }

  return filtered;
});

// Methods
async function fetchNotifications(page = 1) {
  loading.value = true;
  try {
    const response = await notificationStore.fetchNotifications(page, 20);
    totalNotifications.value = response.total;
    hasMore.value = notifications.value.length < response.total;
    state.currentPage = page;
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    if ($swal) {
      $swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to load notifications. Please try again.'
      });
    }
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  await fetchNotifications(state.currentPage + 1);
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
    navigateTo(notification.link);
  }
}

async function handleMarkAllRead() {
  if (!hasUnread.value) return;

  try {
    await notificationStore.markAllAsRead();
    if ($swal) {
      $swal.fire({
        icon: 'success',
        title: 'Success',
        text: 'All notifications marked as read',
        timer: 2000,
        showConfirmButton: false
      });
    }
  } catch (error) {
    console.error('Failed to mark all as read:', error);
    if ($swal) {
      $swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to mark all as read. Please try again.'
      });
    }
  }
}

async function handleClearAll() {
  if (notifications.value.length === 0) return;

  const result = await $swal?.fire({
    icon: 'warning',
    title: 'Clear All Notifications?',
    text: 'This action cannot be undone. All notifications will be permanently deleted.',
    showCancelButton: true,
    confirmButtonText: 'Yes, clear all',
    cancelButtonText: 'Cancel',
    confirmButtonColor: '#ef4444'
  });

  if (result?.isConfirmed) {
    try {
      // Delete all notifications one by one
      const deletePromises = notifications.value.map(n => 
        notificationStore.deleteNotification(n.id)
      );
      await Promise.all(deletePromises);
      
      if ($swal) {
        $swal.fire({
          icon: 'success',
          title: 'Cleared',
          text: 'All notifications have been deleted',
          timer: 2000,
          showConfirmButton: false
        });
      }
    } catch (error) {
      console.error('Failed to clear notifications:', error);
      if ($swal) {
        $swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to clear notifications. Please try again.'
        });
      }
    }
  }
}

async function handleDelete(notificationId: number) {
  try {
    await notificationStore.deleteNotification(notificationId);
  } catch (error) {
    console.error('Failed to delete notification:', error);
  }
}

// Keyboard shortcuts
function handleKeydown(event: KeyboardEvent) {
  const items = filteredNotifications.value;
  if (items.length === 0) return;

  switch (event.key) {
    case 'j': // Next
      event.preventDefault();
      state.selectedIndex = Math.min(state.selectedIndex + 1, items.length - 1);
      break;
    case 'k': // Previous
      event.preventDefault();
      state.selectedIndex = Math.max(state.selectedIndex - 1, 0);
      break;
    case 'Enter': // Open selected
      event.preventDefault();
      if (state.selectedIndex >= 0 && state.selectedIndex < items.length) {
        handleNotificationClick(items[state.selectedIndex]);
      }
      break;
    case 'r': // Mark as read
      event.preventDefault();
      if (state.selectedIndex >= 0 && state.selectedIndex < items.length) {
        const notification = items[state.selectedIndex];
        if (!notification.isRead) {
          notificationStore.markAsRead(notification.id);
        }
      }
      break;
  }
}

// Lifecycle
onMounted(() => {
  fetchNotifications(1);
  
  // Add keyboard listeners
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
});

// SSR prefetch
onServerPrefetch(async () => {
  await notificationStore.fetchNotifications(1, 20);
});
</script>
