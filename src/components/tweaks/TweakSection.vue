<template>
  <div class="twk-sect">{{ label }}</div>
  <slot />
</template>

<script setup>
defineProps({ label: String });
</script>
