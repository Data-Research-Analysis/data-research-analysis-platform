<template>
  <div class="py-16 px-4 text-center">
    <!-- Icon -->
    <div class="mb-6">
      <font-awesome-icon
        :icon="icon"
        class="text-6xl text-gray-300"
      />
    </div>

    <!-- Title -->
    <h3 class="text-xl font-semibold text-gray-900 mb-2">
      {{ title }}
    </h3>

    <!-- Message -->
    <p class="text-gray-500 mb-6 max-w-md mx-auto">
      {{ message }}
    </p>

    <!-- Action Button (optional) -->
    <NuxtLink
      v-if="showAction"
      to="/marketing-projects"
      class="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
    >
      <font-awesome-icon :icon="['fas', 'arrow-left']" class="mr-2" />
      Go to Projects
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  filter: 'all' | 'unread' | 'read';
}>();

const icon = computed(() => {
  switch (props.filter) {
    case 'unread':
      return ['fas', 'inbox'];
    case 'read':
      return ['fas', 'check-circle'];
    default:
      return ['fas', 'bell-slash'];
  }
});

const title = computed(() => {
  switch (props.filter) {
    case 'unread':
      return 'No Unread Notifications';
    case 'read':
      return 'No Read Notifications';
    default:
      return 'No Notifications';
  }
});

const message = computed(() => {
  switch (props.filter) {
    case 'unread':
      return "You're all caught up! All your notifications have been read.";
    case 'read':
      return "You haven't read any notifications yet.";
    default:
      return "You don't have any notifications yet. When you get notifications, they'll appear here.";
  }
});

const showAction = computed(() => props.filter === 'all');
</script>
