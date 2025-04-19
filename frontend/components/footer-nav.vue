<script setup>
const route = useRoute();
const isHomePage = computed(() => {
    return route.name === "index";
})
function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth'});   
}

onMounted(() => {
    document.addEventListener("scroll", () => {
        const scrollButton = document.getElementById("scroll_to_top_button");
        if (window.scrollY > 100) {
            scrollButton.classList.remove("hidden", "opacity-0", "translate-y-2");
            scrollButton.classList.add("opacity-100", "translate-y-0");
        } else {
            scrollButton.classList.add("opacity-0", "translate-y-2");
            scrollButton.classList.remove("opacity-100", "translate-y-0");
            setTimeout(() => {
                if (window.scrollY <= 100) {
                    scrollButton.classList.add("hidden");
                }
            }, 300);
        }
    })
})
</script>
<template>
    <div>
        <img v-if="isHomePage" src="/blue-background-top.svg" class="w-full" />
        <div class="bg-primary-blue-100 w-full h-full text-white text-xl font-bold">
            <div class="flex flex-col justify-between h-full p-5">
                <div class="flex flex-row">
                    <div class="w-1/2">
                        <NuxtLink to="/" class="hover:text-gray-300 lg:ml-8">Data Reasearch Analysis</NuxtLink>
                    </div>
                    <div class="w-1/2 flex flex-row justify-end mr-8">
                        <div class="w-1/4 flex flex-col">
                            <span>Important Links</span>
                            <span class="text-base mt-2 mb-2">
                                <NuxtLink to="/register" class="hover:text-gray-300">Register</NuxtLink>
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
                
                <div class="w-full h-1 bg-white mb-5"></div>
                <div class="">
                    COPYRIGHT 2024 - 2025 Data Research Analysis (SMC-Private) Limited
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