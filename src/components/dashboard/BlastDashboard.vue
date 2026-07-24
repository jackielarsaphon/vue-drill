<template>
  <div class="bd-wrap">
    <div class="bd-toolbar">
      <label class="bd-month">
        <span>วันที่เริ่ม</span>
        <input type="date" v-model="tableStart" :max="tableEnd || undefined" />
      </label>
      <label class="bd-month">
        <span>วันที่จบ</span>
        <input type="date" v-model="tableEnd" :min="tableStart || undefined" />
      </label>
      <button class="bd-dl-btn" :disabled="capturing" @click="downloadPage">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        {{ capturing ? 'กำลังสร้างรูป…' : 'ดาวน์โหลดรูปทั้งหน้า' }}
      </button>
    </div>

    <div ref="captureEl" class="bd-stack">
      <Card :pad="false">
        <table class="bd-sum">
          <tbody>
            <tr class="bd-sum-head"><td colspan="4">Blast volume TODAY</td></tr>
            <tr class="bd-sum-cols">
              <th>Plan (bcm)</th><th>Actual (bcm)</th><th>Diff (bcm)</th><th>%Daily</th>
            </tr>
            <tr class="bd-sum-data">
              <td>{{ fmtInt(summary.today.plan) }}</td>
              <td>{{ fmtDec(summary.today.actual) }}</td>
              <td :class="diffClass(summary.today.diff)">{{ fmtDiff(summary.today.diff) }}</td>
              <td>{{ fmtPct(summary.today.pct) }}</td>
            </tr>
            <tr class="bd-sum-head"><td colspan="4">Blast volume MONTH TO DATE</td></tr>
            <tr class="bd-sum-cols">
              <th>Plan (bcm)</th><th>Actual (bcm)</th><th>Diff (bcm)</th><th>%</th>
            </tr>
            <tr class="bd-sum-data">
              <td>{{ fmtInt(summary.mtd.plan) }}</td>
              <td>{{ fmtInt(summary.mtd.actual) }}</td>
              <td :class="diffClass(summary.mtd.diff)">{{ fmtDiff(summary.mtd.diff) }}</td>
              <td>{{ fmtPct(summary.mtd.pct) }}</td>
            </tr>
          </tbody>
        </table>
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

      <div v-if="!monthDays.length" class="bd-empty">เลือกวันที่ให้ถูกต้อง</div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, nextTick } from 'vue';
import { storeToRefs } from 'pinia';
import html2canvas from 'html2canvas';
import Card from '../Card.vue';
import PlanVsActualChart from './PlanVsActualChart.vue';
import { useDailyTargetsStore } from '../../stores/DailyTargets.stores.ts';
import { usePatternsStore } from '../../stores/Patterns.stores.ts';

const props = defineProps({
  week: { type: Object, required: true },
});

const dailyTargetsStore = useDailyTargetsStore();
const { monthlyTargets } = storeToRefs(dailyTargetsStore);

const patternsStore = usePatternsStore();
const { monthlyPatterns } = storeToRefs(patternsStore);

const captureEl = ref(null);
const capturing = ref(false);

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isoDay(value) {
  if (!value) return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  return String(value).slice(0, 10);
}

// Start/end date range drives the TABLE and the TODAY summary; the CHART stays
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

const monthDays = computed(() => daysBetween(startDate.value, endDate.value)); // chart

const planByDay = computed(() => {
  const m = {};
  for (const r of monthlyTargets.value) {
    const iso = isoDay(r.plan_date);
    // A date can now have multiple rows (one per pit) — accumulate.
    if (iso) m[iso] = (m[iso] || 0) + (Number(r.blast_vol_bcm) || 0);
  }
  return m;
});
const actualByDay = computed(() => {
  const m = {};
  for (const p of monthlyPatterns.value) {
    if (!p.blast_td_updated) continue;
    const iso = isoDay(p.actual_blast_date);
    if (!iso) continue;
    m[iso] = (m[iso] || 0) + Number(p.actual_blast_vol_bcm || 0);
  }
  return m;
});

const chartLabels = computed(() => monthDays.value.map((d) => `${d.dow}\n${d.dm}`));
const planBlast = computed(() => monthDays.value.map((d) => planByDay.value[d.iso] || 0));
const actualBlastByDay = computed(() => monthDays.value.map((d) => +(actualByDay.value[d.iso] || 0).toFixed(1)));

// TODAY row = a SINGLE day (the selected "วันที่จบ" / end date); MONTH TO DATE = the whole month.
const summary = computed(() => {
  const todayIso = tableEnd.value || tableStart.value || '';
  const planP = planByDay.value[todayIso] || 0;
  const actualP = actualByDay.value[todayIso] || 0;
  let planMtd = 0;
  let actualMtd = 0;
  for (const d of monthDays.value) {
    planMtd += planByDay.value[d.iso] || 0;
    actualMtd += actualByDay.value[d.iso] || 0;
  }
  const row = (plan, actual) => ({
    plan, actual,
    diff: actual - plan,
    pct: plan > 0 ? actual / plan : null,
  });
  return { today: row(planP, actualP), mtd: row(planMtd, actualMtd) };
});

function fmtInt(v) { return Number(Math.round(v || 0)).toLocaleString('en-US'); }
function fmtDec(v) { return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
function fmtDiff(v) { return Number(Math.round(v || 0)).toLocaleString('en-US'); }
function fmtPct(p) { return p == null ? '#DIV/0!' : `${Math.round(p * 100)}%`; }
function diffClass(v) {
  if (!v) return '';
  return v < 0 ? 'bd-neg' : 'bd-pos';
}

async function downloadPage() {
  if (!captureEl.value || capturing.value) return;
  capturing.value = true;
  try {
    await nextTick();
    const canvas = await html2canvas(captureEl.value, {
      scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false,
    });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `blast-plan-vs-actual-${startDate.value?.slice(0, 7) || ''}.png`;
    a.click();
  } finally {
    capturing.value = false;
  }
}

watch(
  () => `${startDate.value}..${endDate.value}|${tableStart.value}..${tableEnd.value}`,
  async () => {
    const s = startDate.value;
    const e = endDate.value;
    if (!s || !e || s > e) return;
    const bounds = [s, e, tableStart.value, tableEnd.value].filter(Boolean).sort();
    const ls = bounds[0];
    const le = bounds[bounds.length - 1];
    await Promise.all([
      dailyTargetsStore.loadByRange(ls, le),
      patternsStore.loadByRange(ls, le),
    ]);
  },
  { immediate: true },
);
</script>

<style scoped>
.bd-wrap { display: grid; gap: 12px; }
.bd-stack { display: grid; gap: 12px; }

.bd-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}
.bd-month {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-2);
}
.bd-month input {
  padding: 5px 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  font-size: 12px;
  color: var(--ink);
  cursor: pointer;
}
.bd-month input:hover { border-color: var(--accent); }

.bd-dl-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-2);
  cursor: pointer;
}
.bd-dl-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.bd-dl-btn:disabled { opacity: 0.6; cursor: default; }

.bd-empty { padding: 18px 16px; color: var(--ink-3); font-size: 12px; }

.bd-sum { width: 100%; border-collapse: collapse; font-size: 12px; text-align: center; }
.bd-sum th, .bd-sum td { padding: 6px 10px; border: 1px solid var(--line); }
.bd-sum-head td {
  background: #c0392b;
  color: #fff;
  font-weight: 700;
  letter-spacing: 0.03em;
}
.bd-sum-cols th {
  background: #f3eee6;
  color: var(--ink-2);
  font-weight: 700;
  font-size: 11px;
}
.bd-sum-data td {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--ink);
}
.bd-sum-data td.bd-neg { color: #c0392b; }
.bd-sum-data td.bd-pos { color: #1e7a46; }
</style>
