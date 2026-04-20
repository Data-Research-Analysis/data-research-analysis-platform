<template>
  <div>
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

  <!-- Minimal notice for non-EU regions -->
  <transition
    enter-active-class="transition ease-out duration-300 transform"
    enter-from-class="translate-y-full opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition ease-in duration-200 transform"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-full opacity-0"
  >
    <div v-if="showMinimalNotice" class="fixed bottom-4 right-4 z-50 bg-white rounded-lg shadow-2xl max-w-md border border-gray-200">
      <div class="p-4">
        <div class="flex items-start gap-3">
          <font-awesome-icon :icon="['fas', 'cookie-bite']" class="text-2xl text-primary-blue-100 flex-shrink-0 mt-1" />
          <div class="flex-1 min-w-0">
            <p class="text-sm text-gray-700 mb-2">
              <template v-if="userRegion === 'california'">
                We use cookies for analytics. You have the right to opt out.
              </template>
              <template v-else>
                We use cookies to improve your experience.
              </template>
              <NuxtLink to="/privacy-policy" class="text-primary-blue-100 underline hover:text-primary-blue-200 ml-1">
                Privacy Policy
              </NuxtLink>
            </p>
            <div class="flex gap-2 flex-wrap">
              <button
                v-if="userRegion === 'california'"
                @click="handleCCPAOptOut"
                class="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Do Not Sell My Info
              </button>
              <button
                @click="showSettings = true"
                class="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cookie Settings
              </button>
              <button
                @click="dismissMinimalNotice"
                class="text-xs px-3 py-1.5 bg-primary-blue-100 text-white rounded hover:bg-primary-blue-200 transition-colors cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
          <button
            @click="dismissMinimalNotice"
            class="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            aria-label="Close notice"
          >
            <font-awesome-icon :icon="['fas', 'xmark']" />
          </button>
        </div>
      </div>
    </div>
  </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useGeolocation, type ConsentRegion } from '@/composables/useGeolocation';

const showBanner = ref(false);
const showMinimalNotice = ref(false);
const showSettings = ref(false);
const analyticsEnabled = ref(true);
const geolocation = useGeolocation();
const userRegion = ref<ConsentRegion>('eu_eea_uk'); // Default to strictest

onMounted(async () => {
  if (import.meta.client) {
    // Detect user region first
    userRegion.value = await geolocation.detectRegion();
    
    // Check if user already made a choice
    const consent = localStorage.getItem('cookie_consent');
    const timestamp = localStorage.getItem('cookie_consent_timestamp');

    if (!consent) {
      // First-time visitor
      if (userRegion.value === 'eu_eea_uk') {
        // EU: Show full opt-in banner
        showBanner.value = true;
      } else {
        // Non-EU: Auto-accept and track
        autoAcceptForRegion(userRegion.value);
      }
    } else {
      // Returning visitor - check consent expiry
      if (timestamp) {
        const daysSince = (Date.now() - parseInt(timestamp)) / (1000 * 60 * 60 * 24);
        if (daysSince > 180) {
          // Consent expired - show appropriate UI based on region
          if (userRegion.value === 'eu_eea_uk') {
            showBanner.value = true;
          } else {
            autoAcceptForRegion(userRegion.value);
          }
        } else {
          // Load saved preferences to sync local state
          const preferences = JSON.parse(consent);
          analyticsEnabled.value = preferences.analytics || false;
        }
      } else {
        // No timestamp - show appropriate UI
        if (userRegion.value === 'eu_eea_uk') {
          showBanner.value = true;
        }
      }
    }
  }
});

function autoAcceptForRegion(region: ConsentRegion) {
  const minimalDismissed = localStorage.getItem('minimal_notice_dismissed');
  
  if (region === 'california') {
    // CCPA: Track by default, show minimal opt-out notice
    saveConsent({ 
      essential: true, 
      analytics: true,
      region,
      ccpaOptOut: false 
    });
    enableGoogleAnalytics();
    
    // Show notice if not previously dismissed
    if (!minimalDismissed) {
      showMinimalNotice.value = true;
    }
  } else if (region === 'rest_of_world') {
    // Implied consent: Track, show dismissible notice
    saveConsent({ 
      essential: true, 
      analytics: true,
      region 
    });
    enableGoogleAnalytics();
    
    // Show notice if not previously dismissed
    if (!minimalDismissed) {
      showMinimalNotice.value = true;
    }
  }
}

function acceptAll() {
  saveConsent({ 
    essential: true, 
    analytics: true,
    region: userRegion.value 
  });
  analyticsEnabled.value = true;
  showBanner.value = false;
  showSettings.value = false;
  showMinimalNotice.value = false;

  // Enable Google Analytics
  enableGoogleAnalytics();
}

function essentialOnly() {
  saveConsent({ 
    essential: true, 
    analytics: false,
    region: userRegion.value 
  });
  analyticsEnabled.value = false;
  showBanner.value = false;
  showSettings.value = false;
  showMinimalNotice.value = false;

  // Disable Google Analytics
  disableGoogleAnalytics();
}

function savePreferences() {
  saveConsent({
    essential: true,
    analytics: analyticsEnabled.value,
    region: userRegion.value
  });
  showBanner.value = false;
  showSettings.value = false;
  showMinimalNotice.value = false;

  if (analyticsEnabled.value) {
    enableGoogleAnalytics();
  } else {
    disableGoogleAnalytics();
  }
}

function handleCCPAOptOut() {
  // Stop analytics
  disableGoogleAnalytics();
  
  // Update consent
  saveConsent({
    essential: true,
    analytics: false,
    region: 'california',
    ccpaOptOut: true
  });
  
  analyticsEnabled.value = false;
  showMinimalNotice.value = false;
  
  // Show confirmation toast
  if (import.meta.client) {
    alert('Your preference has been saved. We will not track your activity.');
  }
}

function dismissMinimalNotice() {
  showMinimalNotice.value = false;
  if (import.meta.client) {
    localStorage.setItem('minimal_notice_dismissed', 'true');
  }
}

function saveConsent(preferences: { 
  essential: boolean; 
  analytics: boolean;
  region: ConsentRegion;
  ccpaOptOut?: boolean;
}) {
  if (import.meta.client) {
    localStorage.setItem('cookie_consent', JSON.stringify(preferences));
    localStorage.setItem('cookie_consent_timestamp', Date.now().toString());
  }
}

function enableGoogleAnalytics() {
  if (import.meta.client && (window as any).gtag) {
    (window as any).gtag('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'denied',           // Keep denied for privacy
      ad_user_data: 'denied',         // Consent Mode v2
      ad_personalization: 'denied'    // Consent Mode v2
    });
  }
}

function disableGoogleAnalytics() {
  if (import.meta.client) {
    // Set GA consent to denied
    if ((window as any).gtag) {
      (window as any).gtag('consent', 'update', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
    }

    // Build the domain attribute variants to cover both root and subdomain-scoped cookies.
    // GA sets cookies on the root domain with a leading dot (e.g. .dataresearchanalysis.com)
    // so deletion without a matching domain attribute has no effect on those cookies.
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    // Root domain = last two labels (e.g. dataresearchanalysis.com)
    const rootDomain = parts.length >= 2 ? parts.slice(-2).join('.') : hostname;
    const domainVariants = [hostname, `.${hostname}`, rootDomain, `.${rootDomain}`];
    const expiry = 'expires=Thu, 01 Jan 1970 00:00:00 UTC';

    // Delete GA cookies
    const deleteCookie = (name: string) => {
      // Delete with no domain (catches localhost/exact-match cookies)
      document.cookie = `${name}=; ${expiry}; path=/;`;
      // Delete with each domain variant to catch subdomain- and root-domain-scoped cookies
      domainVariants.forEach(domain => {
        document.cookie = `${name}=; ${expiry}; path=/; domain=${domain};`;
      });
    };

    const knownGACookies = ['_ga', '_gid', '_gat'];
    knownGACookies.forEach(deleteCookie);

    // Also catch dynamically named GA cookies (e.g. _ga_XXXXXXXX container IDs)
    document.cookie.split(';').forEach(cookie => {
      const cookieName = cookie.split('=')[0].trim();
      if (cookieName.startsWith('_ga')) {
        deleteCookie(cookieName);
      }
    });
  }
}
</script>
