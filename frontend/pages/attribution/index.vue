<!-- Deprecated: redirected via routeRules in nuxt.config.ts to /marketing-projects -->
<script setup lang="ts">
const router = useRouter();
onMounted(() => router.replace('/marketing-projects'));
</script>

<template>
    <div class="flex items-center justify-center min-h-screen text-gray-500">
        <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin mr-2" />
        Redirecting…
    </div>
</template>
