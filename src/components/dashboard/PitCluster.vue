<template>
  <div class="pit-cluster">
    <div v-for="d in data" :key="d.pit" class="pit-cluster-row">
      <div class="pit-cluster-name">{{ d.pit }}</div>
      <div>
        <div class="pit-stack" :style="{ width: `${(safePlan(d) / maxM) * 100}%` }">
          <span class="pit-stack-done" :style="{ width: `${donePct(d)}%` }" />
          <span
            class="pit-stack-prog"
            :style="{ width: `${drillingPct(d)}%` }"
          />
          <span class="pit-stack-pend" style="flex: 1" />
        </div>
        <div
          style="
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: var(--ink-3);
            margin-top: 4px;
          "
        >
          <span
            ><span class="num" style="color: var(--ink)">{{ Math.round((displayActual(d) / safePlan(d)) * 100) }}%</span>
            drilled · <span class="num">{{ d.count }}</span> patterns</span
          >
          <span class="num">{{ fnum(displayActual(d)) }} / {{ fnum(safePlan(d)) }} m</span>
        </div>
      </div>
    </div>
    <div class="legend" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--line)">
      <span class="legend-item"><span class="legend-swatch" style="background: var(--green)" />Complete</span>
      <span class="legend-item"><span class="legend-swatch" style="background: var(--accent)" />Drilling</span>
      <span class="legend-item"
        ><span class="legend-swatch" style="background: var(--ink-4); opacity: 0.3" />Pending</span
      >
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { fnum } from '../format.js';

const props = defineProps({
  data: { type: Array, required: true },
});

const maxM = computed(() => Math.max(1, ...props.data.map((d) => safePlan(d))));

function safePlan(row) {
  return Math.max(1, Number(row.plan_m || 0));
}

function displayActual(row) {
  return Math.max(0, Number(row.actual_m || 0), Number(row.complete_m || 0));
}

function donePct(row) {
  return Math.min(100, Math.max(0, (Number(row.complete_m || 0) / safePlan(row)) * 100));
}

function drillingPct(row) {
  const drilling = displayActual(row) - Number(row.complete_m || 0);
  return Math.min(100 - donePct(row), Math.max(0, (drilling / safePlan(row)) * 100));
}
</script>
