<template>
  <div class="filter-sel">
    <span class="filter-sel-key">{{ k }}</span>
    <select :value="value" @change="$emit('change', $event.target.value)">
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
    <svg class="ic" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  </div>
</template>

<script setup>
defineProps({
  k: String,
  value: String,
  options: { type: Array, default: () => [] },
});
defineEmits(['change']);
</script>
