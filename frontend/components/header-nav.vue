<script setup>
const route = useRoute();
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
                                    Products
                                </div>
                            </template>
                            <template #dropdownMenu="{ onClick }">
                                <div class="flex flex-col w-40 text-center">
                                    <div @click="onClick" class="text-xl font-bold text-black hover:bg-gray-200 cursor-pointer border-b-1 border-primary-blue-100 border-solid pt-1 pb-1">
                                        <NuxtLink to="/register">Platform Register</NuxtLink>
                                    </div>
                                    <div @click="onClick" class="text-xl font-bold text-black hover:bg-gray-200 cursor-pointer pt-1 pb-1">
                                        <NuxtLink to="/login">Platform Login</NuxtLink>
                                    </div>
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
            <div v-else class="flex flex-row justify-between items-center h-full">
                <div class="flex flex-row items-start justify-between">
                    <div class="text-xl font-bold hover:text-gray-300 cursor-pointer">
                        <NuxtLink to="/">Projects</NuxtLink>
                    </div>
                    <div class="text-xl font-bold hover:text-gray-300 cursor-pointer ml-8">
                        <NuxtLink to="/">Build Visualizations</NuxtLink>
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
                            <div @click="onClick" class="text-xl font-bold text-black hover:bg-gray-200 cursor-pointer pt-1 pb-1">
                                <NuxtLink to="/logout">Logout</NuxtLink>
                            </div>
                        </div>
                    </template>
                </menu-dropdown>
            </div>
        </div>
       <navigation-drawer :drawer-open="state.drawerOpen" @close-drawer="closeDrawer" />
    </div>
</template>