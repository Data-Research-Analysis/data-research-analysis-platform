<script setup lang="ts">
/**
 * Breadcrumbs component with Schema.org BreadcrumbList markup
 * For AI search optimization and user navigation
 */

interface Breadcrumb {
  name: string;
  path?: string;
}

interface Props {
  items: Breadcrumb[];
}

const props = defineProps<Props>();

// Generate structured data for breadcrumbs
const { getBreadcrumbSchema, injectSchema } = useStructuredData();
const config = useRuntimeConfig();
const baseUrl = config.public.siteUrl || 'https://www.dataresearchanalysis.com';

const breadcrumbItems = computed(() => {
  return props.items.map(item => ({
    name: item.name,
    url: item.path ? `${baseUrl}${item.path}` : baseUrl
  }));
});

// Inject breadcrumb schema
onMounted(() => {
  if (import.meta.client) {
    injectSchema(getBreadcrumbSchema(breadcrumbItems.value));
  }
});
</script>

<template>
  <nav aria-label="Breadcrumb" class="mb-4">
    <ol class="flex items-center space-x-2 text-sm text-gray-600" itemscope itemtype="https://schema.org/BreadcrumbList">
      <li v-for="(item, index) in items" :key="index" class="flex items-center" itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
        <NuxtLink 
          v-if="item.path && index < items.length - 1" 
          :to="item.path" 
          class="hover:text-primary-blue-100 transition-colors"
          itemprop="item"
        >
          <span itemprop="name">{{ item.name }}</span>
        </NuxtLink>
        <span v-else class="text-gray-800 font-medium" itemprop="name">{{ item.name }}</span>
        <meta itemprop="position" :content="String(index + 1)" />
        <span v-if="index < items.length - 1" class="mx-2 text-gray-400">/</span>
      </li>
    </ol>
  </nav>
</template>
