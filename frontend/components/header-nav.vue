<script setup>
import { useLoggedInUserStore } from "@/stores/logged_in_user";
const route = useRoute();
const loggedInUserStore = useLoggedInUserStore();

// Get auth token as a reactive reference
const authToken = useCookie('dra_auth_token');

const state = reactive({
    drawerOpen: false,
});

// Track client-side mount status to prevent hydration mismatches
const isMounted = ref(false);
onMounted(() => {
    isMounted.value = true;
});

// Computed property for authentication state based on cookie
const authenticated = computed(() => {
    // Check cookie value directly for reactivity
    return !!authToken.value;
});

const loggedInUser = computed(() => {
    return loggedInUserStore.getLoggedInUser();
});

const isUserAdmin = computed(() => {
    // Guard to prevent hydration mismatch - always return false during SSR
    if (!isMounted.value) return false;
    return loggedInUser.value?.user_type === 'admin';
});

const isPublicDashboard = computed(() => {
    return route.name === 'public-dashboard-dashboardkey';
});

const userNameFirstLetter = computed(() => {
    return loggedInUser.value?.first_name ? loggedInUser.value.first_name.charAt(0).toUpperCase() : '';
});

function openDrawer() {
    state.drawerOpen = true;
}

function closeDrawer() {
    state.drawerOpen = false;
}

function scrollToPricing(event) {
    event.preventDefault();
    if (import.meta.client) {
        const currentRoute = route.name;
        if (currentRoute === 'index') {
            // Already on homepage, just scroll
            const pricingSection = document.getElementById('pricing');
            if (pricingSection) {
                pricingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } else {
            // Navigate to homepage with hash
            navigateTo('/#pricing');
        }
    }
}
</script>
<template>
    <div class="relative bg-primary-blue-100 text-white h-10 lg:h-15 shadow-lg z-10" id="top">
        <img src="/logo-words.svg" class="absolute top-0 -left-1 h-18 lg:h-22 bg-black p-2 pl-5 pr-[130px] logo-fancy"/>
        <div class="absolute top-[5px] right-5 w-3/5 flex flex-row justify-end flex lg:hidden">
            <font-awesome icon="fas fa-bars" class="text-2xl cursor-pointer hover:text-gray-300" @click="openDrawer" />
        </div>
        <div v-if="!isPublicDashboard" class="absolute lg:top-2 lg:right-10 lg:h-10 hidden lg:block">
            <div v-if="!authenticated" class="flex flex-row justify-between items-center h-full">
                <div class="flex flex-row items-center -mt-2">
                    <div class="text-xl font-bold hover:text-gray-300 cursor-pointer">
                        <NuxtLink to="/">Home</NuxtLink>
                    </div>
                    <div class="text-xl font-bold hover:text-gray-300 cursor-pointer ml-5">
                        <NuxtLink to="/articles">Blog</NuxtLink>
                    </div>
                    <div class="text-xl font-bold hover:text-gray-300 cursor-pointer ml-5">
                        <NuxtLink to="/login" class="text-xl font-bold hover:text-gray-300">Login</NuxtLink>
                    </div>
                </div>
                <div class="flex flex-row">
                    <div class="flex flex-row mr-5">
                        <font-awesome icon="fab fa-github-square" class="ml-5 text-4xl hover:text-gray-300 cursor-pointer" @click="openGithub()"/>
                        <font-awesome icon="fab fa-linkedin" class="ml-5 text-4xl hover:text-gray-300 cursor-pointer" @click="openLinkedin()"/>
                    </div>
                    <div class="flex flex-row mr-5 hidden lg:block">
                        <combo-button label="Choose Your Plan" color="white" class="w-full h-10 mr-2 shadow-lg cursor-pointer" @click="gotoJoinPricing()"/>
                    </div>
                </div>
            </div>
            <div v-else class="flex flex-row items-center h-full" :class="{'justify-between': isUserAdmin, 'justify-end': !isUserAdmin}">
                <div v-if="isUserAdmin" class="flex flex-row justify-start">
                    <div class="text-xl font-bold hover:text-gray-300 cursor-pointer">
                        <NuxtLink to="/admin">Admin</NuxtLink>
                    </div>
                    <div class="text-xl font-bold ml-5 mr-5 hover:text-gray-300 cursor-pointer">
                        <NuxtLink to="/projects">Projects</NuxtLink>
                    </div>
                </div>
                <!-- Organization Switcher -->
                <div class="mr-4">
                    <organization-switcher />
                </div>
                <!-- Notification Bell -->
                <div class="mr-4">
                    <NotificationBell />
                </div>
                <ClientOnly>
                    <menu-dropdown>
                        <template #menuItem="{ onClick }">
                            <div @click="onClick" class="flex flex-col justify-center items-center w-10 h-10 bg-gray-200 border border-primary-blue-100 border-solid p-1 rounded-full cursor-pointer hover:bg-gray-300 font-bold text-center text-black text-none">
                                {{ userNameFirstLetter }}
                            </div>
                        </template>
                        <template #dropdownMenu="{ onClick }">
                            <div class="flex flex-col w-40 text-center">
                                <NuxtLink to="/logout">
                                    <div @click="onClick" class="text-xl font-bold text-black hover:bg-gray-200 cursor-pointer pt-1 pb-1">
                                        Logout
                                    </div>
                                </NuxtLink>
                            </div>
                        </template>
                    </menu-dropdown>
                    <template #fallback>
                        <div class="flex flex-col justify-center items-center w-10 h-10 bg-gray-200 border border-primary-blue-100 border-solid p-1 rounded-full">
                            <div class="animate-pulse h-4 w-4 bg-gray-300 rounded"></div>
                        </div>
                    </template>
                </ClientOnly>
            </div>
        </div>
       <navigation-drawer :drawer-open="state.drawerOpen" @close-drawer="closeDrawer" />
    </div>
</template>