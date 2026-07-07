<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">Plan Daily</h1>
        <p class="page-sub">Enter the planned daily totals for the week — independent of the per-pattern plan.</p>
      </div>
      <div class="daily-plan-actions">
        <button type="button" class="btn" :disabled="refreshing" @click="reload">
          <span class="ic"><component :is="I.refresh" /></span>
          {{ refreshing ? 'กำลังดึง…' : 'ดึงข้อมูลใหม่' }}
        </button>
        <button type="button" class="btn" data-variant="primary" :disabled="dailyTargetsStore.saving" @click="save">
          <span class="ic"><component :is="I.save" /></span>
          {{ dailyTargetsStore.saving ? 'Saving…' : 'Save daily plan' }}
        </button>
      </div>
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
        <div class="daily-plan-addpit">
          <div class="filter-sel daily-plan-newpit">
            <span class="filter-sel-key">New pit</span>
            <input
              v-model="newPitName"
              class="mono daily-plan-newpit-input"
              placeholder="e.g. NLU04"
              @keyup.enter="addPit"
            />
          </div>
          <button type="button" class="btn" data-size="sm" data-variant="primary" @click="addPit">
            <span class="ic"><component :is="I.plus" /></span>Add pit
          </button>
          <span class="daily-plan-addpit-hint">บ่อจาก Blast patterns จะขึ้นเป็นแท็บอัตโนมัติ · เพิ่มบ่อพิเศษเฉพาะหน้านี้ได้ที่นี่</span>
        </div>

        <div v-if="pits.length" class="pit-tabs">
          <button
            v-for="p in pits"
            :key="p"
            type="button"
            class="pit-tab"
            :data-active="p === activePit ? 'true' : undefined"
            @click="activePit = p"
          >
            {{ pitLabel(p) }} <span class="count">{{ pitDayCount(p) }}</span>
          </button>
        </div>

        <div v-if="!pits.length" class="daily-plan-empty">
          ยังไม่มีบ่อ — ดึงจาก Blast patterns ของสัปดาห์นี้ หรือกด Add pit เพื่อเพิ่มบ่อเฉพาะหน้านี้
        </div>

        <div v-else class="daily-plan-pit-panel">
          <div class="daily-plan-panel-head">
            <span class="daily-plan-pit-label mono">{{ pitLabel(activePit) }}</span>
            <button
              v-if="!isPatternPit(activePit)"
              type="button"
              class="daily-plan-remove-btn"
              title="Remove this pit from the daily plan"
              @click="removePit(activePit)"
            >
              <span class="ic"><component :is="I.x" /></span>ลบบ่อ
            </button>
          </div>

          <div class="daily-plan-hscroll">
            <table class="tbl daily-plan-h-tbl">
              <thead>
                <tr>
                  <th class="daily-plan-metric-th">Metric</th>
                  <th v-for="d in weekDays" :key="d.iso" class="r daily-plan-day-th">
                    <span class="daily-plan-dow">{{ d.dow }}</span>
                    <span class="daily-plan-dm">{{ d.dm }}</span>
                  </th>
                  <th class="r daily-plan-total-th">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="daily-plan-metric">Drilling metres</td>
                  <td v-for="d in weekDays" :key="d.iso" class="num r daily-plan-day-col">
                    <input
                      class="mono edit-cell daily-plan-cell r"
                      :value="getValue('drilling_m', activePit, d.iso)"
                      placeholder="—"
                      @change="setValue('drilling_m', activePit, d.iso, $event.target.value)"
                    />
                  </td>
                  <td class="num r daily-plan-total-col">
                    <strong>{{ pitTotal('drilling_m', activePit) > 0 ? commaNumber(pitTotal('drilling_m', activePit)) : '—' }}</strong>
                  </td>
                </tr>
                <tr>
                  <td class="daily-plan-metric">Blast vol (bcm)</td>
                  <td v-for="d in weekDays" :key="d.iso" class="num r daily-plan-day-col">
                    <input
                      class="mono edit-cell daily-plan-cell r"
                      :value="getValue('blast_vol_bcm', activePit, d.iso)"
                      placeholder="—"
                      @change="setValue('blast_vol_bcm', activePit, d.iso, $event.target.value)"
                    />
                  </td>
                  <td class="num r daily-plan-total-col">
                    <strong>{{ pitTotal('blast_vol_bcm', activePit) > 0 ? commaNumber(pitTotal('blast_vol_bcm', activePit)) : '—' }}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="daily-plan-grandbar">
          <span class="daily-plan-grand-label">Total · {{ pits.length }} บ่อ</span>
          <span class="mono daily-plan-grand-val">
            {{ grandTotal('drilling_m') > 0 ? commaNumber(grandTotal('drilling_m')) : '—' }} m ·
            {{ grandTotal('blast_vol_bcm') > 0 ? commaNumber(grandTotal('blast_vol_bcm')) : '—' }} bcm
          </span>
        </div>
      </div>

      <div style="padding: 16px; display: flex; justify-content: flex-end; border-top: 1px solid var(--line)">
        <button type="button" class="btn" data-variant="primary" :disabled="dailyTargetsStore.saving" @click="save">
          {{ dailyTargetsStore.saving ? 'Saving…' : 'Save daily plan' }}
        </button>
      </div>
    </Card>

    <template v-if="weekDays.length">
      <Card :pad="false" style="margin-top: 12px">
        <PlanVsActualChart
          title="Drill Metre Plan vs Actual"
          y-name="metres"
          :labels="chartLabels"
          :plan="planDrill"
          :actual="actualDrillByDay"
          bar-color="#e8533a"
          plan-color="#2f4ad0"
        />
      </Card>

      <Card :pad="false" style="margin-top: 12px">
        <PlanVsActualChart
          title="Blast Volume Plan vs Actual (bcm)"
          y-name="BCM"
          :labels="chartLabels"
          :plan="planBlast"
          :actual="actualBlastByDay"
          bar-color="#f08a24"
          plan-color="#2f4ad0"
        />
      </Card>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import { I } from '../components/format.js';
import Card from '../components/Card.vue';
import PlanVsActualChart from '../components/dashboard/PlanVsActualChart.vue';
import { useDailyTargetsStore } from '../stores/DailyTargets.stores.ts';
import { useDrillLogStore } from '../stores/DrillLog.stores.ts';
import { usePatternsStore } from '../stores/Patterns.stores.ts';

const props = defineProps({
  week: { type: Object, required: true },
});

const dailyTargetsStore = useDailyTargetsStore();
const { targets } = storeToRefs(dailyTargetsStore);

const drillLogStore = useDrillLogStore();
const { drillLog } = storeToRefs(drillLogStore);

const patternsStore = usePatternsStore();
const { patterns, pitNames } = storeToRefs(patternsStore);

const flash = ref('');
const refreshing = ref(false);

// Per-pit daily plan. valueMap keyed `${metric}__${pit}__${iso}`.
const valueMap = ref({});
// Pits that already have saved daily-plan rows (kept as tabs even if their pattern was later removed).
const loadedPits = ref([]);
// Pits added directly on this page (extra to the Blast-pattern pits), and pits hidden this session.
const manualPits = ref([]);
const removedPits = ref([]);
const newPitName = ref('');
const activePit = ref('');   // currently selected pit tab

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

function pitKey(pit) {
  return String(pit ?? '').trim();
}

function parseCell(value) {
  const parsed = Number(String(value || '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? Math.max(0, +parsed.toFixed(1)) : 0;
}

function valueKey(metric, pit, iso) {
  return `${metric}__${pitKey(pit)}__${iso}`;
}

function pitLabel(pit) {
  return pitKey(pit) || '(ไม่ระบุบ่อ)';
}

function mergePits(sources) {
  const out = [];
  for (const src of sources) {
    for (const p of src || []) {
      const k = pitKey(p);
      // Keep '' too: it is the legacy "no pit" bucket (aggregate plan saved before
      // the per-pit split) — showing it as a "(ไม่ระบุบ่อ)" tab keeps this page and
      // the dashboards consistent, and lets the user clear or reassign that data.
      if (!out.includes(k)) out.push(k);
    }
  }
  return out;
}

// Pit tabs come from this week's Blast patterns, plus any pit that already has saved
// daily-plan data, plus pits added directly on this page — minus any hidden this session.
const pits = computed(() => {
  const merged = mergePits([pitNames.value, loadedPits.value, manualPits.value]);
  return removedPits.value.length ? merged.filter((p) => !removedPits.value.includes(p)) : merged;
});

// Pattern pits are defined on the Patterns page, so they are not removable here.
function isPatternPit(pit) {
  return pitNames.value.includes(pitKey(pit));
}

function addPit() {
  const name = pitKey(newPitName.value);
  newPitName.value = '';
  if (!name) return;
  removedPits.value = removedPits.value.filter((p) => p !== name);
  if (!manualPits.value.includes(name)) manualPits.value.push(name);
  activePit.value = name;
}

function removePit(pit) {
  if (isPatternPit(pit)) return;
  const idx = pits.value.indexOf(pit);
  manualPits.value = manualPits.value.filter((p) => p !== pit);
  if (!removedPits.value.includes(pit)) removedPits.value.push(pit);
  for (const d of weekDays.value) {
    delete valueMap.value[valueKey('drilling_m', pit, d.iso)];
    delete valueMap.value[valueKey('blast_vol_bcm', pit, d.iso)];
  }
  if (activePit.value === pit) {
    activePit.value = pits.value[Math.min(idx, pits.value.length - 1)] || '';
  }
}

function getValue(metric, pit, iso) {
  const v = valueMap.value[valueKey(metric, pit, iso)];
  return Number(v) > 0 ? commaNumber(v) : '';
}

function setValue(metric, pit, iso, value) {
  valueMap.value[valueKey(metric, pit, iso)] = parseCell(value);
}

// Days with any plan value for a pit — shown as the tab count badge.
function pitDayCount(pit) {
  return weekDays.value.reduce((n, d) => {
    const drill = Number(valueMap.value[valueKey('drilling_m', pit, d.iso)]) || 0;
    const blast = Number(valueMap.value[valueKey('blast_vol_bcm', pit, d.iso)]) || 0;
    return n + (drill > 0 || blast > 0 ? 1 : 0);
  }, 0);
}

// Sum one pit's values for a metric across the week.
function pitTotal(metric, pit) {
  return +weekDays.value
    .reduce((sum, d) => sum + (Number(valueMap.value[valueKey(metric, pit, d.iso)]) || 0), 0)
    .toFixed(1);
}

// Sum a metric across every pit (grand total).
function grandTotal(metric) {
  return +pits.value.reduce((sum, pit) => sum + pitTotal(metric, pit), 0).toFixed(1);
}

// Sum one metric across all pits for a single day (for the charts).
function dayTotal(metric, iso) {
  return +pits.value
    .reduce((sum, pit) => sum + (Number(valueMap.value[valueKey(metric, pit, iso)]) || 0), 0)
    .toFixed(1);
}

// Keep the active tab valid as pits (patterns) load/change.
watch(
  pits,
  (list) => {
    if (!activePit.value || !list.includes(activePit.value)) {
      activePit.value = list[0] || '';
    }
  },
  { immediate: true },
);

// ── chart data ────────────────────────────────────────────────────────────
const chartLabels = computed(() => weekDays.value.map((d) => `${d.dow}\n${d.dm}`));

// Charts plot the daily plan totalled across all pits.
const planDrill = computed(() => weekDays.value.map((d) => dayTotal('drilling_m', d.iso)));
const planBlast = computed(() => weekDays.value.map((d) => dayTotal('blast_vol_bcm', d.iso)));

const actualDrillByDay = computed(() => {
  const map = {};
  for (const e of drillLog.value) {
    if (Number(e.week_id) !== Number(props.week?.week_id)) continue;
    const iso = isoDay(e.work_date);
    if (!iso) continue;
    map[iso] = (map[iso] || 0) + Number(e.total_drilling_m || 0);
  }
  return weekDays.value.map((d) => +(map[d.iso] || 0).toFixed(1));
});

const actualBlastByDay = computed(() => {
  const map = {};
  for (const p of patterns.value) {
    if (Number(p.week_id) !== Number(props.week?.week_id)) continue;
    if (!p.blast_td_updated) continue;
    const iso = isoDay(p.actual_blast_date);
    if (!iso) continue;
    map[iso] = (map[iso] || 0) + Number(p.actual_blast_vol_bcm || 0);
  }
  return weekDays.value.map((d) => +(map[d.iso] || 0).toFixed(1));
});

function populateValueMap() {
  const m = {};
  const found = [];
  for (const r of targets.value) {
    const iso = isoDay(r.plan_date);
    if (!iso) continue;
    const pit = pitKey(r.pit_name);
    m[valueKey('drilling_m', pit, iso)] = Number(r.drilling_m) || 0;
    m[valueKey('blast_vol_bcm', pit, iso)] = Number(r.blast_vol_bcm) || 0;
    if (!found.includes(pit)) found.push(pit);
  }
  valueMap.value = m;
  loadedPits.value = found.slice();
}

watch(targets, populateValueMap, { immediate: true });

// Re-pull the current week: pits from Blast patterns + the latest saved daily plan.
// (Also refreshes the actual drilling/blast used by the charts.)
async function reload() {
  const id = Number(props.week?.week_id);
  if (props.week?.week_id == null || Number.isNaN(id)) return;
  refreshing.value = true;
  try {
    await Promise.all([
      dailyTargetsStore.loadByWeek(id),
      drillLogStore.loadByWeek(id),
      patternsStore.loadByWeek(id),
    ]);
  } finally {
    refreshing.value = false;
  }
}

watch(
  () => props.week?.week_id,
  async (weekId) => {
    const id = Number(weekId);
    if (weekId == null || Number.isNaN(id)) return;
    // Page-local pit edits don't carry across weeks.
    manualPits.value = [];
    removedPits.value = [];
    await reload();
  },
  { immediate: true },
);

async function save() {
  const weekId = props.week?.week_id;
  if (weekId == null) return;
  // Include pits that were loaded but since removed so saveMany deletes their (now-empty) rows.
  const savePits = Array.from(new Set([...pits.value, ...loadedPits.value].map(pitKey)));
  const rowsToSave = [];
  for (const pit of savePits) {
    for (const d of weekDays.value) {
      rowsToSave.push({
        week_id: weekId,
        plan_date: d.iso,
        pit_name: pit,
        drilling_m: Number(valueMap.value[valueKey('drilling_m', pit, d.iso)]) || 0,
        blast_vol_bcm: Number(valueMap.value[valueKey('blast_vol_bcm', pit, d.iso)]) || 0,
      });
    }
  }
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

.daily-plan-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
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

.daily-plan-addpit {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 0 0 12px;
}

.daily-plan-newpit {
  width: 220px;
}

.daily-plan-newpit-input {
  border: 0;
  background: transparent;
  flex: 1;
  min-width: 0;
  font-size: 12px;
}

.daily-plan-addpit-hint {
  font-size: 11px;
  color: var(--ink-3);
}

.pit-tabs {
  margin-bottom: 12px;
}

.daily-plan-empty {
  padding: 18px 4px;
  color: var(--ink-3);
  font-size: 12px;
}

.daily-plan-remove-btn {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  font-size: 11px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: transparent;
  color: var(--ink-3);
  cursor: pointer;
}

.daily-plan-remove-btn:hover {
  color: var(--red, #c00);
  border-color: var(--red, #c00);
}

/* Panel for the currently selected pit tab. */
.daily-plan-pit-panel {
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
  margin-bottom: 14px;
}

.daily-plan-panel-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--accent-soft);
  border-bottom: 1px solid var(--line);
}

.daily-plan-pit-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--ink);
}

/* Horizontal layout: days across columns, metrics down rows. */
.daily-plan-hscroll {
  overflow-x: auto;
}

.daily-plan-h-tbl {
  min-width: 640px;
}

.daily-plan-metric-th {
  min-width: 150px;
}

.daily-plan-metric {
  white-space: nowrap;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink);
}

.daily-plan-day-th {
  white-space: nowrap;
  border-left: 1px solid var(--line);
}

.daily-plan-day-col {
  border-left: 1px solid var(--line);
}

.daily-plan-total-th,
.daily-plan-total-col {
  border-left: 2px solid var(--line);
  white-space: nowrap;
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

.daily-plan-cell {
  width: 72px;
}

.daily-plan-grandbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface-2, var(--accent-soft));
}

.daily-plan-grand-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--ink);
}

.daily-plan-grand-val {
  margin-left: auto;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 700;
  color: var(--ink);
}
</style>
