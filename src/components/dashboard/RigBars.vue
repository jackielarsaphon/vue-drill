<template>
  <div class="rig-host">
    <p v-if="!data.length" class="chart-empty">No rig output for this week.</p>
    <div
      v-else
      style="display: flex; flex-direction: column; gap: 6px; max-height: 400px; overflow: auto; padding-right: 4px"
    >
      <div v-for="r in list" :key="r.rig" class="rigbar-row">
        <span class="mono">{{ r.rig }}</span>
        <div>
          <div class="rigbar"><span :style="{ width: `${(r.m / maxM) * 100}%` }" /></div>
          <div class="rigbar smu-bar" style="margin-top: 3px">
            <span :style="{ width: `${(r.smu / maxSmu) * 100}%` }" />
          </div>
        </div>
        <div class="rigbar-vals">
          <div class="num">
            {{ fnum(r.m) }}<span class="val-unit">m</span>
          </div>
          <div class="num smu-val">
            {{ fnum(r.smu, 1) }}<span class="val-unit">h</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { fnum } from '../format.js';

const props = defineProps({
  data: { type: Array, default: () => [] },
  limit: { type: Number, default: 12 },
});

const list = computed(() => props.data.slice(0, props.limit));
const maxM = computed(() => Math.max(1, ...props.data.map((d) => d.m)));
const maxSmu = computed(() => Math.max(1, ...props.data.map((d) => d.smu)));
</script>

<style scoped>
.rig-host {
  min-height: 120px;
}

.chart-empty {
  margin: 0;
  padding: 28px 12px;
  text-align: center;
  color: var(--ink-3);
  font-size: 12px;
}
</style>
