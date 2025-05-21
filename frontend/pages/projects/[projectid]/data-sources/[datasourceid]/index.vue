<script setup>
const route = useRoute();
const router = useRouter();
router.push(`${route.fullPath}/data-models`);
</script>
<template>
    <div class="min-h-100"></div>
</template>