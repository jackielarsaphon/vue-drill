<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">Plan Daily</h1>
        <p class="page-sub">Enter the planned daily totals for the week — independent of the per-pattern plan.</p>
      </div>
      <button type="button" class="btn" data-variant="primary" :disabled="dailyTargetsStore.saving" @click="save">
        <span class="ic"><component :is="I.save" /></span>
        {{ dailyTargetsStore.saving ? 'Saving…' : 'Save daily plan' }}
      </button>
    </div>

    <Card
      :pad="false"
      title="Daily plan"
      :sub="`Week ${week?.week_id ?? '-'} · ${weekDays.length} days`"
    >
      <p
        v-if="flash"
        class="mono"
        style="margin: 10px 12px 0; padding: 8px 12px; font-size: 12px; color: var(--ink); background: var(--accent-soft); border-radius: var(--radius)"
      >
        {{ flash }}
      </p>

      <div v-if="!weekDays.length" style="padding: 18px 16px; color: var(--ink-3); font-size: 12px">
        This week has no valid date range (week_start / week_end).
      </div>

      <div v-else class="daily-plan-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th class="daily-plan-metric-th">Metric</th>
              <th v-for="d in weekDays" :key="d.iso" class="r daily-plan-th">
                <span class="daily-plan-dow">{{ d.dow }}</span>
                <span class="daily-plan-dm">{{ d.dm }}</span>
              </th>
              <th class="r daily-plan-total-th">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="daily-plan-metric">Total drilling metres per day</td>
              <td v-for="d in weekDays" :key="d.iso" class="num r daily-plan-col">
                <input
                  class="mono edit-cell daily-plan-cell r"
                  :value="getValue('drilling_m', d.iso)"
                  placeholder="—"
                  @change="setValue('drilling_m', d.iso, $event.target.value)"
                />
              </td>
              <td class="num r daily-plan-total-col"><strong>{{ rowTotal('drilling_m') > 0 ? commaNumber(rowTotal('drilling_m')) : '—' }}</strong></td>
            </tr>
            <tr>
              <td class="daily-plan-metric">Total blast volumes per day (bcm)</td>
              <td v-for="d in weekDays" :key="d.iso" class="num r daily-plan-col">
                <input
                  class="mono edit-cell daily-plan-cell r"
                  :value="getValue('blast_vol_bcm', d.iso)"
                  placeholder="—"
                  @change="setValue('blast_vol_bcm', d.iso, $event.target.value)"
                />
              </td>
              <td class="num r daily-plan-total-col"><strong>{{ rowTotal('blast_vol_bcm') > 0 ? commaNumber(rowTotal('blast_vol_bcm')) : '—' }}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="padding: 16px; display: flex; justify-content: flex-end; border-top: 1px solid var(--line)">
        <button type="button" class="btn" data-variant="primary" :disabled="dailyTargetsStore.saving" @click="save">
          {{ dailyTargetsStore.saving ? 'Saving…' : 'Save daily plan' }}
        </button>
      </div>
    </Card>
  </div>
</template>

<script setup>
import { computed, ref, watch, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import { I } from '../components/format.js';
import Card from '../components/Card.vue';
import { useDailyTargetsStore } from '../stores/DailyTargets.stores.ts';

const props = defineProps({
  week: { type: Object, required: true },
});

const dailyTargetsStore = useDailyTargetsStore();
const { targets } = storeToRefs(dailyTargetsStore);

const flash = ref('');

// Map of `${metric}__${YYYY-MM-DD}` -> planned value for that single day.
const valueMap = ref({});

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isoDay(value) {
  if (!value) return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  return String(value).slice(0, 10);
}

const weekDays = computed(() => {
  const start = isoDay(props.week?.week_start);
  const end = isoDay(props.week?.week_end);
  if (!start || !end) return [];
  const out = [];
  const cur = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  let guard = 0;
  while (cur.getTime() <= last.getTime() && guard < 31) {
    out.push({
      iso: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`,
      dow: DOW[cur.getDay()],
      dm: `${cur.getDate()}/${cur.getMonth() + 1}`,
    });
    cur.setDate(cur.getDate() + 1);
    guard += 1;
  }
  return out;
});

function commaNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString('en-US') : '';
}

function valueKey(metric, iso) {
  return `${metric}__${iso}`;
}

function getValue(metric, iso) {
  const v = valueMap.value[valueKey(metric, iso)];
  return Number(v) > 0 ? commaNumber(v) : '';
}

function setValue(metric, iso, value) {
  const parsed = Number(String(value || '').replace(/,/g, ''));
  valueMap.value[valueKey(metric, iso)] = Number.isFinite(parsed) ? Math.max(0, +parsed.toFixed(1)) : 0;
}

function rowTotal(metric) {
  return +weekDays.value
    .reduce((sum, d) => sum + (Number(valueMap.value[valueKey(metric, d.iso)]) || 0), 0)
    .toFixed(1);
}

function populateValueMap() {
  const m = {};
  for (const r of targets.value) {
    const iso = isoDay(r.plan_date);
    if (!iso) continue;
    m[valueKey('drilling_m', iso)] = Number(r.drilling_m) || 0;
    m[valueKey('blast_vol_bcm', iso)] = Number(r.blast_vol_bcm) || 0;
  }
  valueMap.value = m;
}

watch(targets, populateValueMap, { immediate: true });

watch(
  () => props.week?.week_id,
  async (weekId) => {
    const id = Number(weekId);
    if (weekId == null || Number.isNaN(id)) return;
    await dailyTargetsStore.loadByWeek(id);
  },
  { immediate: true },
);

async function save() {
  const weekId = props.week?.week_id;
  if (weekId == null) return;
  const rowsToSave = weekDays.value.map((d) => ({
    week_id: weekId,
    plan_date: d.iso,
    drilling_m: Number(valueMap.value[valueKey('drilling_m', d.iso)]) || 0,
    blast_vol_bcm: Number(valueMap.value[valueKey('blast_vol_bcm', d.iso)]) || 0,
  }));
  const { error } = await dailyTargetsStore.saveMany(rowsToSave, weekId);
  if (error) {
    const detail = [error.message, error.details, error.hint, error.code].filter(Boolean).join(' | ');
    flash.value = `Save failed: ${detail || String(error)}`;
    return;
  }
  flash.value = 'Daily plan saved.';
  clearFlash(4000);
}

let flashTimer;
function clearFlash(delay) {
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { flash.value = ''; }, delay);
}
onUnmounted(() => clearTimeout(flashTimer));
</script>

<style scoped>
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.daily-plan-wrap {
  padding: 4px 0 0;
  overflow-x: auto;
}

.edit-cell {
  height: 26px;
  padding: 0 8px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--ink);
  font-size: 12px;
}

.edit-cell.r {
  text-align: right;
}

.edit-cell:focus {
  outline: none;
  border-color: var(--accent);
  background: var(--surface);
}

.daily-plan-metric-th {
  min-width: 230px;
}

.daily-plan-metric {
  white-space: nowrap;
  font-size: 12px;
  color: var(--ink);
}

.daily-plan-th {
  white-space: nowrap;
  border-left: 1px solid var(--line);
}

.daily-plan-dow {
  display: block;
  font-size: 11px;
  color: var(--ink-3);
  font-weight: 600;
}

.daily-plan-dm {
  display: block;
  font-size: 10px;
  color: var(--ink-4);
}

.daily-plan-col {
  border-left: 1px solid var(--line);
}

.daily-plan-cell {
  width: 72px;
}

.daily-plan-total-th,
.daily-plan-total-col {
  border-left: 2px solid var(--line);
  white-space: nowrap;
}
</style>
