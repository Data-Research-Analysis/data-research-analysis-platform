<script setup>
const props = defineProps({
  status: {
    type: Boolean,
    default: false,
  },
});
</script>
<template>
  <div
    role="button"
    class="w-20 p-2 mb-2 ml-2 flex flex-row cursor-pointer shadow-md rounded-full"
    :class="
      props.status
        ? 'bg-primary-blue-100 justify-end'
        : 'bg-gray-300 justify-start'
    "
  >
    <div
      v-if="!props.status"
      class="flex flex-col justify-center bg-white hover:bg-gray-100 h-6 w-6 rounded-full"
    ></div>
    <div
      v-else
      class="flex flex-col justify-center bg-white hover:bg-gray-100 h-6 w-6 rounded-full"
    ></div>
  </div>
</template>
