<script setup>
import { useLoggedInUserStore } from "@/stores/logged_in_user";

const loggedInUserStore = useLoggedInUserStore();
const route = useRoute();

const state = reactive({
    authenticated: false,
})

// Update authentication state
onMounted(() => {
    state.authenticated = isAuthenticated();
});

// Watch for route changes to update authentication state
watch(route, () => {
    state.authenticated = isAuthenticated();
});

const loggedInUser = computed(() => {
    return loggedInUserStore.getLoggedInUser();
});

const isUserAdmin = computed(() => {
    return loggedInUser.value?.user_type === 'admin';
});

const isInPublicDashboard = computed(() => {
    return route.name === 'public-dashboard-dashboardkey';
});
</script>
<template>
    <div class="relative data-research-analysis">
        <header-nav />
        <breadcrumbs v-if="state.authenticated && !isInPublicDashboard" />
        <div class="flex "
        :class="{
            'flex-row': state.authenticated,
            'flex-col': !state.authenticated,
        }"
        >
        <div class="w-full">
                <slot></slot>
            </div>
        </div>
        <footer-nav />
    </div>
</template>