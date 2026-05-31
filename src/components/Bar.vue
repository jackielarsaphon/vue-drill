<template>
  <div class="bar" :data-status="status">
    <div class="bar-fill" :style="{ width: `${clamped}%` }" />
    <div
      v-if="marker != null"
      class="bar-mark"
      :style="{ left: `${Math.max(0, Math.min(100, marker))}%` }"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  pct: Number,
  status: String,
  marker: Number,
});

const clamped = computed(() => Math.max(0, Math.min(100, props.pct ?? 0)));
</script>
