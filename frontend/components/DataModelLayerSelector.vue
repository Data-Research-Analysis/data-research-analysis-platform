<template>
  <div class="data-model-layer-selector">
    <!-- Dropdown Trigger -->
    <div class="relative">
      <button
        @click="toggleDropdown"
        :disabled="disabled"
        class="w-full flex items-center justify-between px-4 py-2.5 border rounded-lg text-sm font-medium transition-colors"
        :class="[
          disabled 
            ? 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-white border-gray-300 text-gray-700 hover:border-primary-blue-300 hover:bg-blue-50 cursor-pointer'
        ]"
      >
        <div class="flex items-center gap-2">
          <font-awesome-icon 
            :icon="currentLayer ? DATA_LAYER_ICONS[currentLayer] : ['fas', 'layer-group']" 
            :class="currentLayer && DATA_LAYER_COLORS[currentLayer].text"
          />
          <span>{{ currentLayer ? DATA_LAYER_LABELS[currentLayer] : placeholder }}</span>
        </div>
        <font-awesome-icon 
          :icon="['fas', 'chevron-down']" 
          :class="{ 'rotate-180': isOpen }"
          class="text-gray-400 text-xs transition-transform"
        />
      </button>

      <!-- Dropdown Menu -->
      <Transition
        enter-active-class="transition ease-out duration-100"
        enter-from-class="transform opacity-0 scale-95"
        enter-to-class="transform opacity-100 scale-100"
        leave-active-class="transition ease-in duration-75"
        leave-from-class="transform opacity-100 scale-100"
        leave-to-class="transform opacity-0 scale-95"
      >
        <div 
          v-if="isOpen"
          class="absolute z-50 mt-2 w-full md:w-96 bg-white rounded-lg shadow-xl border border-gray-200 max-h-96 overflow-y-auto"
        >
          <div class="p-2">
            <!-- Layer Options -->
            <div
              v-for="layer in layers"
              :key="layer"
              @click="selectLayer(layer)"
              class="group cursor-pointer px-3 py-3 rounded-lg hover:bg-blue-50 transition-colors"
              :class="{ 'bg-blue-50 border-2 border-blue-300': modelValue === layer }"
            >
              <div class="flex items-start gap-3">
                <font-awesome-icon 
                  :icon="DATA_LAYER_ICONS[layer]" 
                  :class="DATA_LAYER_COLORS[layer].text"
                  class="text-lg mt-0.5 flex-shrink-0"
                />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="font-semibold text-gray-900">{{ DATA_LAYER_LABELS[layer] }}</span>
                    <span 
                      :class="[
                        'text-[10px] font-medium px-2 py-0.5 rounded-full',
                        DATA_LAYER_COLORS[layer].bg,
                        DATA_LAYER_COLORS[layer].text
                      ]"
                    >
                      {{ getAlternativeName(layer) }}
                    </span>
                  </div>
                  <p class="text-xs text-gray-600">{{ DATA_LAYER_DESCRIPTIONS[layer] }}</p>
                  
                  <!-- Requirements -->
                  <div class="mt-2 text-xs text-gray-500">
                    <span class="font-medium">Requirements:</span>
                    <span class="ml-1">{{ getRequirements(layer) }}</span>
                  </div>
                </div>
                <font-awesome-icon 
                  v-if="modelValue === layer"
                  :icon="['fas', 'check-circle']" 
                  class="text-blue-600 mt-1 flex-shrink-0"
                />
              </div>
            </div>

            <!-- Clear Selection -->
            <div
              v-if="allowNoLayer && modelValue"
              @click="clearLayer"
              class="mt-2 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors cursor-pointer text-sm text-red-600 font-medium flex items-center gap-2 border-t border-gray-200 pt-3"
            >
              <font-awesome-icon :icon="['fas', 'xmark']" />
              Clear Layer Assignment
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Validation Feedback -->
    <div v-if="validationFeedback" class="mt-2">
      <div 
        v-for="(issue, index) in validationFeedback.issues"
        :key="index"
        class="flex items-start gap-2 p-2 rounded text-xs"
        :class="{
          'bg-red-50 text-red-700': issue.severity === 'error',
          'bg-amber-50 text-amber-700': issue.severity === 'warning',
          'bg-blue-50 text-blue-700': issue.severity === 'info'
        }"
      >
        <font-awesome-icon 
          :icon="issue.severity === 'error' ? ['fas', 'circle-xmark'] : issue.severity === 'warning' ? ['fas', 'triangle-exclamation'] : ['fas', 'circle-info']"
          class="mt-0.5 flex-shrink-0"
        />
        <div class="flex-1">
          <p class="font-medium">{{ issue.message }}</p>
          <p v-if="issue.suggestion" class="mt-1 text-xs opacity-75">{{ issue.suggestion }}</p>
        </div>
      </div>
    </div>

    <!-- Recommendation -->
    <div v-if="showRecommendation && recommendation" class="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
      <div class="flex items-start gap-2">
        <font-awesome-icon :icon="['fas', 'lightbulb']" class="text-purple-600 mt-0.5" />
        <div class="flex-1 text-xs">
          <p class="font-semibold text-purple-900 mb-1">
            AI Recommendation: 
            <span :class="DATA_LAYER_COLORS[recommendation.layer as EDataLayer].text">
              {{ DATA_LAYER_LABELS[recommendation.layer as EDataLayer] }}
            </span>
            <span class="ml-1 text-purple-600">({{ recommendation.confidence }} confidence)</span>
          </p>
          <p class="text-purple-700">{{ recommendation.reasoning }}</p>
          <button
            v-if="recommendation.layer !== modelValue"
            @click="selectLayer(recommendation.layer as EDataLayer)"
            class="mt-2 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-medium transition-colors"
          >
            Apply Recommendation
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { 
  EDataLayer, 
  DATA_LAYER_LABELS,
  DATA_LAYER_DESCRIPTIONS, 
  DATA_LAYER_COLORS, 
  DATA_LAYER_ICONS,
  DATA_LAYER_ALTERNATIVE_NAMES,
  type ILayerValidationResult,
  type ILayerRecommendation
} from '@/types/IDataModelLayer';

const props = defineProps<{
  modelValue: string | null | undefined;
  dataModelId?: number;
  disabled?: boolean;
  placeholder?: string;
  allowNoLayer?: boolean;
  showRecommendation?: boolean;
  autoValidate?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | null): void;
  (e: 'validate', layer: string): void;
  (e: 'change', layer: string | null): void;
}>();

const isOpen = ref(false);
const validationFeedback = ref<ILayerValidationResult | null>(null);
const recommendation = ref<ILayerRecommendation | null>(null);

const layers = [EDataLayer.RAW_DATA, EDataLayer.CLEAN_DATA, EDataLayer.BUSINESS_READY];

const currentLayer = computed(() => {
  if (!props.modelValue) return null;
  return props.modelValue as EDataLayer;
});

function toggleDropdown() {
  if (props.disabled) return;
  isOpen.value = !isOpen.value;
}

function closeDropdown() {
  isOpen.value = false;
}

function selectLayer(layer: EDataLayer) {
  emit('update:modelValue', layer);
  emit('change', layer);
  
  if (props.autoValidate && props.dataModelId) {
    validateSelection(layer);
  }
  
  closeDropdown();
}

function clearLayer() {
  emit('update:modelValue', null);
  emit('change', null);
  validationFeedback.value = null;
  closeDropdown();
}

function getAlternativeName(layer: EDataLayer): string {
  return DATA_LAYER_ALTERNATIVE_NAMES[layer];
}

function getRequirements(layer: EDataLayer): string {
  const requirements: Record<EDataLayer, string> = {
    [EDataLayer.RAW_DATA]: 'None (preserves source)',
    [EDataLayer.CLEAN_DATA]: 'Transformation OR filtering',
    [EDataLayer.BUSINESS_READY]: 'Aggregation OR joins'
  };
  return requirements[layer];
}

async function validateSelection(layer: string) {
  if (!props.dataModelId) return;
  
  const dataModelsStore = useDataModelsStore();
  
  try {
    const result = await dataModelsStore.validateLayer(props.dataModelId, layer);
    if (result) {
      validationFeedback.value = result.validation;
    }
  } catch (error: any) {
    console.error('[DataModelLayerSelector] Validation failed:', error);
    validationFeedback.value = {
      valid: false,
      layer: layer as EDataLayer,
      issues: [{
        code: 'VALIDATION_ERROR',
        severity: 'error',
        message: error.message || 'Failed to validate layer assignment'
      }]
    };
  }
}

async function fetchRecommendation() {
  if (!props.showRecommendation || !props.dataModelId) return;
  
  const dataModelsStore = useDataModelsStore();
  
  try {
    recommendation.value = await dataModelsStore.getLayerRecommendation(props.dataModelId) as ILayerRecommendation | null;
  } catch (error: any) {
    console.error('[DataModelLayerSelector] Failed to fetch recommendation:', error);
  }
}

// Close dropdown when clicking outside
function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (!target.closest('.data-model-layer-selector')) {
    closeDropdown();
  }
}

onMounted(() => {
  if (import.meta.client) {
    document.addEventListener('click', handleClickOutside);
  }
  
  if (props.showRecommendation && props.dataModelId) {
    fetchRecommendation();
  }
});

onBeforeUnmount(() => {
  if (import.meta.client) {
    document.removeEventListener('click', handleClickOutside);
  }
});

// Watch for dataModelId changes
watch(() => props.dataModelId, (newId) => {
  if (newId && props.showRecommendation) {
    fetchRecommendation();
  }
});
</script>

<style scoped>
.rotate-180 {
  transform: rotate(180deg);
}
</style>
