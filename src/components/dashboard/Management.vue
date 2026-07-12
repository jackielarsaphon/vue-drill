<template>
  <div>
    <div class="grid-4" style="margin-bottom: 12px">
      <KPI label="Drilling progress" :val="Math.round(k.progress_pct)" unit="%">
        <template #trend>
          <span class="num">{{ fnum(k.actual_m) }}</span> /
          <span class="num">{{ fnum(k.plan_m) }}</span> m
        </template>
      </KPI>
      <KPI
        label="Blasts completed"
        :val="`${k.blasts_done}/${k.blasts_planned}`"
        :trend="`${k.blasts_planned - k.blasts_done} pending this week`"
      />
      <KPI label="Blast volume" :val="fnum(k.blast_vol / 1000, 1)" unit="k bcm">
        <template #trend>
          of <span class="num">{{ fnum(k.plan_vol / 1000, 1) }}</span>k bcm planned
        </template>
      </KPI>
      <KPI label="Patterns at risk" :val="k.delayed + k.atRisk" :accent="k.delayed > 0 ? 'red' : 'amber'">
        <template #trend>
          <span style="color: var(--red)">{{ k.delayed }} delayed</span> ·
          <span style="color: var(--amber)">{{ k.atRisk }} at risk</span>
        </template>
      </KPI>
    </div>

    <div class="grid-2" style="margin-bottom: 12px">
      <Card title="Cumulative drilling — actual vs plan" :sub="`Week ${week.week_id} · all pits`">
        <template #action>
          <div class="legend">
            <span class="legend-item"><span class="legend-swatch" />Actual</span>
            <span class="legend-item"><span class="legend-swatch dashed" />Plan</span>
          </div>
        </template>
        <CumulativeChart :data="cumul" />
      </Card>
      <Card title="Metres by bit size" sub="Net drilling, current week">
        <BitSizeDonut :data="bits" />
      </Card>
    </div>

    <div class="grid-2" style="margin-bottom: 12px">
      <Card title="Completion by pit" sub="Stacked: complete / drilling / pending — metres">
        <PitCluster :data="pitProg" />
      </Card>
      <Card title="Patterns by pit" sub="Delayed / at-risk / on-track · grouped">
        <HighRiskGroups :data="risk" />
      </Card>
    </div>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue';
import { fnum } from '../format.js';
import KPI from '../KPI.vue';
import Card from '../Card.vue';
import CumulativeChart from './CumulativeChart.vue';
import BitSizeDonut from './BitSizeDonut.vue';
import PitCluster from './PitCluster.vue';
import HighRiskGroups from './HighRiskGroups.vue';
import { useDashboardStore } from '../../stores/Dashboard.stores.ts';
import { usePatternsStore } from '../../stores/Patterns.stores.ts';
import { useDrillLogStore } from '../../stores/DrillLog.stores.ts';

const props = defineProps({
  week: { type: Object, required: true },
});

const store = useDashboardStore();
const patternsStore = usePatternsStore();
const drillLogStore = useDrillLogStore();

watch(() => props.week?.week_id, (id) => {
  if (id != null) {
    store.loadByWeek(Number(id), props.week);
    patternsStore.loadByWeek(Number(id));
    if (drillLogStore.loadedWeekId !== id) drillLogStore.loadByWeek(Number(id));
  }
}, { immediate: true });

const k = computed(() => {
  const d = store.kpisData;
  return {
    progress_pct: d.plan_m > 0 ? (d.actual_m / d.plan_m) * 100 : 0,
    blasts_done:    d.blasts_done,
    blasts_planned: d.blasts_planned,
    blast_vol: d.blast_vol,
    plan_vol:  d.plan_vol,
    delayed:   d.delayed,
    atRisk:    d.atRisk,
    plan_m:    d.plan_m,
    actual_m:  d.actual_m,
  };
});

const cumul   = computed(() => store.cumulData);
const bits    = computed(() => store.bitSizeData);
const pitProg = computed(() => store.pitProgressData);

// ── Risk grouping — same logic as PlanReviewPage ──────────────────────────────

function validDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return !Number.isNaN(d.getTime()) && d.getFullYear() > 1970 ? d : null;
}

function reviewBlastDate(p) {
  return validDate(p?.planned_blast_date) || validDate(p?.actual_blast_date);
}

function drilledM(p) {
  return +drillLogStore.drillLog
    .filter(e => e.pattern_id === p.pattern_id && Number(e.week_id) === Number(p.week_id))
    .reduce((s, e) => s + Number(e.total_drilling_m || 0) + Number(e.redrill_m || 0), 0)
    .toFixed(1);
}

function riskFor(p) {
  const s = String(p.status || '').toLowerCase();
  if (s === 'complete' || s === 'blasting' || s === 'done') return 'on-track';
  if (p.blast_td_updated) return 'on-track';
  const blastDate = reviewBlastDate(p);
  if (!blastDate || isNaN(blastDate.getTime())) return 'no-date';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const daysToBlast = Math.round((blastDate.getTime() - today.getTime()) / 86400000);
  if (daysToBlast < 0) return 'delayed';
  if (daysToBlast <= 2) return 'at-risk';
  return 'on-track';
}

const risk = computed(() => {
  const ORDER = { delayed: 0, 'at-risk': 1, 'on-track': 2, 'no-date': 3 };
  const weekId = Number(props.week?.week_id);
  const groups = {};
  const weekPatterns = patternsStore.patterns.filter(p => Number(p.week_id) === weekId);
  for (const p of weekPatterns) {
    if (!groups[p.pit_name]) groups[p.pit_name] = [];
    const plan = Number(p.effective_m || 0);
    const drilled = drilledM(p);
    const drilling_pct = plan > 0 ? +Math.min(100, (drilled / plan) * 100).toFixed(1) : 0;
    groups[p.pit_name].push({ ...p, _risk: riskFor(p), drilling_pct });
  }
  return Object.entries(groups)
    .map(([pit, list]) => ({
      pit,
      list: list.sort(
        (a, b) => ORDER[a._risk] - ORDER[b._risk] || String(a.pattern_id).localeCompare(String(b.pattern_id)),
      ),
    }))
    .sort((a, b) => b.list.length - a.list.length);
});
</script>
