<template>
  <div class="twk-row twk-row-h">
    <div class="twk-lbl"><span>{{ label }}</span></div>
    <button
      type="button"
      class="twk-toggle"
      :data-on="modelValue ? '1' : '0'"
      role="switch"
      :aria-checked="!!modelValue"
      @click="$emit('update:modelValue', !modelValue)"
    >
      <i />
    </button>
  </div>
</template>

<script setup>
defineProps({
  label: String,
  modelValue: Boolean,
});
defineEmits(['update:modelValue']);
</script>
