<template>
  <div class="relative inline-block">
    <button
      ref="buttonRef"
      @click="toggleDropdown"
      class="relative bg-transparent border-none cursor-pointer p-2 rounded-md transition-colors duration-200 text-white hover:bg-black/5"
      aria-label="Notifications"
      type="button"
    >
      <font-awesome-icon :icon="['fas', 'bell']" class="text-xl" />
      <span v-if="hasUnread" class="absolute top-1 right-1 bg-red-500 text-white rounded-full px-1.5 py-0.5 text-xs font-semibold min-w-[18px] h-[18px] flex items-center justify-center shadow-md">
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </button>

    <ClientOnly>
      <Teleport to="body">
        <Transition
          enter-active-class="transition-all duration-200"
          leave-active-class="transition-all duration-200"
          enter-from-class="opacity-0 -translate-y-2"
          leave-to-class="opacity-0 -translate-y-2"
        >
          <NotificationDropdown
            v-if="isOpen && isClient"
            @close="closeDropdown"
            :style="dropdownStyle"
          />
        </Transition>
      </Teleport>

      <!-- Backdrop overlay -->
      <Transition
        enter-active-class="transition-opacity duration-200"
        leave-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isOpen && isClient"
          class="fixed inset-0 bg-black/30 z-[9998]"
          @click="closeDropdown"
        />
      </Transition>
    </ClientOnly>
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
const isClient = ref(false);
const buttonRef = ref<HTMLElement | null>(null);

const { unreadCount, hasUnread } = storeToRefs(notificationStore);

const dropdownStyle = computed(() => {
  if (!isClient.value || !buttonRef.value) return {};
  
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
  // Set client flag for SSR safety
  isClient.value = true;
  
  // Initialize Socket.IO connection
  const user = userStore.getLoggedInUser();
  if (user?.id) {
    notificationStore.initializeSocket(user.id);
    notificationStore.fetchUnreadCount();
  }

  // Add keyboard event listener
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  if (isClient.value) {
    window.removeEventListener('keydown', handleKeydown);
  }
});
</script>
