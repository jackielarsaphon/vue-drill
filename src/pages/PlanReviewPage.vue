<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">Plan Review</h1>
        <p class="page-sub">Read-only view of the week's blast plan. Risk-first ordering — delayed top.</p>
      </div>
      <div style="display: flex; gap: 8px">
        <button type="button" class="btn"><span class="ic"><component :is="I.download" /></span>Export CSV</button>
      </div>
    </div>

    <div class="grid-4" style="margin-bottom: 8px">
      <KPI label="Patterns this week" :val="counts.total" trend="3 carryovers from W19" />
      <KPI label="Delayed" :val="counts.delayed" accent="red" trend="blast date passed" />
      <KPI label="At risk" :val="counts.atRisk" accent="amber" trend="blast date ≤ 2 days" />
      <KPI label="On track" :val="counts.onTrack" accent="green" trend="meeting drilling pace" />
    </div>

    <div class="filters">
      <span class="ic" style="color: var(--ink-3)"><component :is="I.filter" /></span>
      <FilterSelect k="Risk" :value="filterRisk" :options="riskOpts" @change="filterRisk = $event" />
      <FilterSelect k="Pit" :value="filterPit" :options="pitOptions" @change="filterPit = $event" />
      <FilterSelect k="Status" :value="filterStatus" :options="statusOpts" @change="filterStatus = $event" />
      <div style="margin-left: auto; font-size: 11px; color: var(--ink-3)">
        Showing
        <strong class="mono" style="color: var(--ink)">{{ filtered.length }}</strong>
        of {{ reviewPatterns.length }}
      </div>
    </div>

    <RiskSection status="delayed" :list="grouped.delayed" :default-open="true" />
    <div style="height: 12px" />
    <RiskSection status="at-risk" :list="grouped['at-risk']" :default-open="true" />
    <div style="height: 12px" />
    <RiskSection status="on-track" :list="grouped['on-track']" :default-open="true" />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { usePatternsStore } from '../stores/Patterns.stores.ts';
import { useDrillLogStore } from '../stores/DrillLog.stores.ts';
import { I } from '../components/format.js';
import KPI from '../components/KPI.vue';
import FilterSelect from '../components/plan-review/FilterSelect.vue';
import RiskSection from '../components/plan-review/RiskSection.vue';

const filterRisk = ref('all');
const filterPit = ref('all');
const filterStatus = ref('all');

const props = defineProps({
  week: { type: Object, required: true },
});

const patternsStore = usePatternsStore();
const drillLogStore = useDrillLogStore();

function riskFor(p) {
  const s = String(p.status || '').toLowerCase();
  if (s === 'complete' || s === 'blasting' || s === 'done') return 'on-track';
  if (p.blast_td_updated) return 'on-track';
  const blastDate = reviewBlastDate(p);
  if (!blastDate || isNaN(blastDate.getTime())) return 'no-date';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const daysToBlast = Math.round((blastDate.getTime() - today.getTime()) / 86400000);
  if (daysToBlast < 0 && !p.blast_td_updated) return 'delayed';
  if (daysToBlast <= 2 && !p.blast_td_updated) return 'at-risk';
  return 'on-track';
}

watch(
  () => props.week?.week_id,
  (weekId) => {
    if (!weekId) return;
    patternsStore.loadByWeek(weekId);
    if (drillLogStore.loadedWeekId !== weekId) drillLogStore.loadByWeek(weekId);
  },
  { immediate: true },
);

const weekPatterns = computed(() =>
  patternsStore.patterns.filter((p) => Number(p.week_id) === Number(props.week?.week_id)),
);

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getFullYear() > 1970 ? date : null;
}

function reviewBlastDate(p) {
  return validDate(p?.planned_blast_date) || validDate(p?.actual_blast_date);
}

function hasBlastDate(p) {
  return !!reviewBlastDate(p);
}

const reviewPatterns = computed(() => weekPatterns.value);

function drilledM(p) {
  return +drillLogStore.drillLog
    .filter(e => e.pattern_id === p.pattern_id && Number(e.week_id) === Number(p.week_id))
    .reduce((s, e) => s + Number(e.total_drilling_m || 0) + Number(e.redrill_m || 0), 0)
    .toFixed(1);
}

const enrichedPatterns = computed(() =>
  reviewPatterns.value.map(p => {
    const plan = Number(p.effective_m || 0);
    const drilled = drilledM(p);
    const drilling_pct = plan > 0 ? +Math.min(100, (drilled / plan) * 100).toFixed(1) : 0;
    const _risk = riskFor(p);
    const _review_blast_date = reviewBlastDate(p);
    return { ...p, actual_drilling_m: drilled, drilling_pct, _risk, _review_blast_date };
  }),
);

const sorted = computed(() => {
  const order = { delayed: 0, 'at-risk': 1, 'on-track': 2, 'no-date': 3 };
  return [...enrichedPatterns.value].sort((a, b) => {
    if (order[a._risk] !== order[b._risk]) return order[a._risk] - order[b._risk];
    const da = a._review_blast_date ? new Date(a._review_blast_date).getTime() : Infinity;
    const db = b._review_blast_date ? new Date(b._review_blast_date).getTime() : Infinity;
    return da - db;
  });
});

const filtered = computed(() =>
  sorted.value.filter(
    (p) =>
      (filterRisk.value === 'all' || p._risk === filterRisk.value) &&
      (filterPit.value === 'all' || p.pit_name === filterPit.value) &&
      (filterStatus.value === 'all' || p.status === filterStatus.value),
  ),
);

const grouped = computed(() => ({
  delayed: filtered.value.filter((p) => p._risk === 'delayed'),
  'at-risk': filtered.value.filter((p) => p._risk === 'at-risk'),
  'on-track': filtered.value.filter((p) => p._risk === 'on-track'),
}));

const counts = computed(() => ({
  total: enrichedPatterns.value.length,
  delayed: enrichedPatterns.value.filter((p) => p._risk === 'delayed').length,
  atRisk: enrichedPatterns.value.filter((p) => p._risk === 'at-risk').length,
  onTrack: enrichedPatterns.value.filter((p) => p._risk === 'on-track').length,
}));

const pitOptions = computed(() => [
  { value: 'all', label: 'All pits' },
  ...[...new Set(reviewPatterns.value.map((p) => p.pit_name))].map((p) => ({ value: p, label: p })),
]);

const riskOpts = [
  { value: 'all', label: 'All risks' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'at-risk', label: 'At risk' },
  { value: 'on-track', label: 'On track' },
];

const statusOpts = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'drilling', label: 'Drilling' },
  { value: 'blasting', label: 'Blasting' },
  { value: 'complete', label: 'Complete' },
];
</script>
