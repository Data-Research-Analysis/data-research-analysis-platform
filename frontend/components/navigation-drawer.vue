<script setup>
import { useLoggedInUserStore } from "@/stores/logged_in_user";

const emits = defineEmits(["closeDrawer"]);
const props = defineProps({
    drawerOpen: Boolean,
});

const loggedInUserStore = useLoggedInUserStore();

// Get auth token as a reactive reference
const authToken = useCookie('dra_auth_token');

// Track client-side mount status to prevent hydration mismatches
const isMounted = ref(false);
onMounted(() => {
    isMounted.value = true;
});

// Computed property for authentication state based on cookie
const authenticated = computed(() => {
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

const userNameFirstLetter = computed(() => {
    return loggedInUser.value?.first_name ? loggedInUser.value.first_name.charAt(0).toUpperCase() : '';
});

function closeDrawer() {
    emits("closeDrawer");
}
</script>
<template>
    <div>
        <div class="bg-black opacity-50 w-full h-full z-40 fixed top-0 left-0 lg:hidden"
            :class="{
                'hidden': !props.drawerOpen,
                'block': props.drawerOpen
            }"
             @click="closeDrawer"
        ></div>
        <div class="bg-primary-blue-200 w-2/3 h-full z-50 fixed top-0 left-0 lg:hidden 
                    transition-all duration-500 transform"
            :class="{
                'translate-x-0': props.drawerOpen,
                '-translate-x-full': !props.drawerOpen
            }">
            <div class="">
                <img src="/logo-words.svg" class="absolute top-0 -left-1 h-18 lg:h-22 bg-black p-2 pl-5 pr-[130px] logo-fancy"/>     
                <font-awesome icon="fas fa-times" class="absolute top-18 right-2 text-4xl hover:text-gray-300 cursor-pointer" @click="closeDrawer" />
            </div>
            
            <!-- Unauthenticated Menu -->
            <div v-if="!authenticated" class="flex flex-col mt-20 ml-2">
                <div class="text-xl font-bold hover:text-gray-300 cursor-pointer" @click="closeDrawer">
                    <NuxtLink to="/">Home</NuxtLink>
                </div>
                <div class="text-xl font-bold mt-2 hover:text-gray-300 cursor-pointer" @click="closeDrawer">
                    <NuxtLink to="/articles">Blog</NuxtLink>
                </div>
                <div class="flex flex-row mr-5 mt-5 gap-3">
                    <NuxtLink to="/login" class="text-xl font-bold hover:text-gray-300" @click="closeDrawer()">Login</NuxtLink>
                </div>
                <div class="flex flex-row mr-5 mt-3">
                    <combo-button label="Choose Your Plan" color="white" class="w-full h-10 mr-2 shadow-lg cursor-pointer" @click="gotoJoinPricing();closeDrawer();"/>
                </div>
                <div class="w-3/4 h-1 bg-white m-auto mt-5"></div>
                <div class="flex flex-row mt-5">
                    <font-awesome icon="fab fa-github-square" class="text-4xl hover:text-gray-300 cursor-pointer" @click="openGithub();closeDrawer();"/>
                    <font-awesome icon="fab fa-linkedin" class="ml-5 text-4xl hover:text-gray-300 cursor-pointer" @click="openLinkedin();closeDrawer();"/>
                </div>
            </div>
            
            <!-- Authenticated Menu -->
            <div v-else class="flex flex-col mt-20 ml-2">
                <div v-if="isUserAdmin" class="text-xl font-bold hover:text-gray-300 cursor-pointer" @click="closeDrawer">
                    <NuxtLink to="/admin">Admin</NuxtLink>
                </div>
                <div class="text-xl font-bold mt-2 hover:text-gray-300 cursor-pointer" @click="closeDrawer">
                    <NuxtLink to="/projects">Projects</NuxtLink>
                </div>
                <div class="w-3/4 h-1 bg-white m-auto mt-5"></div>
                <div class="flex flex-row mt-5 items-center">
                    <ClientOnly>
                        <div class="flex flex-col justify-center items-center w-10 h-10 bg-gray-200 border border-primary-blue-100 border-solid p-1 rounded-full font-bold text-center text-black">
                            {{ userNameFirstLetter }}
                        </div>
                        <template #fallback>
                            <div class="flex flex-col justify-center items-center w-10 h-10 bg-gray-200 border border-primary-blue-100 border-solid p-1 rounded-full">
                                <div class="animate-pulse h-4 w-4 bg-gray-300 rounded"></div>
                            </div>
                        </template>
                    </ClientOnly>
                    <div class="text-xl font-bold ml-3 hover:text-gray-300 cursor-pointer" @click="closeDrawer">
                        <NuxtLink to="/logout">Logout</NuxtLink>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>