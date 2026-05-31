<template>
  <span class="pill" :data-status="status" style="justify-content: flex-start; padding: 0 7px">
    <slot>{{ status }}</slot>
  </span>
</template>

<script setup>
defineProps({ status: String });
</script>
