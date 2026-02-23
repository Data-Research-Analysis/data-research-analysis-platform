<template>
  <span 
    :class="[
      'inline-flex items-center rounded-full text-xs font-medium',
      sizeClasses,
      colorClasses
    ]">
    <font-awesome 
      v-if="sourceIcon" 
      :icon="sourceIcon" 
      :class="iconSizeClasses" />
    <slot>{{ displayName }}</slot>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  sourceType: string;
  sourceName?: string;
  size?: 'x-small' | 'small' | 'default' | 'large';
  showName?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'small',
  showName: true
});

const sizeClasses = computed(() => {
  const sizes = {
    'x-small': 'px-2 py-0.5 text-xs',
    'small': 'px-2.5 py-0.5 text-xs',
    'default': 'px-3 py-1 text-sm',
    'large': 'px-4 py-1.5 text-base'
  };
  return sizes[props.size] || sizes.small;
});

const iconSizeClasses = computed(() => {
  const sizes = {
    'x-small': 'text-[10px] mr-1',
    'small': 'text-xs mr-1.5',
    'default': 'text-sm mr-2',
    'large': 'text-base mr-2'
  };
  return sizes[props.size] || sizes.small;
});

const colorClasses = computed(() => {
  const colors: Record<string, string> = {
    'postgresql': 'bg-blue-100 text-blue-800',
    'mysql': 'bg-orange-100 text-orange-800',
    'mariadb': 'bg-orange-200 text-orange-900',
    'excel': 'bg-green-100 text-green-800',
    'csv': 'bg-green-50 text-green-700',
    'google_analytics': 'bg-purple-100 text-purple-800',
    'google_ad_manager': 'bg-red-100 text-red-800',
    'google_ads': 'bg-blue-200 text-blue-900',
    'meta_ads': 'bg-blue-100 text-blue-900',
    'linkedin_ads': 'bg-sky-100 text-sky-900',
    'pdf': 'bg-red-50 text-red-700',
    'mongodb': 'bg-green-200 text-green-900'
  };
  return colors[props.sourceType?.toLowerCase()] || 'bg-gray-100 text-gray-800';
});

const sourceIcon = computed(() => {
  const icons: Record<string, string> = {
    'postgresql': 'mdi-database',
    'mysql': 'mdi-database',
    'mariadb': 'mdi-database',
    'excel': 'mdi-file-excel',
    'csv': 'mdi-file-delimited',
    'google_analytics': 'mdi-google-analytics',
    'google_ad_manager': 'mdi-google-ads',
    'google_ads': 'mdi-google-ads',
    'meta_ads': 'mdi-facebook',
    'linkedin_ads': 'mdi-linkedin',
    'pdf': 'mdi-file-pdf-box',
    'mongodb': 'mdi-database'
  };
  return icons[props.sourceType?.toLowerCase()] || 'mdi-database-outline';
});

const displayName = computed(() => {
  if (!props.showName) return '';
  return props.sourceName || formatSourceType(props.sourceType);
});

function formatSourceType(type: string): string {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
</script>
