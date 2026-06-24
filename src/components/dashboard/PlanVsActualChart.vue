<template>
  <div class="pva-root">
    <div class="pva-title">{{ title }}</div>
    <div ref="chartEl" class="pva-chart" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import * as echarts from 'echarts';

const props = defineProps({
  title: { type: String, default: '' },
  labels: { type: Array, required: true },
  plan: { type: Array, required: true },
  actual: { type: Array, required: true },
  yName: { type: String, default: '' },
  barColor: { type: String, default: '#e8533a' },
  planColor: { type: String, default: '#2f4ad0' },
  decimals: { type: Number, default: 0 },
});

const chartEl = ref(null);
let chart = null;

function fmtVal(v) {
  if (v == null) return '';
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: props.decimals, maximumFractionDigits: props.decimals });
}

const chartOption = computed(() => ({
  backgroundColor: 'transparent',
  animation: false,
  legend: {
    top: 4,
    data: [
      { name: 'Plan', icon: 'circle' },
      { name: 'Actual', icon: 'rect' },
    ],
    textStyle: { fontSize: 12, fontWeight: 600 },
  },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    textStyle: { fontSize: 11 },
    formatter(params) {
      const day = params[0]?.axisValue ?? '';
      let html = `<div style="font-weight:700;margin-bottom:4px">${String(day).replace('\n', ' ')}</div>`;
      for (const p of params) {
        html += `<div>${p.marker}${p.seriesName}: <strong>${fmtVal(p.value)}</strong></div>`;
      }
      return html;
    },
  },
  grid: { top: 44, right: 24, bottom: 44, left: 60, containLabel: false },
  xAxis: {
    type: 'category',
    data: props.labels,
    axisLine: { lineStyle: { color: '#ddd' } },
    axisTick: { show: false },
    axisLabel: { fontSize: 10, color: '#888', interval: 0, lineHeight: 14 },
  },
  yAxis: {
    type: 'value',
    name: props.yName,
    nameTextStyle: { fontSize: 10, color: '#aaa' },
    axisLabel: { fontSize: 10, color: '#555', formatter: (v) => Number(v).toLocaleString('en-US') },
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: '#f0f0f0' } },
  },
  series: [
    {
      name: 'Actual',
      type: 'bar',
      data: props.actual,
      itemStyle: { color: props.barColor, borderRadius: [2, 2, 0, 0] },
      barMaxWidth: 34,
      label: {
        show: true, position: 'inside', rotate: 90, fontSize: 9, fontWeight: 600, color: '#fff',
        formatter: ({ value: v }) => (v > 0 ? fmtVal(v) : ''),
      },
      z: 1,
    },
    {
      name: 'Plan',
      type: 'line',
      data: props.plan,
      symbol: 'circle',
      symbolSize: 9,
      itemStyle: { color: props.planColor },
      lineStyle: { color: props.planColor, width: 2, type: 'dashed' },
      label: {
        show: true, position: 'top', fontSize: 10, fontWeight: 700, color: props.planColor,
        formatter: ({ value: v }) => (v > 0 ? fmtVal(v) : ''),
      },
      z: 2,
    },
  ],
}));

onMounted(async () => {
  await nextTick();
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
</script>

<style scoped>
.pva-root {
  padding: 14px 16px 12px;
}

.pva-title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--ink-2);
  text-align: center;
  text-transform: uppercase;
}

.pva-chart {
  width: 100%;
  height: 320px;
}
</style>
