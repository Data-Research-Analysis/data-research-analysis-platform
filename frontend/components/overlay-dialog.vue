<script setup lang="ts">
const overlayRef = useTemplateRef('overlayRef');

interface State {
    top: string
}
const state = reactive<State>({
    top: '200px',
});

interface Props {
    enableScrolling?: boolean
    yOffset?: number
}
const props = withDefaults(defineProps<Props>(), {
    enableScrolling: true,
    yOffset: 200,
});
const emit = defineEmits<{ close: [] }>();

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
            // Fixed positioning: center in viewport
            state.top = '50%';
        } else {
            // Absolute positioning: center in current viewport position
            // Account for -translate-y-1/2 by using viewport center
            state.top = `${window.scrollY + window.innerHeight / 2}px`;
        }
    }
});
</script>
<template>
    <!-- Backdrop -->
    <div class="fixed top-0 left-0 bg-black h-lvh w-full opacity-50 z-[1100]"></div>
    
    <!-- Dialog Container -->
    <div 
        :class="[positioningClass, 'left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xs sm:max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-4 bg-white opacity-100 z-[1200] shadow-lg max-h-[80vh] rounded-lg overflow-hidden']"
        :style="{ top: state.top }"
    >
        <!-- Close button -->
        <div class="flex flex-row justify-end items-center pt-5 pr-5">
            <button 
                class="text-2xl text-gray-400 hover:text-gray-600 cursor-pointer bg-transparent border-none p-0 leading-none"
                @click="close"
                aria-label="Close dialog"
            >
                <font-awesome icon="fas fa-times" />
            </button>
        </div>
        
        <!-- Content slot -->
        <div class="px-10 pb-10 overflow-y-auto max-h-[calc(80vh-60px)]">
            <slot name="overlay"></slot>
        </div>
    </div>
</template>