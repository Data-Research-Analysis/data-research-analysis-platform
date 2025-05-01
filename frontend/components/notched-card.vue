<script setup>
</script>
<template>
    <div class="drop-shadow-md hover:drop-shadow-lg select-none" data-cy="notched-card">
        <div class="w-50 h-50 p-5 bg-gray-100 notched-corner">
            <slot name="body"></slot>
        </div>
    </div>
</template>
<style scoped>
.notched-corner {
    clip-path: polygon(
        0 0,
        100% 0,
        100% 70%,
        60% 100%,
        0% 100%
  );
}
</style>