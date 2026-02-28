<script setup>
import { useLoggedInUserStore } from "@/stores/logged_in_user";

const loggedInUserStore = useLoggedInUserStore();
const route = useRoute();

const state = reactive({
    authenticated: false,
});

const mobileNavOpen = ref(false);
provide('mobileNavOpen', mobileNavOpen);

onMounted(() => {
    state.authenticated = isAuthenticated();
});

watch(route, () => {
    state.authenticated = isAuthenticated();
    mobileNavOpen.value = false;
});

const loggedInUser = computed(() => {
    return loggedInUserStore.getLoggedInUser();
});

const isInPublicDashboard = computed(() => {
    return route.name === 'public-dashboard-dashboardkey';
});

const isInOauthCallback = computed(() => {
    return route.path.startsWith('/oauth/');
});

const isInInvitationAccept = computed(() => {
    return route.path.startsWith('/invitations/accept/');
});
</script>

<template>
    <div class="relative flex flex-col min-h-screen data-research-analysis">
        <header-nav class="print:hidden" />
        <breadcrumbs
            v-if="state.authenticated && !isInPublicDashboard && !isInOauthCallback && !isInInvitationAccept"
            class="print:hidden"
        />
        <!-- Mobile top bar: hamburger to open the sidebar drawer -->
        <div class="md:hidden print:hidden flex items-center gap-3 px-4 py-2 bg-primary-blue-300 border-b border-primary-blue-400">
            <button
                @click="mobileNavOpen = true"
                type="button"
                class="text-white p-1.5 rounded hover:bg-primary-blue-400 transition-colors cursor-pointer"
                aria-label="Open navigation"
            >
                <font-awesome-icon :icon="['fas', 'bars']" class="w-5 h-5" />
            </button>
            <span class="text-white text-sm font-medium">Navigation</span>
        </div>
        <div class="flex flex-grow flex-row print:block">
            <project-sidebar class="print:hidden" />
            <div class="flex-1 min-w-0 print:w-full">
                <slot />
            </div>
        </div>
        <footer-nav class="print:hidden" />
        <cookie-disclaimer-banner class="print:hidden" />
    </div>
</template>
