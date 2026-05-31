<template>
  <div class="week-pick">
    <button type="button" aria-label="Previous week" @click="$emit('prev')">
      <component :is="I.chevL" />
    </button>
    <div class="week-pick-body">
      <div>
        <div class="week-pick-id">Week {{ week.week_id }}</div>
        <div class="week-pick-dates">{{ fmtDate(week.week_start) }} → {{ fmtDate(week.week_end) }}</div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px">
        <span class="week-status" :data-status="week.status">{{
          week.status === 'active' ? 'current' : week.status
        }}</span>
        <span v-if="countdown !== null" class="week-countdown" :data-urgent="daysLeft <= 1">
          {{ countdown }}
        </span>
      </div>
    </div>
    <button type="button" aria-label="Next week" title="Next week" @click="$emit('next')">
      <component :is="I.chevR" />
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { I } from './format.js';

const props = defineProps({
  week: { type: Object, required: true },
  fmtDate: { type: Function, required: true },
});
defineEmits(['prev', 'next']);

const daysLeft = computed(() => {
  const end = new Date(props.week.week_end);
  end.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((end - today) / 86400000);
});

const countdown = computed(() => {
  const status = props.week.status;
  if (status === 'locked' || status === 'archived') return null;
  const d = daysLeft.value;
  if (d < 0) return `ended ${-d}d ago`;
  if (d === 0) return 'last day';
  if (d === 1) return '1 day left';
  return `${d} days left`;
});
</script>

<style scoped>
.week-countdown {
  font-size: 11px;
  color: var(--ink-3);
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 1px 8px;
  white-space: nowrap;
}
.week-countdown[data-urgent='true'] {
  color: var(--amber, #d97706);
  background: color-mix(in srgb, var(--amber, #d97706) 10%, var(--surface));
  border-color: color-mix(in srgb, var(--amber, #d97706) 30%, transparent);
}
</style>
