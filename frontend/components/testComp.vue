<script setup>
const name = ref("John Doe");
const state = reactive({
    name: "ABC"
})
const props = defineProps({
    name1: {
        type: String,
        default: "Joe Does",
    },
});
defineExpose({
    state,
});
</script>
<template>
    <div>
        <div class="bg-white w-full h-full">
            {{ name }}<br />
            {{ state.name }}<br />
            {{ props.name1 }}<br />
            <div class="flex flex-col h-full p-10 mt-10 mb-10">
                <div class="text-2xl font-bold text-black text-center">
                    Data Research Analysis is being developed as an open source project and all you have to do is to 
                    plugin your data into the platform and quickly and very easily build insightful visualizations and 
                    dashboards along with state of the art analysis.
                </div>
            </div> 
        </div>
    </div>
</template>