<script setup lang="ts">
const router = useRouter();

interface State {
    dropdownOpen: boolean
}
const state = reactive<State>({
    dropdownOpen: false,
})

interface Props {
    direction?: string
    offsetY?: string
}
const props = withDefaults(defineProps<Props>(), {
    direction: 'left',
    offsetY: '8',
})

const isDirectionLeft = computed(() => {
    return props.direction === 'left' ? true : false;
})
function toggleDropdown(): void {
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