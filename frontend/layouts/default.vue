<script setup>
const route = useRoute();
const state = reactive({
    authenticated: false,
})
watch(
  route,
  (value, oldValue) => {
    state.authenticated = isAuthenticated();
  },
);

onMounted(() => {
    state.authenticated = isAuthenticated();
})
</script>
<template>
    <div class="relative">
        <header-nav />
        <breadcrumbs v-if="state.authenticated" />
        <div class="flex "
            :class="{
                'flex-row': state.authenticated,
                'flex-col': !state.authenticated,
            }"
        >
            <sidebar v-if="state.authenticated" class="-mt-10 w-1/6"/>
            <div class="w-full">
                <slot></slot>
            </div>
        </div>
        <footer-nav />
    </div>
</template>