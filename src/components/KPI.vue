<template>
  <div class="kpi">
    <div class="kpi-label">{{ label }}</div>
    <div class="kpi-val" :style="accent ? { color: `var(--${accent})` } : undefined">
      <span class="tnum">{{ val }}</span>
      <span v-if="unit" class="kpi-unit">{{ unit }}</span>
    </div>
    <div v-if="$slots.trend" class="kpi-trend" :data-dir="trendDir">
      <slot name="trend" />
    </div>
    <div v-else-if="trend != null && trend !== ''" class="kpi-trend" :data-dir="trendDir">{{ trend }}</div>
  </div>
</template>

<script setup>
defineProps({
  label: String,
  val: [String, Number],
  unit: String,
  trend: [String, Number],
  trendDir: String,
  danger: Boolean,
  accent: String,
});
</script>
