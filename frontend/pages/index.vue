<script setup>
import { onMounted } from "vue";

onMounted(() => {

})
</script>
<template>
    <div>
        <hero />
        <div class="h-[350px] flex flex-row justify-center">
            <div class="text-4xl font-bold text-black mt-30 pl-20 pr-20">
                Data Research Analysis is being developed as an open source project and all you have to do is to 
                plugin your data into the platform and quickly and very easily build insightful visualizations and 
                dashboards along with state of the art analysis.
            </div>
        </div>
        <features />
        <timeline />
        <community />
        <signup-form />
    </div>
</template>