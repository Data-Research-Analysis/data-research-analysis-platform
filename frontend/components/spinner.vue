<script setup>
const props = defineProps({
  show: {
    type: Boolean,
    required: true,
  },
});
</script>
<template>
  <div v-if="show" class="flex flex-row justify-center h-[200px] text-white">
    <div
      class="inline-block h-20 w-20 animate-spin rounded-full border-8 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
      role="status"
    >
      <span
        class="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(1,1,1,0)]"
        >Loading...</span
      >
    </div>
  </div>
</template>
