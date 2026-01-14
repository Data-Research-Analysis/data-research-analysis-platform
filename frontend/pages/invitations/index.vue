<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Project Invitations</h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">Manage your pending project invitations</p>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center items-center py-12">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>

      <!-- Empty State -->
      <div v-else-if="!invitations || invitations.length === 0" class="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
        <svg class="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <h3 class="mt-4 text-lg font-medium text-gray-900 dark:text-white">No pending invitations</h3>
        <p class="mt-2 text-gray-600 dark:text-gray-400">You don't have any pending project invitations at the moment.</p>
        <div class="mt-6">
          <NuxtLink to="/projects" class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors">
            Go to Projects
          </NuxtLink>
        </div>
      </div>

      <!-- Invitations List -->
      <div v-else class="space-y-4">
        <div
          v-for="invite in invitations"
          :key="invite.id"
          class="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden"
        >
          <div class="p-6">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center">
                  <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
                    {{ invite.project_name }}
                  </h3>
                  <span class="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200">
                    {{ invite.role }}
                  </span>
                </div>
                
                <div class="mt-2 space-y-1">
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    <span class="font-medium">Invited by:</span> {{ invite.invited_by_name }}
                  </p>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    <span class="font-medium">Received:</span> {{ formatDate(invite.created_at) }}
                  </p>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    <span class="font-medium">Expires:</span> {{ formatDate(invite.expires_at) }}
                  </p>
                </div>

                <!-- Expiring Soon Warning -->
                <div v-if="isExpiringSoon(invite.expires_at)" class="mt-3 flex items-center text-sm text-yellow-700 dark:text-yellow-400">
                  <svg class="flex-shrink-0 mr-1.5 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                  Expires soon!
                </div>
              </div>

              <!-- Actions -->
              <div class="ml-4 flex flex-col space-y-2">
                <button
                  @click="acceptInvitation(invite.invitation_token)"
                  :disabled="accepting === invite.id"
                  class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg v-if="accepting === invite.id" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Accept
                </button>
                <NuxtLink
                  :to="`/invitations/accept/${invite.invitation_token}`"
                  class="inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  View Details
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useLoggedInUserStore } from '~/stores/logged_in_user';
import { getAuthToken } from '~/composables/AuthToken';

const router = useRouter();
const loggedInUserStore = useLoggedInUserStore();

const loading = ref(true);
const accepting = ref<number | null>(null);
const invitations = ref<any[]>([]);

onMounted(async () => {
  await fetchInvitations();
});

async function fetchInvitations() {
  try {
    loading.value = true;
    const authToken = getAuthToken();
    
    const response = await fetch(`${useRuntimeConfig().public.apiBase}/project-invitations/user`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'authorization-type': 'auth'
      }
    });

    const data = await response.json();

    if (response.ok && data.success) {
      invitations.value = data.invitations;
    }
  } catch (error) {
    console.error('Error fetching invitations:', error);
  } finally {
    loading.value = false;
  }
}

async function acceptInvitation(token: string) {
  const invite = invitations.value.find(i => i.invitation_token === token);
  if (!invite) return;

  try {
    accepting.value = invite.id;
    const authToken = getAuthToken();
    
    const response = await fetch(`${useRuntimeConfig().public.apiBase}/project-invitations/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'authorization-type': 'auth'
      },
      body: JSON.stringify({ token })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      alert(data.message || 'Failed to accept invitation');
      return;
    }

    // Remove from list
    invitations.value = invitations.value.filter(i => i.id !== invite.id);
    
    // Show success message
    alert('Successfully joined the project!');
    
    // Redirect to projects if no more invitations
    if (invitations.value.length === 0) {
      router.push('/projects');
    }
  } catch (error) {
    console.error('Error accepting invitation:', error);
    alert('Failed to accept invitation. Please try again.');
  } finally {
    accepting.value = null;
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function isExpiringSoon(expiresAt: string): boolean {
  const expires = new Date(expiresAt);
  const now = new Date();
  const hoursDiff = (expires.getTime() - now.getTime()) / (1000 * 60 * 60);
  return hoursDiff < 24 && hoursDiff > 0;
}
</script>
