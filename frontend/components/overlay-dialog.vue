<script setup>
const emit = defineEmits(['close']);
function close() {
    emit('close');
}
</script>
<template>
    <div class="fixed top-0 left-0 bg-black h-lvh w-full opacity-50 z-10"></div>
    <div class="h-max w-max bg-white absolute top-1/5 left-1/4 md:left-1/8 lg:left-1/4 opacity-100 z-15 p-10 shadow-lg">
        <div class="flex flex-row justify-end items-center -mt-5 mb-5">
            <font-awesome icon="fas fa-times" class="text-2xl hover:text-gray-500 cursor-pointer" @click="close"/>
        </div>
        <slot name="overlay"></slot>
    </div>
</template>