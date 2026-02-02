<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps({
    images: {
        type: Array,
        required: true
    },
    interval: {
        type: Number,
        default: 4000
    }
});

const currentImageIndex = ref(0);
let timer = null;

const nextImage = () => {
    currentImageIndex.value = (currentImageIndex.value + 1) % props.images.length;
};

onMounted(() => {
    // Preload images
    props.images.forEach(img => {
        const image = new Image();
        image.src = img;
    });
    
    timer = setInterval(nextImage, props.interval);
});

onUnmounted(() => {
    if (timer) clearInterval(timer);
});
</script>

<template>
    <div class="relative w-full aspect-video bg-gray-900 rounded-xl shadow-2xl overflow-hidden border border-gray-700/50 group transform transition-all duration-500 hover:scale-[1.02]">
        <!-- Window Controls (Decoration) -->
        <div class="absolute top-0 left-0 w-full h-8 bg-gray-800/90 backdrop-blur flex items-center px-4 gap-2 z-10 border-b border-gray-700">
            <div class="w-3 h-3 rounded-full bg-[#FF5F56] shadow-sm"></div>
            <div class="w-3 h-3 rounded-full bg-[#FFBD2E] shadow-sm"></div>
            <div class="w-3 h-3 rounded-full bg-[#27C93F] shadow-sm"></div>
            <div class="ml-4 text-xs text-gray-400 font-mono hidden sm:block">dataresearchanalysis.com</div>
        </div>
        
        <!-- Images -->
        <div class="absolute inset-0 top-8 bg-gray-800">
            <transition-group name="fade">
                <div v-for="(img, index) in images" :key="img" v-show="index === currentImageIndex" class="absolute inset-0 w-full h-full">
                     <img 
                        :src="img" 
                        class="w-full h-full object-cover object-top" 
                        alt="Dashboard Preview"
                        :fetchpriority="index === 0 ? 'high' : 'low'"
                        :loading="index === 0 ? 'eager' : 'lazy'"
                     />
                </div>
            </transition-group>
        </div>
        
        <!-- Progress Indicators -->
        <div class="absolute bottom-4 left-0 w-full flex justify-center gap-2 z-20">
            <button 
                v-for="(_, index) in images" 
                :key="index"
                @click="currentImageIndex = index"
                class="w-2 h-2 rounded-full transition-all duration-300"
                :class="index === currentImageIndex ? 'bg-white w-6' : 'bg-white/40 hover:bg-white/60'"
            ></button>
        </div>
    </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 1s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
