<script setup>
import { NuxtLink } from "#components";
import { onMounted, reactive } from "vue";
import fontawesome from "~/plugins/fontawesome";
const { openGithub, openLinkedin } = Utils();

const state = reactive({
    drawerOpen: false
})

function openDrawer() {
 state.drawerOpen = true;
}
function closeDrawer() {
 state.drawerOpen = false;
}
onMounted(() => {})
</script>
<template>
    <div class="relative bg-primary-blue-100 text-white h-10 lg:h-15 shadow-lg" id="top">
        <img src="/logo.svg" class="absolute top-0 -left-1 h-18 lg:h-20 z-10" />      
        <div class="absolute top-[5px] right-5 w-3/5 flex flex-row justify-end flex lg:hidden">
            <font-awesome icon="fas fa-bars" class="text-2xl cursor-pointer hover:text-gray-300" @click="openDrawer" />
        </div>
        <div class="absolute lg:top-2 lg:right-10 lg:h-10 w-3/5 hidden lg:block">
            <div class="flex flex-row justify-between items-center h-full">
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
                    <div class="text-xl font-bold ml-12 hover:text-gray-300 cursor-pointer">
                        <NuxtLink to="/privacy-policy">Privacy Policy</NuxtLink>
                    </div>
                    <div class="text-xl font-bold ml-12 hover:text-gray-300 cursor-pointer">
                        <NuxtLink to="/terms-conditions">Terms</NuxtLink>
                    </div>
                </div>
                <div class="flex flex-row mr-5">
                    <font-awesome icon="fab fa-github-square" class="ml-5 text-4xl hover:text-gray-300 cursor-pointer" @click="openGithub()"/>
                    <font-awesome icon="fab fa-linkedin" class="ml-5 text-4xl hover:text-gray-300 cursor-pointer" @click="openLinkedin()"/>
                </div>
            </div>
        </div>
       <navigation-drawer :drawer-open="state.drawerOpen" @close-drawer="closeDrawer" />
    </div>
</template>