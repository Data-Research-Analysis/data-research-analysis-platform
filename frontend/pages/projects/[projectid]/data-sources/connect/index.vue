<script setup>

definePageMeta({ layout: 'project' });
const route = useRoute();
const router = useRouter();
//remove /connect from the url
router.push(`${route.fullPath.split('/').splice(0, route.fullPath.split('/').length -1).join('/')}`);
</script>
<template>
</template>