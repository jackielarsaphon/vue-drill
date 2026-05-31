<template>
  <div :class="inline ? 'twk-row twk-row-h' : 'twk-row'">
    <div class="twk-lbl">
      <span>{{ label }}</span>
      <span v-if="value != null" class="twk-val">{{ value }}</span>
    </div>
    <slot />
  </div>
</template>

<script setup>
defineProps({
  label: String,
  value: [String, Number],
  inline: Boolean,
});
</script>
