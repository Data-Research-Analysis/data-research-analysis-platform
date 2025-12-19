<script setup>
// Get auth token as reactive reference (matches header pattern)
const authToken = useCookie('dra_auth_token');

const route = useRoute();

// Computed property for authentication state based on cookie
const authenticated = computed(() => {
    return !!authToken.value;
});

const isHomePage = computed(() => {
    return route.name === "index";
})
const isPublicDashboard = computed(() => {
    return route.name === 'public-dashboard-dashboardkey';
});
const currentYear = computed(() => { return new Date().getFullYear()});
function scrollToTop() {
    // Only access window on client side for SSR compatibility
    if (import.meta.client) {
        window.scrollTo({ top: 0, behavior: 'smooth'});   
    }
}

onMounted(() => {
    // Only access window/document on client side for SSR compatibility
    if (import.meta.client) {
        document.addEventListener("scroll", () => {
            const scrollButton = document.getElementById("scroll_to_top_button");
            if (window.scrollY > 100) {
                scrollButton?.classList?.remove("hidden", "opacity-0", "translate-y-2");
                scrollButton?.classList?.add("opacity-100", "translate-y-0");
            } else {
                scrollButton?.classList?.add("opacity-0", "translate-y-2");
                scrollButton?.classList?.remove("opacity-100", "translate-y-0");
                setTimeout(() => {
                    if (window.scrollY <= 100) {
                        scrollButton?.classList?.add("hidden");
                    }
                }, 300);
            }
        })
    }
})
</script>
<template>
    <div>
        <div class="bg-primary-blue-100 w-full h-full text-white text-xl font-bold">
            <div class="flex flex-col justify-between h-full p-5">
                <div class="w-full h-1 bg-white mb-5"></div>
                <div class="flex flex-row">
                    <div class="w-1/2">
                        <div class="hover:text-gray-300 cursor-pointer" @click="openGithub()">Data Research Analysis is an open source data analysis platform developed under the MIT Open Source License.</div>
                    </div>
                    <div class="w-1/2 flex flex-row justify-end mr-8">
                        <div v-if="!isPublicDashboard" class="w-1/4 flex flex-col">
                            <span>Important Links</span>
                            <span v-if="isPlatformEnabled() && isPlatformRegistrationEnabled() && !authenticated" class="text-base mt-2 mb-2">
                                <NuxtLink to="/register" class="hover:text-gray-300">Register</NuxtLink>
                            </span>
                            <span v-if="isPlatformEnabled() && isPlatformLoginEnabled() && !authenticated" class="text-base mt-2 mb-2">
                                <NuxtLink to="/login" class="hover:text-gray-300">Login</NuxtLink>
                            </span>
                            <span class="text-base mt-2 mb-2">
                                <NuxtLink to="/privacy-policy" class="hover:text-gray-300">Privacy Policy</NuxtLink>
                            </span>
                            <span class="text-base mb-2">
                                <NuxtLink to="/terms-conditions" class="hover:text-gray-300">Terms &amp; Conditions</NuxtLink>
                            </span>
                        </div>
                        
                    </div>
                </div>                
                <div class="">
                    COPYRIGHT 2024 - {{ currentYear }} Data Research Analysis (SMC-Private) Limited
                </div>
            </div>
        </div>
        <div
            id="scroll_to_top_button"
            @click="scrollToTop"
            role="button"
            class="hidden fixed right-20 bottom-5 w-12 p-2 rounded-lg mb-2 ml-2 flex flex-row cursor-pointer bg-red-500 hover:bg-red-700 text-white text-lg justify-center z-10 transition duration-150 ease-in-out"
        >
            <font-awesome icon="fas fa-arrow-up" />
        </div>
    </div>
</template>