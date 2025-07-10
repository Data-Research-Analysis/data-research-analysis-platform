<script setup>
import { useLoggedInUserStore } from "@/stores/logged_in_user";
const route = useRoute();
const loggedInUserStore = useLoggedInUserStore();
const state = reactive({
    drawerOpen: false,
    authenticated: false,
})

watch(
  route,
  (value, oldValue) => {
    state.authenticated = isAuthenticated();
  },
);
const loggedInUser = computed(() => {
    return loggedInUserStore.getLoggedInUser();
});
const isUserAdmin = computed(() => {
    return loggedInUser.value?.user_type === 'admin';
});
function openDrawer() {
 state.drawerOpen = true;
}
function closeDrawer() {
 state.drawerOpen = false;
}

onMounted(() => {
    state.authenticated = isAuthenticated();
})
</script>
<template>
    <div class="relative bg-primary-blue-100 text-white h-10 lg:h-15 shadow-lg z-10" id="top">
        <img src="/logo.svg" class="absolute top-0 -left-1 h-18 lg:h-20" />      
        <div class="absolute top-[5px] right-5 w-3/5 flex flex-row justify-end flex lg:hidden">
            <font-awesome icon="fas fa-bars" class="text-2xl cursor-pointer hover:text-gray-300" @click="openDrawer" />
        </div>
        <div class="absolute lg:top-2 lg:right-10 lg:h-10 w-3/4 hidden lg:block">
            <div v-if="!state.authenticated" class="flex flex-row justify-between items-center h-full">
                <div class="flex flex-row items-center">
                    <div class="text-xl font-bold hover:text-gray-300 cursor-pointer">
                        <NuxtLink to="/">Home</NuxtLink>
                    </div>
                    <div class="text-xl font-bold ml-12 hover:text-gray-300 cursor-pointer">
                        <NuxtLink to="/articles">Blog</NuxtLink>
                    </div>
                    <div class="text-xl font-bold ml-12 hover:text-gray-300 cursor-pointer">
                        <NuxtLink to="/#about">About</NuxtLink>
                    </div>
                    <div class="text-xl font-bold ml-12 hover:text-gray-300 cursor-pointer">
                        <NuxtLink to="/#features">Features</NuxtLink>
                    </div>
                    <div class="text-xl font-bold ml-12 hover:text-gray-300 cursor-pointer">
                        <NuxtLink to="/#community">Community</NuxtLink>
                    </div>
                    <div v-if="isPlatformEnabled()">
                        <menu-dropdown>
                            <template #menuItem="{ onClick }">
                                <div @click="onClick" class="text-xl font-bold ml-12 hover:text-gray-300 cursor-pointer">
                                    Platform
                                </div>
                            </template>
                            <template #dropdownMenu="{ onClick }">
                                <div class="flex flex-col w-40 text-center">
                                    <NuxtLink to="/register">
                                        <div @click="onClick" class="text-xl font-bold text-black hover:bg-gray-200 cursor-pointer border-b-1 border-primary-blue-100 border-solid pt-1 pb-1">
                                            Register
                                        </div>
                                    </NuxtLink>
                                    <NuxtLink to="/login">
                                        <div @click="onClick" class="text-xl font-bold text-black hover:bg-gray-200 cursor-pointer pt-1 pb-1">
                                            Login
                                        </div>
                                    </NuxtLink>
                                </div>
                            </template>
                        </menu-dropdown>
                    </div>
                </div>
                <div class="flex flex-row mr-5">
                    <font-awesome icon="fab fa-github-square" class="ml-5 text-4xl hover:text-gray-300 cursor-pointer" @click="openGithub()"/>
                    <font-awesome icon="fab fa-linkedin" class="ml-5 text-4xl hover:text-gray-300 cursor-pointer" @click="openLinkedin()"/>
                </div>
            </div>
            <div v-else class="flex flex-row items-center h-full" :class="{'justify-between': isUserAdmin, 'justify-end': !isUserAdmin}">
                <div v-if="isUserAdmin" class="flex flex-row justify-start">
                    <div class="text-xl font-bold ml-12 hover:text-gray-300 cursor-pointer">
                        <NuxtLink to="/admin">Admin</NuxtLink>
                    </div>
                    <div class="text-xl font-bold ml-12 hover:text-gray-300 cursor-pointer">
                        <NuxtLink to="/projects">Projects</NuxtLink>
                    </div>
                </div>
                <menu-dropdown>
                    <template #menuItem="{ onClick }">
                        <div @click="onClick" class="flex flex-col justify-center items-center w-10 h-10 bg-gray-200 border border-primary-blue-100 border-solid p-1 rounded-full cursor-pointer hover:bg-gray-300 font-bold text-center text-black text-none">
                            M
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
            </div>
        </div>
       <navigation-drawer :drawer-open="state.drawerOpen" @close-drawer="closeDrawer" />
    </div>
</template>