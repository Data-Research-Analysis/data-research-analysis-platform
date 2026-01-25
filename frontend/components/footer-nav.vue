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
        <div class="bg-primary-blue-100 text-white font-sans w-full">
            <div class="max-w-7xl mx-auto px-6 py-12">
                <!-- Main Footer Content -->
                <div class="flex flex-col lg:flex-row lg:justify-between gap-10">
                    
                    <!-- 1. Brand / Description -->
                    <div class="lg:w-1/3 text-center lg:text-left">
                        <p class="hover:text-gray-200 cursor-pointer text-lg leading-relaxed font-bold" @click="openGithub()">
                            Data Research Analysis is an open source data analysis platform developed under the MIT Open Source License.
                        </p>
                    </div>

                    <!-- 2. Important Links -->
                    <div v-if="!isPublicDashboard" class="flex flex-col items-center lg:items-start space-y-3">
                        <h3 class="font-bold text-xl mb-2 opacity-90">Important Links</h3>
                        
                        <NuxtLink v-if="isPlatformEnabled() && isPlatformRegistrationEnabled() && !authenticated" 
                                  to="/register" 
                                  class="text-base hover:text-gray-300 hover:underline opacity-90 hover:opacity-100 transition duration-200">
                            Register
                        </NuxtLink>
                        
                        <NuxtLink v-if="isPlatformEnabled() && isPlatformLoginEnabled() && !authenticated" 
                                  to="/login" 
                                  class="text-base hover:text-gray-300 hover:underline opacity-90 hover:opacity-100 transition duration-200">
                            Login
                        </NuxtLink>

                        <NuxtLink to="/privacy-policy" 
                                  class="text-base hover:text-gray-300 hover:underline opacity-90 hover:opacity-100 transition duration-200">
                            Privacy Policy
                        </NuxtLink>

                        <NuxtLink to="/return-refund-policy" 
                                  class="text-base hover:text-gray-300 hover:underline opacity-90 hover:opacity-100 transition duration-200">
                            Return &amp; Refund Policy
                        </NuxtLink>

                        <NuxtLink to="/cancellation-policy" 
                                  class="text-base hover:text-gray-300 hover:underline opacity-90 hover:opacity-100 transition duration-200">
                            Cancellation Policy
                        </NuxtLink>

                        <NuxtLink to="/terms-conditions" 
                                  class="text-base hover:text-gray-300 hover:underline opacity-90 hover:opacity-100 transition duration-200">
                            Terms & Conditions
                        </NuxtLink>
                    </div>

                    <!-- 3. Trust Badges ("Registered with") -->
                    <div class="flex flex-col items-center lg:items-start">
                         <h3 class="text-sm uppercase tracking-wider mb-4 opacity-70 font-bold">Registered With</h3>
                         <div class="flex flex-row gap-4 items-center bg-white/5 p-4 rounded-xl">
                            <a href="https://www.secp.gov.pk/" target="_blank" title="Securities Exchange Commission Pakistan" class="hover:opacity-80 transition duration-200">
                                <img src="/assets/images/secp.png" class="h-16 w-auto" alt="Securities Exchange Commission Pakistan" />
                            </a>
                            <a href="https://www.techdestination.com/" target="_blank" title="Pakistan Software Export Board" class="hover:opacity-80 transition duration-200">
                                <img src="/assets/images/pseb-logo.png" class="h-16 w-auto" alt="Pakistan Software Export Board" />
                            </a>
                            <a href="https://www.techdestination.com/" target="_blank" title="Tech Destination Pakistan" class="hover:opacity-80 transition duration-200">
                                <img src="/assets/images/tech-destination-logo.png" class="h-12 w-auto" alt="Tech Destination Pakistan" />
                            </a>
                         </div>
                    </div>
                </div>

                <!-- Divider -->
                <div class="w-full h-px bg-white/20 my-8"></div>

                <!-- Copyright -->
                <div class="text-center text-sm opacity-60">
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