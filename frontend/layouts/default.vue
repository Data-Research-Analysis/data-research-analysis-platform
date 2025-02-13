<script setup>
import { onMounted } from "vue";

onMounted(() => {

})
</script>
<template>
    <div>
        <header-nav />
        <div>
            <slot></slot>
        </div>
        <footer-nav />
    </div>
</template>