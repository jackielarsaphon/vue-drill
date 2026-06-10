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
      <g v-if="plan > 0">
        <path class="plan-curve" :d="planPath" />
        <g v-for="(pt, i) in planPoints" :key="'p' + i">
          <circle class="plan-dot" :cx="pt.x" :cy="pt.y" r="3.5" />
          <text class="plan-label" :x="pt.x" :y="pt.y - 8" text-anchor="middle">{{ fnum(Math.round(plan)) }}</text>
        </g>
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
  plan: { type: Number, default: 0 }, // PLAN metres target per day
});

const W = 580;
const H = 220;
const P = { l: 36, r: 16, t: 16, b: 30 };

const maxY = computed(() => {
  if (!props.data.length) return 1;
  return Math.max(1, props.plan, ...props.data.map((d) => d.day + d.night)) * 1.1;
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

// PLAN target: one point per day, centred over each day's bar pair
const planPoints = computed(() =>
  props.plan > 0
    ? props.data.map((_, i) => ({ x: barX(i) + innerW.value, y: ys(props.plan) }))
    : [],
);

// smooth curve through the points (Catmull-Rom → cubic bezier)
const planPath = computed(() => {
  const pts = planPoints.value;
  if (!pts.length) return '';
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
});
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

.plan-curve {
  fill: none;
  stroke: var(--green);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.plan-dot {
  fill: var(--green);
}
.plan-label {
  font: 700 9px var(--font-mono);
  fill: var(--green);
}
</style>
