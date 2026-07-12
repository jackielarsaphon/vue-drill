<template>
  <div class="dpd-wrap">
    <div class="dpd-toolbar">
      <label class="dpd-month">
        <span>วันที่เริ่ม</span>
        <input type="date" v-model="tableStart" :max="tableEnd || undefined" />
      </label>
      <label class="dpd-month">
        <span>วันที่จบ</span>
        <input type="date" v-model="tableEnd" :min="tableStart || undefined" />
      </label>
      <button class="dpd-dl-btn" :disabled="capturing" @click="downloadPage">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        {{ capturing ? 'กำลังสร้างรูป…' : 'ดาวน์โหลดรูปทั้งหน้า' }}
      </button>
    </div>

    <div ref="captureEl" class="dpd-stack">
    <Card :pad="false">
      <table class="dpd-sum">
        <tbody>
          <tr class="dpd-sum-head"><td colspan="7">Drill meter TODAY</td></tr>
          <tr class="dpd-sum-cols">
            <th>Plan (m)</th><th>Actual (m)</th><th>Diff (m)</th><th>%Daily</th>
            <th>อัตราการเจาะ (m/Hr)</th><th>อัตราน้ำมัน (L/Hr)</th><th>ประสิทธิภาพ (m/L)</th>
          </tr>
          <tr class="dpd-sum-data">
            <td>{{ fmtInt(summary.today.plan) }}</td>
            <td>{{ fmtDec(summary.today.actual) }}</td>
            <td :class="diffClass(summary.today.diff)">{{ fmtDiff(summary.today.diff) }}</td>
            <td>{{ fmtPct(summary.today.pct) }}</td>
            <td>{{ fmtRate(summary.today.mPerHr) }}</td>
            <td>{{ fmtRate(summary.today.lPerHr) }}</td>
            <td>{{ fmtRate(summary.today.mPerL) }}</td>
          </tr>
          <tr class="dpd-sum-head"><td colspan="7">Drill meter MONTH TO DATE</td></tr>
          <tr class="dpd-sum-cols">
            <th>Plan (m)</th><th>Actual (m)</th><th>Diff (m)</th><th>%</th>
            <th>อัตราการเจาะ (m/Hr)</th><th>อัตราน้ำมัน (L/Hr)</th><th>ประสิทธิภาพ (m/L)</th>
          </tr>
          <tr class="dpd-sum-data">
            <td>{{ fmtInt(summary.mtd.plan) }}</td>
            <td>{{ fmtInt(summary.mtd.actual) }}</td>
            <td :class="diffClass(summary.mtd.diff)">{{ fmtDiff(summary.mtd.diff) }}</td>
            <td>{{ fmtPct(summary.mtd.pct) }}</td>
            <td>{{ fmtRate(summary.mtd.mPerHr) }}</td>
            <td>{{ fmtRate(summary.mtd.lPerHr) }}</td>
            <td>{{ fmtRate(summary.mtd.mPerL) }}</td>
          </tr>
        </tbody>
      </table>
    </Card>

    <!-- Drill Metre chart -->
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

    <!-- Per-rig output + rig report -->
    <div class="dpd-row">
      <Card title="Per-rig output" sub="Total drill + SMU hours · ทั้งเดือน">
        <PerDayOutputBars :data="perDayOutputMonth" />
      </Card>

      <Card :pad="false">
        <FuelRigChart :start-date="startDate" :end-date="endDate" hide-table hide-export />
      </Card>
    </div>

    <div v-if="!monthDays.length" class="dpd-empty">
      เลือกวันที่ให้ถูกต้อง
    </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, nextTick } from 'vue';
import { storeToRefs } from 'pinia';
import html2canvas from 'html2canvas';
import Card from '../Card.vue';
import PlanVsActualChart from './PlanVsActualChart.vue';
import PerDayOutputBars from './PerDayOutputBars.vue';
import FuelRigChart from './FuelRigChart.vue';
import { useDailyTargetsStore } from '../../stores/DailyTargets.stores.ts';
import { useDrillLogStore } from '../../stores/DrillLog.stores.ts';
import { useFuelLogStore } from '../../stores/FuelLog.stores.ts';

const props = defineProps({
  week: { type: Object, required: true },
});

const dailyTargetsStore = useDailyTargetsStore();
const { monthlyTargets } = storeToRefs(dailyTargetsStore);

const drillLogStore = useDrillLogStore();
const { monthlyDrillLog } = storeToRefs(drillLogStore);

const fuelLogStore = useFuelLogStore();
const { monthlyLog: monthlyFuelLog } = storeToRefs(fuelLogStore);

const captureEl = ref(null);
const capturing = ref(false);

// Capture all charts on the page into a single PNG.
async function downloadPage() {
  if (!captureEl.value || capturing.value) return;
  capturing.value = true;
  try {
    await nextTick();
    const canvas = await html2canvas(captureEl.value, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `daily-plan-vs-actual-week${props.week?.week_id ?? ''}.png`;
    a.click();
  } finally {
    capturing.value = false;
  }
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isoDay(value) {
  if (!value) return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  return String(value).slice(0, 10);
}

// Start/end date range drives the TABLES and the TODAY summary; the CHARTS stay
// locked to the whole month (of the start date).
const tableStart = ref(''); // 'YYYY-MM-DD'
const tableEnd = ref('');   // 'YYYY-MM-DD'

const weekStartStr = computed(() => isoDay(props.week?.week_start));

watch(
  weekStartStr,
  (d) => {
    if (!d || tableStart.value || tableEnd.value) return;
    const [y, m] = d.split('-').map(Number);
    if (!y || !m) return;
    const mm = String(m).padStart(2, '0');
    const lastDay = new Date(y, m, 0).getDate();
    tableStart.value = `${y}-${mm}-01`;
    tableEnd.value = `${y}-${mm}-${String(lastDay).padStart(2, '0')}`;
  },
  { immediate: true },
);

// Chart month bounds (1st → last day) of the start date's month.
const startDate = computed(() => (tableStart.value ? `${tableStart.value.slice(0, 7)}-01` : ''));
const endDate = computed(() => {
  if (!tableStart.value) return '';
  const [y, m] = tableStart.value.split('-').map(Number);
  if (!y || !m) return '';
  const lastDay = new Date(y, m, 0).getDate();
  return `${tableStart.value.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`;
});

// TODAY summary = a SINGLE day = the selected end date (วันที่จบ), not the whole
// range — so this row reads day-by-day while MONTH TO DATE stays cumulative.
const periodWindow = computed(() => ({ start: tableEnd.value, end: tableEnd.value, label: 'วันที่เลือก' }));

// Inclusive list of calendar days between two ISO dates.
function daysBetween(from, to) {
  if (!from || !to || from > to) return [];
  const out = [];
  const end = new Date(`${to}T00:00:00`);
  for (let cur = new Date(`${from}T00:00:00`); cur <= end; cur.setDate(cur.getDate() + 1)) {
    const y = cur.getFullYear();
    const mo = cur.getMonth() + 1;
    const day = cur.getDate();
    out.push({
      iso: `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      dow: DOW[cur.getDay()],
      dm: `${day}/${mo}`,
    });
  }
  return out;
}

const monthDays = computed(() => daysBetween(startDate.value, endDate.value)); // charts

const targetByDay = computed(() => {
  const m = {};
  for (const r of monthlyTargets.value) {
    const iso = isoDay(r.plan_date);
    if (!iso) continue;
    // A date can now have multiple rows (one per pit) — accumulate.
    const cur = m[iso] || (m[iso] = { drilling_m: 0, blast_vol_bcm: 0 });
    cur.drilling_m += Number(r.drilling_m) || 0;
    cur.blast_vol_bcm += Number(r.blast_vol_bcm) || 0;
  }
  return m;
});

const drillActualMap = computed(() => {
  const map = {};
  for (const e of monthlyDrillLog.value) {
    const iso = isoDay(e.work_date);
    if (!iso) continue;
    map[iso] = (map[iso] || 0) + Number(e.total_drilling_m || 0) + Number(e.redrill_m || 0);
  }
  return map;
});

// Charts (locked to the whole month).
const chartLabels = computed(() => monthDays.value.map((d) => `${d.dow}\n${d.dm}`));
const planDrill = computed(() => monthDays.value.map((d) => targetByDay.value[d.iso]?.drilling_m || 0));
const actualDrillByDay = computed(() => monthDays.value.map((d) => +(drillActualMap.value[d.iso] || 0).toFixed(1)));

// Per-rig output over an arbitrary window.
function rigOutput(s, e) {
  if (!s || !e) return [];
  const map = {};
  for (const en of monthlyDrillLog.value) {
    const iso = isoDay(en.work_date);
    if (!iso || iso < s || iso > e) continue;
    const rig = en.rig_id || '—';
    if (!map[rig]) map[rig] = { m: 0, smu: 0 };
    map[rig].m += Number(en.total_drilling_m || 0) + Number(en.redrill_m || 0);
    map[rig].smu += Number(en.smu_hr || 0);
  }
  return Object.entries(map)
    .map(([rig, v]) => ({ label: rig, m: +v.m.toFixed(1), smu: +v.smu.toFixed(1) }))
    .sort((a, b) => b.m - a.m);
}
const perDayOutputMonth = computed(() => rigOutput(startDate.value, endDate.value));    // chart

// TODAY row = the selected period window. MONTH TO DATE = the whole month.
const summary = computed(() => {
  const ps = periodWindow.value.start;
  const pe = periodWindow.value.end;
  const ms = startDate.value;
  const me = endDate.value;
  let planP = 0;
  let actualP = 0;
  let smuP = 0;
  let litreP = 0;
  let planMtd = 0;
  let actualMtd = 0;
  let smuMtd = 0;
  let litreMtd = 0;

  for (const r of monthlyTargets.value) {
    const iso = isoDay(r.plan_date);
    if (!iso) continue;
    const m = Number(r.drilling_m) || 0;
    if (iso >= ps && iso <= pe) planP += m;
    if (iso >= ms && iso <= me) planMtd += m;
  }
  for (const e of monthlyDrillLog.value) {
    const iso = isoDay(e.work_date);
    if (!iso) continue;
    const m = (Number(e.total_drilling_m) || 0) + (Number(e.redrill_m) || 0);
    const smu = Number(e.smu_hr) || 0;
    if (iso >= ps && iso <= pe) { actualP += m; smuP += smu; }
    if (iso >= ms && iso <= me) { actualMtd += m; smuMtd += smu; }
  }
  for (const e of monthlyFuelLog.value) {
    const iso = isoDay(e.work_date);
    if (!iso) continue;
    const l = Number(e.fuel_litres) || 0;
    if (iso >= ps && iso <= pe) litreP += l;
    if (iso >= ms && iso <= me) litreMtd += l;
  }

  const row = (plan, actual, smu, litre) => ({
    plan, actual,
    diff: actual - plan,
    pct: plan > 0 ? actual / plan : null,
    mPerHr: smu > 0 ? actual / smu : null,   // อัตราการเจาะเฉลี่ย
    lPerHr: smu > 0 ? litre / smu : null,    // อัตราการใช้น้ำมันเฉลี่ย
    mPerL:  litre > 0 ? actual / litre : null, // ประสิทธิภาพการเจาะ
  });
  return {
    today: row(planP, actualP, smuP, litreP),
    mtd:   row(planMtd, actualMtd, smuMtd, litreMtd),
  };
});

// ── number formatting for the summary table ─────────────────────────────────
function fmtInt(v) {
  return Number(Math.round(v || 0)).toLocaleString('en-US');
}
function fmtDec(v) {
  return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
function fmtDiff(v) {
  return Number(Math.round(v || 0)).toLocaleString('en-US');
}
function fmtPct(p) {
  return p == null ? '#DIV/0!' : `${Math.round(p * 100)}%`;
}
function fmtRate(v) {
  return v == null ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function diffClass(v) {
  if (!v) return '';
  return v < 0 ? 'dpd-neg' : 'dpd-pos';
}

watch(
  () => `${startDate.value}..${endDate.value}|${periodWindow.value.start}..${periodWindow.value.end}`,
  async () => {
    const s = startDate.value;
    const e = endDate.value;
    if (!s || !e || s > e) return;
    // Load the bounding span of the chart month and the period window (a week
    // may cross a month boundary), so every view has data.
    const bounds = [s, e, periodWindow.value.start, periodWindow.value.end].filter(Boolean).sort();
    const ls = bounds[0];
    const le = bounds[bounds.length - 1];
    await Promise.all([
      dailyTargetsStore.loadByRange(ls, le),
      drillLogStore.loadByRange(ls, le),
      fuelLogStore.loadByRange(ls, le),
    ]);
  },
  { immediate: true },
);
</script>

<style scoped>
.dpd-wrap {
  display: grid;
  gap: 12px;
}

.dpd-stack {
  display: grid;
  gap: 12px;
}

.dpd-sum {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  text-align: center;
}
.dpd-sum th,
.dpd-sum td {
  padding: 6px 10px;
  border: 1px solid var(--line);
}
.dpd-sum-head td {
  background: #c0392b;
  color: #fff;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: none;
}
.dpd-sum-cols th {
  background: #f3eee6;
  color: var(--ink-2);
  font-weight: 700;
  font-size: 11px;
}
.dpd-sum-data td {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--ink);
}
.dpd-sum-data td.dpd-neg { color: #c0392b; }
.dpd-sum-data td.dpd-pos { color: #1e7a46; }

.dpd-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.dpd-row > * { min-width: 0; }

@media (max-width: 1100px) {
  .dpd-row { grid-template-columns: 1fr; }
}

.dpd-toolbar {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
}

.dpd-month {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-2);
}
.dpd-month input {
  padding: 5px 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  font-size: 12px;
  color: var(--ink);
  cursor: pointer;
}
.dpd-month input:hover { border-color: var(--accent); }

.dpd-dl-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.03em;
  color: var(--ink-2);
  cursor: pointer;
}
.dpd-dl-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}
.dpd-dl-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.dpd-empty {
  padding: 18px 16px;
  color: var(--ink-3);
  font-size: 12px;
}
</style>
