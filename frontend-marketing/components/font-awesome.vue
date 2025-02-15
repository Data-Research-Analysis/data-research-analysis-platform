<script setup>
const props = defineProps({
  icon: {
    type: [String, Array],
    required: true,
  },
  class: {
    type: String,
    required: false,
    default: "",
  },
  title: {
    type: String,
    required: false,
    default: "",
  },
  // eslint-disable-next-line vue/require-default-prop
  onClick: {
    type: Function,
    required: false,
  },
});
</script>
<template>
  <client-only>
    <font-awesome-icon
      :icon="props.icon"
      :class="props.class"
      :title="props.title"
      @click="props.onClick"
    />
  </client-only>
</template>
