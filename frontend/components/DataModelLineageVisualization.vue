<template>
  <div class="bg-white shadow-md overflow-hidden p-6">
    <h2 class="text-lg font-semibold text-gray-900 mb-4">Data Model Lineage</h2>
    
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <font-awesome icon="fas fa-spinner" spin class="text-indigo-600 text-3xl" />
    </div>
    
    <!-- Lineage Visualization -->
    <div v-else-if="hasLineage" class="space-y-6">
      <!-- Legend -->
      <div class="flex items-center gap-6 pb-4 border-b border-gray-200">
        <div class="text-sm font-medium text-gray-700">Layer Colors:</div>
        <div class="flex items-center gap-2">
          <div class="w-4 h-4 rounded-full bg-gray-400"></div>
          <span class="text-sm text-gray-600">Raw Data</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-4 h-4 rounded-full bg-blue-500"></div>
          <span class="text-sm text-gray-600">Clean Data</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-4 h-4 rounded-full bg-green-500"></div>
          <span class="text-sm text-gray-600">Business Ready</span>
        </div>
      </div>
      
      <!-- Parent Dependencies -->
      <div v-if="lineage.parents.length > 0">
        <h3 class="text-md font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <font-awesome icon="fas fa-arrow-up" class="text-blue-500" />
          Parent Models (Dependencies)
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="parent in lineage.parents"
            :key="parent.id"
            class="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
            :class="getBorderColorClass(parent.layer)"
            @click="navigateToModel(parent.id)"
          >
            <div class="flex items-start gap-3">
              <div
                :class="getLayerDotClass(parent.layer)"
                class="w-3 h-3 rounded-full mt-1 flex-shrink-0"
              ></div>
              <div class="flex-1 min-w-0">
                <div class="font-medium text-gray-900 truncate">{{ parent.name }}</div>
                <div class="text-sm text-gray-500 mt-1">{{ getLayerLabel(parent.layer) }}</div>
                <div class="flex items-center gap-2 mt-2">
                  <span
                    :class="getHealthBadgeClass(parent.health_status)"
                    class="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                  >
                    {{ getHealthLabel(parent.health_status) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Current Model -->
      <div class="flex items-center justify-center py-4">
        <div class="border-2 border-indigo-500 rounded-lg p-4 bg-indigo-50">
          <div class="flex items-center gap-3">
            <div
              :class="getLayerDotClass(currentModelLayer)"
              class="w-4 h-4 rounded-full"
            ></div>
            <div>
              <div class="font-semibold text-gray-900">Current Model</div>
              <div class="text-sm text-gray-600">{{ getLayerLabel(currentModelLayer) }}</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Child Dependents -->
      <div v-if="lineage.children.length > 0">
        <h3 class="text-md font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <font-awesome icon="fas fa-arrow-down" class="text-green-500" />
          Child Models (Dependents)
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="child in lineage.children"
            :key="child.id"
            class="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
            :class="getBorderColorClass(child.layer)"
            @click="navigateToModel(child.id)"
          >
            <div class="flex items-start gap-3">
              <div
                :class="getLayerDotClass(child.layer)"
                class="w-3 h-3 rounded-full mt-1 flex-shrink-0"
              ></div>
              <div class="flex-1 min-w-0">
                <div class="font-medium text-gray-900 truncate">{{ child.name }}</div>
                <div class="text-sm text-gray-500 mt-1">{{ getLayerLabel(child.layer) }}</div>
                <div class="flex items-center gap-2 mt-2">
                  <span
                    :class="getHealthBadgeClass(child.health_status)"
                    class="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                  >
                    {{ getHealthLabel(child.health_status) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Flow Warnings -->
      <div v-if="flowWarnings.length > 0" class="bg-amber-50 border-l-4 border-amber-400 p-4">
        <div class="flex items-start gap-3">
          <font-awesome icon="fas fa-triangle-exclamation" class="text-amber-600 mt-0.5" />
          <div>
            <h4 class="text-sm font-semibold text-amber-800 mb-2">Layer Flow Warnings</h4>
            <ul class="list-disc list-inside text-sm text-amber-700 space-y-1">
              <li v-for="(warning, index) in flowWarnings" :key="index">{{ warning }}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
    
    <!-- No Lineage State -->
    <div v-else class="text-center py-12">
      <font-awesome icon="fas fa-circle-info" class="text-gray-400 text-4xl mb-3" />
      <p class="text-lg font-medium text-gray-700">No Lineage Dependencies</p>
      <p class="text-sm text-gray-500 mt-2">
        This data model does not depend on other data models and is not used by any other models.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { getAuthToken } from '@/composables/AuthToken';

const props = defineProps<{
  dataModelId: number;
  projectId: number;
  currentModelLayer: string | null;
}>();

const router = useRouter();
const baseUrl = () => useRuntimeConfig().public.apiBase;

const loading = ref(true);
const lineage = ref<{
  parents: Array<{ id: number; name: string; layer: string; health_status: string }>;
  children: Array<{ id: number; name: string; layer: string; health_status: string }>;
}>({
  parents: [],
  children: []
});

const hasLineage = computed(() => {
  return lineage.value.parents.length > 0 || lineage.value.children.length > 0;
});

const flowWarnings = computed(() => {
  const warnings: string[] = [];
  const currentLayer = props.currentModelLayer;
  
  if (!currentLayer) return warnings;
  
  // Check parent dependencies for anti-patterns
  if (currentLayer === 'raw_data' && lineage.value.parents.length > 0) {
    warnings.push('Raw Data models should typically not depend on other data models.');
  }
  
  if (currentLayer === 'clean_data') {
    const nonRawParents = lineage.value.parents.filter(p => p.layer !== 'raw_data');
    if (nonRawParents.length > 0) {
      warnings.push(`Clean Data models should primarily use Raw Data sources. Found dependencies on ${nonRawParents.length} non-Raw model(s).`);
    }
  }
  
  if (currentLayer === 'business_ready') {
    const rawParents = lineage.value.parents.filter(p => p.layer === 'raw_data');
    if (rawParents.length > 0) {
      warnings.push(`Business Ready models skip Clean Data layer. Consider using Clean Data models as intermediaries.`);
    }
  }
  
  return warnings;
});

function getLayerDotClass(layer: string | null) {
  if (!layer) return 'bg-gray-300';
  const layerClasses: Record<string, string> = {
    'raw_data': 'bg-gray-400',
    'clean_data': 'bg-blue-500',
    'business_ready': 'bg-green-500'
  };
  return layerClasses[layer] || 'bg-gray-300';
}

function getBorderColorClass(layer: string | null) {
  if (!layer) return 'border-gray-200';
  const borderClasses: Record<string, string> = {
    'raw_data': 'border-gray-300',
    'clean_data': 'border-blue-300',
    'business_ready': 'border-green-300'
  };
  return borderClasses[layer] || 'border-gray-200';
}

function getLayerLabel(layer: string | null) {
  if (!layer) return 'Unknown';
  const labels: Record<string, string> = {
    'raw_data': 'Raw Data',
    'clean_data': 'Clean Data',
    'business_ready': 'Business Ready'
  };
  return labels[layer] || 'Unknown';
}

function getHealthBadgeClass(status: string) {
  const badgeClasses: Record<string, string> = {
    'healthy': 'bg-green-100 text-green-800',
    'warning': 'bg-amber-100 text-amber-800',
    'blocked': 'bg-red-100 text-red-800',
    'unknown': 'bg-gray-100 text-gray-800'
  };
  return badgeClasses[status] || 'bg-gray-100 text-gray-800';
}

function getHealthLabel(status: string) {
  const labels: Record<string, string> = {
    'healthy': 'Healthy',
    'warning': 'Warnings',
    'blocked': 'Blocked',
    'unknown': 'Unknown'
  };
  return labels[status] || 'Unknown';
}

function navigateToModel(modelId: number) {
  router.push(`/projects/${props.projectId}/data-models/${modelId}`);
}

async function fetchLineage() {
  loading.value = true;
  try {
    const token = getAuthToken();
    if (!token) throw new Error('Authentication required');
    
    const response = await $fetch<any>(
      `${baseUrl()}/data-model/lineage/${props.dataModelId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Authorization-Type': 'auth',
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response) {
      lineage.value = response;
    }
  } catch (error: any) {
    console.error('[DataModelLineage] Failed to fetch lineage:', error);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchLineage();
});
</script>
