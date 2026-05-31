<template>
  <svg class="chart" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="xMidYMid meet">
    <g v-for="(t, i) in ticks" :key="'y' + i">
      <line class="gridline" :x1="P.l" :x2="W - P.r" :y1="ys(t)" :y2="ys(t)" />
      <text class="axis-text r" :x="P.l - 6" :y="ys(t) + 3">{{ fnum(t) }}</text>
    </g>
    <g v-if="todayIdx >= 0">
      <line
        :x1="xs(todayIdx)"
        :x2="xs(todayIdx)"
        :y1="P.t"
        :y2="H - P.b"
        stroke="var(--ink-4)"
        stroke-dasharray="2 3"
      />
      <text class="axis-text" :x="xs(todayIdx) + 4" :y="P.t + 10" fill="var(--ink-3)">TODAY</text>
    </g>
    <path :d="areaPath" class="area-actual" />
    <path :d="planPath" class="line-plan" />
    <path :d="actualPath" class="line-actual" />
    <text
      v-for="(d, i) in data"
      v-show="i % 2 === 0"
      :key="'x' + i"
      class="axis-text"
      :x="xs(i)"
      :y="H - 10"
      text-anchor="middle"
    >
      {{ fmtDate(d.date) }}
    </text>
  </svg>
</template>

<script setup>
import { computed } from 'vue';
import { fmtDate, fnum } from '../format.js';

const props = defineProps({
  data: { type: Array, required: true },
});

const W = 640;
const H = 220;
const P = { l: 44, r: 48, t: 14, b: 28 };

const maxY = computed(() => {
  if (!props.data.length) return 1;
  return Math.max(1, ...props.data.map((d) => Math.max(d.plan || 0, d.actual || 0)));
});

function xs(i) {
  const n = props.data.length;
  if (n <= 1) return P.l;
  return P.l + (W - P.l - P.r) * (i / (n - 1));
}

function ys(v) {
  return P.t + (H - P.t - P.b) * (1 - v / maxY.value);
}

const todayIdx = computed(() => props.data.findIndex((d) => d.actual === null) - 1);

const planPath = computed(() =>
  props.data.map((d, i) => `${i ? 'L' : 'M'} ${xs(i).toFixed(1)} ${ys(d.plan).toFixed(1)}`).join(' '),
);

const actualPts = computed(() => props.data.filter((d) => d.actual !== null));

const actualPath = computed(() => {
  if (!actualPts.value.length) return '';
  return props.data
    .map((d, i) => (d.actual == null ? null : `${i ? 'L' : 'M'} ${xs(i).toFixed(1)} ${ys(d.actual).toFixed(1)}`))
    .filter(Boolean)
    .join(' ');
});

const lastActualIdx = computed(() => {
  let last = -1;
  props.data.forEach((d, i) => {
    if (d.actual != null) last = i;
  });
  return last;
});

const areaPath = computed(() => {
  const ap = actualPath.value;
  if (!ap || lastActualIdx.value < 0) return ap;
  return `${ap} L ${xs(lastActualIdx.value).toFixed(1)} ${ys(0).toFixed(1)} L ${xs(0).toFixed(1)} ${ys(0).toFixed(1)} Z`;
});

const ticks = computed(() => [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(maxY.value * t)));
</script>
