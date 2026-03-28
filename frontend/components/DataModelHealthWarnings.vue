<template>
  <div v-if="healthIssues && healthIssues.length > 0" class="rounded-lg border p-4 space-y-3" :class="containerClass">
    <div class="flex items-start gap-2">
      <font-awesome-icon
        :icon="['fas', healthStatus === 'blocked' ? 'circle-xmark' : 'triangle-exclamation']"
        :class="iconClass"
        class="flex-shrink-0 mt-0.5"
      />
      <div class="flex-1 min-w-0">
        <h3 class="text-sm font-semibold mb-2" :class="titleClass">
          {{ healthStatus === 'blocked' ? 'Critical Issues' : 'Health Warnings' }}
        </h3>
        <div class="space-y-3">
          <div
            v-for="(issue, idx) in healthIssues"
            :key="idx"
            class="flex flex-col gap-1"
          >
            <div class="flex items-start gap-2">
              <font-awesome-icon
                :icon="getIssueIcon(issue.code)"
                :class="getIssueIconClass(issue.severity)"
                class="flex-shrink-0 mt-0.5 text-xs"
              />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-800">{{ issue.title }}</p>
                <p v-if="issue.description" class="text-xs text-gray-600 mt-0.5">{{ issue.description }}</p>
                <p v-if="issue.recommendation" class="text-xs text-blue-600 mt-1 italic">
                  💡 {{ issue.recommendation }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface HealthIssue {
  code: string;
  severity: 'warning' | 'info' | 'error';
  title: string;
  description?: string;
  recommendation?: string;
}

interface Props {
  healthStatus: 'healthy' | 'warning' | 'blocked' | 'unknown' | null;
  healthIssues: HealthIssue[] | null;
}

const props = defineProps<Props>();

const containerClass = computed(() => {
  if (props.healthStatus === 'blocked') {
    return 'bg-red-50 border-red-300';
  } else if (props.healthStatus === 'warning') {
    return 'bg-amber-50 border-amber-300';
  }
  return 'bg-blue-50 border-blue-300';
});

const iconClass = computed(() => {
  if (props.healthStatus === 'blocked') {
    return 'text-red-500';
  } else if (props.healthStatus === 'warning') {
    return 'text-amber-500';
  }
  return 'text-blue-500';
});

const titleClass = computed(() => {
  if (props.healthStatus === 'blocked') {
    return 'text-red-800';
  } else if (props.healthStatus === 'warning') {
    return 'text-amber-800';
  }
  return 'text-blue-800';
});

function getIssueIcon(code: string): [string, string] {
  // Layer validation issues get special icons
  if (code.startsWith('LAYER_MISMATCH')) {
    return ['fas', 'layer-group'];
  } else if (code === 'NON_STANDARD_LAYER_FLOW') {
    return ['fas', 'shuffle'];
  } else if (code === 'MISSING_AGGREGATE_FUNCTION') {
    return ['fas', 'calculator'];
  } else if (code.includes('FULL_TABLE_SCAN')) {
    return ['fas', 'database'];
  }
  
  // Default icon based on severity
  return ['fas', 'circle-info'];
}

function getIssueIconClass(severity: string): string {
  if (severity === 'error') {
    return 'text-red-500';
  } else if (severity === 'warning') {
    return 'text-amber-500';
  }
  return 'text-blue-500';
}
</script>
