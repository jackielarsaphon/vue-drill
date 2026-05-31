<template>
  <div class="fdr-root">

    <!-- toolbar -->
    <div class="fdr-toolbar">
      <button class="fdr-export-btn" @click="exportExcel">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        EXPORT
      </button>
      <div class="fdr-radio-group">
        <label v-for="opt in shiftOpts" :key="opt.value" class="fdr-radio">
          <input type="radio" :value="opt.value" v-model="shiftFilter" />
          {{ opt.label }}
        </label>
      </div>
    </div>

    <!-- title -->
    <div class="fdr-title-block">
      <div class="fdr-title">รายงานการใช้น้ำมัน ประจำวัน ({{ weekLabel }})</div>
      <div class="fdr-source">Week {{ week?.week_id }} · {{ fmtDate(week?.week_start) }} – {{ fmtDate(week?.week_end) }}</div>
    </div>

    <!-- legend (top-right) -->
    <div class="fdr-legend">
      <span class="fdr-leg-item"><span class="fdr-leg-bar" />เมตร/ชม.</span>
      <span class="fdr-leg-item"><span class="fdr-leg-dot" style="background:#2d3436" />ลิตร/ชม.</span>
      <span class="fdr-leg-item"><span class="fdr-leg-dot" style="background:#4caf50" />เมตร/ลิตร (แกนขวา)</span>
    </div>

    <!-- loading overlay -->
    <div v-if="fuelStore.loading || drillStore.loading" class="fdr-overlay">Loading…</div>

    <!-- chart — always mounted -->
    <div ref="chartEl" class="fdr-chart" />

    <!-- KPI table per day -->
    <table class="fdr-kpi-tbl">
      <thead>
        <tr>
          <th>วัน</th>
          <th class="r">เมตร/ชม.</th>
          <th class="r">ลิตร/ชม.</th>
          <th class="r">เมตร/ลิตร</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(d, i) in dailyDrill" :key="i">
          <td class="mono">{{ xLabels[i] }}</td>
          <td class="r num">{{ d.mPerHr != null ? d.mPerHr : '—' }}</td>
          <td class="r num">{{ d.lPerHr != null ? d.lPerHr : '—' }}</td>
          <td class="r num">{{ d.mPerL  != null ? d.mPerL  : '—' }}</td>
        </tr>
      </tbody>
    </table>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import * as echarts from 'echarts';
import * as XLSX from 'xlsx';
import { fmtDate } from '../format.js';
import { useFuelLogStore }  from '../../stores/FuelLog.stores.ts';
import { useDrillLogStore } from '../../stores/DrillLog.stores.ts';

const props = defineProps({
  week: { type: Object, required: true },
});

const fuelStore  = useFuelLogStore();
const drillStore = useDrillLogStore();
const chartEl    = ref(null);
let   chart      = null;

const shiftFilter = ref('all');
const shiftOpts   = [
  { value: 'all',   label: 'ทั้งหมด' },
  { value: 'day',   label: 'กลางวัน' },
  { value: 'night', label: 'กลางคืน' },
];

// ── load drill log when week changes ─────────────────────────────────────────
watch(() => props.week?.week_id, (id) => {
  if (id != null) drillStore.loadByWeek(Number(id));
}, { immediate: true });

// ── week label ────────────────────────────────────────────────────────────────
const weekLabel = computed(() => {
  if (!props.week?.week_start) return '';
  const d = new Date(props.week.week_start);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
});

// ── 7-day date spine ──────────────────────────────────────────────────────────
const allDates = computed(() => {
  if (!props.week?.week_start) return [];
  const start = new Date(props.week.week_start);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d  = new Date(start);
    d.setDate(d.getDate() + i);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dates.push(`${d.getFullYear()}-${mm}-${dd}`);
  }
  return dates;
});

// normalise any date value → "YYYY-MM-DD"
function toIso(v) {
  if (!v) return '';
  if (v instanceof Date) {
    const mm = String(v.getMonth() + 1).padStart(2, '0');
    const dd = String(v.getDate()).padStart(2, '0');
    return `${v.getFullYear()}-${mm}-${dd}`;
  }
  return String(v).slice(0, 10);
}

// ── daily fuel aggregates ─────────────────────────────────────────────────────
const dailyFuel = computed(() => {
  const src = shiftFilter.value === 'all'
    ? fuelStore.fuelLog
    : fuelStore.fuelLog.filter(e => e.shift === shiftFilter.value);

  const map = {};
  for (const e of src) {
    const iso = toIso(e.work_date);
    if (!map[iso]) map[iso] = { litres: 0 };
    map[iso].litres += Number(e.fuel_litres || 0);
  }

  return allDates.value.map(iso => ({
    litres: Math.round((map[iso]?.litres || 0) * 100) / 100,
  }));
});

// ── daily drilling aggregates ─────────────────────────────────────────────────
const dailyDrill = computed(() => {
  const src = shiftFilter.value === 'all'
    ? drillStore.drillLog
    : drillStore.drillLog.filter(e => e.shift === shiftFilter.value);

  const map = {};
  for (const e of src) {
    const iso = toIso(e.work_date);
    if (!map[iso]) map[iso] = { metres: 0, smuHr: 0 };
    map[iso].metres += Math.max(0, Number(e.total_drilling_m || 0) - Number(e.redrill_m || 0));
    map[iso].smuHr  += Number(e.smu_hr || 0);
  }

  return allDates.value.map((iso, i) => {
    const d    = map[iso] || { metres: 0, smuHr: 0 };
    const litres = dailyFuel.value[i]?.litres || 0;
    const mPerHr = d.smuHr > 0 ? +(d.metres / d.smuHr).toFixed(1) : null;
    const lPerHr = (d.smuHr > 0 && litres > 0) ? +(litres / d.smuHr).toFixed(1) : null;
    const mPerL  = litres > 0 ? +(d.metres / litres).toFixed(2) : null;
    return {
      metres:  Math.round(d.metres * 100) / 100,
      smuHr:   Math.round(d.smuHr  * 100) / 100,
      mPerHr, lPerHr, mPerL,
    };
  });
});

// ── x-axis labels: short weekday + date ──────────────────────────────────────
const xLabels = computed(() =>
  allDates.value.map(iso => {
    const d   = new Date(iso);
    const day = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dd  = String(d.getDate()).padStart(2, '0');
    const mm  = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}\n${dd}/${mm}`;
  }),
);

// ── chart option ──────────────────────────────────────────────────────────────
const chartOption = computed(() => {
  const mPerHr = dailyDrill.value.map(d => d.mPerHr ?? 0);
  const lPerHr = dailyDrill.value.map(d => d.lPerHr ?? 0);
  const mPerL  = dailyDrill.value.map(d => d.mPerL  ?? 0);

  const maxLeft  = Math.max(10, ...mPerHr, ...lPerHr);
  const maxRight = Math.max(0.5, ...mPerL);

  return {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross', crossStyle: { color: '#bbb' } },
      textStyle: { fontSize: 11 },
      formatter(params) {
        const day = params[0]?.axisValue ?? '';
        let html = `<div style="font-weight:700;margin-bottom:4px">${day.replace('\n', ' ')}</div>`;
        for (const p of params) {
          const unit = p.seriesName === 'เมตร/ลิตร' ? ' m/L' : p.seriesName === 'ลิตร/ชม.' ? ' L/hr' : ' m/hr';
          const dec  = p.seriesName === 'เมตร/ลิตร' ? 2 : 1;
          const val  = p.value > 0 ? Number(p.value).toFixed(dec) : '—';
          html += `<div>${p.marker}${p.seriesName}: <strong>${val}${val !== '—' ? unit : ''}</strong></div>`;
        }
        return html;
      },
    },
    grid: { top: 50, right: 60, bottom: 56, left: 56, containLabel: false },
    xAxis: {
      type: 'category',
      data: xLabels.value,
      axisLine: { lineStyle: { color: '#ddd' } },
      axisTick: { show: false },
      axisLabel: { fontSize: 10, color: '#888', interval: 0, lineHeight: 16 },
    },
    yAxis: [
      {
        type: 'value',
        name: 'm/hr · L/hr',
        nameTextStyle: { fontSize: 9, color: '#aaa' },
        max: Math.ceil(maxLeft * 1.3 / 10) * 10,
        axisLabel: { show: true, fontSize: 10, color: '#555' },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#f0f0f0' } },
      },
      {
        type: 'value',
        name: 'm/L',
        nameTextStyle: { fontSize: 9, color: '#4caf50' },
        position: 'right',
        max: Math.ceil(maxRight * 1.5 * 10) / 10,
        axisLabel: { show: true, fontSize: 10, color: '#4caf50',
          formatter: v => v.toFixed(2) },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: 'เมตร/ชม.',
        type: 'bar',
        yAxisIndex: 0,
        data: mPerHr,
        itemStyle: { color: '#74b9ff', borderRadius: [2, 2, 0, 0] },
        barMaxWidth: 48,
        label: {
          show: true, position: 'top', fontSize: 10, fontWeight: 600, color: '#444',
          formatter: ({ value: v }) => v > 0 ? Number(v).toFixed(1) : '',
        },
      },
      {
        name: 'ลิตร/ชม.',
        type: 'line',
        yAxisIndex: 0,
        data: lPerHr,
        smooth: true,
        symbol: 'circle', symbolSize: 7,
        itemStyle: { color: '#2d3436' },
        lineStyle: { color: '#2d3436', width: 2.5 },
        label: {
          show: true, position: 'top', fontSize: 10, fontWeight: 600, color: '#222',
          formatter: ({ value: v }) => v > 0 ? Number(v).toFixed(1) : '',
        },
      },
      {
        name: 'เมตร/ลิตร',
        type: 'line',
        yAxisIndex: 1,
        data: mPerL,
        smooth: true,
        symbol: 'circle', symbolSize: 7,
        itemStyle: { color: '#4caf50' },
        lineStyle: { color: '#4caf50', width: 2.5 },
        label: {
          show: true, position: 'top', fontSize: 10, fontWeight: 600, color: '#4caf50',
          formatter: ({ value: v }) => v > 0 ? Number(v).toFixed(2) : '',
        },
      },
    ],
  };
});

// ── chart lifecycle ───────────────────────────────────────────────────────────
onMounted(() => {
  chart = echarts.init(chartEl.value);
  chart.setOption(chartOption.value);
  window.addEventListener('resize', onResize);
});

onUnmounted(() => {
  chart?.dispose();
  chart = null;
  window.removeEventListener('resize', onResize);
});

watch(chartOption, (opt) => { chart?.setOption(opt, true); });

function onResize() { chart?.resize(); }

// ── export ────────────────────────────────────────────────────────────────────
function exportExcel() {
  const rows = allDates.value.map((iso, i) => {
    const d = dailyDrill.value[i];
    return {
      'วันที่':       iso,
      'เมตร':         d?.metres  ?? 0,
      'SMU (ชม.)':    d?.smuHr   ?? 0,
      'ลิตร':         dailyFuel.value[i]?.litres ?? 0,
      'เมตร/ชม.':     d?.mPerHr  ?? '—',
      'ลิตร/ชม.':     d?.lPerHr  ?? '—',
      'เมตร/ลิตร':    d?.mPerL   ?? '—',
    };
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Fuel Report');
  XLSX.writeFile(wb, `fuel-report-week${props.week?.week_id ?? ''}.xlsx`);
}
</script>

<style scoped>
.fdr-root {
  position: relative;
  padding: 14px 16px 10px;
}

.fdr-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 10px;
}

.fdr-export-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: var(--ink-2);
  cursor: pointer;
}
.fdr-export-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.fdr-radio-group { display: flex; gap: 14px; }
.fdr-radio {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--ink-2);
  cursor: pointer;
  user-select: none;
}
.fdr-radio input[type="radio"] {
  accent-color: var(--accent);
  width: 14px;
  height: 14px;
  cursor: pointer;
}

.fdr-title-block { margin-bottom: 4px; }
.fdr-title { font-size: 13px; font-weight: 600; color: var(--ink); }
.fdr-source { font-size: 11px; color: var(--ink-4); margin-top: 1px; }

.fdr-legend {
  position: absolute;
  top: 14px;
  right: 16px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.fdr-leg-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: var(--ink-3);
}
.fdr-leg-bar {
  display: inline-block;
  width: 10px;
  height: 10px;
  background: #74b9ff;
  border-radius: 2px;
  flex-shrink: 0;
}
.fdr-leg-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.fdr-overlay {
  position: absolute;
  inset: 0;
  top: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--ink-4);
  background: var(--surface);
  z-index: 1;
  opacity: 0.85;
}

.fdr-chart {
  width: 100%;
  height: 340px;
}

.fdr-kpi-tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  margin-top: 4px;
  border-top: 1px solid var(--line);
}
.fdr-kpi-tbl th {
  padding: 5px 10px;
  text-align: left;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-3);
  border-bottom: 1px solid var(--line);
}
.fdr-kpi-tbl td {
  padding: 5px 10px;
  color: var(--ink);
  border-bottom: 1px solid var(--line);
  white-space: pre;
}
.fdr-kpi-tbl tr:last-child td { border-bottom: 0; }
.fdr-kpi-tbl .r { text-align: right; }
.fdr-kpi-tbl .num { font-variant-numeric: tabular-nums; font-family: var(--font-mono); }
</style>
