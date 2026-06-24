<template>
  <div class="source-pdf-panel">
    <label>Source plan file</label>
    <input
      ref="pdfInput"
      type="file"
      accept="application/pdf,.pdf"
      style="display: none"
      @change="importPdf"
    />
    <input
      ref="excelInput"
      type="file"
      accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
      style="display: none"
      @change="importExcel"
    />
    <div class="filter-sel source-pdf-control">
      <span class="mono source-pdf-name">{{ sourcePdfName }}</span>
      <div style="display: flex; gap: 8px">
        <button type="button" class="btn" data-size="sm" :disabled="locked || isImporting" @click="pdfInput?.click()">
          {{ isImporting ? 'Reading...' : 'PDF' }}
        </button>
        <button type="button" class="btn" data-size="sm" :disabled="locked || isImporting" @click="excelInput?.click()">
          Excel
        </button>
      </div>
    </div>
    <div class="field-hint">{{ sourceStatus }}</div>
  </div>

  <div v-if="importPreview" class="import-preview-panel">
    <div class="import-preview-head">
      <div>
        <span class="import-preview-title">ตรวจสอบข้อมูลก่อนนำเข้า — {{ previewFileName }}</span>
        <span class="import-preview-sub">
          พบ {{ importPreview.length }} pattern (เฉพาะ Thai Drill)
          <template v-if="importSkippedSections > 0">
            — <span style="color:var(--ink-3)">ข้าม {{ importSkippedSections }} หน้า/sheet ที่ไม่ใช่ Thai Drill</span>
          </template>
          <template v-if="importUnparsedIds.length">
            — <span style="color:var(--red,#c00);font-weight:600">⚠️ {{ importUnparsedIds.length }} pattern ไม่ครบข้อมูล: {{ importUnparsedIds.join(', ') }}</span>
          </template>
          — ตรวจสอบทุกคอลัมน์ก่อนกด Confirm
        </span>
      </div>
      <div style="display:flex;gap:8px">
        <button type="button" class="btn" data-variant="ghost" data-size="sm" @click="discardImport">Discard</button>
        <button type="button" class="btn" data-variant="primary" data-size="sm" @click="confirmImport">Confirm import</button>
      </div>
    </div>
    <div class="import-preview-scroll">
      <table class="tbl import-preview-tbl">
        <thead>
          <tr>
            <th class="c">#</th>
            <th>Pattern ID</th>
            <th class="r">Holes</th>
            <th class="r">Bit mm</th>
            <th class="r">Plan m</th>
            <th class="r">Carried m</th>
            <th class="r">Remain m</th>
            <th class="r">Vol bcm</th>
            <th class="r">Blast area m²</th>
            <th>Blast date</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="group in importPreviewGroups" :key="group.pit">
            <tr class="import-pit-row">
              <td colspan="10">
                <span class="mono" style="font-weight:700">{{ group.pit }}</span>
                <span class="dim" style="margin-left:8px;font-size:11px">{{ group.rows.length }} patterns</span>
              </td>
            </tr>
            <tr v-for="(r, i) in group.rows" :key="r.pattern_id" :class="r._warn ? 'import-row-warn' : ''">
              <td class="c mono dim">{{ i + 1 }}</td>
              <td class="mono" style="font-size:11px;white-space:nowrap">{{ r.pattern_id }}</td>
              <td class="num r" :class="!r.num_holes ? 'cell-zero' : ''">{{ r.num_holes }}</td>
              <td class="num r" :class="r.hole_diameter_mm === 115 ? 'cell-default' : ''">{{ r.hole_diameter_mm }}</td>
              <td class="num r" :class="!r.plan_total_drilling_m ? 'cell-zero' : ''">{{ fnum(r.plan_total_drilling_m, 1) }}</td>
              <td class="num r dim">{{ fnum(r.carried_drilling_m, 1) }}</td>
              <td class="num r">{{ fnum(r.effective_m, 1) }}</td>
              <td class="num r" :class="!r.plan_blast_vol_bcm ? 'cell-zero' : ''">{{ r.plan_blast_vol_bcm?.toLocaleString('en-US') }}</td>
              <td class="num r dim">{{ r.blast_area_m2?.toLocaleString('en-US') }}</td>
              <td class="mono" style="font-size:11px;white-space:nowrap">—</td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>

  <Card
    :pad="false"
    title="Blast patterns"
    sub="Switch pits to enter LXML page-by-page. Pattern names validate against LXML regex."
  >
    <template #action>
      <div style="display: flex; gap: 8px">
        <button type="button" class="btn" data-size="sm" data-variant="primary" @click="addPattern">
          <span class="ic"><component :is="I.plus" /></span>Add pattern
        </button>
      </div>
    </template>

    <p
      v-if="locked"
      class="mono"
      style="margin: 0 0 8px; padding: 8px 12px; font-size: 12px; color: var(--ink); background: var(--accent-soft); border-radius: var(--radius)"
    >
      Weekly blast plan is saved. ข้อมูล pattern ที่มีอยู่เป็น read-only — ยังสามารถเพิ่มบ่อใหม่และ pattern ใหม่ได้
    </p>

    <div style="display: flex; gap: 8px; align-items: center; padding: 0 0 10px">
      <div class="filter-sel" style="width: 260px">
        <span class="filter-sel-key">New pit</span>
        <input
          v-model="newPitName"
          class="mono"
          placeholder="e.g. NLU04"
          style="border: 0; background: transparent; flex: 1; min-width: 0; font-size: 12px"
          @keyup.enter="addPit"
        />
      </div>
      <button type="button" class="btn" data-size="sm" @click="addPit">
        <span class="ic"><component :is="I.plus" /></span>Add pit
      </button>
      <button type="button" class="btn" data-size="sm" data-variant="ghost" :disabled="(locked && !isPitAllUnsaved) || !pit" @click="deletePit">
        <span class="ic"><component :is="I.x" /></span>Delete current pit
      </button>
    </div>

    <p
      v-if="flash"
      class="mono"
      style="margin: 0 0 8px; padding: 8px 12px; font-size: 12px; color: var(--ink); background: var(--accent-soft); border-radius: var(--radius)"
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

    <div v-if="!pitNames.length" style="padding: 18px 16px; color: var(--ink-3); font-size: 12px">
      No pits in the system. Add a new pit above to start entering blast patterns.
    </div>

    <div v-else class="patterns-table-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th style="width: 30px" class="c">#</th>
            <th>Pattern ID</th>
            <th class="c">Type</th>
            <th class="c">RL</th>
            <th class="r">Bench</th>
            <th class="r">Holes</th>
            <th class="r">Bit dia</th>
            <th class="r">Plan m</th>
            <th v-for="d in weekDays" :key="d.iso" class="r daily-plan-th">
              <span class="daily-plan-dow">{{ d.dow }}</span>
              <span class="daily-plan-dm">{{ d.dm }}</span>
            </th>
            <th class="r">Remain</th>
            <th class="r">Vol bcm</th>
            <th class="c">Blast date</th>
            <th style="width: 40px" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in rows" :key="p.pattern_id">
            <td class="c"><span class="mono dim">{{ p.pit_priority }}</span></td>
            <td>
              <input
                class="mono pattern-input"
                :value="p.pattern_id"
                :disabled="locked && !p._unsaved"
                :style="{ borderBottomColor: valid(p) ? 'transparent' : 'var(--red)' }"
                @change="updatePatternId(p, $event.target.value)"
              />
            </td>
            <td class="c">
              <input class="mono edit-cell type-cell" :disabled="locked && !p._unsaved" :value="p.pattern_type" @change="updatePatternType(p, $event.target.value)" />
            </td>
            <td class="num c">
              <input class="mono edit-cell rl-cell" type="number" :disabled="locked && !p._unsaved" :value="p.rl_level" @change="updateNumber(p, 'rl_level', $event.target.value, 0, true)" />
            </td>
            <td class="num r">
              <input class="mono edit-cell r" type="number" step="0.1" :disabled="locked && !p._unsaved" :value="p.bench_height_m" @change="updateBench(p, $event.target.value)" />
            </td>
            <td class="num r">
              <input class="mono edit-cell r" type="number" :disabled="locked && !p._unsaved" :value="p.num_holes" @change="updateNumber(p, 'num_holes', $event.target.value, 0)" />
            </td>
            <td class="num r">
              <input class="mono edit-cell r" type="number" :disabled="locked && !p._unsaved" :value="p.hole_diameter_mm" @change="updateNumber(p, 'hole_diameter_mm', $event.target.value, 115)" />
            </td>
            <td class="num r plan-m-col">
              <input class="mono edit-cell plan-m-cell r" :disabled="locked && !p._unsaved" :value="commaNumber(p.plan_total_drilling_m)" @change="updateMetres(p, 'plan_total_drilling_m', $event.target.value)" />
            </td>
            <td v-for="d in weekDays" :key="d.iso" class="num r daily-plan-col">
              <input class="mono edit-cell daily-plan-cell r" :disabled="locked && !p._unsaved" :value="getDaily(p, d.iso)" placeholder="—" @change="setDaily(p, d.iso, $event.target.value)" />
            </td>
            <td class="num r">{{ fnum(remainingMetres(p)) }}</td>
            <td class="num r">
              <input class="mono edit-cell r" :disabled="locked && !p._unsaved" :value="commaNumber(p.plan_blast_vol_bcm)" @change="updateNumber(p, 'plan_blast_vol_bcm', $event.target.value, 0)" />
            </td>
            <td class="c">
              <input
                class="mono edit-cell date-cell"
                type="date"
                :disabled="locked && !p._unsaved"
                :value="dateInput(p.planned_blast_date)"
                @change="updateBlastDate(p, $event.target.value)"
              />
            </td>
            <td class="c">
              <button type="button" class="btn" data-variant="ghost" data-size="sm" :disabled="locked && !p._unsaved" @click="deletePattern(p)">
                <span class="ic"><component :is="I.x" /></span>
              </button>
            </td>
          </tr>
          <tr style="background: var(--surface-2)">
            <td class="c"><span class="dim">+</span></td>
            <td :colspan="11 + weekDays.length" style="color: var(--ink-3)">
              <button type="button" class="btn" data-variant="ghost" data-size="sm" @click="addPattern">
                <span class="ic"><component :is="I.plus" /></span>Add pattern to
                <span class="mono" style="margin-left: 4px">{{ pit }}</span>
              </button>
              <span style="margin-left: 12px; font-size: 11px">
                Format: <span class="mono">PIT_RL_BENCH_SEQ_TYPE</span>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div style="padding: 16px; display: flex; justify-content: space-between; border-top: 1px solid var(--line)">
      <button type="button" class="btn" @click="emit('back')"><span class="ic"><component :is="I.chevL" /></span>Back</button>
      <div style="display: flex; gap: 14px; align-items: center">
        <span class="foot-hint" style="padding: 0; gap: 8px">
          <span>Effective plan = <span class="mono">plan - carried</span></span>
          <span class="kbd">Tab</span><span>to edit fields</span>
        </span>
        <button type="button" class="btn" data-variant="primary" :disabled="saving" @click="saveAndNext">
          {{ saving ? 'Saving…' : (locked && !hasUnsavedNew) ? 'Go to drill log' : 'Save plan & go to drill log' }}
        </button>
      </div>
    </div>
  </Card>
</template>

<script setup>
import { computed, ref, onUnmounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { fmtDisplayDate, fnum, I } from '../format.js';
import Card from '../Card.vue';
import { PATTERN_RE, PATTERN_TYPES, extractPlanRowsFromPdf, extractPlanRowsFromExcel } from '../planImport.js';
import { usePatternsStore } from '../../stores/Patterns.stores.ts';
import { useDrillLogStore } from '../../stores/DrillLog.stores.ts';
import { useDailyPlanStore } from '../../stores/DailyPlan.stores.ts';

const TODAY = new Date();

const props = defineProps({
  initialPit: {
    type: String,
    default: '',
  },
  week: {
    type: Object,
    required: true,
  },
  locked: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['next', 'back', 'plan-saved']);

const patternsStore = usePatternsStore();
const { patterns, pitNames } = storeToRefs(patternsStore);

const drillLogStore = useDrillLogStore();
const { drillLog } = storeToRefs(drillLogStore);

const dailyPlanStore = useDailyPlanStore();
const { dailyPlans } = storeToRefs(dailyPlanStore);

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

function dailyKey(patternId, iso) {
  return `${patternId}__${iso}`;
}

function getDaily(p, iso) {
  const v = dailyMap.value[dailyKey(p.pattern_id, iso)];
  return Number(v) > 0 ? commaNumber(v) : '';
}

function setDaily(p, iso, value) {
  if (props.locked && !p._unsaved) return;
  const parsed = Number(String(value || '').replace(/,/g, ''));
  dailyMap.value[dailyKey(p.pattern_id, iso)] = Number.isFinite(parsed) ? Math.max(0, +parsed.toFixed(1)) : 0;
}

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

const listRevision = ref(0);
const pit = ref('');
const flash = ref('');
const saving = ref(false);
const isImporting = ref(false);
const pdfInput = ref(null);
const excelInput = ref(null);
const sourcePdfName = ref('');
const sourceStatus = ref('');
const newPitName = ref('');
const importPreview = ref(null);
const previewFileName = ref('');
const importUnparsedIds = ref([]);
const importSkippedSections = ref(0);

const hasUnsavedNew = computed(() => patterns.value.some((p) => p._unsaved));
const isPitAllUnsaved = computed(() => {
  const pitRows = byPit.value[pit.value] || [];
  return pitRows.length > 0 && pitRows.every((r) => r._unsaved);
});

const importPreviewGroups = computed(() => {
  if (!importPreview.value) return [];
  const groups = new Map();
  for (const r of importPreview.value) {
    if (!groups.has(r.pit_name)) groups.set(r.pit_name, []);
    groups.get(r.pit_name).push(r);
  }
  return [...groups.entries()].map(([pit, rows]) => ({ pit, rows }));
});
const byPit = computed(() => {
  listRevision.value;
  const out = {};
  for (const p of patterns.value.filter((row) => Number(row.week_id) === Number(props.week.week_id))) {
    if (!out[p.pit_name]) out[p.pit_name] = [];
    out[p.pit_name].push(p);
  }
  for (const key of Object.keys(out)) out[key].sort(patternPrioritySort);
  return out;
});

const rows = computed(() => byPit.value[pit.value] || []);

// Set initial pit once patterns load or when initialPit prop changes
watch(
  [pitNames, () => props.initialPit],
  ([names, initPit]) => {
    if (!names?.length) return;
    if (initPit && names.includes(initPit)) {
      pit.value = initPit;
    } else if (!pit.value || !names.includes(pit.value)) {
      pit.value = names[0];
    }
    listRevision.value += 1;
  },
  { immediate: true },
);

watch(
  () => props.week?.week_id,
  async (weekId) => {
    const id = Number(weekId);
    if (weekId != null && !Number.isNaN(id)) {
      await patternsStore.loadByWeek(id);
      await drillLogStore.loadByWeek(id);
      await dailyPlanStore.loadByWeek(id);
    }
  },
  { immediate: true },
);

function valid(p) {
  return PATTERN_RE.test(p.pattern_id);
}

function patternPrioritySort(a, b) {
  const aCarry = Number(a.pit_priority) === 0 ? 0 : 1;
  const bCarry = Number(b.pit_priority) === 0 ? 0 : 1;
  if (aCarry !== bCarry) return aCarry - bCarry;
  const priorityDiff = Number(a.pit_priority || 0) - Number(b.pit_priority || 0);
  if (priorityDiff) return priorityDiff;
  return a.pattern_id.localeCompare(b.pattern_id);
}

function nextSeqFromIds() {
  let max = 100;
  for (const p of patterns.value) {
    const m = p.pattern_id.match(/_[0-9.]+M_([0-9]+)_/);
    if (m) max = Math.max(max, +m[1]);
  }
  return max + 1;
}

function nextPitPriority(pitName) {
  const list = patterns.value.filter((p) => p.pit_name === pitName);
  if (!list.length) return 1;
  return Math.max(...list.map((p) => p.pit_priority)) + 1;
}

function riskForNew(plannedBlastDate, drillingPct) {
  const d = plannedBlastDate instanceof Date ? plannedBlastDate : new Date(plannedBlastDate);
  if (!d || isNaN(d.getTime())) return 'on-track';
  const daysToBlast = Math.round((d.getTime() - TODAY.getTime()) / 86400000);
  if (daysToBlast < 0 && drillingPct < 100) return 'delayed';
  if (daysToBlast <= 2) return 'at-risk';
  return 'on-track';
}

function normalizePitName(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

function parsePatternId(patternId) {
  const match = String(patternId || '').match(/^([A-Z]+[0-9]+[A-Z]*)_([0-9]+)RL_([0-9]+(?:\.[0-9]+)?)M_([0-9]+)_([A-Z0-9]+(?:_[A-Z0-9]+)*)$/);
  if (!match) return null;
  return {
    pit_name: match[1],
    rl_level: +match[2],
    bench_height_m: +match[3],
    seq: +match[4],
    pattern_type: match[5],
  };
}

function patternSeq(p) {
  return parsePatternId(p.pattern_id)?.seq || nextSeqFromIds();
}

function syncPatternId(p) {
  const seq = patternSeq(p);
  p.pattern_id = `${p.pit_name}_${p.rl_level}RL_${p.bench_height_m}M_${seq}_${p.pattern_type}`;
}

function recalcPattern(p) {
  const plan = Number(p.plan_total_drilling_m || 0);
  const carried = Math.max(0, Number(p.carried_drilling_m || 0));
  p.effective_m = +(Math.max(0, plan - carried)).toFixed(1);
  p.drilling_pct = p.effective_m > 0 ? +((p.actual_drilling_m / p.effective_m) * 100).toFixed(1) : 0;
  p.risk = riskForNew(p.planned_blast_date, p.drilling_pct);
}

function touch() {
  listRevision.value += 1;
}

function dateInput(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function isRealDate(value) {
  if (!value) return false;
  const d = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(d.getTime()) && d.getFullYear() > 1970;
}

function fmtShortDate(value) {
  return fmtDisplayDate(value);
}

function updateNumber(p, field, value, fallback = 0, updateId = false) {
  if (props.locked && !p._unsaved) return;
  const parsed = Number(String(value || '').replace(/,/g, ''));
  p[field] = Number.isFinite(parsed) ? parsed : fallback;
  if (updateId) syncPatternId(p);
  recalcPattern(p);
  touch();
}

function commaNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString('en-US') : '';
}

function drilledMetres(p) {
  return drillLog.value
    .filter(e => e.pattern_id === p.pattern_id)
    .reduce((s, e) => s + Number(e.total_drilling_m || 0), 0);
}

function remainingMetres(p) {
  return +Math.max(0, Number(p.effective_m || 0) - drilledMetres(p)).toFixed(1);
}

function updateMetres(p, field, value) {
  if (props.locked && !p._unsaved) return;
  const parsed = Number(String(value || '').replace(/,/g, ''));
  p[field] = Number.isFinite(parsed) ? Math.max(0, +parsed.toFixed(1)) : 0;
  recalcPattern(p);
  touch();
}

function updateBench(p, value) {
  if (props.locked && !p._unsaved) return;
  const parsed = Number(value);
  p.bench_height_m = Number.isFinite(parsed) ? parsed : 0;
  syncPatternId(p);
  recalcPattern(p);
  touch();
}

function updatePatternType(p, value) {
  if (props.locked && !p._unsaved) return;
  const nextType = String(value || '').trim().toUpperCase().replace(/\s+/g, '_');
  if (!nextType) return;
  p.pattern_type = nextType;
  syncPatternId(p);
  touch();
}

function updatePatternId(p, value) {
  if (props.locked && !p._unsaved) return;
  const nextId = String(value || '').trim().toUpperCase();
  const parts = parsePatternId(nextId);
  p.pattern_id = nextId;

  if (parts) {
    p.pit_name = parts.pit_name;
    p.rl_level = parts.rl_level;
    p.bench_height_m = parts.bench_height_m;
    p.pattern_type = parts.pattern_type;
    pit.value = parts.pit_name;
  }

  recalcPattern(p);
  touch();
}

function updateDate(p, value) {
  if (props.locked && !p._unsaved) return;
  const nextDate = new Date(value);
  if (Number.isNaN(nextDate.getTime())) return;
  p.planned_blast_date = nextDate;
  recalcPattern(p);
  touch();
}

function updateBlastDate(p, value) {
  if (props.locked && !p._unsaved) return;
  if (!value) {
    p.planned_blast_date = null;
    recalcPattern(p);
    touch();
    return;
  }
  const nextDate = new Date(value);
  if (Number.isNaN(nextDate.getTime())) return;
  p.planned_blast_date = nextDate;
  recalcPattern(p);
  touch();
}


async function importPdf(event) {
  if (props.locked) return;
  const [file] = event.target.files || [];
  event.target.value = '';
  if (!file) return;

  isImporting.value = true;
  try {
    const result = await extractPlanRowsFromPdf(file, patterns.value, props.week);
    if (!result.rows.length) {
      flash.value = 'ไม่พบข้อมูล pattern ในไฟล์ PDF นี้';
      clearFlash(6000);
      return;
    }
    importPreview.value = result.rows;
    importUnparsedIds.value = result.unparsedPatternIds ?? [];
    importSkippedSections.value = result.skippedPages ?? 0;
    previewFileName.value = file.name;
  } catch (error) {
    console.error(error);
    flash.value = 'Could not read table data from this PDF.';
    clearFlash(6000);
  } finally {
    isImporting.value = false;
  }
}

async function importExcel(event) {
  if (props.locked) return;
  const [file] = event.target.files || [];
  event.target.value = '';
  if (!file) return;

  isImporting.value = true;
  try {
    const result = await extractPlanRowsFromExcel(file, patterns.value, props.week);
    if (!result.rows.length) {
      flash.value = 'ไม่พบข้อมูล pattern ในไฟล์ Excel นี้';
      clearFlash(6000);
      return;
    }
    importPreview.value = result.rows;
    importUnparsedIds.value = result.unparsedPatternIds ?? [];
    importSkippedSections.value = result.skippedSheets ?? 0;
    previewFileName.value = file.name;
  } catch (error) {
    console.error(error);
    flash.value = 'Could not read table data from this Excel file.';
    clearFlash(6000);
  } finally {
    isImporting.value = false;
  }
}

function confirmImport() {
  if (!importPreview.value) return;
  const summary = applyImportedRows(importPreview.value);
  sourcePdfName.value = previewFileName.value;
  const skipped = importUnparsedIds.value.length;
  sourceStatus.value = `Imported ${importPreview.value.length} rows. Added ${summary.added}, updated ${summary.updated}.${skipped ? ` (${skipped} patterns found but not parsed)` : ''}`;
  flash.value = `นำเข้าสำเร็จ: เพิ่ม ${summary.added}, อัปเดต ${summary.updated}, carried ${summary.carried}.${skipped ? ` ⚠️ ${skipped} pattern ไม่ครบข้อมูล — เพิ่มมือ` : ''}`;
  importPreview.value = null;
  importUnparsedIds.value = [];
  importSkippedSections.value = 0;
  clearFlash(8000);
}

function discardImport() {
  importPreview.value = null;
  previewFileName.value = '';
  importUnparsedIds.value = [];
  importSkippedSections.value = 0;
}

function applyImportedRows(importedRows) {
  let added = 0;
  let updated = 0;
  let carried = 0;
  let firstAddedPit = '';

  for (const row of importedRows) {
    const existing = patterns.value.find((p) => p.pattern_id === row.pattern_id && p.week_id === row.week_id);
    if (existing) {
      // Keep blast-confirmed fields if the pattern has already been blasted
      const preserve = existing.blast_td_updated
        ? { blast_td_updated: existing.blast_td_updated, actual_blast_vol_bcm: existing.actual_blast_vol_bcm, status: existing.status }
        : {};
      Object.assign(existing, row, preserve);
      if (!firstAddedPit) firstAddedPit = row.pit_name;
      if (isCarryoverSignal(row)) carried += 1;
      updated += 1;
      continue;
    }
    patterns.value.push(row);
    if (!firstAddedPit) firstAddedPit = row.pit_name;
    if (isCarryoverSignal(row)) carried += 1;
    added += 1;
  }

  if (added + updated + carried > 0) pit.value = firstAddedPit || pit.value;
  touch();
  return { added, updated, carried, skippedDuplicate: 0 };
}

function setImportStatus(importType, fileName, sourceReadText, foundPatternCount, summary) {
  sourcePdfName.value = fileName;
  sourceStatus.value = `${sourceReadText} and found ${foundPatternCount} pattern row${foundPatternCount === 1 ? '' : 's'}. Added ${summary.added}, updated ${summary.updated}, carried ${summary.carried}.`;
  flash.value = `${importType}: found ${foundPatternCount} pattern row${foundPatternCount === 1 ? '' : 's'}, added ${summary.added}, updated ${summary.updated}, carried ${summary.carried}${summary.skippedDuplicate ? `, skipped ${summary.skippedDuplicate} duplicate row${summary.skippedDuplicate === 1 ? '' : 's'}` : ''}.`;
}

function isCarryoverSignal(row) {
  return Number(row.pit_priority) === 0 || Number(row.effective_m || 0) <= 0 || Number(row.plan_total_drilling_m || 0) <= 0;
}

function buildPatternRow(pitName) {
  const seq = nextSeqFromIds();
  const rl = 190;
  const bench = 7.5;
  const type = 'TRI';
  const pattern_id = `${pitName}_${rl}RL_${bench}M_${seq}_${type}`;
  const num_holes = 80;
  const hole_diameter_mm = 115;
  const plan_total = +(num_holes * (bench + 1)).toFixed(1);

  return {
    pattern_id,
    week_id: props.week.week_id,
    pit_name: pitName,
    pit_priority: nextPitPriority(pitName),
    pattern_type: type,
    rl_level: rl,
    bench_height_m: bench,
    hole_diameter_mm,
    num_holes,
    plan_total_drilling_m: plan_total,
    carried_drilling_m: 0,
    effective_m: plan_total,
    actual_drilling_m: 0,
    drilling_pct: 0,
    planned_blast_date: null,
    plan_blast_vol_bcm: Math.round(num_holes * bench * 45),
    actual_blast_vol_bcm: 0,
    blast_td_updated: false,
    status: 'pending',
    risk: 'no-date',
    blast_area_m2: Math.round(num_holes * 45),
  };
}

function addPattern() {
  const pitName = pit.value || normalizePitName(newPitName.value);
  if (!pitName) {
    flash.value = 'Add a pit before adding a pattern.';
    clearFlash(4000);
    return;
  }
  pit.value = pitName;
  const row = buildPatternRow(pitName);
  if (props.locked) row._unsaved = true;
  patterns.value.push(row);
  touch();
  flash.value = `Added ${row.pattern_id} to ${pitName}`;
  clearFlash(4000);
}

function addPit() {
  const pitName = normalizePitName(newPitName.value);
  if (!pitName) {
    flash.value = 'Enter a pit name before adding.';
    clearFlash(4000);
    return;
  }
  pit.value = pitName;
  newPitName.value = '';
  addPattern();
}

function deletePit() {
  if (props.locked && !isPitAllUnsaved.value) return;
  const pitName = pit.value;
  const index = pitNames.value.indexOf(pitName);
  if (index === -1) return;

  for (let i = patterns.value.length - 1; i >= 0; i -= 1) {
    if (patterns.value[i].pit_name === pitName) patterns.value.splice(i, 1);
  }

  pit.value = pitNames.value.length ? pitNames.value[Math.min(index, pitNames.value.length - 1)] : '';
  touch();
  flash.value = `Deleted ${pitName} and its pattern rows.`;
  clearFlash(5000);
}

function deletePattern(row) {
  if (props.locked && !row._unsaved) return;
  const index = patterns.value.findIndex((p) => p === row);
  if (index === -1) return;

  const patternId = row.pattern_id;
  patterns.value.splice(index, 1);
  touch();
  flash.value = `Deleted ${patternId}`;
  clearFlash(4000);
}

async function saveDailyPlans() {
  if (!weekDays.value.length) return { error: null };
  const weekId = props.week.week_id;
  const validIds = new Set(
    patterns.value.filter((p) => Number(p.week_id) === Number(weekId)).map((p) => p.pattern_id),
  );
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
  if (!rowsToSave.length) return { error: null };
  return dailyPlanStore.saveMany(rowsToSave, weekId);
}

async function saveAndNext() {
  if (props.locked && !hasUnsavedNew.value) { emit('next'); return; }
  saving.value = true;
  flash.value = '';
  const { error: err } = await patternsStore.save();
  saving.value = false;
  if (err) {
    const detail = [err.message, err.details, err.hint, err.code].filter(Boolean).join(' | ');
    flash.value = `Save failed: ${detail || String(err)}`;
    return;
  }
  const { error: dpErr } = await saveDailyPlans();
  if (dpErr) {
    const detail = [dpErr.message, dpErr.details, dpErr.hint, dpErr.code].filter(Boolean).join(' | ');
    flash.value = `Daily plan save failed: ${detail || String(dpErr)}`;
    return;
  }
  emit('plan-saved');
  emit('next');
}

let flashTimer;
function clearFlash(delay) {
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    flash.value = '';
  }, delay);
}

onUnmounted(() => clearTimeout(flashTimer));
</script>

<style scoped>
.pattern-input,
.edit-cell {
  height: 26px;
  padding: 0 8px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--ink);
  font-size: 12px;
}

.source-pdf-panel {
  margin: 0 0 12px;
  max-width: 584px;
}

.source-pdf-panel label {
  display: block;
  margin: 0 0 8px;
  color: var(--ink-3);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.source-pdf-control {
  height: 44px;
  justify-content: space-between;
}

.source-pdf-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.import-preview-panel {
  margin: 0 0 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
}

.import-preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  background: var(--accent-soft);
  border-bottom: 1px solid var(--line);
}

.import-preview-title {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink);
}

.import-preview-sub {
  display: block;
  font-size: 11px;
  color: var(--ink-3);
  margin-top: 2px;
}

.import-preview-scroll {
  overflow-x: auto;
  max-height: 280px;
  overflow-y: auto;
}

.import-preview-tbl {
  min-width: 700px;
}

.import-pit-row td {
  background: var(--surface-2, #f4f4f5);
  padding: 5px 12px;
  font-size: 12px;
  border-top: 2px solid var(--line);
}

.import-preview-panel {
  margin: 0 0 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
}
.import-preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  background: var(--accent-soft);
  border-bottom: 1px solid var(--line);
}
.import-preview-title {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink);
}
.import-preview-sub {
  display: block;
  font-size: 11px;
  color: var(--ink-3);
  margin-top: 2px;
}
.import-preview-scroll {
  overflow-x: auto;
  max-height: 320px;
  overflow-y: auto;
}
.import-preview-tbl {
  min-width: 860px;
}
.import-pit-row td {
  background: var(--surface-2, #f4f4f5);
  padding: 5px 12px;
  font-size: 12px;
  border-top: 2px solid var(--line);
}
.cell-zero { color: var(--red, #c00); font-weight: 600; }
.cell-default { color: var(--ink-3); }

.pattern-input {
  width: 260px;
}

.edit-cell {
  width: 72px;
}

.plan-m-col {
  min-width: 104px;
}

.plan-m-cell {
  width: 96px;
}

.date-cell {
  width: 132px;
  text-align: center;
}

.type-cell {
  width: 88px;
  text-align: center;
}

.rl-cell {
  text-align: center;
}

.edit-cell.r {
  text-align: right;
}

.pattern-input:focus,
.edit-cell:focus {
  outline: none;
  border-color: var(--accent);
  background: var(--surface);
}

.pattern-input:disabled,
.edit-cell:disabled {
  color: var(--ink-2);
  cursor: not-allowed;
  opacity: 0.72;
}

.patterns-table-wrap {
  padding: 4px 0 0;
  overflow-x: auto;
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
  width: 58px;
}

</style>
