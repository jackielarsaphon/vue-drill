<template>
  <div>
    <div class="grid-4" style="margin-bottom: 12px">
      <KPI label="Avg metres / shift" :val="fnum(avgPerShift)" unit="m">
        <template #trend>
          <span class="num">{{ shiftCount }}</span> shifts logged · 7 days
        </template>
      </KPI>
      <KPI label="Total SMU hours" :val="fnum(totalSmu)" unit="h" :trend="`across ${activeRigs} active rigs`" />
      <KPI label="Total drill metres" :val="fnum(totalNet)" unit="m">
        <template #trend>
          gross <span class="num">{{ fnum(totalGross) }}</span> m
        </template>
      </KPI>
      <KPI
        label="Total redrill"
        :val="fnum(totalRedrill, 1)"
        unit="m"
        :accent="totalGross > 0 && totalRedrill / totalGross > 0.05 ? 'amber' : undefined"
      >
        <template #trend>
          {{ totalGross > 0 ? `${((totalRedrill / totalGross) * 100).toFixed(1)}% of gross` : '—' }}
        </template>
      </KPI>
    </div>

    <div class="grid-2" style="margin-bottom: 12px">
      <Card title="Daily metres by shift" sub="Last 7 days · net metres">
        <template #action>
          <div class="legend">
            <span class="legend-item"><span class="legend-swatch" />Day</span>
            <span class="legend-item">
              <span class="legend-swatch" style="background: var(--ink-2)" />Night
            </span>
          </div>
        </template>
        <DailyShiftBars :data="shifts" />
      </Card>
      <Card title="Per-rig output" sub="Net metres + SMU hours · last 7 days">
        <template #action>
          <div class="legend">
            <span class="legend-item"><span class="legend-swatch" />Net metres</span>
            <span class="legend-item">
              <span class="legend-swatch" style="background: var(--ink-3); height: 4px; width: 14px" />SMU hours
            </span>
          </div>
        </template>
        <RigBars :data="rig" />
      </Card>
    </div>

    <div class="grid-2" style="margin-bottom: 12px">
      <Card title="Operator metres" sub="Net m by operator · 7 days" :pad="false">
        <div class="ops-table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Operator</th>
              <th class="r">Shifts</th>
              <th class="r">Net m</th>
              <th class="r">Avg / shift</th>
              <th class="r">Redrill</th>
            </tr>
          </thead>
          <tbody>
            <template v-if="ops.length">
              <tr v-for="o in ops.slice(0, 9)" :key="o.name">
                <td>{{ o.name }}</td>
                <td class="num r">{{ o.shifts }}</td>
                <td class="num r"><strong>{{ fnum(o.net) }}</strong></td>
                <td class="num r">{{ fnum(o.avgNet) }}</td>
                <td class="num r dim">{{ o.redrill > 0 ? fnum(o.redrill, 1) : '—' }}</td>
              </tr>
              <tr class="tot">
                <td>Total</td>
                <td class="num r">{{ opsTot.shifts }}</td>
                <td class="num r">{{ fnum(opsTot.net) }}</td>
                <td class="num r">—</td>
                <td class="num r">{{ fnum(opsTot.redrill, 1) }}</td>
              </tr>
            </template>
            <tr v-else>
              <td colspan="5" class="ops-empty-cell">No drill log entries for this week.</td>
            </tr>
          </tbody>
        </table>
        </div>
      </Card>

      <Card title="Remaining patterns" sub="Sorted by blast due date" :pad="false">
        <div class="ops-table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Pattern</th>
              <th class="r">% drilled</th>
              <th class="r">Remaining m</th>
              <th>Blast due</th>
              <th>Risk</th>
            </tr>
          </thead>
          <tbody>
            <template v-if="rem.length">
            <tr v-for="p in rem" :key="p.pattern_id">
              <td><span class="mono" style="font-size: 11px">{{ p.pattern_id }}</span></td>
              <td class="num r">{{ Math.round(p.progress_pct) }}%</td>
              <td class="num r">{{ fnum(p.remaining_m) }}</td>
              <td>
                <div>{{ p.blastDate }}</div>
                <div class="dim" style="font-size: 11px">{{ p.blastRel }}</div>
              </td>
              <td><Pill :status="p.risk">{{ p.risk }}</Pill></td>
            </tr>
            </template>
            <tr v-else>
              <td colspan="5" class="ops-empty-cell">No remaining patterns this week.</td>
            </tr>
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue';
import { fnum, fmtDate, relDay } from '../format.js';
import KPI from '../KPI.vue';
import Card from '../Card.vue';
import Pill from '../Pill.vue';
import DailyShiftBars from './DailyShiftBars.vue';
import RigBars from './RigBars.vue';
import { useDashboardStore } from '../../stores/Dashboard.stores.ts';

const props = defineProps({
  week: { type: Object, required: true },
});

const store = useDashboardStore();

watch(() => props.week?.week_id, (id) => {
  if (id != null) store.loadByWeek(Number(id), props.week);
}, { immediate: true });

const ops = computed(() =>
  store.operatorData.map((o) => ({
    name:   o.name,
    shifts: o.shifts,
    net:    o.m + o.redrill,
    redrill: o.redrill,
    avgNet: o.shifts ? Math.round((o.m + o.redrill) / o.shifts) : 0,
  })),
);

const opsTot = computed(() => ({
  shifts:  ops.value.reduce((s, o) => s + o.shifts, 0),
  net:     ops.value.reduce((s, o) => s + o.net, 0),
  redrill: ops.value.reduce((s, o) => s + o.redrill, 0),
}));

const shiftCount   = computed(() => opsTot.value.shifts);
const totalRedrill = computed(() => opsTot.value.redrill);
const totalNet     = computed(() => opsTot.value.net);
const totalGross   = computed(() => totalNet.value + totalRedrill.value);
const avgPerShift  = computed(() => shiftCount.value ? totalNet.value / shiftCount.value : 0);

const rig        = computed(() => store.rigData);
const totalSmu   = computed(() => rig.value.reduce((s, r) => s + r.smu, 0));
const activeRigs = computed(() => rig.value.length);

const shifts = computed(() => store.shiftsData);

const rem = computed(() =>
  store.remainingData.slice(0, 10).map((p) => {
    const blast = p.planned_blast_date instanceof Date ? p.planned_blast_date : new Date(p.planned_blast_date);
    return {
      pattern_id:   p.pattern_id,
      progress_pct: store.patternProgressPct(p),
      remaining_m:  store.patternRemainingM(p),
      blastDate:    fmtDate(blast),
      blastRel:     relDay(blast),
      risk:         store.patternRisk(p),
    };
  }),
);
</script>

<style scoped>
.ops-table-wrap {
  overflow-x: auto;
}

.ops-empty {
  margin: 0;
  padding: 28px 12px;
  text-align: center;
  color: var(--ink-3);
  font-size: 12px;
}

.ops-empty-cell {
  padding: 24px 12px;
  text-align: center;
  color: var(--ink-3);
  font-size: 12px;
}
</style>
