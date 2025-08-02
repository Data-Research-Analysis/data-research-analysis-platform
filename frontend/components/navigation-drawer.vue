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
                <img src="/logo-words.svg" class="absolute top-0 -left-1 h-18 lg:h-22 bg-black p-2 pl-5 pr-[130px] logo-fancy"/>     
                <font-awesome icon="fas fa-times" class="absolute top-18 right-2 text-4xl hover:text-gray-300 cursor-pointer" @click="closeDrawer" />
            </div>
            <div class="flex flex-col mt-20 ml-2">
                <div class="text-xl font-bold hover:text-gray-300 cursor-pointer" @click="closeDrawer">
                    <NuxtLink to="/">Home</NuxtLink>
                </div>
                <div class="text-xl font-bold mt-2 hover:text-gray-300 cursor-pointer" @click="closeDrawer">
                    <NuxtLink to="/articles">Blog</NuxtLink>
                </div>
                <div v-if="isPlatformEnabled()">
                    <menu-dropdown>
                        <template #menuItem="{ onClick }">
                            <div @click="onClick" class="text-xl font-bold mt-2 cursor-pointer hover:text-gray-300 cursor-pointer">
                                Platform
                            </div>
                        </template>
                        <template #dropdownMenu="{ onClick }">
                            <div class="flex flex-col w-40 text-center">
                                <div @click="onClick" class="text-xl font-bold text-black hover:bg-gray-200 cursor-pointer border-b-1 border-primary-blue-100 border-solid pt-1 pb-1">
                                    <NuxtLink to="/register" @click="closeDrawer">Register</NuxtLink>
                                </div>
                                <div @click="onClick" class="text-xl font-bold text-black hover:bg-gray-200 cursor-pointer pt-1 pb-1">
                                    <NuxtLink to="/login" @click="closeDrawer">Login</NuxtLink>
                                </div>
                            </div>
                        </template>
                    </menu-dropdown>
                </div>
                <div class="w-3/4 h-1 bg-white m-auto mt-5"></div>
                <div class="flex flex-row mt-5">
                    <font-awesome icon="fab fa-github-square" class="text-4xl hover:text-gray-300 cursor-pointer" @click="openGithub();closeDrawer();"/>
                    <font-awesome icon="fab fa-linkedin" class="ml-5 text-4xl hover:text-gray-300 cursor-pointer" @click="openLinkedin();closeDrawer();"/>
                </div>
                <div class="flex flex-row mr-5 mt-5">
                    <combo-button label="Join Our Wait List" color="white" class="w-full h-10 mr-2 shadow-lg cursor-pointer" @click="gotoJoinWaitList();closeDrawer();"/>
                </div>
            </div>
        </div>
    </div>
</template>