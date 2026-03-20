<template>
  <div class="infinite-list">
    <!-- List Items -->
    <div v-for="item in items" :key="item.id" class="list-item">
      <slot :item="item" />
    </div>
    
    <!-- Load More Trigger -->
    <div v-if="hasMore" ref="loadMoreTrigger" class="load-more-trigger py-8">
      <div v-if="loading" class="loading flex flex-col items-center gap-3">
        <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-2xl text-blue-600" />
        <span class="text-sm text-gray-600">Loading more...</span>
      </div>
      <button 
        v-else 
        @click="loadMore" 
        class="load-more-btn bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors flex items-center gap-2 mx-auto"
      >
        <font-awesome-icon :icon="['fas', 'arrow-down']" />
        Load More
      </button>
    </div>
    
    <!-- End of List Message -->
    <div v-if="!hasMore && items.length > 0" class="end-message py-6 text-center text-gray-500 flex items-center justify-center gap-2">
      <font-awesome-icon :icon="['fas', 'check']" class="text-green-600" />
      <span>That's all!</span>
    </div>
    
    <!-- Empty State -->
    <div v-if="!loading && !hasMore && items.length === 0" class="empty-state py-12 text-center">
      <font-awesome-icon :icon="['fas', 'inbox']" class="text-4xl text-gray-400 mb-3" />
      <p class="text-gray-500">No items found</p>
    </div>
    
    <!-- Error State -->
    <div v-if="error" class="error-state bg-red-50 border border-red-200 rounded-lg p-6 text-center mt-4">
      <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="text-red-500 text-3xl mb-2" />
      <h3 class="text-lg font-semibold text-red-800 mb-1">Failed to Load</h3>
      <p class="text-red-600 text-sm mb-4">{{ error }}</p>
      <button 
        @click="retry" 
        class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
      >
        <font-awesome-icon :icon="['fas', 'arrow-rotate-right']" class="mr-2" />
        Retry
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  fetchFunction: (page: number, pageSize: number) => Promise<{ items: any[]; hasMore: boolean; total?: number }>;
  pageSize?: number;
  autoLoad?: boolean; // Whether to use Intersection Observer for auto-loading
  initialLoad?: boolean; // Whether to load on mount
}

const props = withDefaults(defineProps<Props>(), {
  pageSize: 25,
  autoLoad: true,
  initialLoad: true
});

const items = ref<any[]>([]);
const loading = ref(false);
const hasMore = ref(true);
const currentPage = ref(0);
const error = ref<string | null>(null);
const loadMoreTrigger = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

async function loadMore() {
  if (loading.value || !hasMore.value) return;
  
  loading.value = true;
  error.value = null;
  
  try {
    const nextPage = currentPage.value + 1;
    const result = await props.fetchFunction(nextPage, props.pageSize);
    
    items.value.push(...result.items);
    hasMore.value = result.hasMore;
    currentPage.value = nextPage;
    
    console.log(`[InfiniteList] Loaded page ${nextPage}, ${result.items.length} items, hasMore: ${result.hasMore}`);
  } catch (err: any) {
    console.error('[InfiniteList] Failed to load more:', err);
    error.value = err.message || 'Failed to load items';
  } finally {
    loading.value = false;
  }
}

function retry() {
  error.value = null;
  loadMore();
}

function reset() {
  items.value = [];
  currentPage.value = 0;
  hasMore.value = true;
  error.value = null;
  if (props.initialLoad) {
    loadMore();
  }
}

// Expose methods for parent components
defineExpose({
  loadMore,
  reset,
  items: computed(() => items.value),
  loading: computed(() => loading.value),
  hasMore: computed(() => hasMore.value)
});

onMounted(() => {
  // Set up intersection observer for auto-loading
  if (props.autoLoad) {
    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore.value && !loading.value) {
          loadMore();
        }
      },
      { 
        threshold: 0.1,
        rootMargin: '100px' // Start loading 100px before the trigger is visible
      }
    );
    
    // Watch for loadMoreTrigger to be created
    watch(() => loadMoreTrigger.value, (newVal) => {
      if (newVal && observer) {
        observer.observe(newVal);
      }
    }, { immediate: true });
  }
  
  // Load initial data
  if (props.initialLoad) {
    loadMore();
  }
});

onUnmounted(() => {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
});
</script>

<style scoped>
.infinite-list {
  width: 100%;
}

.list-item {
  /* Parent component provides styling via slot */
}

.load-more-trigger {
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
