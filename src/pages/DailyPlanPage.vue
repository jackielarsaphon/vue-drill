<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">Plan Daily</h1>
        <p class="page-sub">กรอกแผนการเจาะรายวันของแต่ละ pattern ตามวันในสัปดาห์ (แยกอิสระจาก Plan m รวม)</p>
      </div>
      <button type="button" class="btn" data-variant="primary" :disabled="dailyPlanStore.saving" @click="save">
        <span class="ic"><component :is="I.save" /></span>
        {{ dailyPlanStore.saving ? 'Saving…' : 'Save daily plan' }}
      </button>
    </div>

    <Card
      :pad="false"
      title="Daily plan"
      :sub="`Week ${week?.week_id ?? '-'} · ${weekDays.length} days · ${pitNames.length} pits`"
    >
      <p
        v-if="flash"
        class="mono"
        style="margin: 10px 12px 0; padding: 8px 12px; font-size: 12px; color: var(--ink); background: var(--accent-soft); border-radius: var(--radius)"
      >
        {{ flash }}
      </p>

      <div class="pit-tabs" style="border-top: 0">
        <button
          v-for="p in pitNames"
          :key="p"
          type="button"
          class="pit-tab"
          :data-active="p === pit ? 'true' : undefined"
          @click="pit = p"
        >
          {{ p }} <span class="count">{{ (byPit[p] || []).length }}</span>
        </button>
      </div>

      <div v-if="!weekDays.length" style="padding: 18px 16px; color: var(--ink-3); font-size: 12px">
        สัปดาห์นี้ไม่มีช่วงวันที่ (week_start / week_end) ที่ใช้ได้
      </div>
      <div v-else-if="!pitNames.length" style="padding: 18px 16px; color: var(--ink-3); font-size: 12px">
        ยังไม่มี pattern ในสัปดาห์นี้ — เพิ่มที่หน้า Data Entry ก่อน
      </div>

      <div v-else class="daily-plan-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th style="width: 30px" class="c">#</th>
              <th>Pattern ID</th>
              <th class="r">Plan m</th>
              <th v-for="d in weekDays" :key="d.iso" class="r daily-plan-th">
                <span class="daily-plan-dow">{{ d.dow }}</span>
                <span class="daily-plan-dm">{{ d.dm }}</span>
              </th>
              <th class="r daily-plan-total-th">รวม/วัน</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in rows" :key="p.pattern_id">
              <td class="c"><span class="mono dim">{{ p.pit_priority === 0 ? 'C' : p.pit_priority }}</span></td>
              <td><span class="mono" style="font-size: 12px">{{ p.pattern_id }}</span></td>
              <td class="num r dim">{{ commaNumber(p.plan_total_drilling_m) }}</td>
              <td v-for="d in weekDays" :key="d.iso" class="num r daily-plan-col">
                <input
                  class="mono edit-cell daily-plan-cell r"
                  :value="getDaily(p, d.iso)"
                  placeholder="—"
                  @change="setDaily(p, d.iso, $event.target.value)"
                />
              </td>
              <td class="num r daily-plan-total-col">
                <strong>{{ rowTotal(p) > 0 ? commaNumber(rowTotal(p)) : '—' }}</strong>
              </td>
            </tr>
            <tr class="daily-plan-foot-row">
              <td class="c" />
              <td style="color: var(--ink-3); font-size: 12px">รวมทั้งบ่อ</td>
              <td class="num r dim">{{ commaNumber(pitPlanTotal) }}</td>
              <td v-for="d in weekDays" :key="d.iso" class="num r daily-plan-col">
                <strong>{{ colTotal(d.iso) > 0 ? commaNumber(colTotal(d.iso)) : '—' }}</strong>
              </td>
              <td class="num r daily-plan-total-col"><strong>{{ pitDailyTotal > 0 ? commaNumber(pitDailyTotal) : '—' }}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="padding: 16px; display: flex; justify-content: flex-end; border-top: 1px solid var(--line)">
        <button type="button" class="btn" data-variant="primary" :disabled="dailyPlanStore.saving" @click="save">
          {{ dailyPlanStore.saving ? 'Saving…' : 'Save daily plan' }}
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
import { usePatternsStore } from '../stores/Patterns.stores.ts';
import { useDailyPlanStore } from '../stores/DailyPlan.stores.ts';

const props = defineProps({
  week: { type: Object, required: true },
});

const patternsStore = usePatternsStore();
const { patterns, pitNames } = storeToRefs(patternsStore);

const dailyPlanStore = useDailyPlanStore();
const { dailyPlans } = storeToRefs(dailyPlanStore);

const pit = ref('');
const flash = ref('');

// Map of `${pattern_id}__${YYYY-MM-DD}` -> planned metres for that single day.
const dailyMap = ref({});

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

const weekPatterns = computed(() =>
  patterns.value
    .filter((p) => Number(p.week_id) === Number(props.week?.week_id))
    .sort((a, b) => a.pit_name.localeCompare(b.pit_name) || Number(a.pit_priority || 0) - Number(b.pit_priority || 0) || a.pattern_id.localeCompare(b.pattern_id)),
);

const byPit = computed(() => {
  const out = {};
  for (const p of weekPatterns.value) {
    if (!out[p.pit_name]) out[p.pit_name] = [];
    out[p.pit_name].push(p);
  }
  return out;
});

const rows = computed(() => byPit.value[pit.value] || []);

function commaNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString('en-US') : '';
}

function dailyKey(patternId, iso) {
  return `${patternId}__${iso}`;
}

function getDaily(p, iso) {
  const v = dailyMap.value[dailyKey(p.pattern_id, iso)];
  return Number(v) > 0 ? commaNumber(v) : '';
}

function setDaily(p, iso, value) {
  const parsed = Number(String(value || '').replace(/,/g, ''));
  dailyMap.value[dailyKey(p.pattern_id, iso)] = Number.isFinite(parsed) ? Math.max(0, +parsed.toFixed(1)) : 0;
}

function rowTotal(p) {
  return +weekDays.value
    .reduce((sum, d) => sum + (Number(dailyMap.value[dailyKey(p.pattern_id, d.iso)]) || 0), 0)
    .toFixed(1);
}

function colTotal(iso) {
  return +rows.value
    .reduce((sum, p) => sum + (Number(dailyMap.value[dailyKey(p.pattern_id, iso)]) || 0), 0)
    .toFixed(1);
}

const pitPlanTotal = computed(() =>
  +rows.value.reduce((sum, p) => sum + Number(p.plan_total_drilling_m || 0), 0).toFixed(1),
);

const pitDailyTotal = computed(() =>
  +rows.value.reduce((sum, p) => sum + rowTotal(p), 0).toFixed(1),
);

function populateDailyMap() {
  const m = {};
  for (const r of dailyPlans.value) {
    const iso = isoDay(r.plan_date);
    if (!iso) continue;
    m[dailyKey(r.pattern_id, iso)] = Number(r.plan_m) || 0;
  }
  dailyMap.value = m;
}

watch(dailyPlans, populateDailyMap, { immediate: true });

watch(
  pitNames,
  (names) => {
    if (!names?.length) {
      pit.value = '';
      return;
    }
    if (!pit.value || !names.includes(pit.value)) pit.value = names[0];
  },
  { immediate: true },
);

watch(
  () => props.week?.week_id,
  async (weekId) => {
    const id = Number(weekId);
    if (weekId == null || Number.isNaN(id)) return;
    await patternsStore.loadByWeek(id);
    await dailyPlanStore.loadByWeek(id);
  },
  { immediate: true },
);

async function save() {
  const weekId = props.week?.week_id;
  if (weekId == null) return;
  const validIds = new Set(weekPatterns.value.map((p) => p.pattern_id));
  const validDays = new Set(weekDays.value.map((d) => d.iso));
  const rowsToSave = [];
  for (const key of Object.keys(dailyMap.value)) {
    const sep = key.lastIndexOf('__');
    if (sep < 0) continue;
    const patternId = key.slice(0, sep);
    const iso = key.slice(sep + 2);
    if (!validIds.has(patternId) || !validDays.has(iso)) continue;
    rowsToSave.push({ pattern_id: patternId, week_id: weekId, plan_date: iso, plan_m: Number(dailyMap.value[key]) || 0 });
  }
  const { error } = await dailyPlanStore.saveMany(rowsToSave, weekId);
  if (error) {
    const detail = [error.message, error.details, error.hint, error.code].filter(Boolean).join(' | ');
    flash.value = `บันทึกไม่สำเร็จ: ${detail || String(error)}`;
    return;
  }
  flash.value = 'บันทึกแผนรายวันแล้ว';
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
  width: 64px;
}

.daily-plan-total-th,
.daily-plan-total-col {
  border-left: 2px solid var(--line);
  white-space: nowrap;
}

.daily-plan-foot-row td {
  border-top: 2px solid var(--line);
  background: var(--surface-2);
}
</style>
