<template>
  <TweakRow :label="label">
    <select class="twk-field" :value="String(modelValue)" @change="$emit('update:modelValue', $event.target.value)">
      <option v-for="o in normalized" :key="o.v" :value="String(o.v)">{{ o.l }}</option>
    </select>
  </TweakRow>
</template>

<script setup>
import { computed } from 'vue';
import TweakRow from './TweakRow.vue';

const props = defineProps({
  label: String,
  modelValue: [String, Number, Boolean],
  options: { type: Array, default: () => [] },
});
defineEmits(['update:modelValue']);

const normalized = computed(() =>
  props.options.map((o) => (typeof o === 'object' ? { v: o.value, l: o.label } : { v: o, l: o })),
);
</script>
