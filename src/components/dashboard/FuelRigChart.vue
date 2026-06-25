<template>
  <div class="frr-root">

    <!-- toolbar -->
    <div class="frr-toolbar">
      <button v-if="!hideExport" class="frr-export-btn" @click="exportExcel">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        EXPORT
      </button>
      <button v-if="showImageExport" class="frr-export-btn" @click="exportImage">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
          stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        PNG
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
      <div class="frr-title">รายงานการทำงานรถเจาะ รายคัน ({{ rangeLabel }})</div>
      <div class="frr-source">{{ sourceLabel }} · {{ rigData.length }} rigs</div>
    </div>

    <!-- legend (top-right) -->
    <div v-if="!hideChart" class="frr-legend">
      <span class="frr-leg-item"><span class="frr-leg-bar" />เมตร/ชม.</span>
      <span class="frr-leg-item"><span class="frr-leg-dot" style="background:#2d3436" />ลิตร/ชม.</span>
      <span class="frr-leg-item"><span class="frr-leg-dot" style="background:#4caf50" />เมตร/ลิตร (แกนขวา)</span>
    </div>

    <!-- loading overlay -->
    <div v-if="fuelStore.loading || drillStore.loading" class="frr-overlay">Loading…</div>

    <!-- chart -->
    <div v-if="!hideChart" ref="chartEl" class="frr-chart" />

    <!-- KPI table per rig -->
    <div v-if="!hideTable" class="frr-kpi-scroll">
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
  week: { type: Object, default: null },
  // When both are set, the chart aggregates over this date range (day-based)
  // instead of the active week.
  startDate: { type: String, default: '' },
  endDate: { type: String, default: '' },
  hideTable: { type: Boolean, default: false },
  hideExport: { type: Boolean, default: false },
  hideChart: { type: Boolean, default: false },
  showImageExport: { type: Boolean, default: false },
});

// Range mode reads month/range-scoped store refs; week mode reads week refs.
const rangeMode = computed(() => !!(props.startDate && props.endDate));

const fuelStore  = useFuelLogStore();
const drillStore = useDrillLogStore();
const chartEl    = ref(null);
let   chart      = null;
let   ro         = null;

const shiftFilter = ref('all');
const shiftOpts   = [
  { value: 'all',   label: 'ทั้งหมด' },
  { value: 'day',   label: 'กลางวัน' },
  { value: 'night', label: 'กลางคืน' },
];

// ── title / source labels ─────────────────────────────────────────────────────
function fmtDMY(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

const rangeLabel = computed(() => {
  if (rangeMode.value) {
    const s = props.startDate;
    const e = props.endDate;
    const [y, m] = s.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const wholeMonth = s.slice(0, 7) === e.slice(0, 7)
      && s.slice(8) === '01'
      && Number(e.slice(8)) === lastDay;
    if (wholeMonth) {
      return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    return s === e ? fmtDMY(s) : `${fmtDMY(s)} – ${fmtDMY(e)}`;
  }
  if (!props.week?.week_start) return '';
  const d = new Date(props.week.week_start);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
});

const sourceLabel = computed(() =>
  rangeMode.value ? 'ช่วงที่เลือก' : `Week ${props.week?.week_id ?? ''}`,
);

// Tag used in export filenames.
const reportTag = computed(() =>
  rangeMode.value
    ? `${props.startDate}_${props.endDate}`
    : `week${props.week?.week_id ?? ''}`,
);

// ── per-rig aggregation ───────────────────────────────────────────────────────
const rigData = computed(() => {
  const drillBase = rangeMode.value ? drillStore.monthlyDrillLog : drillStore.drillLog;
  const fuelBase  = rangeMode.value ? fuelStore.monthlyLog : fuelStore.fuelLog;

  // In range mode the store may hold a wider span than this chart's window,
  // so restrict entries to [startDate, endDate] by work_date.
  const inWindow = (e) => {
    if (!rangeMode.value) return true;
    const d = String(e.work_date || '').slice(0, 10);
    return d >= props.startDate && d <= props.endDate;
  };
  const matchShift = (e) => shiftFilter.value === 'all' || e.shift === shiftFilter.value;

  const drillSrc = drillBase.filter(e => inWindow(e) && matchShift(e));
  const fuelSrc  = fuelBase.filter(e => inWindow(e) && matchShift(e));

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
  if (props.hideChart || !chartEl.value) return;
  chart = echarts.init(chartEl.value);
  chart.setOption(chartOption.value);
  window.addEventListener('resize', onResize);
  if (chartEl.value && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => onResize());
    ro.observe(chartEl.value);
  }
});

onUnmounted(() => {
  ro?.disconnect();
  ro = null;
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
  XLSX.writeFile(wb, `rig-report-${reportTag.value}.xlsx`);
}

// ── export chart as PNG image (with title + legend baked in) ────────────────────
function exportImage() {
  if (!chartEl.value) return;

  // Render off-screen so the on-screen chart (HTML title/legend) is untouched.
  const w = Math.max(chartEl.value.clientWidth || 900, 720);
  const h = (chartEl.value.clientHeight || 340) + 90; // room for title + legend
  const holder = document.createElement('div');
  holder.style.cssText = `position:fixed;left:-99999px;top:0;width:${w}px;height:${h}px`;
  document.body.appendChild(holder);

  const tmp = echarts.init(holder, null, { renderer: 'canvas' });
  tmp.setOption({
    ...chartOption.value,
    grid: { ...chartOption.value.grid, top: 90 },
    title: {
      text: `รายงานการทำงานรถเจาะ รายคัน (${rangeLabel.value})`,
      subtext: `${sourceLabel.value} · ${rigData.value.length} rigs`,
      left: 16,
      top: 12,
      textStyle: { fontSize: 15, fontWeight: 600, color: '#222' },
      subtextStyle: { fontSize: 11, color: '#999' },
    },
    legend: {
      data: ['เมตร/ชม.', 'ลิตร/ชม.', 'เมตร/ลิตร'],
      top: 14,
      right: 16,
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { fontSize: 11, color: '#555' },
    },
  });

  const url = tmp.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
  tmp.dispose();
  document.body.removeChild(holder);

  const a = document.createElement('a');
  a.href = url;
  a.download = `rig-report-${reportTag.value}.png`;
  a.click();
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
