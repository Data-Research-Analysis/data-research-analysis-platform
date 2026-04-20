<script setup lang="ts">
interface Props {
    color?: string
    label: string
    class?: string
    onClick: () => void
    icon?: string
    iconDirection?: string
    disabled?: boolean
}
const props = withDefaults(defineProps<Props>(), {
    color: 'primary',
    class: '',
    icon: '',
    iconDirection: 'left',
});

const classes = computed(() => {
  if (props.color.toLowerCase() === "primary") {
  return `bg-primary-blue-100 hover:bg-primary-blue-300 text-white ${props.class}`;
  } else if (props.color.toLowerCase() === "success") {
    return `bg-green-500 hover:bg-green-700 text-white ${props.class}`;
  } else if (props.color.toLowerCase() === "danger") {
    return `bg-red-500 hover:bg-red-700 text-white ${props.class}`;
  } else if (props.color.toLowerCase() === "warning") {
    return `bg-orange-500 hover:bg-orange-700 text-white ${props.class}`;
  } else if (props.color.toLowerCase() === "info") {
    return `bg-sky-500 hover:bg-sky-700 text-white ${props.class}`;
  } else if (props.color.toLowerCase() === "green-blue") {
    return `bg-green-blue-100 hover:bg-green-blue-300 text-white ${props.class}`;
  } else if (props.color.toLowerCase() === "white") {
    return `bg-white hover:bg-gray-200 text-primary-blue-200 ${props.class}`;
  } else {
    return `bg-blue-500 hover:bg-blue-700 text-white ${props.class}`;
  }
});
</script>
<template>
  <button
    :class="`${classes} rounded-md font-bold px-2`"
    :disabled="props.disabled"
    @click="props.onClick"
  >
    <font-awesome v-if="icon !== '' && iconDirection === 'left'" :icon="icon" />
    {{ props.label }}
    <font-awesome
      v-if="icon !== '' && iconDirection === 'right'"
      :icon="icon"
    />
  </button>
</template>
