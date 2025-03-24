<script setup>
const props = defineProps({});
</script>
<template>
  <div class="flex flex-row justify-center h-30 text-primary-blue-300">
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
