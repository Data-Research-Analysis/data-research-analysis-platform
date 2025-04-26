<script setup>
const router = useRouter();
const state = reactive({
    dropdownOpen: false,
})
const props = defineProps({
    direction: {
        type: String,
        default: 'left'
    }
})
const isDirectionLeft = computed(() => {
    return props.direction === 'left' ? true : false;
})
function toggleDropdown() {
    state.dropdownOpen = !state.dropdownOpen;
}
</script>
<template>
    <div class="relative select-none">
        <slot name="menuItem" :onClick="toggleDropdown"></slot>
        <div
            class="absolute top-8 bg-white border border-primary-blue-100 border-solid shadow-md transition-all duration-500"
            :class="{
                'opacity-0': !state.dropdownOpen,
                'opacity-100': state.dropdownOpen,
                'left-5': !isDirectionLeft,
                'right-5': isDirectionLeft,
            }"
        >
            <slot name="dropdownMenu" :onClick="toggleDropdown"></slot>
        </div>
    </div>
</template>