<script setup>
const route = useRoute();
const router = useRouter();
onMounted(() => {
    let path = route.fullPath.split('/');
    path = path.filter((item, index) => index < path.length - 1).join('/');
    router.push(path);
});
</script>
<template>
    <div class="min-h-100"></div>
</template>