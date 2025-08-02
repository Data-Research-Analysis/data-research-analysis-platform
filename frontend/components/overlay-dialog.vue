<script setup>
const overlayRef = useTemplateRef('overlayRef');
const state = reactive({
    top: '200px',
});
const props = defineProps({
    enableScrolling: {
        type: Boolean,
        required: false,
        default: true,
    },
});
const emit = defineEmits(['close']);
function close() {
    emit('close');
}
onMounted(() => {
    state.top = `${window.scrollY + 200}px`;
    if (props.enableScrolling) {
        //keep the overlay in the same position when the user scrolls
        document.addEventListener("scroll", () => {
            state.top = `${window.scrollY + 200}px`;
        })
    }
});
</script>
<template>
    <div class="fixed top-0 left-0 bg-black h-lvh w-full opacity-50 z-10"></div>
    <div class="h-max w-max bg-white absolute left-1/4 md:left-1/8 lg:left-1/4 opacity-100 z-15 p-10 shadow-lg"
        :style="`top: ${state.top};`"
    >
        <div class="flex flex-row justify-end items-center -mt-5 mb-5">
            <font-awesome icon="fas fa-times" class="text-2xl hover:text-gray-500 cursor-pointer" @click="close"/>
        </div>
        <slot name="overlay"></slot>
    </div>
</template>