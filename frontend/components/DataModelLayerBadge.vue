<template>
  <span 
    v-if="layer"
    :class="[
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border',
      colors.bg,
      colors.text,
      colors.border
    ]"
  >
    <font-awesome-icon :icon="icon" class="mr-1.5 text-xs" />
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { 
  EDataLayer, 
  DATA_LAYER_LABELS, 
  DATA_LAYER_COLORS, 
  DATA_LAYER_ICONS 
} from '@/types/IDataModelLayer';

const props = defineProps<{
  layer: string | null | undefined;
  showAlternativeName?: boolean;
}>();

const layer = computed(() => {
  if (!props.layer) return null;
  return props.layer as EDataLayer;
});

const label = computed(() => {
  if (!layer.value) return '';
  if (props.showAlternativeName) {
    const altNames = {
      [EDataLayer.RAW_DATA]: 'Bronze',
      [EDataLayer.CLEAN_DATA]: 'Silver',
      [EDataLayer.BUSINESS_READY]: 'Gold'
    };
    return altNames[layer.value];
  }
  return DATA_LAYER_LABELS[layer.value];
});

const colors = computed(() => {
  if (!layer.value) return { bg: '', text: '', border: '' };
  return DATA_LAYER_COLORS[layer.value];
});

const icon = computed(() => {
  if (!layer.value) return ['fas', 'layer-group'];
  return DATA_LAYER_ICONS[layer.value];
});
</script>
