<template>
  <div class="notification-bell-container" v-if="import.meta.client">
    <button
      @click="toggleDropdown"
      class="notification-bell-button"
      aria-label="Notifications"
      type="button"
    >
      <font-awesome-icon :icon="['fas', 'bell']" class="bell-icon" />
      <span v-if="hasUnread" class="notification-badge">
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </button>

    <Teleport to="body">
      <Transition name="dropdown-fade">
        <NotificationDropdown
          v-if="isOpen"
          @close="closeDropdown"
          :style="dropdownStyle"
        />
      </Transition>
    </Teleport>

    <!-- Backdrop overlay -->
    <Transition name="backdrop-fade">
      <div
        v-if="isOpen"
        class="notification-backdrop"
        @click="closeDropdown"
      />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { storeToRefs } from 'pinia';
import { useNotificationStore } from '~/stores/notifications';
import { useLoggedInUserStore } from '~/stores/logged_in_user';

const notificationStore = useNotificationStore();
const userStore = useLoggedInUserStore();

const isOpen = ref(false);
const buttonRef = ref<HTMLElement | null>(null);

const { unreadCount, hasUnread } = storeToRefs(notificationStore);

const dropdownStyle = computed(() => {
  if (!import.meta.client || !buttonRef.value) return {};
  
  const rect = buttonRef.value.getBoundingClientRect();
  return {
    position: 'fixed',
    top: `${rect.bottom + 8}px`,
    right: `${window.innerWidth - rect.right}px`,
    zIndex: '9999'
  };
});

function toggleDropdown() {
  isOpen.value = !isOpen.value;
  
  if (isOpen.value) {
    // Fetch latest notifications when opening
    notificationStore.fetchNotifications(1, 10);
  }
}

function closeDropdown() {
  isOpen.value = false;
}

// Close dropdown on Escape key
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isOpen.value) {
    closeDropdown();
  }
}

onMounted(() => {
  if (import.meta.client) {
    // Initialize Socket.IO connection
    const user = userStore.getLoggedInUser();
    if (user?.id) {
      notificationStore.initializeSocket(user.id);
      notificationStore.fetchUnreadCount();
    }

    // Add keyboard event listener
    window.addEventListener('keydown', handleKeydown);
  }
});

onBeforeUnmount(() => {
  if (import.meta.client) {
    window.removeEventListener('keydown', handleKeydown);
  }
});
</script>

<style scoped>
.notification-bell-container {
  position: relative;
  display: inline-block;
}

.notification-bell-button {
  position: relative;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  transition: background-color 0.2s;
  color: var(--text-primary, #333);
}

.notification-bell-button:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.bell-icon {
  font-size: 20px;
}

.notification-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  background: #ff4444;
  color: white;
  border-radius: 10px;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 600;
  min-width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.notification-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 9998;
}

/* Transitions */
.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.backdrop-fade-enter-active,
.backdrop-fade-leave-active {
  transition: opacity 0.2s;
}

.backdrop-fade-enter-from,
.backdrop-fade-leave-to {
  opacity: 0;
}
</style>
