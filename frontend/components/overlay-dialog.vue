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
    yOffset: {
        type: Number,
        required: false,
        default: 200,
    },
});
const emit = defineEmits(['close']);

// Determine positioning class based on enableScrolling
// true -> fixed (stays in place relative to viewport)
// false -> absolute (scrolls with page relative to document)
const positioningClass = computed(() => {
    return props.enableScrolling ? 'fixed' : 'absolute';
});

function close() {
    emit('close');
}

onMounted(() => {
    // Only access window/document on client side for SSR compatibility
    if (import.meta.client) {
        if (props.enableScrolling) {
            // Fixed positioning: just use the offset
            state.top = `${props.yOffset}px`;
        } else {
            // Absolute positioning: set initial top to current scroll + offset
            // The dialog will "stick" to this document position and scroll with the page
            state.top = `${window.scrollY + props.yOffset}px`;
        }
    }
});
</script>
<template>
    <!-- Backdrop -->
    <div class="fixed top-0 left-0 bg-black h-lvh w-full opacity-50 z-10"></div>
    
    <!-- Dialog Container -->
    <div 
        :class="[positioningClass, 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xs sm:max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-4 bg-white opacity-100 z-15 p-10 shadow-lg max-h-[80vh] overflow-y-auto rounded-lg']"
    >
        <!-- Close button -->
        <div class="flex flex-row justify-end items-center -mt-5 mb-5">
            <font-awesome icon="fas fa-times" class="text-2xl hover:text-gray-500 cursor-pointer" @click="close"/>
        </div>
        
        <!-- Content slot -->
        <slot name="overlay"></slot>
    </div>
</template>