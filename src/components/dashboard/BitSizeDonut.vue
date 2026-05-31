<template>
  <div style="display: flex; align-items: center; gap: 24px">
    <svg width="180" height="180" viewBox="0 0 180 180">
      <path v-for="(s, i) in slices" :key="i" :d="s.d" :fill="s.color" />
      <text x="90" y="86" text-anchor="middle" font-size="11" fill="var(--ink-3)" style="letter-spacing: 0.1em">
        TOTAL
      </text>
      <text
        x="90"
        y="106"
        text-anchor="middle"
        font-size="20"
        font-weight="600"
        fill="var(--ink)"
        class="mono"
        >{{ fnum(total) }}</text
      >
      <text x="90" y="122" text-anchor="middle" font-size="10" fill="var(--ink-3)">m</text>
    </svg>
    <div style="flex: 1; display: flex; flex-direction: column; gap: 8px">
      <div
        v-for="(s, i) in slices"
        :key="'l' + i"
        style="display: flex; align-items: center; gap: 8px; font-size: 12px"
      >
        <span :style="{ width: '10px', height: '10px', borderRadius: '2px', background: s.color }" />
        <span class="mono" style="min-width: 60px">Ø {{ s.bit }}mm</span>
        <span class="num" style="margin-left: auto">{{ fnum(s.m) }} m</span>
        <span class="dim num" style="width: 40px; text-align: right">{{ Math.round((s.m / total) * 100) }}%</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { fnum } from '../format.js';

const props = defineProps({
  data: { type: Array, required: true },
});

const total = computed(() => props.data.reduce((s, d) => s + d.m, 0));

const colors = ['var(--accent)', 'var(--accent-ink)', 'var(--ink-2)', 'var(--ink-4)'];

const slices = computed(() => {
  if (!total.value) return [];
  const R = 70;
  const r = 44;
  const cx = 90;
  const cy = 90;
  let a = -Math.PI / 2;
  const out = [];
  props.data.forEach((d, i) => {
    const angle = (d.m / total.value) * Math.PI * 2;
    const x1 = cx + R * Math.cos(a);
    const y1 = cy + R * Math.sin(a);
    const x2 = cx + R * Math.cos(a + angle);
    const y2 = cy + R * Math.sin(a + angle);
    const x3 = cx + r * Math.cos(a + angle);
    const y3 = cy + r * Math.sin(a + angle);
    const x4 = cx + r * Math.cos(a);
    const y4 = cy + r * Math.sin(a);
    const large = angle > Math.PI ? 1 : 0;
    const d_ = `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${r} ${r} 0 ${large} 0 ${x4} ${y4} Z`;
    a += angle;
    out.push({ d: d_, color: colors[i % colors.length], bit: d.bit, m: d.m });
  });
  return out;
});
</script>
