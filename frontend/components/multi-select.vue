<script setup>
import { onMounted, reactive, watch } from "vue";
const state = reactive({
  selectedFilterItems: [],
  selectedFilterItemsObjects: [],
  filterSelectorOpened: false,
  textInput: [],
  value: "",
});
const emit = defineEmits(["multi-select-filtered-data"]);
const filteredOptions = computed(() => {
  if (state.value === "") {
    return props.options;
  }
  return props.options.filter((option) => {
    const pattern = new RegExp(state.value, "i");
    return option.label.toLowerCase().match(pattern);
  });
});
const props = defineProps({
  options: {
    type: Array,
    required: true,
  },
  defaultOptions: {
    type: Array,
    required: true,
  },
  searchable: {
    type: Boolean,
    default: false,
  },
  placeholder: {
    type: String,
    default: "",
  },
});
watch(
  () => state.value,
  (value, oldValue) => {
    openFilter();
  },
);
function toggleFilter() {
  state.filterSelectorOpened = !state.filterSelectorOpened;
}
function openFilter() {
  state.filterSelectorOpened = true;
}
function closeFilter() {
  state.filterSelectorOpened = false;
}
function selectOption(option) {
  if (!state.selectedFilterItems.includes(option.label)) {
    state.selectedFilterItems.push(option.label);
    state.selectedFilterItemsObjects.push(option);
  }
  emit("multi-select-filtered-data", state.selectedFilterItemsObjects);
  closeFilter();
}
function removeSelectedOption(option) {
  state.selectedFilterItems = state.selectedFilterItems.filter(
    (f) => f !== option.label,
  );
  state.selectedFilterItemsObjects = state.selectedFilterItemsObjects.filter(
    (f) => f.label !== option.label,
  );
  emit("multi-select-filtered-data", state.selectedFilterItemsObjects);
}
onMounted(async () => {
  props.defaultOptions.forEach((d) => {
    if (!state.selectedFilterItems.includes(d.label)) {
      state.selectedFilterItems.push(d.label);
      state.selectedFilterItemsObjects.push(d);
    }
  });
  emit("multi-select-filtered-data", state.selectedFilterItemsObjects);
});
</script>
<template>
  <div class="w-full flex flex-col justify-center">
    <div>
      <div
        v-if="!props.searchable"
        class="w-full text-left text-md flex flex-row justify-between border-1 border-gray-200 p-2 cursor-pointer mt-5 hover:bg-blue-100"
        @click="toggleFilter"
      >
        <span class="ml-5">Select Item</span>
        <span v-if="!state.filterSelectorOpened" class="mr-5">
          <font-awesome icon="fa-solid fa-chevron-down" />
        </span>
        <span v-else class="mr-5">
          <font-awesome icon="fa-solid fa-chevron-up" />
        </span>
      </div>
      <div v-else class="relative">
        <input
          id="text-input"
          v-model="state.value"
          class="w-full text-left text-md flex flex-row justify-between border-1 border-gray-300 p-2 cursor-pointer rounded-t-lg"
          :placeholder="placeholder"
          @click="toggleFilter"
        />
        <span
          v-if="!state.filterSelectorOpened"
          class="absolute top-0 right-0 mt-3 mr-5"
        >
          <font-awesome icon="fa-solid fa-chevron-down" />
        </span>
        <span v-else class="absolute top-0 right-0 mt-3 mr-5">
          <font-awesome icon="fa-solid fa-chevron-up" />
        </span>
      </div>
      <div
        class="input-filter w-full text-left font-bold text-md grid gap-4 grid-cols-5 grid-rows-1 border-1 border-gray-300 p-2 min-h-[50px] cursor-pointer rounded-b-md"
      >
        <div
          v-for="item in state.selectedFilterItemsObjects"
          :key="item.key"
          class="input-filter flex flex-row justify-between bg-primary-blue-200 text-white text-base p-1 ml-2 rounded"
        >
          <span class="text-white flex flex-col justify-center">
            {{ item.label }}
          </span>
          <span
            class="close-filter-input flex flex-col justify-center text-md hover:text-blue-300 cursor-pointer mr-2"
            @click="removeSelectedOption(item)"
          >
            X
          </span>
        </div>
      </div>
      <div
        v-if="state.filterSelectorOpened && filteredOptions.length"
        id="input-filter-options"
        class="w-full text-left text-md cursor-pointer bg-white"
      >
        <div
          v-for="(option, index) in filteredOptions"
          :key="option.key"
          class="input-filter-options-value w-full text-left text-md rounded-none border-1 border-gray-300 p-2 cursor-pointer hover:bg-blue-100"
          :class="{
            'bg-red-100': state.selectedFilterItems.includes(option.label),
            'rounded-b-md': index === filteredOptions.length - 1,
          }"
          @click="selectOption(option)"
        >
          {{ option.label }}
        </div>
      </div>
    </div>
  </div>
</template>
