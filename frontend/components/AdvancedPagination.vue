<template>
  <div class="advanced-pagination bg-white border border-gray-300 rounded-lg px-6 py-4">
    <!-- Info Row -->
    <div class="pagination-info flex items-center justify-between mb-4 text-sm text-gray-600">
      <div class="flex items-center gap-2">
        <font-awesome-icon :icon="['fas', 'table-cells']" class="text-gray-500" />
        <span>
          Showing <strong class="text-gray-900">{{ startRow.toLocaleString() }}</strong>-<strong class="text-gray-900">{{ endRow.toLocaleString() }}</strong> 
          of <strong class="text-gray-900">{{ totalRows.toLocaleString() }}</strong> rows
        </span>
      </div>
      
      <!-- Rows per page selector -->
      <div class="flex items-center gap-2">
        <label for="page-size-select" class="text-sm">Rows per page:</label>
        <select 
          id="page-size-select"
          v-model="selectedPageSize" 
          @change="changePageSize" 
          class="page-size-select px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option :value="25">25</option>
          <option :value="50">50</option>
          <option :value="100">100</option>
          <option :value="500">500</option>
          <option :value="1000">1000</option>
        </select>
      </div>
    </div>
    
    <!-- Controls Row -->
    <div class="pagination-controls flex items-center justify-center gap-2">
      <!-- First Page -->
      <button 
        @click="goToFirst" 
        :disabled="currentPage === 1"
        :title="`First Page${!disableKeyboardHints ? ' (Ctrl + Home)' : ''}`"
        class="pagination-btn"
        :class="{ disabled: currentPage === 1 }"
      >
        <font-awesome-icon :icon="['fas', 'angles-left']" />
      </button>
      
      <!-- Previous Page -->
      <button 
        @click="prevPage" 
        :disabled="currentPage === 1"
        :title="`Previous Page${!disableKeyboardHints ? ' (PageUp)' : ''}`"
        class="pagination-btn"
        :class="{ disabled: currentPage === 1 }"
      >
        <font-awesome-icon :icon="['fas', 'arrow-left']" />
      </button>
      
      <!-- Page Input -->
      <div class="page-input-group flex items-center gap-2 mx-4">
        <span class="text-sm text-gray-600">Page</span>
        <input 
          v-model.number="pageInput" 
          @keyup.enter="goToPage"
          @blur="goToPage"
          type="number" 
          min="1" 
          :max="totalPages"
          class="page-input w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span class="text-sm text-gray-600">of {{ totalPages.toLocaleString() }}</span>
      </div>
      
      <!-- Next Page -->
      <button 
        @click="nextPage" 
        :disabled="currentPage === totalPages"
        :title="`Next Page${!disableKeyboardHints ? ' (PageDown)' : ''}`"
        class="pagination-btn"
        :class="{ disabled: currentPage === totalPages }"
      >
        <font-awesome-icon :icon="['fas', 'arrow-right']" />
      </button>
      
      <!-- Last Page -->
      <button 
        @click="goToLast" 
        :disabled="currentPage === totalPages"
        :title="`Last Page${!disableKeyboardHints ? ' (Ctrl + End)' : ''}`"
        class="pagination-btn"
        :class="{ disabled: currentPage === totalPages }"
      >
        <font-awesome-icon :icon="['fas', 'angles-right']" />
      </button>
    </div>
    
    <!-- Keyboard Shortcuts Help (optional) -->
    <div v-if="showKeyboardHelp && !disableKeyboardHints" class="keyboard-help mt-4 pt-4 border-t border-gray-200">
      <div class="text-xs text-gray-500 flex items-start gap-2">
        <font-awesome-icon :icon="['fas', 'keyboard']" class="mt-0.5 text-gray-400" />
        <div class="flex flex-wrap gap-x-4 gap-y-1">
          <span><kbd>PageUp</kbd> Previous</span>
          <span><kbd>PageDown</kbd> Next</span>
          <span><kbd>Ctrl+Home</kbd> First</span>
          <span><kbd>Ctrl+End</kbd> Last</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  currentPage: number;
  totalRows: number;
  pageSize: number;
  showKeyboardHelp?: boolean;
  disableKeyboardShortcuts?: boolean;
  disableKeyboardHints?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showKeyboardHelp: false,
  disableKeyboardShortcuts: false,
  disableKeyboardHints: false
});

const emit = defineEmits<{
  (e: 'page-change', page: number): void;
  (e: 'page-size-change', pageSize: number): void;
}>();

const selectedPageSize = ref(props.pageSize);
const pageInput = ref(props.currentPage);

// Update page input when currentPage prop changes
watch(() => props.currentPage, (newPage) => {
  pageInput.value = newPage;
});

// Computed values
const totalPages = computed(() => Math.ceil(props.totalRows / props.pageSize));
const startRow = computed(() => {
  if (props.totalRows === 0) return 0;
  return (props.currentPage - 1) * props.pageSize + 1;
});
const endRow = computed(() => {
  const end = props.currentPage * props.pageSize;
  return Math.min(end, props.totalRows);
});

// Navigation methods
function goToFirst() {
  if (props.currentPage !== 1) {
    emit('page-change', 1);
  }
}

function goToLast() {
  if (props.currentPage !== totalPages.value) {
    emit('page-change', totalPages.value);
  }
}

function prevPage() {
  if (props.currentPage > 1) {
    emit('page-change', props.currentPage - 1);
  }
}

function nextPage() {
  if (props.currentPage < totalPages.value) {
    emit('page-change', props.currentPage + 1);
  }
}

function goToPage() {
  const targetPage = pageInput.value;
  
  // Validate and clamp the input
  if (isNaN(targetPage) || targetPage < 1) {
    pageInput.value = 1;
    emit('page-change', 1);
  } else if (targetPage > totalPages.value) {
    pageInput.value = totalPages.value;
    emit('page-change', totalPages.value);
  } else if (targetPage !== props.currentPage) {
    emit('page-change', targetPage);
  } else {
    // Reset to current page if invalid input
    pageInput.value = props.currentPage;
  }
}

function changePageSize() {
  if (selectedPageSize.value !== props.pageSize) {
    emit('page-size-change', selectedPageSize.value);
  }
}

// Keyboard shortcuts
onMounted(() => {
  if (props.disableKeyboardShortcuts) return;
  
  const handleKeyPress = (e: KeyboardEvent) => {
    // Don't trigger if user is typing in an input field
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }
    
    switch (e.key) {
      case 'PageUp':
        e.preventDefault();
        prevPage();
        break;
      case 'PageDown':
        e.preventDefault();
        nextPage();
        break;
      case 'Home':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          goToFirst();
        }
        break;
      case 'End':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          goToLast();
        }
        break;
    }
  };
  
  window.addEventListener('keydown', handleKeyPress);
  
  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyPress);
  });
});

// Expose methods for parent components
defineExpose({
  goToFirst,
  goToLast,
  prevPage,
  nextPage,
  goToPage
});
</script>

<style scoped>
.pagination-btn {
  @apply px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white;
}

.pagination-btn.disabled {
  @apply text-gray-400;
}

.pagination-btn:not(.disabled) {
  @apply text-gray-700;
}

.pagination-btn:not(.disabled):hover {
  @apply bg-blue-50 border-blue-300;
}

.pagination-btn:not(.disabled):active {
  @apply bg-blue-100;
}

kbd {
  @apply px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono;
}

/* Remove spinner from number input */
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type="number"] {
  -moz-appearance: textfield;
}
</style>
