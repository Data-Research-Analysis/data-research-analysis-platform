<script setup>
import { onMounted, reactive } from "vue";
const router = useRouter();
const state = reactive({
    dropdownOpen: false,
})
function toggleDropdown() {
    state.dropdownOpen = !state.dropdownOpen;
}
</script>
<template>
    <div class="relative">
        <slot name="menuItem" :onClick="toggleDropdown"></slot>
        <div
            class="absolute top-8 left-5 bg-white border border-primary-blue-100 border-solid shadow-md transition-all duration-500"
            :class="{
                'opacity-0': !state.dropdownOpen,
                'opacity-100': state.dropdownOpen
            }"
        >
            <slot name="dropdownMenu" :onClick="toggleDropdown"></slot>
        </div>
    </div>
</template>