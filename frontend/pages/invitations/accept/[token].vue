<template>
  <div class="min-h-screen overflow-x-hidden bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-2xl mx-auto">
      <!-- Loading State -->
      <div v-if="loading" class="bg-white rounded-lg shadow-xl p-8 text-center">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p class="mt-4 text-gray-600">Loading invitation...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-white rounded-lg shadow-xl p-8">
        <div class="text-center">
          <font-awesome-icon :icon="['fas', 'circle-info']" class="mx-auto h-16 w-16 text-red-500" />
          <h2 class="mt-4 text-2xl font-bold text-gray-900">Invalid or Expired Invitation</h2>
          <p class="mt-2 text-gray-600">{{ error }}</p>
          <div class="mt-6 space-y-3">
            <NuxtLink to="/login" class="block w-full text-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer">
              Go to Login
            </NuxtLink>
            <NuxtLink to="/" class="block w-full text-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors cursor-pointer">
              Back to Home
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Success State -->
      <div v-else-if="accepted" class="bg-white rounded-lg shadow-xl p-8">
        <div class="text-center">
          <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
            <font-awesome-icon :icon="['fas', 'check']" class="h-10 w-10 text-green-600" />
          </div>
          <h2 class="mt-4 text-2xl font-bold text-gray-900">Invitation Accepted!</h2>
          <p class="mt-2 text-gray-600">You've successfully joined the project.</p>
          <div class="mt-6">
            <NuxtLink :to="`/projects`" class="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer">
              Go to Projects
              <font-awesome-icon :icon="['fas', 'arrow-right']" class="ml-2 -mr-1 h-5 w-5" />
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Invitation Details (Not Accepted Yet) -->
      <div v-else-if="invitation" class="bg-white rounded-lg shadow-xl overflow-hidden">
        <div class="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
          <h1 class="text-3xl font-bold text-white">You're Invited!</h1>
          <p class="mt-2 text-blue-100">Join a collaborative data analytics project</p>
        </div>

        <div class="p-8">
          <!-- Project Details -->
          <div class="bg-blue-50 border-l-4 border-blue-500 p-6 mb-6">
            <dl class="space-y-3">
              <div>
                <dt class="text-sm font-medium text-gray-500">Project Name</dt>
                <dd class="mt-1 text-xl font-semibold text-gray-900">{{ invitation.project_name }}</dd>
              </div>
              <div>
                <dt class="text-sm font-medium text-gray-500">Invited by</dt>
                <dd class="mt-1 text-base text-gray-900">{{ invitation.invited_by_name }}</dd>
              </div>
              <div>
                <dt class="text-sm font-medium text-gray-500">Your Role</dt>
                <dd class="mt-1">
                  <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    {{ invitation.role }}
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          <!-- Expiration Warning -->
          <div v-if="isExpiringSoon" class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div class="flex">
              <div class="flex-shrink-0">
                <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="h-5 w-5 text-yellow-400" />
              </div>
              <div class="ml-3">
                <p class="text-sm text-yellow-700">
                  This invitation expires {{ formatExpirationTime(invitation.expires_at) }}
                </p>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div v-if="isLoggedIn" class="space-y-3">
            <button
              @click="acceptInvitation"
              :disabled="accepting"
              class="w-full flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <span v-if="accepting">
                <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                Accepting...
              </span>
              <span v-else>Accept Invitation</span>
            </button>
            <p class="text-sm text-gray-500 text-center">
              Logged in as {{ userEmail }}
            </p>
          </div>

          <!-- Not Logged In -->
          <div v-else class="space-y-3">
            <p class="text-center text-gray-600 mb-4">
              Please log in or create an account to accept this invitation
            </p>
            <NuxtLink 
              :to="`/login?redirect=/invitations/accept/${token}`" 
              class="block w-full text-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Log In
            </NuxtLink>
            <NuxtLink 
              :to="`/register?redirect=/invitations/accept/${token}&email=${encodeURIComponent(invitation.invited_email)}`" 
              class="block w-full text-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Create Account
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useLoggedInUserStore } from '~/stores/logged_in_user';
import { useProjectsStore } from '~/stores/projects';
import { getAuthToken } from '~/composables/AuthToken';

const router = useRouter();
const route = useRoute();
const loggedInUserStore = useLoggedInUserStore();
const projectsStore = useProjectsStore();

const token = computed(() => route.params.token as string);
const loading = ref(true);
const accepting = ref(false);
const error = ref('');
const invitation = ref<any>(null);
const accepted = ref(false);

const isLoggedIn = computed(() => !!loggedInUserStore.getLoggedInUser);
const userEmail = computed(() => loggedInUserStore.getLoggedInUser()?.email || '');

const isExpiringSoon = computed(() => {
  if (!invitation.value?.expires_at) return false;
  const expiresAt = new Date(invitation.value.expires_at);
  const now = new Date();
  const hoursDiff = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
  return hoursDiff < 24 && hoursDiff > 0;
});

onMounted(async () => {
  await fetchInvitation();
});

async function fetchInvitation() {
  try {
    loading.value = true;
    const data = await $fetch(`${useRuntimeConfig().public.NUXT_API_URL}/project-invitations/token/${token.value}`);

    if (!data.success) {
      error.value = data.message || 'Failed to load invitation';
      return;
    }

    invitation.value = data.invitation;

    // Check if already expired
    if (invitation.value.status === 'expired' || new Date(invitation.value.expires_at) < new Date()) {
      error.value = 'This invitation has expired';
      return;
    }

    // Check if already accepted
    if (invitation.value.status === 'accepted') {
      error.value = 'This invitation has already been accepted';
      return;
    }

    // Check if cancelled
    if (invitation.value.status === 'cancelled') {
      error.value = 'This invitation has been cancelled';
      return;
    }
  } catch (err: any) {
    console.error('Error fetching invitation:', err);
    error.value = 'Failed to load invitation. Please try again.';
  } finally {
    loading.value = false;
  }
}

async function acceptInvitation() {
  if (!isLoggedIn.value) {
    router.push(`/login?redirect=/invitations/accept/${token.value}`);
    return;
  }

  try {
    accepting.value = true;
    const authToken = getAuthToken();
    
    // Verify we have a valid token before proceeding
    if (!authToken) {
      error.value = 'Authentication required. Please log in.';
      router.push(`/login?redirect=/invitations/accept/${token.value}`);
      return;
    }
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${authToken}`,
      'authorization-type': 'auth'
    };
    
    const data = await $fetch(`${useRuntimeConfig().public.NUXT_API_URL}/project-invitations/accept`, {
      method: 'POST',
      headers,
      body: { token: token.value }
    });

    if (!data.success) {
      error.value = data.message || 'Failed to accept invitation';
      return;
    }

    accepted.value = true;
    
    // Refresh projects store to show the newly joined project
    await projectsStore.retrieveProjects();
    
    // Redirect after a brief delay
    setTimeout(() => {
      router.push('/projects');
    }, 2000);
  } catch (err: any) {
    console.error('Error accepting invitation:', err);
    error.value = 'Failed to accept invitation. Please try again.';
  } finally {
    accepting.value = false;
  }
}

function formatExpirationTime(expiresAt: string): string {
  const expires = new Date(expiresAt);
  const now = new Date();
  const hoursDiff = (expires.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  if (hoursDiff < 0) return 'has expired';
  if (hoursDiff < 1) return 'in less than an hour';
  if (hoursDiff < 24) return `in ${Math.round(hoursDiff)} hours`;
  
  const daysDiff = Math.round(hoursDiff / 24);
  return `in ${daysDiff} day${daysDiff > 1 ? 's' : ''}`;
}
</script>
