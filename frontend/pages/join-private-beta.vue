<script setup>
definePageMeta({
    middleware: [
        function () {
            return navigateTo('/register', { redirectCode: 301 })
        }
    ]
})
</script>

<template>
    <div class="min-h-screen flex items-center justify-center bg-gray-50">
        <div class="text-center">
            <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p class="text-gray-600 text-lg">Redirecting to registration...</p>
        </div>
    </div>
</template>
