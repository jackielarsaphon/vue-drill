<template>
  <div class="dpd-stack">
    <Card :pad="false">
      <PlanVsActualChart
        title="Drill Metre Plan vs Actual"
        y-name="metres"
        :labels="chartLabels"
        :plan="planDrill"
        :actual="actualDrillByDay"
        bar-color="#e8533a"
        plan-color="#2f4ad0"
      />
    </Card>

    <Card :pad="false">
      <PlanVsActualChart
        title="Blast Volume Plan vs Actual (bcm)"
        y-name="BCM"
        :labels="chartLabels"
        :plan="planBlast"
        :actual="actualBlastByDay"
        bar-color="#f08a24"
        plan-color="#2f4ad0"
      />
    </Card>

    <div v-if="!weekDays.length" class="dpd-empty">
      This week has no valid date range (week_start / week_end).
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import Card from '../Card.vue';
import PlanVsActualChart from './PlanVsActualChart.vue';
import { useDailyTargetsStore } from '../../stores/DailyTargets.stores.ts';
import { useDrillLogStore } from '../../stores/DrillLog.stores.ts';
import { usePatternsStore } from '../../stores/Patterns.stores.ts';

const props = defineProps({
  week: { type: Object, required: true },
});

const dailyTargetsStore = useDailyTargetsStore();
const { targets } = storeToRefs(dailyTargetsStore);

const drillLogStore = useDrillLogStore();
const { drillLog } = storeToRefs(drillLogStore);

const patternsStore = usePatternsStore();
const { patterns } = storeToRefs(patternsStore);

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isoDay(value) {
  if (!value) return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  return String(value).slice(0, 10);
}

const weekDays = computed(() => {
  const start = isoDay(props.week?.week_start);
  const end = isoDay(props.week?.week_end);
  if (!start || !end) return [];
  const out = [];
  const cur = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  let guard = 0;
  while (cur.getTime() <= last.getTime() && guard < 31) {
    out.push({
      iso: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`,
      dow: DOW[cur.getDay()],
      dm: `${cur.getDate()}/${cur.getMonth() + 1}`,
    });
    cur.setDate(cur.getDate() + 1);
    guard += 1;
  }
  return out;
});

const targetByDay = computed(() => {
  const m = {};
  for (const r of targets.value) {
    const iso = isoDay(r.plan_date);
    if (!iso) continue;
    m[iso] = { drilling_m: Number(r.drilling_m) || 0, blast_vol_bcm: Number(r.blast_vol_bcm) || 0 };
  }
  return m;
});

const chartLabels = computed(() => weekDays.value.map((d) => `${d.dow}\n${d.dm}`));

const planDrill = computed(() => weekDays.value.map((d) => targetByDay.value[d.iso]?.drilling_m || 0));
const planBlast = computed(() => weekDays.value.map((d) => targetByDay.value[d.iso]?.blast_vol_bcm || 0));

const actualDrillByDay = computed(() => {
  const map = {};
  for (const e of drillLog.value) {
    if (Number(e.week_id) !== Number(props.week?.week_id)) continue;
    const iso = isoDay(e.work_date);
    if (!iso) continue;
    map[iso] = (map[iso] || 0) + Number(e.total_drilling_m || 0);
  }
  return weekDays.value.map((d) => +(map[d.iso] || 0).toFixed(1));
});

const actualBlastByDay = computed(() => {
  const map = {};
  for (const p of patterns.value) {
    if (Number(p.week_id) !== Number(props.week?.week_id)) continue;
    if (!p.blast_td_updated) continue;
    const iso = isoDay(p.actual_blast_date);
    if (!iso) continue;
    map[iso] = (map[iso] || 0) + Number(p.actual_blast_vol_bcm || 0);
  }
  return weekDays.value.map((d) => +(map[d.iso] || 0).toFixed(1));
});

watch(
  () => props.week?.week_id,
  async (weekId) => {
    const id = Number(weekId);
    if (weekId == null || Number.isNaN(id)) return;
    await Promise.all([
      dailyTargetsStore.loadByWeek(id),
      drillLogStore.loadByWeek(id),
      patternsStore.loadByWeek(id),
    ]);
  },
  { immediate: true },
);
</script>

<style scoped>
.dpd-stack {
  display: grid;
  gap: 12px;
}

.dpd-empty {
  padding: 18px 16px;
  color: var(--ink-3);
  font-size: 12px;
}
</style>
