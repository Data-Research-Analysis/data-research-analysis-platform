<template>
  <transition
    enter-active-class="transition ease-out duration-300 transform"
    enter-from-class="translate-y-full opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition ease-in duration-200 transform"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-full opacity-0"
  >
    <div v-if="showBanner" class="fixed bottom-0 left-0 right-0 z-50 bg-primary-blue-300 text-white shadow-[0_-8px_30px_rgba(0,0,0,0.4)]">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div class="flex flex-col lg:flex-row items-start lg:items-center gap-4">
          <!-- Icon -->
          <div class="flex-shrink-0 hidden sm:block">
            <font-awesome icon="fas fa-cookie-bite" class="text-4xl text-white opacity-90" />
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <h3 class="text-lg font-semibold mb-2">We Use Cookies</h3>
            <p class="text-sm opacity-95 leading-relaxed">
              This site uses <strong>essential cookies</strong> for authentication and app functionality, plus <strong>Google Analytics</strong> to understand how you use our platform. We do NOT sell your data.
              <NuxtLink to="/privacy-policy" class="underline hover:text-blue-200 ml-1">Learn more</NuxtLink>
            </p>
          </div>

          <!-- Actions -->
          <div class="flex flex-col sm:flex-row gap-3 w-full lg:w-auto flex-shrink-0">
            <button
              @click="acceptAll"
              class="px-6 py-2.5 bg-white text-primary-blue-100 font-semibold rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-transform cursor-pointer"
            >
              Accept All
            </button>
            <button
              @click="essentialOnly"
              class="px-6 py-2.5 bg-transparent text-white font-semibold border-2 border-white rounded-lg hover:bg-white hover:text-blue-300 hover:bg-opacity-10 active:bg-opacity-20 transition-colors cursor-pointer"
            >
              Essential Only
            </button>
            <button
              @click="showSettings = true"
              class="px-6 py-2.5 text-white font-medium underline hover:text-blue-200 transition-colors text-center cursor-pointer"
            >
              Customize
            </button>
          </div>

          <!-- Close button -->
          <button
            @click="essentialOnly"
            class="absolute top-4 right-4 lg:relative lg:top-0 lg:right-0 text-white hover:text-blue-200 transition-colors p-2 cursor-pointer"
            aria-label="Close and use essential cookies only"
          >
            <font-awesome icon="fas fa-times" class="text-xl" />
          </button>
        </div>
      </div>
    </div>
  </transition>

  <!-- Settings Modal -->
  <transition
    enter-active-class="transition ease-out duration-200"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition ease-in duration-150"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="showSettings" class="fixed inset-0 z-50 overflow-y-auto" @click.self="showSettings = false">
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black bg-opacity-50 transition-opacity"></div>

      <!-- Modal -->
      <div class="flex min-h-full items-center justify-center p-4">
        <div class="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 sm:p-8">
          <!-- Header -->
          <div class="flex items-start justify-between mb-6">
            <h2 class="text-2xl font-bold text-gray-900">Cookie Settings</h2>
            <button
              @click="showSettings = false"
              class="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              <font-awesome icon="fas fa-times" class="text-xl" />
            </button>
          </div>

          <!-- Cookie Categories -->
          <div class="space-y-6">
            <!-- Essential Cookies -->
            <div class="border border-gray-200 rounded-lg p-4">
              <div class="flex items-center justify-between mb-2">
                <h3 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <font-awesome icon="fas fa-shield-alt" class="text-green-600" />
                  Essential Cookies
                </h3>
                <span class="text-sm font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full">
                  Always Active
                </span>
              </div>
              <p class="text-sm text-gray-600 mb-2">
                Required for the website to function. These cannot be disabled.
              </p>
              <ul class="text-sm text-gray-500 list-disc list-inside space-y-1">
                <li>Authentication token (dra_auth_token)</li>
                <li>Application state (localStorage)</li>
                <li>OAuth session data (sessionStorage)</li>
              </ul>
            </div>

            <!-- Analytics Cookies -->
            <div class="border border-gray-200 rounded-lg p-4">
              <div class="flex items-center justify-between mb-2">
                <h3 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <font-awesome icon="fas fa-chart-line" class="text-blue-600" />
                  Analytics Cookies
                </h3>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    v-model="analyticsEnabled"
                    type="checkbox"
                    class="sr-only peer"
                  />
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <p class="text-sm text-gray-600 mb-2">
                Help us understand how visitors use our site to improve user experience.
              </p>
              <ul class="text-sm text-gray-500 list-disc list-inside space-y-1">
                <li>Google Analytics (GA4) - Traffic analysis</li>
                <li>Page views and user behavior tracking</li>
                <li>Anonymous usage statistics</li>
              </ul>
            </div>
          </div>

          <!-- Privacy Notice -->
          <div class="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div class="flex gap-3">
              <font-awesome icon="fas fa-info-circle" class="text-blue-600 flex-shrink-0 mt-0.5" />
              <div class="text-sm text-blue-900">
                <p class="font-medium mb-1">Your Privacy Matters</p>
                <p>We do NOT sell your data to third parties. Analytics data is used solely to improve our service.</p>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex flex-col sm:flex-row gap-3 mt-6">
            <button
              @click="savePreferences"
              class="flex-1 px-6 py-3 bg-primary-blue-100 text-white font-semibold rounded-lg hover:bg-primary-blue-200 active:bg-primary-blue-300 transition-colors cursor-pointer"
            >
              Save Preferences
            </button>
            <button
              @click="acceptAll"
              class="flex-1 px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-colors cursor-pointer"
            >
              Accept All
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const showBanner = ref(false);
const showSettings = ref(false);
const analyticsEnabled = ref(true);

onMounted(() => {
  if (import.meta.client) {
    // Check if user already made a choice
    const consent = localStorage.getItem('cookie_consent');
    const timestamp = localStorage.getItem('cookie_consent_timestamp');

    if (!consent) {
      // First time visitor - show banner
      showBanner.value = true;
    } else if (timestamp) {
      // Re-show after 180 days (GDPR recommendation)
      const daysSince = (Date.now() - parseInt(timestamp)) / (1000 * 60 * 60 * 24);
      if (daysSince > 180) {
        showBanner.value = true;
      } else {
        // Load saved preferences
        const preferences = JSON.parse(consent);
        analyticsEnabled.value = preferences.analytics || false;

        // Apply analytics consent
        if (!preferences.analytics) {
          disableGoogleAnalytics();
        }
      }
    }
  }
});

function acceptAll() {
  saveConsent({ essential: true, analytics: true });
  analyticsEnabled.value = true;
  showBanner.value = false;
  showSettings.value = false;

  // Enable Google Analytics
  enableGoogleAnalytics();
}

function essentialOnly() {
  saveConsent({ essential: true, analytics: false });
  analyticsEnabled.value = false;
  showBanner.value = false;
  showSettings.value = false;

  // Disable Google Analytics
  disableGoogleAnalytics();
}

function savePreferences() {
  saveConsent({
    essential: true,
    analytics: analyticsEnabled.value
  });
  showBanner.value = false;
  showSettings.value = false;

  if (analyticsEnabled.value) {
    enableGoogleAnalytics();
  } else {
    disableGoogleAnalytics();
  }
}

function saveConsent(preferences: { essential: boolean; analytics: boolean }) {
  if (import.meta.client) {
    localStorage.setItem('cookie_consent', JSON.stringify(preferences));
    localStorage.setItem('cookie_consent_timestamp', Date.now().toString());
  }
}

function enableGoogleAnalytics() {
  if (import.meta.client && (window as any).gtag) {
    (window as any).gtag('consent', 'update', {
      analytics_storage: 'granted'
    });
  }
}

function disableGoogleAnalytics() {
  if (import.meta.client) {
    // Set GA consent to denied
    if ((window as any).gtag) {
      (window as any).gtag('consent', 'update', {
        analytics_storage: 'denied'
      });
    }

    // Delete GA cookies
    const gaCookies = ['_ga', '_gid', '_gat'];
    gaCookies.forEach(cookieName => {
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    });

    // Delete GA cookies with specific patterns
    document.cookie.split(';').forEach(cookie => {
      const cookieName = cookie.split('=')[0].trim();
      if (cookieName.startsWith('_ga')) {
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      }
    });
  }
}
</script>
