<script setup lang="ts">
</script>
<template>
    <div class="drop-shadow-md hover:drop-shadow-lg select-none" data-cy="notched-card">
        <div class="w-50 h-50 p-5 bg-gray-100 [clip-path:polygon(0_0,100%_0,100%_70%,60%_100%,0%_100%)] rounded-xl">
            <slot name="body"></slot>
        </div>
    </div>
</template>