<template>
  <div class="pat-row">
    <div>
      <div class="pat-id">{{ p.pattern_id }}</div>
      <div class="pat-meta">
        {{ p.pit_name }} · {{ p.pattern_type }} · RL {{ p.rl_level }} · {{ p.num_holes }} holes · Ø{{
          p.hole_diameter_mm
        }}mm
        <span v-if="p.pit_priority === 0" class="mono" style="margin-left: 8px; color: var(--ink-4)">·CARRYOVER</span>
      </div>
    </div>

    <div>
      <Pill :status="p.status">{{ p.status }}</Pill>
    </div>

    <div class="pat-bar-col">
      <Bar
        :pct="p.drilling_pct"
        :status="isDone ? 'complete' : p._risk"
        :marker="70"
      />
      <div class="pat-bar-meta">
        <span
          ><span class="num">{{ fnum(p.actual_drilling_m) }}</span
          ><span style="color: var(--ink-4)"> / {{ fnum(p.effective_m) }} m</span></span
        >
        <span><strong class="num">{{ Math.round(p.drilling_pct) }}%</strong></span>
      </div>
    </div>

    <div>
      <div class="pat-blast num">{{ fmtDate(reviewBlastDate) }}</div>
      <div
        class="pat-blast-rel"
        :style="overdue && p._risk === 'delayed' ? { color: 'var(--red)' } : undefined"
      >
        {{ relDay(reviewBlastDate) }}
      </div>
    </div>

    <div>
      <div class="num" style="font-size: 12px">
        {{ fnum(p.plan_blast_vol_bcm) }} <span style="color: var(--ink-3); font-size: 11px">bcm</span>
      </div>
      <div style="font-size: 11px; color: var(--ink-3)">{{ fnum(p.blast_area_m2) }} m²</div>
    </div>

    <button type="button" class="btn" data-variant="ghost" data-size="sm" @click.stop>
      <span class="ic" style="color: var(--ink-3)"><component :is="I.chevR" /></span>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { fmtDate, relDay, fnum, I } from '../format.js';
import Pill from '../Pill.vue';
import Bar from '../Bar.vue';

const TODAY = new Date();

const props = defineProps({
  p: { type: Object, required: true },
});

const reviewBlastDate = computed(() => props.p._review_blast_date || props.p.planned_blast_date || props.p.actual_blast_date);
const overdue = computed(() => {
  const date = new Date(reviewBlastDate.value);
  return !Number.isNaN(date.getTime()) && date < TODAY;
});
const isDone  = computed(() => {
  const s = String(props.p.status || '').toLowerCase();
  return s === 'complete' || s === 'blasting' || s === 'done';
});
</script>
