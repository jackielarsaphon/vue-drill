<template>
  <div class="blast-shell">
    <div class="blast-list">
      <div class="blast-search">
        <div class="filter-sel" style="height: 32px">
          <span class="ic" style="color: var(--ink-3)"><component :is="I.search" /></span>
          <input v-model="query" placeholder="Filter patterns..." style="border: 0; background: transparent; flex: 1; font-size: 12px" />
        </div>
      </div>

      <button
        v-for="group in groupedLocations"
        :key="group.location"
        type="button"
        class="blast-location-row"
        :data-active="group.location === selectedLocation ? 'true' : undefined"
        @click="selectedLocation = group.location"
      >
        <span class="ic"><component :is="I.chevR" /></span>
        <span class="blast-location-name">{{ group.location }}</span>
        <span class="blast-location-count">{{ group.count }}</span>
        <span class="blast-location-pct num">{{ Math.round(group.percent) }}%</span>
      </button>
    </div>

    <Card
      :pad="false"
      :title="selectedLocation || 'Blast'"
      :sub="`${visibleRows.length} patterns - LXML ${commaNumber(selectedLxmlVolume)} bcm - TD ${commaNumber(selectedTdVolume)} bcm`"
    >
      <template #action>
        <button type="button" class="btn" data-size="sm" @click="addBlast">
          <span class="ic"><component :is="I.plus" /></span>Add blast
        </button>
      </template>

      <div v-if="!rows.length" style="padding: 18px 16px; color: var(--ink-3); font-size: 12px">
        No blast rows for this week. Add blast patterns first or create a blast row here.
      </div>

      <table v-else class="tbl">
        <thead>
          <tr>
            <th>Blast Date LXML</th>
            <th>Blast Date TD</th>
            <th class="r">Month</th>
            <th>Location</th>
            <th>Pattern ID</th>
            <th class="r">Blast Volume LXML</th>
            <th class="r">Blast Volume TD</th>
            <th class="r">Drilled %</th>
            <th>Status</th>
            <th style="width: 40px" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in visibleRows" :key="p.pattern_id">
            <td class="c">
              <input
                class="mono edit-cell date-cell"
                type="date"
                :value="dateInput(p.planned_blast_date)"
                @change="updateDate(p, $event.target.value)"
              />
            </td>
            <td>
              <input
                class="mono edit-cell date-cell"
                type="date"
                :value="dateInput(p.actual_blast_date)"
                @change="updateActualBlastDate(p, $event.target.value)"
              />
            </td>
            <td class="num r">{{ blastMonth(p.planned_blast_date) }}</td>
            <td>
              <input
                class="mono edit-cell location-cell"
                :value="p.pit_name"
                @change="updateLocation(p, $event.target.value)"
              />
            </td>
            <td>
              <input
                class="mono edit-cell pattern-cell"
                :value="p.pattern_id"
                @change="updatePatternId(p, $event.target.value)"
              />
            </td>
            <td class="num r">
              <input
                class="mono edit-cell volume-cell r"
                :value="commaNumber(p.plan_blast_vol_bcm)"
                @change="updateLxmlVolume(p, $event.target.value)"
              />
            </td>
            <td class="num r">
              <input
                class="mono edit-cell volume-cell r"
                :value="commaNumber(p.actual_blast_vol_bcm)"
                @change="updateTdVolume(p, $event.target.value)"
              />
            </td>
            <td class="num r">
              <span
                class="mono"
                :style="{
                  fontWeight: drilledPct(p) >= 100 ? 600 : undefined,
                  color: barStatus(p) === 'delayed' ? 'var(--red)'
                       : barStatus(p) === 'at-risk' ? 'var(--amber)'
                       : barStatus(p) === 'on-track' ? 'var(--green)'
                       : barStatus(p) === 'no-date' ? 'var(--ink)'
                       : undefined,
                }"
              >{{ drilledPct(p) }}%</span>
            </td>
            <td>
              <span class="status-badge" :data-status="p.status || 'pending'">
                {{ p.status || 'pending' }}
              </span>
            </td>
            <td class="c">
              <div class="row-actions">
                <button type="button" class="row-save" title="Save this row" @click="saveRow(p)">
                  <component :is="I.check" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div style="padding: 16px; display: flex; justify-content: space-between; border-top: 1px solid var(--line)">
        <button type="button" class="btn" @click="$emit('back')">
          <span class="ic"><component :is="I.chevL" /></span>Back to daily progress
        </button>
        <div style="display: flex; gap: 14px; align-items: center">
          <span class="foot-hint" style="padding: 0; gap: 8px">
            <span>LXML</span>
            <strong class="mono">{{ commaNumber(totalLxmlVolume) }}</strong>
            <span>TD</span>
            <strong class="mono">{{ commaNumber(totalTdVolume) }}</strong>
            <span>TD may differ from LXML plan</span>
            <span v-if="saveMessage" class="save-message">{{ saveMessage }}</span>
          </span>
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup>
import { computed, ref, watchEffect } from 'vue';
import { storeToRefs } from 'pinia';
import { TODAY, addDays } from '../data.js';
import { usePatternsStore } from '../../stores/Patterns.stores.ts';
import { useDrillLogStore } from '../../stores/DrillLog.stores.ts';
import { I } from '../format.js';
import Card from '../Card.vue';

const patternsStore = usePatternsStore();
const { patterns } = storeToRefs(patternsStore);
const drillLogStore = useDrillLogStore();

const emit = defineEmits(['back']);

const props = defineProps({
  week: {
    type: Object,
    required: true,
  },
});

const revision = ref(0);
const query = ref('');
const selectedLocation = ref('');
const saveMessage = ref('');

const rows = computed(() => {
  revision.value;
  return patterns.value
    .filter((p) => Number(p.week_id) === Number(props.week?.week_id))
    .sort((a, b) => {
      const da = validDate(a.planned_blast_date);
      const db = validDate(b.planned_blast_date);
      if (!da && !db) return String(a.pattern_id).localeCompare(String(b.pattern_id));
      if (!da) return 1;
      if (!db) return -1;
      const dateDiff = da.getTime() - db.getTime();
      if (dateDiff) return dateDiff;
      return String(a.pattern_id).localeCompare(String(b.pattern_id));
    });
});

const totalLxmlVolume = computed(() => rows.value.reduce((sum, p) => sum + Number(p.plan_blast_vol_bcm || 0), 0));
const totalTdVolume = computed(() => rows.value.reduce((sum, p) => sum + Number(p.actual_blast_vol_bcm || 0), 0));
const filteredRows = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return rows.value;
  return rows.value.filter((p) =>
    [
      p.pit_name,
      p.pattern_id,
      blastMonth(p.planned_blast_date),
      commaNumber(p.plan_blast_vol_bcm),
      commaNumber(p.actual_blast_vol_bcm),
    ]
      .some((value) => String(value || '').toLowerCase().includes(q)),
  );
});
const groupedLocations = computed(() => {
  const groups = new Map();
  for (const row of filteredRows.value) {
    if (!groups.has(row.pit_name)) groups.set(row.pit_name, []);
    groups.get(row.pit_name).push(row);
  }

  return [...groups.entries()]
    .map(([location, locationRows]) => {
      const lxmlVolume = locationRows.reduce((sum, p) => sum + Number(p.plan_blast_vol_bcm || 0), 0);
      const tdVolume = locationRows.reduce((sum, p) => sum + Number(p.actual_blast_vol_bcm || 0), 0);
      return {
        location,
        count: locationRows.length,
        lxmlVolume,
        tdVolume,
        percent: lxmlVolume > 0 ? (tdVolume / lxmlVolume) * 100 : 0,
      };
    })
    .sort((a, b) => a.location.localeCompare(b.location));
});
const visibleRows = computed(() => filteredRows.value.filter((p) => p.pit_name === selectedLocation.value));
const selectedLxmlVolume = computed(() => visibleRows.value.reduce((sum, p) => sum + Number(p.plan_blast_vol_bcm || 0), 0));
const selectedTdVolume = computed(() => visibleRows.value.reduce((sum, p) => sum + Number(p.actual_blast_vol_bcm || 0), 0));

function touch() {
  revision.value += 1;
  saveMessage.value = '';
}

function dateInput(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function blastMonth(value) {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.getMonth() + 1;
}

function commaNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '';
}


function shouldHideBlastDate(_row) {
  return false;
}

function parseNumber(value) {
  const parsed = Number(String(value || '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function validDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return !Number.isNaN(d.getTime()) && d.getFullYear() > 1970 ? d : null;
}

function barStatus(p) {
  const s = String(p.status || '').toLowerCase();
  if (s === 'complete' || s === 'blasting' || s === 'done') return 'on-track';
  if (p.blast_td_updated) return 'on-track';
  const blastDate = validDate(p.planned_blast_date) || validDate(p.actual_blast_date);
  if (!blastDate) return 'no-date';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const daysToBlast = Math.round((blastDate.getTime() - today.getTime()) / 86400000);
  if (daysToBlast < 0) return 'delayed';
  if (daysToBlast <= 2) return 'at-risk';
  return 'on-track';
}

function drilledPct(p) {
  const plan = Number(p.effective_m || 0);
  if (plan <= 0) return 0;
  const drilled = drillLogStore.drillLog
    .filter(e => e.pattern_id === p.pattern_id && Number(e.week_id) === Number(p.week_id))
    .reduce((s, e) => s + Number(e.total_drilling_m || 0), 0);
  return +Math.min(100, (drilled / plan) * 100).toFixed(1);
}

function updateDate(row, value) {
  if (!value) {
    row.planned_blast_date = null;
    touch();
    return;
  }
  const nextDate = new Date(value);
  if (Number.isNaN(nextDate.getTime())) return;
  row.planned_blast_date = nextDate;
  touch();
}

function updateActualBlastDate(row, value) {
  if (!value) { row.actual_blast_date = null; touch(); return; }
  const nextDate = new Date(value);
  if (Number.isNaN(nextDate.getTime())) return;
  row.actual_blast_date = nextDate;
  touch();
}

function updateLocation(row, value) {
  const nextLocation = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!nextLocation) return;
  row.pit_name = nextLocation;
  touch();
}

function updatePatternId(row, value) {
  const nextPatternId = String(value || '').trim().toUpperCase();
  if (!nextPatternId) return;
  row.pattern_id = nextPatternId;
  const pit = nextPatternId.match(/^([A-Z]+[0-9]+[A-Z]*)_/);
  if (pit) row.pit_name = pit[1];
  touch();
}

function updateLxmlVolume(row, value) {
  row.plan_blast_vol_bcm = +parseNumber(value).toFixed(2);
  touch();
}

function updateTdVolume(row, value) {
  const tdVolume = +parseNumber(value).toFixed(2);
  row.actual_blast_vol_bcm = tdVolume;
  row.blast_td_updated = tdVolume > 1;
  if (!tdVolume) row.status = 'drilling';
  touch();
}

function nextSeq() {
  let max = 100;
  for (const p of patterns.value) {
    const match = p.pattern_id.match(/_[0-9.]+M_([0-9]+)_/);
    if (match) max = Math.max(max, +match[1]);
  }
  return max + 1;
}

function addBlast() {
  const pitName = selectedLocation.value || rows.value[0]?.pit_name || 'NLU03C';
  const planned_blast_date = addDays(TODAY, 5);
  const pattern_id = `${pitName}_205RL_5M_${nextSeq()}_PROTRI`;
  patterns.value.push({
    pattern_id,
    week_id: props.week.week_id,
    pit_name: pitName,
    pit_priority: rows.value.length + 1,
    pattern_type: 'PROTRI',
    rl_level: 205,
    bench_height_m: 5,
    hole_diameter_mm: 115,
    num_holes: 0,
    plan_total_drilling_m: 0,
    carried_drilling_m: 0,
    effective_m: 0,
    actual_drilling_m: 0,
    drilling_pct: 0,
    planned_blast_date,
    plan_blast_vol_bcm: 18488.51,
    actual_blast_vol_bcm: 0,
    blast_td_updated: false,
    status: 'drilling',
    risk: 'on-track',
    blast_area_m2: 0,
  });
  touch();
}

async function saveRow(row) {
  const hasDate = hasBlastDate(row);
  const hasTd = Number(row.actual_blast_vol_bcm || 0) > 0;

  // Mark done only when both blast date and TD volume are present
  if (hasTd) {
    if (!hasDate) {
      saveMessage.value = `Add Blast Date for ${row.pattern_id} before marking done.`;
      return;
    }
    row.status = 'done';
    row.blast_td_updated = true;
  }

  touch();

  const payload = {
    pattern_id:           row.pattern_id,
    week_id:              row.week_id,
    status:               row.status,
    blast_td_updated:     row.blast_td_updated,
    actual_blast_vol_bcm: row.actual_blast_vol_bcm,
    plan_blast_vol_bcm:   row.plan_blast_vol_bcm,
    planned_blast_date:   hasDate ? dateInput(row.planned_blast_date) : null,
    actual_blast_date:    row.actual_blast_date ? dateInput(row.actual_blast_date) : null,
    pit_name:             row.pit_name,
  };

  const { error } = row.id
    ? await patternsStore.updateById(row.id, payload)
    : await patternsStore.upsertMany([{ ...row, ...payload }]);

  saveMessage.value = error
    ? `Error saving ${row.pattern_id}: ${error.message ?? error}`
    : `Saved ${row.pattern_id}.`;
}

function hasBlastDate(row) {
  const value = row.planned_blast_date;
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(date.getTime()) && date.getFullYear() > 1970;
}

watchEffect(() => {
  if (!groupedLocations.value.length) {
    selectedLocation.value = '';
    return;
  }

  if (!groupedLocations.value.some((group) => group.location === selectedLocation.value)) {
    selectedLocation.value = groupedLocations.value[0].location;
  }
});
</script>

<style scoped>
.blast-shell {
  display: grid;
  grid-template-columns: 280px max-content;
  gap: 12px;
  align-items: start;
  width: max-content;
  min-width: 100%;
}

.blast-list {
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}

.blast-search {
  padding: 10px;
  border-bottom: 1px solid var(--line);
}

.blast-location-row {
  width: 100%;
  height: 52px;
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) 34px 36px;
  align-items: center;
  gap: 9px;
  padding: 0 12px;
  background: var(--surface);
  border: 0;
  border-bottom: 1px solid var(--line);
  color: var(--ink);
  cursor: pointer;
  text-align: left;
}

.blast-location-row:last-child {
  border-bottom: 0;
}

.blast-location-row:hover,
.blast-location-row[data-active="true"] {
  background: var(--surface-2);
}

.blast-location-row .ic {
  color: var(--ink-3);
}

.blast-location-row[data-active="true"] .ic {
  color: var(--accent);
}

.blast-location-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
}

.blast-location-count {
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

.blast-location-pct {
  color: var(--ink-3);
  font-size: 11px;
  text-align: right;
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

.edit-cell:focus {
  outline: none;
  border-color: var(--accent);
  background: var(--surface);
}

.date-cell {
  width: 120px;
  text-align: center;
}

.location-cell {
  width: 90px;
}

.pattern-cell {
  width: 220px;
}

.volume-cell {
  width: 110px;
}

.row-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}

.row-save {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--surface);
  color: var(--ink-3);
  cursor: pointer;
}

.row-save:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--surface-2);
}

.row-save :deep(svg) {
  width: 13px;
  height: 13px;
}

.save-message {
  color: var(--green);
  font-weight: 700;
}

.edit-cell.r {
  text-align: right;
}


.status-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  padding: 2px 7px;
  border-radius: 20px;
  border: 1px solid var(--line);
  white-space: nowrap;
  color: var(--ink-3);
  background: var(--surface-2);
}
.status-badge[data-status="done"] {
  color: var(--green);
  border-color: color-mix(in srgb, var(--green) 40%, var(--line));
  background: color-mix(in srgb, var(--green) 8%, var(--surface));
}
.status-badge[data-status="drilling"] {
  color: var(--accent, #3b82f6);
  border-color: color-mix(in srgb, var(--accent, #3b82f6) 40%, var(--line));
  background: color-mix(in srgb, var(--accent, #3b82f6) 8%, var(--surface));
}
.status-badge[data-status="blasting"] {
  color: var(--amber);
  border-color: color-mix(in srgb, var(--amber) 40%, var(--line));
  background: color-mix(in srgb, var(--amber) 8%, var(--surface));
}
.status-badge[data-status="at-risk"] {
  color: var(--red);
  border-color: color-mix(in srgb, var(--red) 40%, var(--line));
  background: color-mix(in srgb, var(--red) 8%, var(--surface));
}

@media (max-width: 980px) {
  .blast-shell {
    grid-template-columns: 1fr;
  }
}
</style>
