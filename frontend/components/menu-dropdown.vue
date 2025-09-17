<script setup>
const router = useRouter();
const state = reactive({
    dropdownOpen: false,
})
const props = defineProps({
    direction: {
        type: String,
        default: 'left'
    },
    offsetY: {
        type: String,
        default: "8"
    },
})
const isDirectionLeft = computed(() => {
    return props.direction === 'left' ? true : false;
})
function toggleDropdown() {
    state.dropdownOpen = !state.dropdownOpen;
}
const defaultClasses = computed(() => {
    return `absolute top-${props.offsetY} bg-white border border-gray-300 rounded shadow-lg z-20`;
});
</script>
<template>
    <div class="relative select-none">
        <slot name="menuItem" :onClick="toggleDropdown"></slot>
        <div
            :class="{
                [defaultClasses]: true,
                'opacity-0': !state.dropdownOpen,
                'opacity-100': state.dropdownOpen,
                'left-5': !isDirectionLeft,
                'right-5': isDirectionLeft,
            }"
        >
            <slot v-if="state.dropdownOpen" name="dropdownMenu" :onClick="toggleDropdown"></slot>
        </div>
    </div>
</template>