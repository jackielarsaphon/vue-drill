<template>
  <div class="frr-root">

    <!-- toolbar -->
    <div class="frr-toolbar">
      <button class="frr-export-btn" @click="exportExcel">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        EXPORT
      </button>
      <div class="frr-radio-group">
        <label v-for="opt in shiftOpts" :key="opt.value" class="frr-radio">
          <input type="radio" :value="opt.value" v-model="shiftFilter" />
          {{ opt.label }}
        </label>
      </div>
    </div>

    <!-- title -->
    <div class="frr-title-block">
      <div class="frr-title">รายงานการทำงานรถเจาะ รายคัน ({{ weekLabel }})</div>
      <div class="frr-source">Week {{ week?.week_id }} · {{ rigData.length }} rigs</div>
    </div>

    <!-- legend (top-right) -->
    <div class="frr-legend">
      <span class="frr-leg-item"><span class="frr-leg-bar" />เมตร/ชม.</span>
      <span class="frr-leg-item"><span class="frr-leg-dot" style="background:#2d3436" />ลิตร/ชม.</span>
      <span class="frr-leg-item"><span class="frr-leg-dot" style="background:#4caf50" />เมตร/ลิตร (แกนขวา)</span>
    </div>

    <!-- loading overlay -->
    <div v-if="fuelStore.loading || drillStore.loading" class="frr-overlay">Loading…</div>

    <!-- chart -->
    <div ref="chartEl" class="frr-chart" />

    <!-- KPI table per rig -->
    <div class="frr-kpi-scroll">
      <table class="frr-kpi-tbl">
        <thead>
          <tr>
            <th>Rig</th>
            <th class="r">เมตร/ชม.</th>
            <th class="r">ลิตร/ชม.</th>
            <th class="r">เมตร/ลิตร</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rigData" :key="r.rig">
            <td class="mono">{{ r.rig }}</td>
            <td class="r num kpi-hi">{{ r.mPerHr != null ? r.mPerHr : '—' }}</td>
            <td class="r num kpi-hi">{{ r.lPerHr != null ? r.lPerHr : '—' }}</td>
            <td class="r num kpi-hi">{{ r.mPerL  != null ? r.mPerL  : '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import * as echarts from 'echarts';
import * as XLSX from 'xlsx';
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

// ── week label ────────────────────────────────────────────────────────────────
const weekLabel = computed(() => {
  if (!props.week?.week_start) return '';
  const d = new Date(props.week.week_start);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
});

// ── per-rig aggregation ───────────────────────────────────────────────────────
const rigData = computed(() => {
  const drillSrc = shiftFilter.value === 'all'
    ? drillStore.drillLog
    : drillStore.drillLog.filter(e => e.shift === shiftFilter.value);

  const fuelSrc = shiftFilter.value === 'all'
    ? fuelStore.fuelLog
    : fuelStore.fuelLog.filter(e => e.shift === shiftFilter.value);

  // aggregate drill by rig (metres, smuHr from drill log)
  const drillMap = {};
  for (const e of drillSrc) {
    const r = e.rig_id;
    if (!drillMap[r]) drillMap[r] = { metres: 0, smuHr: 0 };
    drillMap[r].metres += Math.max(0, Number(e.total_drilling_m || 0) - Number(e.redrill_m || 0));
    drillMap[r].smuHr  += Number(e.smu_hr || 0);
  }

  // aggregate fuel by rig (fuel_litres from Fuel Data page)
  const fuelMap = {};
  for (const e of fuelSrc) {
    const r = e.rig_id;
    fuelMap[r] = (fuelMap[r] || 0) + Number(e.fuel_litres || 0);
  }

  const allRigs = new Set([...Object.keys(drillMap), ...Object.keys(fuelMap)]);

  const rows = [...allRigs].map(rig => {
    const d    = drillMap[rig] || { metres: 0, smuHr: 0 };
    const fuel = fuelMap[rig]  || 0;
    const mPerHr = d.smuHr > 0 ? +(d.metres / d.smuHr).toFixed(1) : null;
    const lPerHr = (d.smuHr > 0 && fuel > 0) ? +(fuel / d.smuHr).toFixed(1) : null;
    const mPerL  = fuel > 0 ? +(d.metres / fuel).toFixed(2) : null;
    return {
      rig,
      metres:  Math.round(d.metres * 100) / 100,
      smuHr:   Math.round(d.smuHr  * 100) / 100,
      fuel:    Math.round(fuel),
      mPerHr, lPerHr, mPerL,
    };
  });

  return rows.sort((a, b) => b.metres - a.metres);
});

// ── chart option ──────────────────────────────────────────────────────────────
const chartOption = computed(() => {
  const rigs   = rigData.value.map(r => r.rig);
  const mPerHr = rigData.value.map(r => r.mPerHr ?? 0);
  const lPerHr = rigData.value.map(r => r.lPerHr ?? 0);
  const mPerL  = rigData.value.map(r => r.mPerL  ?? 0);

  const maxLeft  = Math.max(10, ...mPerHr, ...lPerHr);
  const maxRight = Math.max(0.5, ...mPerL);

  const barW = rigs.length > 15 ? 20 : rigs.length > 8 ? 28 : 40;

  return {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross', crossStyle: { color: '#bbb' } },
      textStyle: { fontSize: 11 },
      formatter(params) {
        const rig = params[0]?.axisValue ?? '';
        let html = `<div style="font-weight:700;margin-bottom:4px">${rig}</div>`;
        for (const p of params) {
          const unit = p.seriesName === 'เมตร/ลิตร' ? ' m/L' : p.seriesName === 'ลิตร/ชม.' ? ' L/hr' : ' m/hr';
          const val  = p.value != null ? Number(p.value).toFixed(p.seriesName === 'เมตร/ลิตร' ? 2 : 1) : '—';
          html += `<div>${p.marker}${p.seriesName}: <strong>${val}${unit}</strong></div>`;
        }
        return html;
      },
    },
    grid: { top: 50, right: 60, bottom: 60, left: 56, containLabel: false },
    xAxis: {
      type: 'category',
      data: rigs,
      axisLine: { lineStyle: { color: '#ddd' } },
      axisTick: { show: false },
      axisLabel: { fontSize: 9, color: '#888', interval: 0, rotate: rigs.length > 10 ? 35 : 0 },
    },
    yAxis: [
      {
        type: 'value',
        name: 'm/hr · L/hr',
        nameTextStyle: { fontSize: 9, color: '#aaa' },
        max:  Math.ceil(maxLeft * 1.3 / 10) * 10,
        axisLabel: { show: true, fontSize: 10, color: '#555' },
        axisLine:  { show: false },
        axisTick:  { show: false },
        splitLine: { lineStyle: { color: '#f0f0f0' } },
      },
      {
        type: 'value',
        name: 'm/L',
        nameTextStyle: { fontSize: 9, color: '#4caf50' },
        position: 'right',
        max:  Math.ceil(maxRight * 1.5 * 10) / 10,
        axisLabel: { show: true, fontSize: 10, color: '#4caf50',
          formatter: v => v.toFixed(2) },
        axisLine:  { show: false },
        axisTick:  { show: false },
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
        barMaxWidth: barW,
        label: {
          show: true, position: 'top', fontSize: 9, fontWeight: 600, color: '#444',
          formatter: ({ value: v }) => v > 0 ? Number(v).toFixed(1) : '',
        },
      },
      {
        name: 'ลิตร/ชม.',
        type: 'line',
        yAxisIndex: 0,
        data: lPerHr,
        smooth: true,
        symbol: 'circle', symbolSize: 6,
        itemStyle: { color: '#2d3436' },
        lineStyle: { color: '#2d3436', width: 2.5 },
        label: {
          show: true, position: 'top', fontSize: 9, fontWeight: 600, color: '#222',
          formatter: ({ value: v }) => v > 0 ? Number(v).toFixed(1) : '',
        },
      },
      {
        name: 'เมตร/ลิตร',
        type: 'line',
        yAxisIndex: 1,
        data: mPerL,
        smooth: true,
        symbol: 'circle', symbolSize: 6,
        itemStyle: { color: '#4caf50' },
        lineStyle: { color: '#4caf50', width: 2.5 },
        label: {
          show: true, position: 'top', fontSize: 9, fontWeight: 600, color: '#4caf50',
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
  const rows = rigData.value.map(r => ({
    'rig_id':        r.rig,
    'เมตร':          r.metres,
    'SMU (ชม.)':     r.smuHr,
    'ลิตร':          r.fuel,
    'เมตร/ชม.':      r.mPerHr ?? '—',
    'ลิตร/ชม.':      r.lPerHr ?? '—',
    'เมตร/ลิตร':     r.mPerL  ?? '—',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rig Report');
  XLSX.writeFile(wb, `rig-report-week${props.week?.week_id ?? ''}.xlsx`);
}
</script>

<style scoped>
.frr-root {
  position: relative;
  padding: 14px 16px 10px;
}

.frr-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 10px;
}

.frr-export-btn {
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
.frr-export-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.frr-radio-group { display: flex; gap: 14px; }
.frr-radio {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--ink-2);
  cursor: pointer;
  user-select: none;
}
.frr-radio input[type="radio"] {
  accent-color: var(--accent);
  width: 14px;
  height: 14px;
  cursor: pointer;
}

.frr-title-block { margin-bottom: 4px; }
.frr-title { font-size: 13px; font-weight: 600; color: var(--ink); }
.frr-source { font-size: 11px; color: var(--ink-4); margin-top: 1px; }

.frr-legend {
  position: absolute;
  top: 14px;
  right: 16px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.frr-leg-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: var(--ink-3);
}
.frr-leg-bar {
  display: inline-block;
  width: 10px;
  height: 10px;
  background: #74b9ff;
  border-radius: 2px;
  flex-shrink: 0;
}
.frr-leg-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.frr-overlay {
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

.frr-chart {
  width: 100%;
  height: 340px;
}

.frr-kpi-scroll {
  overflow-x: auto;
  border-top: 1px solid var(--line);
  margin-top: 4px;
}
.frr-kpi-tbl {
  width: 100%;
  min-width: 560px;
  border-collapse: collapse;
  font-size: 11px;
}
.frr-kpi-tbl th {
  padding: 5px 10px;
  text-align: left;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-3);
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
}
.frr-kpi-tbl td {
  padding: 5px 10px;
  color: var(--ink);
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
}
.frr-kpi-tbl tr:last-child td { border-bottom: 0; }
.frr-kpi-tbl .r   { text-align: right; }
.frr-kpi-tbl .num { font-variant-numeric: tabular-nums; font-family: var(--font-mono); }
.frr-kpi-tbl .dim { color: var(--ink-3); }
.frr-kpi-tbl .kpi-hi { color: var(--accent); font-weight: 600; }
</style>
