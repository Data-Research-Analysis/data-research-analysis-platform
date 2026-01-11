<template>
  <div class="email-preferences-page min-h-screen bg-gray-50 py-8">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900">Email Notification Preferences</h1>
        <p class="mt-2 text-sm text-gray-600">
          Manage how and when you receive email notifications from Data Research Analysis Platform
        </p>
      </div>

      <!-- Loading State -->
      <div v-if="state.loading" class="bg-white rounded-lg shadow p-8 text-center">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        <p class="mt-4 text-gray-600">Loading your preferences...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="state.error" class="bg-red-50 border border-red-200 rounded-lg p-6">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-800">Error loading preferences</h3>
            <p class="mt-1 text-sm text-red-700">{{ state.error }}</p>
            <button @click="loadPreferences" class="mt-3 text-sm font-medium text-red-600 hover:text-red-500">
              Try again
            </button>
          </div>
        </div>
      </div>

      <!-- Preferences Form -->
      <div v-else class="bg-white rounded-lg shadow">
        <div class="p-6 space-y-6">
          <!-- Subscription Updates -->
          <div class="flex items-start">
            <div class="flex items-center h-5">
              <input
                id="subscription_updates"
                type="checkbox"
                v-model="state.preferences.subscription_updates"
                class="focus:ring-purple-500 h-5 w-5 text-purple-600 border-gray-300 rounded cursor-pointer"
              />
            </div>
            <div class="ml-3 text-sm">
              <label for="subscription_updates" class="font-medium text-gray-700 cursor-pointer">
                Subscription Updates
              </label>
              <p class="text-gray-500">
                Receive notifications when your subscription is assigned, upgraded, downgraded, or cancelled
              </p>
            </div>
          </div>

          <!-- Expiration Warnings -->
          <div class="flex items-start">
            <div class="flex items-center h-5">
              <input
                id="expiration_warnings"
                type="checkbox"
                v-model="state.preferences.expiration_warnings"
                class="focus:ring-purple-500 h-5 w-5 text-purple-600 border-gray-300 rounded cursor-pointer"
              />
            </div>
            <div class="ml-3 text-sm">
              <label for="expiration_warnings" class="font-medium text-gray-700 cursor-pointer">
                Expiration Warnings
              </label>
              <p class="text-gray-500">
                Get reminders before your subscription expires (30, 7, and 1 day before expiration)
              </p>
            </div>
          </div>

          <!-- Renewal Reminders -->
          <div class="flex items-start">
            <div class="flex items-center h-5">
              <input
                id="renewal_reminders"
                type="checkbox"
                v-model="state.preferences.renewal_reminders"
                class="focus:ring-purple-500 h-5 w-5 text-purple-600 border-gray-300 rounded cursor-pointer"
              />
            </div>
            <div class="ml-3 text-sm">
              <label for="renewal_reminders" class="font-medium text-gray-700 cursor-pointer">
                Renewal Reminders
              </label>
              <p class="text-gray-500">
                Monthly reminders to renew your subscription
              </p>
            </div>
          </div>

          <!-- Promotional Emails -->
          <div class="flex items-start">
            <div class="flex items-center h-5">
              <input
                id="promotional_emails"
                type="checkbox"
                v-model="state.preferences.promotional_emails"
                class="focus:ring-purple-500 h-5 w-5 text-purple-600 border-gray-300 rounded cursor-pointer"
              />
            </div>
            <div class="ml-3 text-sm">
              <label for="promotional_emails" class="font-medium text-gray-700 cursor-pointer">
                Promotional Emails
              </label>
              <p class="text-gray-500">
                Receive updates about new features, special offers, and product announcements
              </p>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
          <button
            @click="resetToDefaults"
            :disabled="state.saving"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
          >
            Reset to Defaults
          </button>
          <button
            @click="savePreferences"
            :disabled="state.saving"
            class="px-6 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 flex items-center"
          >
            <svg v-if="state.saving" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ state.saving ? 'Saving...' : 'Save Preferences' }}
          </button>
        </div>
      </div>

      <!-- Success Message -->
      <div v-if="state.showSuccess" class="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <p class="text-sm font-medium text-green-800">Preferences saved successfully!</p>
          </div>
        </div>
      </div>

      <!-- Info Box -->
      <div class="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-blue-800">About Email Notifications</h3>
            <div class="mt-2 text-sm text-blue-700">
              <ul class="list-disc pl-5 space-y-1">
                <li>You can change your email preferences at any time</li>
                <li>Critical security notifications will always be sent regardless of preferences</li>
                <li>Unsubscribing from all emails may affect your account management experience</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEmailPreferencesStore } from '@/stores/email_preferences';
import { useNuxtApp } from '#app';

definePageMeta({
  middleware: 'auth',
});

const emailPrefsStore = useEmailPreferencesStore();
const { $swal } = useNuxtApp();

const state = reactive({
  preferences: {
    subscription_updates: true,
    expiration_warnings: true,
    renewal_reminders: true,
    promotional_emails: false,
  },
  loading: false,
  saving: false,
  error: null as string | null,
  showSuccess: false,
});

// Load preferences on mount
onMounted(async () => {
  await loadPreferences();
});

async function loadPreferences() {
  state.loading = true;
  state.error = null;
  try {
    const prefs = await emailPrefsStore.fetchPreferences();
    if (prefs) {
      state.preferences = {
        subscription_updates: prefs.subscription_updates,
        expiration_warnings: prefs.expiration_warnings,
        renewal_reminders: prefs.renewal_reminders,
        promotional_emails: prefs.promotional_emails,
      };
    }
  } catch (error: any) {
    state.error = error.message || 'Failed to load email preferences';
    console.error('Error loading preferences:', error);
  } finally {
    state.loading = false;
  }
}

async function savePreferences() {
  state.saving = true;
  state.error = null;
  state.showSuccess = false;
  try {
    await emailPrefsStore.updatePreferences(state.preferences);
    state.showSuccess = true;
    
    // Hide success message after 3 seconds
    setTimeout(() => {
      state.showSuccess = false;
    }, 3000);
  } catch (error: any) {
    state.error = error.message || 'Failed to save email preferences';
    
    $swal.fire({
      title: 'Error',
      text: state.error,
      icon: 'error',
      confirmButtonColor: '#7c3aed',
    });
  } finally {
    state.saving = false;
  }
}

async function resetToDefaults() {
  const result = await $swal.fire({
    title: 'Reset to Defaults?',
    text: 'This will reset all email preferences to their default values.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#7c3aed',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'Yes, reset',
    cancelButtonText: 'Cancel',
  });

  if (result.isConfirmed) {
    state.preferences = {
      subscription_updates: true,
      expiration_warnings: true,
      renewal_reminders: true,
      promotional_emails: false,
    };
    await savePreferences();
  }
}
</script>

<style scoped>
/* Additional custom styles if needed */
</style>
