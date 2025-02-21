<script setup>
import { onMounted } from "vue";

onMounted(() => {

})
</script>
<template>
    <div>
        <img src="/blue-background-top.svg" class="w-full" />
        <div class="bg-primary-blue-100 w-full h-[200px] text-white text-xl font-bold">
            <div class="flex flex-col justify-between h-full p-5">
                <div class="flex flex-row">
                    <div class="w-1/2">
                        Data Reasearch Analysis
                    </div>
                    <div class="w-1/2 flex flex-row justify-end">
                        <div class="w-1/2 flex flex-col">
                            <span>Important Links</span>
                            <span class="text-base mt-2 mb-2">
                                <NuxtLink to="/privacy-policy">Privacy Policy</NuxtLink>
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
    </div>
</template>