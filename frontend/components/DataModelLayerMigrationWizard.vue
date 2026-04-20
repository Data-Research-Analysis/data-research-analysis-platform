<template>
  <overlay-dialog v-if="isOpen" @close="close" :enable-scrolling="false">
    <template v-slot:overlay>
      <!-- Header -->
      <div class="mb-6">
        <h3 class="text-2xl font-bold text-gray-900 mb-2">
          Data Layer Migration Wizard
        </h3>
        <p class="text-sm text-gray-600">
          Classify your existing data models into Bronze/Silver/Gold layers. Our AI has analyzed your models and recommended appropriate layers based on their transformations and complexity.
        </p>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <div class="text-center">
          <font-awesome-icon :icon="['fas', 'spinner']" class="text-4xl text-blue-500 animate-spin mb-4" />
          <p class="text-gray-600">Analyzing your data models...</p>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="candidates.length === 0" class="text-center py-12">
        <font-awesome-icon :icon="['fas', 'check-circle']" class="text-5xl text-green-500 mb-4" />
        <h4 class="text-lg font-semibold text-gray-900 mb-2">All models are classified!</h4>
        <p class="text-sm text-gray-600">All your data models have been assigned a data layer.</p>
      </div>

      <!-- Candidates List -->
      <div v-else class="space-y-4">
        <!-- Bulk Actions Bar -->
        <div class="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg">
          <div class="flex items-center gap-3">
            <input
              type="checkbox"
              :checked="allSelected"
              @change="toggleSelectAll"
              class="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
            />
            <span class="text-sm font-medium text-gray-700">
              {{ selectedCount }} of {{ candidates.length }} selected
            </span>
          </div>
          <button
            v-if="selectedCount > 0"
            @click="applyBulk"
            :disabled="applying"
            class="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <font-awesome-icon 
              :icon="applying ? ['fas', 'spinner'] : ['fas', 'check']"
              :class="applying ? 'animate-spin' : ''"
              class="mr-2"
            />
            {{ applying ? 'Applying...' : `Apply to ${selectedCount} model${selectedCount !== 1 ? 's' : ''}` }}
          </button>
        </div>

        <!-- Candidates Table -->
        <div class="border border-gray-200 rounded-lg overflow-hidden">
          <div class="max-h-[500px] overflow-y-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th scope="col" class="w-12 px-4 py-3 text-left">
                        <span class="sr-only">Select</span>
                      </th>
                      <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Model Name
                      </th>
                      <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rows
                      </th>
                      <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Recommended Layer
                      </th>
                      <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Confidence
                      </th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    <tr
                      v-for="candidate in candidates"
                      :key="candidate.id"
                      :class="selectedIds.has(candidate.id) ? 'bg-blue-50' : 'hover:bg-gray-50'"
                      class="transition-colors"
                    >
                      <td class="px-4 py-4">
                        <input
                          type="checkbox"
                          :checked="selectedIds.has(candidate.id)"
                          @change="toggleSelect(candidate.id)"
                          class="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td class="px-4 py-4">
                        <div class="flex flex-col">
                          <span class="text-sm font-medium text-gray-900">{{ cleanModelName(candidate.name) }}</span>
                          <span v-if="candidate.health_status && candidate.health_status !== 'healthy'" class="text-xs mt-1">
                            <span
                              v-if="candidate.health_status === 'blocked'"
                              class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800"
                            >
                              <font-awesome-icon :icon="['fas', 'circle-xmark']" class="mr-1 text-[10px]" />
                              Blocked
                            </span>
                            <span
                              v-else-if="candidate.health_status === 'warning'"
                              class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800"
                            >
                              <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="mr-1 text-[10px]" />
                              Warning
                            </span>
                          </span>
                        </div>
                      </td>
                      <td class="px-4 py-4">
                        <span class="text-sm text-gray-600">
                          {{ candidate.model_type || 'N/A' }}
                        </span>
                      </td>
                      <td class="px-4 py-4">
                        <span class="text-sm text-gray-600">
                          {{ candidate.row_count ? candidate.row_count.toLocaleString() : 'N/A' }}
                        </span>
                      </td>
                      <td class="px-4 py-4">
                        <DataModelLayerBadge
                          :layer="candidate.recommendation.layer"
                          :show-alternative-name="true"
                        />
                      </td>
                      <td class="px-4 py-4">
                        <div class="flex items-center gap-2">
                          <span
                            :class="{
                              'text-green-600': candidate.recommendation.confidence === 'high',
                              'text-yellow-600': candidate.recommendation.confidence === 'medium',
                              'text-orange-600': candidate.recommendation.confidence === 'low'
                            }"
                            class="text-sm font-medium capitalize"
                          >
                            {{ candidate.recommendation.confidence }}
                          </span>
                          <button
                            type="button"
                            @click="() => {}"
                            class="text-gray-400 hover:text-gray-600"
                            :title="candidate.recommendation.reasoning"
                          >
                            <font-awesome-icon :icon="['fas', 'circle-info']" class="text-sm" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Info Box -->
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div class="flex items-start gap-3">
                <font-awesome-icon :icon="['fas', 'lightbulb']" class="text-blue-600 mt-0.5 flex-shrink-0" />
                <div class="text-sm text-blue-800">
                  <p class="font-medium mb-1">About the recommendations:</p>
                  <ul class="list-disc list-inside space-y-1 text-xs">
                    <li><strong>Raw Data (Bronze):</strong> Source data preserved without transformations</li>
                    <li><strong>Clean Data (Silver):</strong> Filtered, deduplicated, or transformed data</li>
                    <li><strong>Business Ready (Gold):</strong> Aggregated, joined, analytics-ready data</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

      <!-- Footer Actions -->
      <div class="mt-6 flex justify-end gap-3">
        <button
          @click="close"
          class="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          Close
        </button>
      </div>
    </template>
  </overlay-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useDataModelsStore } from '@/stores/data_models';
import { getAuthToken } from '@/composables/AuthToken';
import type { EDataLayer } from '@/types/IDataModelLayer';

interface Candidate {
  id: number;
  name: string;
  model_type: string | null;
  row_count: number | null;
  health_status: string | null;
  created_at: Date;
  recommendation: {
    layer: EDataLayer;
    confidence: string;
    reasoning: string;
  };
}

interface Props {
  projectId: number;
  modelValue: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'completed': [];
}>();

const config = useRuntimeConfig();
const dataModelsStore = useDataModelsStore();
const { $swal }: any = useNuxtApp();

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const loading = ref(false);
const applying = ref(false);
const candidates = ref<Candidate[]>([]);
const selectedIds = ref<Set<number>>(new Set());

const selectedCount = computed(() => selectedIds.value.size);
const allSelected = computed(() => 
  candidates.value.length > 0 && selectedIds.value.size === candidates.value.length
);

// Load candidates when wizard opens
watch(() => props.modelValue, async (newValue) => {
  if (newValue) {
    await loadCandidates();
  }
});

async function loadCandidates() {
  loading.value = true;
  try {
    const token = getAuthToken();
    if (!token) throw new Error('Authentication required');

    const response = await $fetch<{ success: boolean; candidates: Candidate[]; count: number }>(
      `${config.public.apiBase}/data-model/project/${props.projectId}/layer-migration`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Authorization-Type': 'auth',
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.success) {
      candidates.value = response.candidates;
      // Auto-select all on load
      selectedIds.value = new Set(candidates.value.map(c => c.id));
    }
  } catch (error: any) {
    console.error('[LayerMigrationWizard] Failed to load candidates:', error);
    $swal.fire({
      icon: 'error',
      title: 'Failed to Load',
      text: 'Could not load unclassified models. Please try again.',
    });
  } finally {
    loading.value = false;
  }
}

function toggleSelect(id: number) {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id);
  } else {
    selectedIds.value.add(id);
  }
}

function toggleSelectAll() {
  if (allSelected.value) {
    selectedIds.value.clear();
  } else {
    selectedIds.value = new Set(candidates.value.map(c => c.id));
  }
}

async function applyBulk() {
  if (selectedCount.value === 0) return;

  const result = await $swal.fire({
    icon: 'question',
    title: 'Apply Layer Classifications?',
    html: `
      <p>This will assign recommended layers to <strong>${selectedCount.value} model${selectedCount.value !== 1 ? 's' : ''}</strong>.</p>
      <p class="text-sm text-gray-600 mt-2">You can always change these assignments later.</p>
    `,
    showCancelButton: true,
    confirmButtonText: 'Apply',
    cancelButtonText: 'Cancel',
  });

  if (!result.isConfirmed) return;

  applying.value = true;
  try {
    const token = getAuthToken();
    if (!token) throw new Error('Authentication required');

    // Build assignments array
    const assignments = Array.from(selectedIds.value).map(id => {
      const candidate = candidates.value.find(c => c.id === id);
      return {
        dataModelId: id,
        layer: candidate!.recommendation.layer,
      };
    });

    const response = await $fetch<{
      successCount: number;
      failedCount: number;
      errors: Array<{ dataModelId: number; error: string }>;
    }>(
      `${config.public.apiBase}/data-model/bulk-assign-layers`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Authorization-Type': 'auth',
          'Content-Type': 'application/json',
        },
        body: { assignments },
      }
    );

    if (response.successCount) {
      // Refresh data models store
      await dataModelsStore.retrieveDataModels(props.projectId);

      // Show success message
      if (response.failedCount === 0) {
        await $swal.fire({
          icon: 'success',
          title: 'Success!',
          text: `Successfully assigned layers to ${response.successCount} model${response.successCount !== 1 ? 's' : ''}.`,
        });
      } else {
        await $swal.fire({
          icon: 'warning',
          title: 'Partially Complete',
          html: `
            <p><strong>${response.successCount}</strong> models updated successfully.</p>
            <p><strong>${response.failedCount}</strong> models failed.</p>
          `,
        });
      }

      emit('completed');
      close();
    }
  } catch (error: any) {
    console.error('[LayerMigrationWizard] Failed to apply layers:', error);
    $swal.fire({
      icon: 'error',
      title: 'Failed',
      text: 'Could not apply layer assignments. Please try again.',
    });
  } finally {
    applying.value = false;
  }
}

function cleanModelName(name: string): string {
  // Remove UUID suffix from model names (e.g., "table_name_abc123def456" -> "table_name")
  return name.replace(/_[a-f0-9]{12}$/, '');
}

function close() {
  isOpen.value = false;
}
</script>
