<script setup>
import { onMounted } from "vue";

onMounted(() => {

})
</script>
<template>
    <v-container fluid>
        <header-nav />
        <div>
            <slot />
        </div>
        <footer-nav />
    </v-container>
</template>