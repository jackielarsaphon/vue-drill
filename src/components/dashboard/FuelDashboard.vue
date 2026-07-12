<template>
  <div>
    <!-- KPI row -->
    <div class="grid-4" style="margin-bottom: 12px">
      <KPI label="Total fuel" :val="fnum(totalLitres, 0)" unit="L">
        <template #trend>
          <span class="num">{{ totalEntries }}</span> refuel entries this week
        </template>
      </KPI>
      <KPI label="Active rigs" :val="activeRigs" :trend="`avg ${fnum(avgPerRig, 0)} L / rig`" />
      <KPI label="Day shift" :val="fnum(dayLitres, 0)" unit="L">
        <template #trend>
          <span class="num">{{ dayEntries }}</span> entries
        </template>
      </KPI>
      <KPI label="Night shift" :val="fnum(nightLitres, 0)" unit="L">
        <template #trend>
          <span class="num">{{ nightEntries }}</span> entries
        </template>
      </KPI>
    </div>


    <!-- Drill efficiency KPIs -->
    <div v-if="drillEntries.length" class="grid-4" style="margin-bottom: 12px">
      <KPI label="Total drill metres" :val="fnum(totalDrillNet, 0)" unit="m">
        <template #trend>{{ drillEntries.length }} drill entries this week</template>
      </KPI>
      <KPI label="m / hr" :val="avgMperHour != null ? fnum(avgMperHour, 1) : '—'" unit="m/hr">
        <template #trend>Total drill metres per SMU hour</template>
      </KPI>
      <KPI label="L / hr" :val="avgLperHour != null ? fnum(avgLperHour, 1) : '—'" unit="L/hr">
        <template #trend>Fuel litres per SMU hour</template>
      </KPI>
      <KPI label="m / L" :val="avgMperLitre != null ? fnum(avgMperLitre, 2) : '—'" unit="m/L">
        <template #trend>Total drill metres per litre of fuel</template>
      </KPI>
    </div>

    <!-- Daily report chart -->
    <Card title="Daily fuel report" sub="Litres consumed per day · current week" style="margin-bottom: 12px" :pad="false">
      <FuelDailyReportChart :week="week" />
    </Card>

    <!-- Per-rig chart -->
    <Card title="Rig performance" sub="Metres drilled and fuel efficiency · per rig" style="margin-bottom: 12px" :pad="false">
      <FuelRigChart :week="week" />
    </Card>

    <!-- Refuel entries table -->
    <Card title="Refuel entries" :sub="`Week ${week?.week_id} · ${filteredLog.length} entries`" :pad="false">
      <!-- Filter bar -->
      <div class="entry-filters">
        <span class="ic" style="color:var(--ink-3)"><component :is="I.filter" /></span>
        <div class="ef-sel">
          <span class="ef-key">Date</span>
          <select :value="filterDate" @change="filterDate = $event.target.value">
            <option v-for="o in dateOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>
        <div class="ef-sel">
          <span class="ef-key">Rig</span>
          <select :value="filterRig" @change="filterRig = $event.target.value">
            <option v-for="o in rigOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>
        <div style="margin-left:auto; font-size:11px; color:var(--ink-3)">
          <span class="num" style="color:var(--ink)">{{ filteredLog.length }}</span> of {{ fuelStore.fuelLog.length }}
        </div>
      </div>

      <div v-if="!fuelStore.fuelLog.length" class="chart-empty" style="padding: 28px">
        No fuel entries for this week.
      </div>
      <p v-else-if="!filteredLog.length" class="chart-empty" style="padding: 20px">
        No entries match the selected filters.
      </p>
      <table v-else class="tbl">
        <thead>
          <tr>
            <th>Date</th>
            <th class="c">Shift</th>
            <th>Rig</th>
            <th class="r">Fuel (L)</th>
            <th class="r">Refuel Meter</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in filteredLog" :key="e.id">
            <td class="num">{{ fmtDate(e.work_date) }}</td>
            <td class="c">
              <span class="mono" style="font-size:11px"
                :style="{ color: e.shift === 'day' ? 'var(--ink)' : 'var(--ink-3)' }">
                {{ e.shift }}
              </span>
            </td>
            <td class="mono">{{ e.rig_id }}</td>
            <td class="num r"><strong>{{ fnum(e.fuel_litres, 0) }}</strong></td>
            <td class="num r dim">{{ e.refuel_meter ? fnum(e.refuel_meter, 1) : '—' }}</td>
          </tr>
          <tr class="tot">
            <td colspan="3">Total</td>
            <td class="num r">{{ fnum(filteredTotal, 0) }}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </Card>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { fnum, fmtDate, I } from '../format.js';
import KPI from '../KPI.vue';
import Card from '../Card.vue';
import FuelDailyReportChart from './FuelDailyReportChart.vue';
import FuelRigChart from './FuelRigChart.vue';
import { useFuelLogStore } from '../../stores/FuelLog.stores.ts';
import { useDrillLogStore } from '../../stores/DrillLog.stores.ts';

const props = defineProps({
  week: { type: Object, required: true },
});

const fuelStore = useFuelLogStore();
const drillStore = useDrillLogStore();

watch(() => props.week?.week_id, (id) => {
  if (id != null) {
    fuelStore.loadedWeekId = null;
    fuelStore.loadByWeek(Number(id));
    drillStore.loadByWeek(Number(id));
  }
}, { immediate: true });

// ── aggregates ────────────────────────────────────────────────────────────────
const totalLitres  = computed(() => fuelStore.fuelLog.reduce((s, e) => s + Number(e.fuel_litres || 0), 0));
const totalEntries = computed(() => fuelStore.fuelLog.length);
const dayEntries   = computed(() => fuelStore.fuelLog.filter(e => e.shift === 'day').length);
const nightEntries = computed(() => fuelStore.fuelLog.filter(e => e.shift === 'night').length);
const dayLitres    = computed(() => fuelStore.fuelLog.filter(e => e.shift === 'day').reduce((s, e) => s + Number(e.fuel_litres || 0), 0));
const nightLitres  = computed(() => fuelStore.fuelLog.filter(e => e.shift === 'night').reduce((s, e) => s + Number(e.fuel_litres || 0), 0));

// ── rig bars ──────────────────────────────────────────────────────────────────
const rigData = computed(() => {
  const groups = {};
  for (const e of fuelStore.fuelLog) {
    groups[e.rig_id] = (groups[e.rig_id] || 0) + Number(e.fuel_litres || 0);
  }
  return Object.entries(groups)
    .map(([rig, litres]) => ({ rig, litres: Math.round(litres) }))
    .sort((a, b) => b.litres - a.litres);
});

const maxLitres  = computed(() => Math.max(1, ...rigData.value.map(r => r.litres)));
const activeRigs = computed(() => rigData.value.length);
const avgPerRig  = computed(() => activeRigs.value ? totalLitres.value / activeRigs.value : 0);

// ── daily bars ────────────────────────────────────────────────────────────────
const dailyData = computed(() => {
  if (!props.week?.week_start) return [];
  const days = [];
  const start = new Date(props.week.week_start);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-AU', { weekday: 'short' });
    const dayL   = fuelStore.fuelLog.filter(e => String(e.work_date).slice(0, 10) === iso && e.shift === 'day').reduce((s, e) => s + Number(e.fuel_litres || 0), 0);
    const nightL = fuelStore.fuelLog.filter(e => String(e.work_date).slice(0, 10) === iso && e.shift === 'night').reduce((s, e) => s + Number(e.fuel_litres || 0), 0);
    days.push({ label, day: Math.round(dayL), night: Math.round(nightL) });
  }
  return days;
});

const maxDailyLitres = computed(() => Math.max(1, ...dailyData.value.map(d => d.day + d.night)));

// ── table filters ─────────────────────────────────────────────────────────────
const filterDate = ref('all');
const filterRig  = ref('all');

const dateOptions = computed(() => {
  const dates = [...new Set(fuelStore.fuelLog.map(e => String(e.work_date).slice(0, 10)))].sort().reverse();
  return [
    { value: 'all', label: 'All dates' },
    ...dates.map(d => {
      const dt = new Date(d);
      const label = dt.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' });
      return { value: d, label };
    }),
  ];
});

const rigOptions = computed(() => {
  const rigs = [...new Set(fuelStore.fuelLog.map(e => e.rig_id))].sort();
  return [
    { value: 'all', label: 'All rigs' },
    ...rigs.map(r => ({ value: r, label: r })),
  ];
});

const filteredLog = computed(() => {
  let list = [...fuelStore.fuelLog];
  if (filterDate.value !== 'all') list = list.filter(e => String(e.work_date).slice(0, 10) === filterDate.value);
  if (filterRig.value  !== 'all') list = list.filter(e => e.rig_id === filterRig.value);
  return list.sort((a, b) => String(b.work_date).localeCompare(String(a.work_date)));
});

const filteredTotal = computed(() => filteredLog.value.reduce((s, e) => s + Number(e.fuel_litres || 0), 0));

// ── drill efficiency KPIs (metres+SMU from drill log, fuel from Fuel Data page) ─
const drillEntries = computed(() =>
  drillStore.drillLog.filter(e => Number(e.week_id) === Number(props.week?.week_id)),
);
const totalDrillNet = computed(() => drillEntries.value.reduce((s, e) => s + Number(e.total_drilling_m || 0) + Number(e.redrill_m || 0), 0));
const totalDrillSmu = computed(() => drillEntries.value.reduce((s, e) => s + Number(e.smu_hr || 0), 0));
const avgMperHour  = computed(() => totalDrillSmu.value > 0 ? totalDrillNet.value / totalDrillSmu.value : null);
const avgLperHour  = computed(() => (totalDrillSmu.value > 0 && totalLitres.value > 0) ? totalLitres.value / totalDrillSmu.value : null);
const avgMperLitre = computed(() => totalLitres.value > 0 ? totalDrillNet.value / totalLitres.value : null);
</script>

<style scoped>
.fuel-bar-row {
  display: grid;
  grid-template-columns: 64px 1fr 64px;
  align-items: center;
  gap: 10px;
  font-size: 12px;
}

.fuel-bar {
  height: 8px;
  border-radius: 2px;
  background: var(--surface-2);
  overflow: hidden;
}
.fuel-bar > span {
  display: block;
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
}

.fuel-bar-val {
  text-align: right;
  font-size: 12px;
  color: var(--ink);
}

.fuel-daily-chart {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 160px;
  padding-bottom: 20px;
  position: relative;
}

.fuel-daily-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  position: relative;
}

.fuel-daily-bars {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  gap: 2px;
}

.fuel-daily-bar {
  flex: 1;
  border-radius: 2px 2px 0 0;
  min-height: 2px;
}
.fuel-daily-bar.day   { background: var(--accent); }
.fuel-daily-bar.night { background: var(--ink-2); }

.fuel-daily-label {
  position: absolute;
  bottom: -18px;
  font-size: 10px;
  color: var(--ink-3);
  white-space: nowrap;
}

.entry-filters {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
}

.ef-sel {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  font-size: 11px;
  color: var(--ink-2);
}
.ef-sel .ef-key {
  font-weight: 600;
  color: var(--ink-3);
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.05em;
}
.ef-sel select {
  border: none;
  background: transparent;
  font-size: 11px;
  color: var(--ink);
  outline: none;
  cursor: pointer;
}

.chart-empty {
  margin: 0;
  text-align: center;
  color: var(--ink-3);
  font-size: 12px;
  padding: 28px 12px;
}
</style>
