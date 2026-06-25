<template>
  <div class="pdo-root">
    <p v-if="!data.length" class="chart-empty">No rig output for this month.</p>
    <div v-else ref="chartEl" class="pdo-chart" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import * as echarts from 'echarts';

const props = defineProps({
  // [{ label: '<rig>', m: <net metres>, smu: <smu hours> }]
  data: { type: Array, default: () => [] },
  // original Per-rig output colours: --accent (net metres), --ink-3 (smu hours)
  metresColor: { type: String, default: '#2541B2' },
  smuColor: { type: String, default: '#f08a24' },
});

const chartEl = ref(null);
let chart = null;
let ro = null;

const labels = computed(() => props.data.map((d) => d.label));
const metres = computed(() => props.data.map((d) => d.m));
const smu = computed(() => props.data.map((d) => d.smu));

const chartOption = computed(() => ({
  backgroundColor: 'transparent',
  animation: false,
  legend: {
    top: 4,
    data: [
      { name: 'Net metres', icon: 'rect' },
      { name: 'SMU hours', icon: 'line' },
    ],
    textStyle: { fontSize: 12, fontWeight: 600 },
  },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    textStyle: { fontSize: 11 },
    formatter(params) {
      const rig = params[0]?.axisValue ?? '';
      let html = `<div style="font-weight:700;margin-bottom:4px">${rig}</div>`;
      for (const p of params) {
        const unit = p.seriesName === 'SMU hours' ? ' h' : ' m';
        html += `<div>${p.marker}${p.seriesName}: <strong>${Number(p.value).toLocaleString('en-US')}${unit}</strong></div>`;
      }
      return html;
    },
  },
  grid: { top: 44, right: 56, bottom: 44, left: 56, containLabel: false },
  xAxis: {
    type: 'category',
    data: labels.value,
    axisLine: { lineStyle: { color: '#ddd' } },
    axisTick: { show: false },
    axisLabel: { fontSize: 10, color: '#888', interval: 0, rotate: labels.value.length > 10 ? 40 : 0 },
  },
  yAxis: [
    {
      type: 'value',
      name: 'metres',
      nameTextStyle: { fontSize: 10, color: '#aaa' },
      axisLabel: { fontSize: 10, color: '#555', formatter: (v) => Number(v).toLocaleString('en-US') },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#f0f0f0' } },
    },
    {
      type: 'value',
      name: 'SMU h',
      nameTextStyle: { fontSize: 10, color: '#aaa' },
      axisLabel: { fontSize: 10, color: '#555' },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
    },
  ],
  series: [
    {
      name: 'Net metres',
      type: 'bar',
      data: metres.value,
      itemStyle: { color: props.metresColor, borderRadius: [2, 2, 0, 0] },
      barMaxWidth: 22,
      label: {
        show: true, position: 'top', fontSize: 9, fontWeight: 700, color: props.metresColor,
        formatter: ({ value: v }) => (v > 0 ? Number(v).toLocaleString('en-US') : ''),
      },
      z: 2,
    },
    {
      name: 'SMU hours',
      type: 'line',
      yAxisIndex: 1,
      data: smu.value,
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      itemStyle: { color: props.smuColor },
      lineStyle: { color: props.smuColor, width: 2.5 },
      label: {
        show: true, position: 'top', fontSize: 9, fontWeight: 700, color: props.smuColor,
        formatter: ({ value: v }) => (v > 0 ? Number(v).toLocaleString('en-US') : ''),
      },
      z: 3,
    },
  ],
}));

function ensureChart() {
  if (!chartEl.value) return;
  if (!chart) {
    chart = echarts.init(chartEl.value);
    // Attach the observer here (not at mount): the chart element only exists
    // once data arrives, so observing at mount would miss it and leave the
    // chart un-resized (blank) when it later renders in a narrow column.
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => chart && chart.resize());
      ro.observe(chartEl.value);
    }
  }
  chart.setOption(chartOption.value, true);
  chart.resize();
}

onMounted(async () => {
  await nextTick();
  ensureChart();
  window.addEventListener('resize', onResize);
});

onUnmounted(() => {
  ro?.disconnect();
  ro = null;
  chart?.dispose();
  chart = null;
  window.removeEventListener('resize', onResize);
});

watch(chartOption, () => { chart?.setOption(chartOption.value, true); });
watch(() => props.data.length, async () => {
  await nextTick();
  ensureChart();
});

function onResize() { chart?.resize(); }
</script>

<style scoped>
.pdo-root {
  padding: 4px 4px 8px;
}

.pdo-chart {
  width: 100%;
  height: 320px;
}

.chart-empty {
  margin: 0;
  padding: 28px 12px;
  text-align: center;
  color: var(--ink-3);
  font-size: 12px;
}
</style>
