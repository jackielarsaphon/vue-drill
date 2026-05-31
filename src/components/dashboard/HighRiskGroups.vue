<template>
  <div style="display: flex; flex-direction: column; gap: 14px">
    <div v-for="g in data" :key="g.pit">
      <div style="display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px">
        <span class="mono" style="font-size: 12px; color: var(--ink)">{{ g.pit }}</span>
        <span style="font-size: 11px; color: var(--ink-3)"
          >· {{ g.list.length }} pattern{{ g.list.length !== 1 ? 's' : '' }}</span
        >
      </div>
      <div class="chips">
        <span v-for="p in g.list" :key="p.pattern_id" class="chip" :data-status="p._risk">
          {{ shortId(p.pattern_id) }} · {{ Math.round(p.drilling_pct) }}%
        </span>
      </div>
    </div>
    <div
      v-if="data.length === 0"
      style="color: var(--ink-4); font-size: 12px; padding: 20px; text-align: center; display: flex; align-items: center; justify-content: center; gap: 6px"
    >
      <component :is="I.target" />
      No patterns.
    </div>
  </div>
</template>

<script setup>
import { I } from '../format.js';
defineProps({
  data: { type: Array, required: true },
});

function shortId(patternId) {
  const parts = String(patternId || '').split('_');
  return parts.length >= 2 ? parts.slice(-2).join('_') : patternId;
}
</script>
