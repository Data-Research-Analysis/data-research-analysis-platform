<template>
  <!-- Backdrop -->
  <div
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    @click.self="$emit('close')"
  >
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h2 class="text-lg font-semibold text-gray-900">Add to Dashboard</h2>
        <button
          class="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          @click="$emit('close')"
        >
          <font-awesome-icon :icon="['fas', 'xmark']" class="w-5 h-5" />
        </button>
      </div>

      <!-- Body -->
      <div class="px-6 py-5">
        <!-- Insight preview -->
        <p class="text-sm text-gray-500 mb-5 line-clamp-3 italic border-l-4 border-blue-200 pl-3">
          {{ insightText }}
        </p>

        <!-- Phase: idle or error — show form -->
        <template v-if="phase === 'idle' || phase === 'error'">
          <!-- Dashboard selection -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">Add to dashboard</label>

            <div class="flex flex-col gap-2">
              <label
                v-for="dash in projectDashboards"
                :key="dash.id"
                class="flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors"
                :class="selectedDashboardId === dash.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'"
              >
                <input
                  type="radio"
                  :value="dash.id"
                  v-model="selectedDashboardId"
                  class="text-blue-500"
                />
                <span class="text-sm text-gray-800">{{ dash.name ?? `Dashboard #${dash.id}` }}</span>
              </label>

              <!-- Create new -->
              <label
                class="flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors"
                :class="selectedDashboardId === NEW_DASHBOARD_SENTINEL
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'"
              >
                <input
                  type="radio"
                  :value="NEW_DASHBOARD_SENTINEL"
                  v-model="selectedDashboardId"
                  class="text-blue-500"
                />
                <span class="text-sm text-gray-800">
                  <font-awesome-icon :icon="['fas', 'plus']" class="mr-1" />
                  Create new dashboard
                </span>
              </label>
            </div>

            <input
              v-if="selectedDashboardId === NEW_DASHBOARD_SENTINEL"
              v-model="newDashboardName"
              type="text"
              placeholder="New dashboard name…"
              class="mt-3 w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              @keyup.enter="generate"
            />
          </div>

          <!-- Error message -->
          <p v-if="phase === 'error'" class="text-sm text-red-600 mb-3">
            <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="mr-1" />
            {{ errorMessage }}
          </p>

          <!-- Action buttons -->
          <div class="flex justify-end gap-3 mt-4">
            <button
              class="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
              @click="$emit('close')"
            >
              Cancel
            </button>
            <button
              class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="!canGenerate"
              @click="generate"
            >
              <font-awesome-icon :icon="['fas', 'chart-bar']" />
              Generate Widget
            </button>
          </div>
        </template>

        <!-- Phase: loading -->
        <template v-else-if="phase === 'loading'">
          <div class="flex flex-col items-center gap-4 py-8">
            <font-awesome-icon :icon="['fas', 'spinner']" class="text-blue-500 text-3xl animate-spin" />
            <p class="text-sm text-gray-600">Generating your widget with AI…</p>
          </div>
        </template>

        <!-- Phase: success -->
        <template v-else-if="phase === 'success'">
          <div class="flex flex-col items-center gap-4 py-6 text-center">
            <div class="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 text-2xl" />
            </div>
            <div>
              <p class="text-base font-semibold text-gray-900 mb-1">Widget added!</p>
              <p class="text-sm text-gray-500">
                Your AI widget has been added to
                <strong>{{ successDashboardName }}</strong>.
              </p>
            </div>
            <NuxtLink
              :to="`/projects/${projectId}/dashboards/${successDashboardId}`"
              class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              @click="$emit('close')"
            >
              View Dashboard
              <font-awesome-icon :icon="['fas', 'arrow-right']" />
            </NuxtLink>
            <button
              class="text-sm text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
              @click="$emit('close')"
            >
              Close
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDashboardsStore } from '@/stores/dashboards';
import type { IDashboard } from '@/types/IDashboard';

const NEW_DASHBOARD_SENTINEL = -1;

const props = defineProps<{
  projectId: number;
  insightText: string;
}>();

defineEmits<{ (e: 'close'): void }>();

const config = useRuntimeConfig();
const dashboardsStore = useDashboardsStore();

// ---- state -------------------------------------------------------------------
type Phase = 'idle' | 'loading' | 'success' | 'error';
const phase = ref<Phase>('idle');
const errorMessage = ref('');
const selectedDashboardId = ref<number>(NEW_DASHBOARD_SENTINEL);
const newDashboardName = ref('');
const successDashboardId = ref<number>(0);
const successDashboardName = ref('');

// ---- dashboards --------------------------------------------------------------
const projectDashboards = computed<IDashboard[]>(() => {
  const all = dashboardsStore.getDashboards();
  return all.filter(d => {
    const pid = d.project?.id ?? (d as any).project_id;
    return pid === props.projectId;
  });
});

const canGenerate = computed(() => {
  if (selectedDashboardId.value === NEW_DASHBOARD_SENTINEL) {
    return newDashboardName.value.trim().length > 0;
  }
  return selectedDashboardId.value > 0;
});

// Preload dashboards on mount
onMounted(() => {
  if (import.meta.client) {
    dashboardsStore.retrieveDashboards();
  }
});

// ---- API helper --------------------------------------------------------------
function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  if (!token) throw new Error('Authentication required');
  return {
    Authorization: `Bearer ${token}`,
    'Authorization-Type': 'auth',
    'Content-Type': 'application/json',
  };
}

// ---- generate ----------------------------------------------------------------
async function generate() {
  if (!canGenerate.value) return;
  phase.value = 'loading';
  errorMessage.value = '';

  try {
    const body: Record<string, any> = {
      projectId: props.projectId,
      insightText: props.insightText,
    };

    if (selectedDashboardId.value === NEW_DASHBOARD_SENTINEL) {
      body.dashboardName = newDashboardName.value.trim();
    } else {
      body.dashboardId = selectedDashboardId.value;
    }

    const resp = await $fetch<{ success: boolean; dashboardId: number; spec: any; error?: string }>(
      `${config.public.apiBase}/insights/session/create-widget`,
      { method: 'POST', headers: authHeaders(), body }
    );

    if (resp.success) {
      successDashboardId.value = resp.dashboardId;
      const matched = projectDashboards.value.find(d => d.id === resp.dashboardId);
      successDashboardName.value =
        matched?.name ?? body.dashboardName ?? `Dashboard #${resp.dashboardId}`;
      phase.value = 'success';
      // Refresh dashboards store so the updated widget is immediately visible
      dashboardsStore.retrieveDashboards();
    } else {
      throw new Error(resp.error ?? 'Unknown error');
    }
  } catch (err: any) {
    errorMessage.value = err?.data?.error ?? err?.message ?? 'Failed to generate widget.';
    phase.value = 'error';
  }
}
</script>
