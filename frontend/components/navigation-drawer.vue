<script setup>
const emits = defineEmits(["closeDrawer"]);
const props = defineProps({
    drawerOpen: Boolean,
})
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
                <img src="/logo.svg" class="absolute -top-1 -left-1 h-18 lg:h-20 z-10" />      
                <font-awesome icon="fas fa-times" class="absolute top-18 right-2 text-4xl hover:text-gray-300 cursor-pointer" @click="closeDrawer" />
            </div>
            <div class="flex flex-col mt-20 ml-2">
                <div class="text-xl font-bold hover:text-gray-300 cursor-pointer">
                    <NuxtLink to="/">Home</NuxtLink>
                </div>
                <div class="text-xl font-bold mt-2 hover:text-gray-300 cursor-pointer">
                    <NuxtLink to="/#about">About</NuxtLink>
                </div>
                <div class="text-xl font-bold mt-2 hover:text-gray-300 cursor-pointer">
                    <NuxtLink to="/#features">Features</NuxtLink>
                </div>
                <div class="text-xl font-bold mt-2 hover:text-gray-300 cursor-pointer">
                    <NuxtLink to="/#community">Community</NuxtLink>
                </div>
                <div>
                    <menu-dropdown>
                        <template #menuItem="{ onClick }">
                            <div @click="onClick" class="text-xl font-bold mt-2 cursor-pointer hover:text-gray-300 cursor-pointer">
                                Cloud Access
                            </div>
                        </template>
                        <template #dropdownMenu="{ onClick }">
                            <div class="flex flex-col w-40 text-center">
                                <div @click="onClick" class="text-xl font-bold text-black hover:bg-gray-200 cursor-pointer border-b-1 border-primary-blue-100 border-solid pt-1 pb-1">
                                    <NuxtLink to="/register">Register</NuxtLink>
                                </div>
                                <div @click="onClick" class="text-xl font-bold text-black hover:bg-gray-200 cursor-pointer pt-1 pb-1">
                                    <NuxtLink to="/login">Login</NuxtLink>
                                </div>
                            </div>
                        </template>
                    </menu-dropdown>
                </div>
                <div class="w-3/4 h-1 bg-white m-auto mt-5"></div>
                <div class="flex flex-row mt-5">
                    <font-awesome icon="fab fa-github-square" class="text-4xl hover:text-gray-300 cursor-pointer" @click="openGithub()"/>
                    <font-awesome icon="fab fa-linkedin" class="ml-5 text-4xl hover:text-gray-300 cursor-pointer" @click="openLinkedin()"/>
                </div>
            </div>
        </div>
    </div>
</template>