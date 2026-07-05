<template>
  <div class="daily-progress-shell">
    <div class="daily-main-grid">
      <div class="daily-pit-sidebar">
        <div class="daily-pit-search">
          <span class="ic"><component :is="I.search" /></span>
          <input v-model="pitQuery" placeholder="Filter patterns..." />
        </div>
        <button
          v-for="group in filteredPitGroups"
          :key="group.pit"
          type="button"
          class="daily-pit-row"
          :data-active="group.pit === blastPit ? 'true' : undefined"
          @click="blastPit = group.pit"
        >
          <span class="ic"><component :is="I.chevR" /></span>
          <span class="daily-pit-name">{{ group.pit }}</span>
          <span class="daily-pit-count">{{ group.count }}</span>
          <span class="daily-pit-pct num">{{ Math.round(group.progress) }}%</span>
        </button>
      </div>

      <div class="daily-content-stack">
        <Card
          :pad="false"
          title="Blast patterns"
          sub="Switch pits to review LXML page-by-page. Pattern balance updates from Drill log."
        >
          <template #action>
            <div class="daily-date-range">
              <div class="dmy-wrap daily-history-date">
                <input v-model="startDateText" class="mono" placeholder="DD/MM/YYYY" maxlength="10" @blur="onStartBlur" @keydown.enter.prevent="onStartBlur" />
                <span class="dmy-cal">
                  <input type="date" :value="historyStartDate" class="dmy-native" @change="e => onNativeStart(e.target.value)" />
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </span>
              </div>
              <span>to</span>
              <div class="dmy-wrap daily-history-date">
                <input v-model="endDateText" class="mono" placeholder="DD/MM/YYYY" maxlength="10" @blur="onEndBlur" @keydown.enter.prevent="onEndBlur" />
                <span class="dmy-cal">
                  <input type="date" :value="historyEndDate" class="dmy-native" @change="e => onNativeEnd(e.target.value)" />
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </span>
              </div>
            </div>
          </template>

        <div class="daily-table-wrap">
          <table class="tbl daily-pattern-table">
            <thead>
              <tr>
                <th style="width: 30px" class="c">#</th>
                <th>Pattern ID</th>
                <th class="c">Drilled %</th>
                <th class="c">Type</th>
                <th class="c">RL</th>
                <th class="r">Bench</th>
                <th class="r">Holes</th>
                <th class="r">Bit dia</th>
                <th class="r">Plan m</th>
                <th class="r">Remain</th>
                <th class="r">Vol bcm</th>
                <th class="c">Blast Date LXML</th>
                <th class="c">Blast Date TD</th>
                <th class="c">Status</th>
                <th style="width: 40px" />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in blastRows"
                :key="row.pattern_id"
                class="daily-pattern-row"
                :data-active="row.pattern_id === selectedPatternId ? 'true' : undefined"
                @click="selectedPatternId = row.pattern_id"
              >
                <td class="c"><span class="mono dim">{{ row.pit_priority === 0 ? 'C' : row.pit_priority }}</span></td>
                <td><span class="mono">{{ row.pattern_id }}</span></td>
                <td class="num c">
                  <span :style="{
                    color: barStatus(row) === 'delayed' ? 'var(--red)'
                         : barStatus(row) === 'at-risk' ? 'var(--amber)'
                         : barStatus(row) === 'on-track' ? 'var(--green)'
                         : undefined,
                    fontWeight: progressPct(row) >= 100 ? 600 : undefined
                  }">{{ Math.round(progressPct(row)) }}%</span>
                </td>
                <td class="c"><span class="mono">{{ row.pattern_type }}</span></td>
                <td class="num c">{{ row.rl_level }}</td>
                <td class="num r">{{ fnum(row.bench_height_m, 1) }}</td>
                <td class="num r">{{ row.num_holes }}</td>
                <td class="num r">{{ row.hole_diameter_mm }}</td>
                <td class="num r">{{ fnum(row.plan_total_drilling_m, 1) }}</td>
                <td class="num r" :class="remainInfo(row).cls">{{ remainInfo(row).text }}</td>
                <td class="num r">{{ commaNumber(row.plan_blast_vol_bcm) }}</td>
                <td class="num c">
                  <span class="mono" style="font-size:11px;color:var(--ink-3)">
                    {{ row.planned_blast_date ? fmtShortDate(row.planned_blast_date) : '-' }}
                  </span>
                </td>
                <td class="num c">
                  <span class="mono" style="font-size:11px;color:var(--ink-3)">
                    {{ row.actual_blast_date ? fmtShortDate(row.actual_blast_date) : '-' }}
                  </span>
                </td>
                <td class="c">
                  <span class="daily-date-status" :data-status="patternStatus(row)">
                    {{ patternStatusLabel(row) }}
                  </span>
                </td>
                <td class="c"><span class="ic daily-muted"><component :is="I.x" /></span></td>
              </tr>
              <tr style="background: var(--surface-2)">
                <td class="c"><span class="dim">+</span></td>
                <td colspan="14" style="color: var(--ink-3)">
                  <span class="daily-add-row">
                    <span class="ic"><component :is="I.plus" /></span>
                    Add pattern to <span class="mono">{{ blastPit || '-' }}</span>
                    <span class="daily-format">Format: <span class="mono">PIT_RL_BENCH_SEQ_TYPE</span></span>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="daily-pattern-footer">
          <span class="foot-hint">Remain = Plan m − Drilled (all entries this week)</span>
        </div>
        </Card>

        <Card
          :pad="false"
          title="Daily entries for this pattern"
          :sub="selectedPattern ? `${selectedPattern.pit_name} - ${selectedPattern.pattern_type} - ${fmtShortDate(historyStartDate)} to ${fmtShortDate(historyEndDate)}` : 'Select a pattern above'"
        >
      <div v-if="selectedPattern" class="daily-selected-summary">
        <div class="daily-selected-head">
          <div>
            <h2 class="daily-selected-title">{{ selectedPattern.pattern_id }}</h2>
            <p class="daily-selected-sub">
              {{ selectedPattern.pit_name }} - {{ selectedPattern.pattern_type }} - {{ selectedPattern.num_holes }} holes
              - plan {{ fnum(selectedStats.plan, 1) }} m - remain after range {{ fnum(selectedStats.afterRemaining, 1) }} m
            </p>
          </div>
          <div class="daily-progress-head">
            <span>Progress</span>
            <strong class="num">{{ Math.round(selectedStats.progress) }}%</strong>
            <div class="daily-progress-bar">
              <Bar :pct="selectedStats.progress" :status="barStatus(selectedPattern)" />
            </div>
          </div>
        </div>

        <div class="daily-selected-stats">
          <div><span class="stat-label">Plan m</span><strong class="num">{{ fnum(selectedStats.plan, 1) }}</strong></div>
          <div><span class="stat-label">Remaining before</span><strong class="num">{{ fnum(selectedStats.beforeRemaining, 1) }}</strong></div>
          <div><span class="stat-label">Drilled in range</span><strong class="num">{{ fnum(selectedStats.rangeDrilled, 1) }}</strong></div>
          <div><span class="stat-label">Remaining after</span><strong class="num">{{ fnum(selectedStats.afterRemaining, 1) }}</strong></div>
        </div>
      </div>

      <div class="daily-table-wrap">
        <table class="tbl daily-recent-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Shift</th>
              <th>Rig</th>
              <th>Operator</th>
              <th class="r">Bit mm</th>
              <th class="r">Redrill</th>
              <th class="r">Net m</th>
              <th class="r">SMU h</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in selectedDayEntries" :key="entryKey(entry)">
              <td class="num">{{ fmtTableDate(entry.work_date) }}</td>
              <td>
                <span class="mono" :style="{ color: entry.shift === 'day' ? 'var(--ink)' : 'var(--ink-3)' }">
                  {{ entry.shift }}
                </span>
              </td>
              <td><span class="mono">{{ entry.rig_id }}</span></td>
              <td>{{ entry.employee_name }}</td>
              <td class="num r dim">{{ entry.drill_bit_size_mm ?? '—' }}</td>
              <td class="num r dim">{{ entry.redrill_m > 0 ? fnum(entry.redrill_m, 1) : '-' }}</td>
              <td class="num r"><strong>{{ fnum(entry.total_drilling_m, 1) }}</strong></td>
              <td class="num r">{{ fnum(entry.smu_hr, 1) }}</td>
            </tr>
            <tr v-if="!selectedDayEntries.length">
              <td colspan="8" class="daily-empty">No drill log entries for this pattern in this date range.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="daily-footer">
        <button type="button" class="btn" @click="$emit('back')">
          <span class="ic"><component :is="I.chevL" /></span>Back to drill log
        </button>
        <div class="daily-footer-right">
          <span class="foot-hint">Remain = effective metres - Drill log Net m</span>
        </div>
      </div>
        </Card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, watchEffect } from 'vue';
import { fmtDate, fmtDisplayDate, fnum, I } from './format.js';
import { storeToRefs } from 'pinia';
import { useDrillLogStore } from '../stores/DrillLog.stores.ts';
import { usePatternsStore } from '../stores/Patterns.stores.ts';
import Card from './Card.vue';
import Bar from './Bar.vue';

const TODAY = new Date();

const patternsStore = usePatternsStore();
const drillLogStore = useDrillLogStore();
const { patterns: patternList } = storeToRefs(patternsStore);
const { drillLog: drillLogEntries } = storeToRefs(drillLogStore);

defineEmits(['back']);

const props = defineProps({
  week: {
    type: Object,
    required: true,
  },
});

const blastPit = ref('');
const selectedPatternId = ref('');
const pitQuery = ref('');
const historyStartDate = ref(dateInput(TODAY));
const historyEndDate = ref(dateInput(TODAY));

function toDisplayDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${parseInt(d)}/${parseInt(m)}/${y}`;
}

function parseDisplayDate(text) {
  const parts = text.trim().split('/');
  if (parts.length !== 3) return '';
  const [d, m, y] = parts;
  const dd = String(parseInt(d || '0')).padStart(2, '0');
  const mm = String(parseInt(m || '0')).padStart(2, '0');
  const yyyy = y?.trim();
  if (dd === '00' || mm === '00' || !yyyy || yyyy.length !== 4) return '';
  return `${yyyy}-${mm}-${dd}`;
}

const startDateText = ref(toDisplayDate(dateInput(TODAY)));
const endDateText = ref(toDisplayDate(dateInput(TODAY)));

watch(historyStartDate, (val) => { startDateText.value = toDisplayDate(val); });
watch(historyEndDate,   (val) => { endDateText.value   = toDisplayDate(val); });

function onStartBlur() {
  const iso = parseDisplayDate(startDateText.value);
  if (iso) { historyStartDate.value = iso; startDateText.value = toDisplayDate(iso); }
  else startDateText.value = toDisplayDate(historyStartDate.value);
}
function onNativeStart(iso) { historyStartDate.value = iso; startDateText.value = toDisplayDate(iso); }

function onEndBlur() {
  const iso = parseDisplayDate(endDateText.value);
  if (iso) { historyEndDate.value = iso; endDateText.value = toDisplayDate(iso); }
  else endDateText.value = toDisplayDate(historyEndDate.value);
}
function onNativeEnd(iso) { historyEndDate.value = iso; endDateText.value = toDisplayDate(iso); }

const patterns = computed(() =>
  patternList.value
    .filter((p) => Number(p.week_id) === Number(props.week?.week_id))
    .sort((a, b) => a.pit_name.localeCompare(b.pit_name) || a.pattern_id.localeCompare(b.pattern_id)),
);
const pits = computed(() => [...new Set(patterns.value.map((p) => p.pit_name))].sort((a, b) => a.localeCompare(b)));
const blastRows = computed(() =>
  patterns.value
    .filter((p) => p.pit_name === blastPit.value)
    .sort((a, b) => Number(a.pit_priority || 0) - Number(b.pit_priority || 0) || a.pattern_id.localeCompare(b.pattern_id)),
);
const pitGroups = computed(() =>
  pits.value.map((pitName) => {
    const rows = patterns.value.filter((p) => p.pit_name === pitName);
    const plan = rows.reduce((sum, p) => sum + planMetres(p), 0);
    const actual = rows.reduce((sum, p) => sum + progressMetresAfterRange(p), 0);
    return {
      pit: pitName,
      count: rows.length,
      progress: plan > 0 ? Math.min(999, (actual / plan) * 100) : 0,
    };
  }),
);
const filteredPitGroups = computed(() => {
  const q = pitQuery.value.trim().toLowerCase();
  if (!q) return pitGroups.value;
  return pitGroups.value.filter((group) => group.pit.toLowerCase().includes(q));
});
const selectedPattern = computed(() => patterns.value.find((p) => p.pattern_id === selectedPatternId.value));
const selectedDayEntries = computed(() =>
  drillLogEntries.value
    .filter((entry) => Number(entry.week_id) === Number(props.week?.week_id) && entry.pattern_id === selectedPatternId.value && isInRange(entry.work_date))
    .sort((a, b) => {
      const dateDiff = new Date(a.work_date) - new Date(b.work_date);
      if (dateDiff) return dateDiff;
      if (a.shift !== b.shift) return a.shift === 'day' ? -1 : 1;
      return a.rig_id.localeCompare(b.rig_id);
    }),
);
const selectedStats = computed(() => {
  if (!selectedPattern.value) {
    return { plan: 0, beforeRemaining: 0, rangeDrilled: 0, afterRemaining: 0, progress: 0 };
  }

  const plan = planMetres(selectedPattern.value);
  const beforeDrilled = drillLogEntries.value
    .filter((entry) => Number(entry.week_id) === Number(props.week?.week_id) && entry.pattern_id === selectedPattern.value.pattern_id && isBeforeDay(entry.work_date, rangeStartDate.value))
    .reduce((sum, entry) => sum + totalMetres(entry), 0);
  const rangeDrilled = selectedDayEntries.value.reduce((sum, entry) => sum + totalMetres(entry), 0);
  const afterDrilled = beforeDrilled + rangeDrilled;
  const beforeRemaining = Math.max(0, plan - beforeDrilled);
  const afterRemaining = Math.max(0, plan - afterDrilled);

  return {
    plan,
    beforeRemaining: +beforeRemaining.toFixed(1),
    rangeDrilled: +rangeDrilled.toFixed(1),
    afterRemaining: +afterRemaining.toFixed(1),
    progress: plan > 0 ? Math.min(100, (afterDrilled / plan) * 100) : 0,
  };
});

function dateInput(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const rangeStartDate = computed(() => normalizeRangeDates().start);
const rangeEndDate = computed(() => normalizeRangeDates().end);

function normalizeRangeDates() {
  const start = new Date(historyStartDate.value);
  const end = new Date(historyEndDate.value);
  const fallback = new Date(TODAY);
  const safeStart = Number.isNaN(start.getTime()) ? fallback : start;
  const safeEnd = Number.isNaN(end.getTime()) ? safeStart : end;
  return safeStart <= safeEnd ? { start: safeStart, end: safeEnd } : { start: safeEnd, end: safeStart };
}

function isInRange(value) {
  const date = new Date(dateInput(value));
  return !Number.isNaN(date.getTime()) && date >= rangeStartDate.value && date <= rangeEndDate.value;
}

function isBeforeDay(a, b) {
  const left = new Date(dateInput(a));
  const right = new Date(dateInput(b));
  return !Number.isNaN(left.getTime()) && !Number.isNaN(right.getTime()) && left < right;
}

function totalMetres(entry) {
  return Number(entry.total_drilling_m || 0);
}

function planMetres(pattern) {
  return Number(pattern.plan_total_drilling_m || 0);
}

function progressPct(pattern) {
  const plan = planMetres(pattern);
  const drilled = drillLogEntries.value
    .filter(e => Number(e.week_id) === Number(props.week?.week_id) && e.pattern_id === pattern.pattern_id)
    .reduce((s, e) => s + Number(e.total_drilling_m || 0), 0);
  return plan > 0 ? Math.min(100, (drilled / plan) * 100) : 0;
}

function validDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return !Number.isNaN(d.getTime()) && d.getFullYear() > 1970 ? d : null;
}

function reviewBlastDate(pattern) {
  return validDate(pattern.planned_blast_date) || validDate(pattern.actual_blast_date);
}

function barStatus(pattern) {
  const s = String(pattern.status || '').toLowerCase();
  if (s === 'complete' || s === 'blasting' || s === 'done') return 'on-track';
  if (pattern.blast_td_updated) return 'on-track';
  const blastDate = reviewBlastDate(pattern);
  if (!blastDate) return 'no-date';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const daysToBlast = Math.round((blastDate.getTime() - today.getTime()) / 86400000);
  if (daysToBlast < 0) return 'delayed';
  if (daysToBlast <= 2) return 'at-risk';
  return 'on-track';
}

function progressMetresAfterRange(pattern) {
  return entriesBeforeDate(pattern).reduce((sum, entry) => sum + totalMetres(entry), 0) + actualForDate(pattern);
}

function entriesBeforeDate(pattern) {
  return drillLogEntries.value.filter(
    (entry) => entry.week_id === props.week.week_id && entry.pattern_id === pattern.pattern_id && isBeforeDay(entry.work_date, rangeStartDate.value),
  );
}

function entriesOnDate(pattern) {
  return drillLogEntries.value.filter(
    (entry) => entry.week_id === props.week.week_id && entry.pattern_id === pattern.pattern_id && isInRange(entry.work_date),
  );
}

function actualForDate(pattern) {
  return entriesOnDate(pattern).reduce((sum, entry) => sum + totalMetres(entry), 0);
}

function remainInfo(pattern) {
  const plan = Number(pattern.plan_total_drilling_m || 0);
  const drilled = drillLogEntries.value
    .filter(e => Number(e.week_id) === Number(props.week?.week_id) && e.pattern_id === pattern.pattern_id)
    .reduce((s, e) => s + Number(e.total_drilling_m || 0), 0);
  const diff = +(plan - drilled).toFixed(1);
  const isComplete = patternStatus(pattern) === 'complete';

  if (diff < 0) return { text: `+${fnum(Math.abs(diff), 1)}`, cls: 'remain-over' };
  if (isComplete && diff > 0) return { text: `-${fnum(diff, 1)}`, cls: 'remain-short' };
  return { text: fnum(diff, 1), cls: '' };
}

function remainingAfterDate(pattern) {
  const plan = Number(pattern.plan_total_drilling_m || 0);
  return +Math.max(0, plan - progressMetresAfterRange(pattern)).toFixed(1);
}

function commaNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString('en-US') : '';
}

function fmtShortDate(value) {
  return fmtDisplayDate(value, '');
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtTableDate(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime()) || d.getFullYear() <= 1970) return '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function patternStatus(row) {
  return row.blast_td_updated && Number(row.actual_blast_vol_bcm || 0) > 1 ? 'complete' : 'drilling';
}

function patternStatusLabel(row) {
  return patternStatus(row) === 'complete' ? 'Done' : 'In progress';
}

function entryKey(entry) {
  return `${entry.pattern_id}-${dateInput(entry.work_date)}-${entry.shift}-${entry.rig_id}-${entry.employee_name}`;
}

function syncDateRangeToWeek(week) {
  historyStartDate.value = dateInput(week?.week_start || TODAY);
  historyEndDate.value = dateInput(week?.week_end || week?.week_start || TODAY);
  startDateText.value = toDisplayDate(historyStartDate.value);
  endDateText.value = toDisplayDate(historyEndDate.value);
}

watch(() => props.week?.week_id, (weekId) => {
  const id = Number(weekId);
  if (weekId != null && !Number.isNaN(id)) {
    patternsStore.loadByWeek(id);
    if (drillLogStore.loadedWeekId !== id) drillLogStore.loadByWeek(id);
  }
}, { immediate: true });

watch(() => props.week, syncDateRangeToWeek, { immediate: true });

watchEffect(() => {
  if (!pits.value.length) {
    blastPit.value = '';
    return;
  }

  if (!pits.value.includes(blastPit.value)) {
    blastPit.value = filteredPitGroups.value[0]?.pit || pits.value[0];
  }

  if (!blastRows.value.some((row) => row.pattern_id === selectedPatternId.value)) {
    selectedPatternId.value = blastRows.value[0]?.pattern_id || '';
  }
});
</script>

<style scoped>
.daily-progress-shell {
  display: grid;
  gap: 12px;
}

.daily-main-grid {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.daily-content-stack {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}

.daily-pit-sidebar {
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
}

.daily-pit-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border-bottom: 1px solid var(--line);
}

.daily-pit-search .ic {
  color: var(--ink-3);
}

.daily-pit-search input {
  width: 100%;
  min-width: 0;
  height: 28px;
  padding: 0 0 0 2px;
  border: 0;
  background: transparent;
  color: var(--ink);
}

.daily-pit-row {
  width: 100%;
  height: 52px;
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) 34px 38px;
  gap: 8px;
  align-items: center;
  padding: 0 12px;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
  text-align: left;
}

.daily-pit-row:last-child {
  border-bottom: 0;
}

.daily-pit-row:hover,
.daily-pit-row[data-active="true"] {
  background: var(--surface-2);
}

.daily-pit-row .ic {
  color: var(--ink-4);
}

.daily-pit-row[data-active="true"] .ic {
  color: var(--accent);
}

.daily-pit-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
}

.daily-pit-count {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--ink);
  font-size: 12px;
}

.daily-pit-pct {
  color: var(--ink-3);
  font-size: 11px;
  text-align: right;
}

.daily-pattern-table th,
.daily-pattern-table td {
  white-space: nowrap;
}

.daily-pattern-table .remain-over {
  color: var(--green);
  font-weight: 600;
}

.daily-pattern-table .remain-short {
  color: var(--red);
  font-weight: 600;
}

.daily-pattern-row {
  cursor: pointer;
}

.daily-pattern-row:hover,
.daily-pattern-row[data-active="true"] {
  background: var(--surface-2);
}

.daily-pattern-row[data-active="true"] td:first-child {
  box-shadow: inset 3px 0 0 var(--accent);
}

.daily-muted {
  color: var(--ink-4);
}

.daily-date-status {
  display: inline-flex;
  align-items: center;
  height: 20px;
  margin-left: 8px;
  padding: 0 7px;
  border-radius: 999px;
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 700;
}

.daily-date-status[data-status="drilling"] {
  background: var(--amber-soft);
  color: var(--amber);
}

.daily-date-status[data-status="complete"] {
  background: var(--accent-soft);
  color: var(--accent-ink);
}

.daily-add-row {
  display: inline-flex;
  gap: 8px;
  align-items: center;
}

.daily-format {
  margin-left: 18px;
}

.daily-pattern-footer {
  display: flex;
  justify-content: flex-end;
  padding: 14px 16px;
  border-top: 1px solid var(--line);
}

.daily-history-date {
  width: 160px;
  font-size: 12px;
}

.dmy-wrap {
  display: flex;
  align-items: center;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--surface);
}

.dmy-wrap input:first-child {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  padding: 0 8px;
  height: 32px;
  color: var(--ink);
}

.dmy-cal {
  position: relative;
  width: 34px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-left: 1px solid var(--line);
  color: var(--ink-3);
  cursor: pointer;
  flex-shrink: 0;
  overflow: hidden;
}

.dmy-cal:hover {
  background: var(--surface-2);
  color: var(--ink);
}

.dmy-native {
  position: absolute;
  inset: 0;
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
  color-scheme: light;
}

.daily-date-range {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ink-3);
}

.daily-table-wrap {
  overflow: auto;
}

.daily-selected-summary {
  padding: 18px 22px 14px;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.daily-selected-head {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: start;
}

.daily-selected-title {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 16px;
  line-height: 1.2;
}

.daily-selected-sub {
  margin: 4px 0 0;
  color: var(--ink-3);
  font-size: 13px;
}

.daily-progress-head {
  display: grid;
  grid-template-columns: auto auto 160px;
  gap: 10px;
  align-items: center;
  min-width: 290px;
  color: var(--ink-3);
}

.daily-progress-head strong {
  color: var(--ink);
  font-size: 15px;
}

.daily-progress-bar {
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--surface-2);
}

.daily-progress-bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--green);
}

.daily-selected-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-top: 18px;
  color: var(--ink);
}

.daily-selected-stats > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface-2);
}

.stat-label {
  font-size: 11px;
  color: var(--ink-3);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.daily-selected-stats strong {
  font-size: 18px;
  font-family: var(--font-mono);
}

.daily-recent-table th,
.daily-recent-table td {
  white-space: nowrap;
}

.daily-empty {
  padding: 18px 16px;
  color: var(--ink-3);
  text-align: center;
}

.daily-footer {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  border-top: 1px solid var(--line);
}

.daily-footer-right {
  display: flex;
  align-items: center;
  gap: 14px;
}

@media (max-width: 980px) {
  .daily-main-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .daily-pit-sidebar {
    max-height: 310px;
    overflow: auto;
  }

  .daily-footer,
  .daily-footer-right,
  .daily-selected-head {
    align-items: stretch;
    flex-direction: column;
  }

  .daily-progress-head {
    min-width: 0;
    grid-template-columns: auto auto minmax(90px, 1fr);
  }

  .daily-selected-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .daily-selected-stats {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
