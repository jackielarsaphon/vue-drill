<template>
  <div class="field">
    <label>{{ label }}</label>
    <slot />
    <div v-if="error" class="field-err">{{ error }}</div>
    <div v-else-if="hint" class="field-hint">{{ hint }}</div>
  </div>
</template>

<script setup>
defineProps({
  label: String,
  hint: String,
  error: String,
});
</script>
