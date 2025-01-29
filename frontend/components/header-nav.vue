<script setup>
import { onMounted } from "vue";
const { openGithub, openLinkedin } = Utils();
onMounted(() => {

})
</script>
<template>
    <div class="relative bg-primary-blue-100 text-white h-[87px] shadow-lg">
        <img src="/logo.svg" class="absolute top-0 m-[-10px] h-[137px] z-10" />
        <div class="absolute top-0 left-[40px] bg-black h-[117px] w-1/5"></div>
        <div class="absolute top-0 right-[20px] h-[87px] w-3/5">
            <div class="flex flex-row justify-between items-center h-full">
                <div class="flex flex-row items-center">
                    <div class="text-xl font-bold hover:text-gray-300 cursor-pointer">Home</div>
                    <div class="text-xl font-bold ml-12 hover:text-gray-300 cursor-pointer">About</div>
                    <div class="text-xl font-bold ml-12 hover:text-gray-300 cursor-pointer">Features</div>
                    <div class="text-xl font-bold ml-12 hover:text-gray-300 cursor-pointer">Timeline</div>
                    <div class="text-xl font-bold ml-12 hover:text-gray-300 cursor-pointer">Community</div>
                </div>
                <div class="flex flex-row mr-5">
                    <font-awesome icon="fab fa-github-square" class="ml-5 text-4xl hover:text-gray-300 cursor-pointer" @click="openGithub()"/>
                    <font-awesome icon="fab fa-linkedin" class="ml-5 text-4xl hover:text-gray-300 cursor-pointer" @click="openLinkedin()"/>
                </div>
            </div>
        </div>
       
    </div>
</template>