<template>
  <v-chip 
    :color="sourceColor" 
    :size="size"
    :variant="variant"
    :prepend-icon="sourceIcon">
    <slot>{{ displayName }}</slot>
  </v-chip>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  sourceType: string;
  sourceName?: string;
  size?: 'x-small' | 'small' | 'default' | 'large' | 'x-large';
  variant?: 'flat' | 'text' | 'elevated' | 'tonal' | 'outlined' | 'plain';
  showName?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'small',
  variant: 'tonal',
  showName: true
});

const sourceColor = computed(() => {
  const colors: Record<string, string> = {
    'postgresql': 'blue',
    'mysql': 'orange',
    'mariadb': 'orange-darken-2',
    'excel': 'green',
    'csv': 'green-lighten-1',
    'google_analytics': 'purple',
    'google_ad_manager': 'red',
    'google_ads': 'blue-grey',
    'pdf': 'red-lighten-1',
    'mongodb': 'green-darken-2'
  };
  return colors[props.sourceType?.toLowerCase()] || 'grey';
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
  // Convert snake_case to Title Case
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
</script>
