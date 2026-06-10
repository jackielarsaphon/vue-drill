<template>
  <div class="chart-host">
    <p v-if="!data.length" class="chart-empty">No shift data for this week.</p>
    <svg v-else class="chart" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="xMidYMid meet">
      <g v-for="(t, i) in ticks" :key="'g' + i">
        <line class="gridline" :x1="P.l" :x2="W - P.r" :y1="ys(t)" :y2="ys(t)" />
        <text class="axis-text r" :x="P.l - 6" :y="ys(t) + 3">{{ fnum(t) }}</text>
      </g>
      <g v-for="(d, i) in data" :key="'b' + i">
        <rect
          :x="barX(i)"
          :y="ys(d.day)"
          :width="innerW"
          :height="H - P.b - ys(d.day)"
          fill="var(--accent)"
          rx="1"
        />
        <rect
          :x="barX(i) + innerW"
          :y="ys(d.night)"
          :width="innerW"
          :height="H - P.b - ys(d.night)"
          fill="var(--ink-2)"
          rx="1"
        />
        <text
          v-if="d.day > 0"
          class="bar-val day"
          :x="barX(i) + innerW / 2"
          :y="ys(d.day) - 4"
          text-anchor="middle"
        >{{ fnum(d.day) }}</text>
        <text
          v-if="d.night > 0"
          class="bar-val night"
          :x="barX(i) + innerW * 1.5"
          :y="ys(d.night) - 4"
          text-anchor="middle"
        >{{ fnum(d.night) }}</text>
        <text class="axis-text" :x="barX(i) + innerW" :y="H - 12" text-anchor="middle">{{ fmtDate(d.date) }}</text>
      </g>
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { fmtDate } from '../data.js';
import { fnum } from '../format.js';

const props = defineProps({
  data: { type: Array, default: () => [] },
});

const W = 580;
const H = 220;
const P = { l: 36, r: 16, t: 16, b: 30 };

const maxY = computed(() => {
  if (!props.data.length) return 1;
  return Math.max(1, ...props.data.map((d) => d.day + d.night)) * 1.1;
});

const bw = computed(() => {
  const n = props.data.length;
  if (!n) return 0;
  return (W - P.l - P.r) / Math.max(1, n);
});
const gap = computed(() => bw.value * 0.25);
const innerW = computed(() => (bw.value - gap.value) / 2);

function ys(v) {
  return P.t + (H - P.t - P.b) * (1 - v / maxY.value);
}

function barX(i) {
  return P.l + bw.value * i + gap.value / 2;
}

const ticks = computed(() => [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(maxY.value * t)));
</script>

<style scoped>
.chart-host {
  min-height: 220px;
}

.chart-empty {
  margin: 0;
  padding: 28px 12px;
  text-align: center;
  color: var(--ink-3);
  font-size: 12px;
}

.bar-val {
  font: 600 9px var(--font-mono);
}
.bar-val.day {
  fill: var(--accent);
}
.bar-val.night {
  fill: var(--ink-2);
}
</style>
