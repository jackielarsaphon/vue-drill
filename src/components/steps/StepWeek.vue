<template>
  <Card title="Week header" sub="One row per LXML weekly plan.">
    <div class="form-grid" style="max-width: 880px">
      <Field label="Week ID" :hint="`Suggested next: ${nextWeekId}`">
        <input
          class="mono"
          type="number"
          min="1"
          :value="week.week_id"
          :disabled="headerLocked"
          @change="updateWeekId($event.target.value)"
        />
      </Field>
      <Field label="Week start">
        <input type="date" :value="dateInput(week.week_start)" :disabled="headerLocked" @input="updateWeekDate('week_start', $event.target.value)" />
      </Field>
      <Field label="Week end">
        <input type="date" :value="dateInput(week.week_end)" :disabled="headerLocked" @input="updateWeekDate('week_end', $event.target.value)" />
      </Field>
      <Field label="Plan source">
        <select :value="week.plan_source || 'LXML'" :disabled="headerLocked" @change="updatePlanSource($event.target.value)">
          <option>LXML</option>
          <option>TDL Internal</option>
          <option>Carryover only</option>
        </select>
      </Field>
    </div>
    <p
      v-if="flash"
      class="mono"
      style="margin: 12px 0 0; padding: 8px 12px; font-size: 12px; color: var(--ink); background: var(--accent-soft); border-radius: var(--radius)"
    >
      {{ flash }}
    </p>
    <div class="hr" />
    <div class="foot-hint">
      <span>Required: week ID, dates. Saved as <span class="kbd">draft</span> until you advance.</span>
      <div class="week-actions">
        <button type="button" class="btn" @click="createWeek">Create next week</button>
        <button type="button" class="btn" data-variant="ghost" :disabled="!canDeleteWeek" @click="deleteWeek">Delete week</button>
        <button type="button" class="btn" data-variant="primary" :disabled="saving" @click="continueToPatterns">
          {{ saving ? 'Saving…' : 'Continue to patterns →' }}
        </button>
      </div>
    </div>
  </Card>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useWeeksStore } from '../../stores/Weeks.stores.ts';
import Card from '../Card.vue';
import Field from '../Field.vue';

const emit = defineEmits(['next', 'create-week', 'delete-week']);

const props = defineProps({
  week: { type: Object, required: true },
  canDeleteWeek: { type: Boolean, default: false },
});

const weeksStore = useWeeksStore();
const flash = ref('');
const saving = ref(false);
const headerLocked = computed(() => Boolean(props.week.header_locked));
const nextWeekId = computed(() => {
  const max = weeksStore.weeks.reduce((m, w) => Math.max(m, w.week_id), 0);
  return max + 1;
});

async function updateWeekId(value) {
  const newId = parseInt(value);
  if (isNaN(newId) || newId <= 0 || newId === props.week.week_id) return;
  const { error } = await weeksStore.update(props.week.week_id, { week_id: newId });
  if (error) flash.value = `Save failed: ${error.message}`;
}

async function updateWeekDate(field, value) {
  if (headerLocked.value) return;
  const next = parseDateInput(value);
  if (Number.isNaN(next.getTime())) return;
  const { error } = await weeksStore.update(props.week.week_id, { [field]: dateInput(next) });
  if (error) flash.value = `Save failed: ${error.message}`;
}

async function updatePlanSource(value) {
  if (headerLocked.value) return;
  const { error } = await weeksStore.update(props.week.week_id, { plan_source: value || 'LXML' });
  if (error) flash.value = `Save failed: ${error.message}`;
}

async function continueToPatterns() {
  saving.value = true;
  flash.value = '';
  const { error } = await weeksStore.update(props.week.week_id, { header_locked: true });
  saving.value = false;
  if (error) {
    flash.value = `Save failed: ${error.message}`;
    return;
  }
  emit('next');
}

function createWeek() {
  emit('create-week', { week: props.week });
  flash.value = 'Created next week.';
}

function deleteWeek() {
  if (!props.canDeleteWeek) {
    flash.value = 'Cannot delete the only week.';
    return;
  }
  emit('delete-week', { week: props.week });
}

function parseDateInput(value) {
  const match = String(value || '').match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);
  if (!match) return new Date(value);
  return new Date(+match[1], +match[2] - 1, +match[3]);
}

function dateInput(d) {
  if (!(d instanceof Date)) return String(d || '');
  if (Number.isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
</script>

<style scoped>
.week-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
