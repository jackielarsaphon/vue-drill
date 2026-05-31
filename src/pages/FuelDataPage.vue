<template>
  <div class="fuel-page">

    <!-- ── Page header ── -->
    <div class="page-head">
      <div>
        <h1 class="page-title">Fuel Data</h1>
        <p class="page-sub">บันทึกการเติมน้ำมันรายวันต่อแท่น</p>
      </div>
    </div>

    <!-- ── Import modal overlay ── -->
    <teleport to="body">
      <div v-if="importState !== 'idle'" class="import-overlay" @click.self="cancelImport">
        <div class="import-modal">

          <div class="import-modal-head">
            <div>
              <div class="import-modal-title">Import Fuel Data</div>
              <div class="import-modal-sub" v-if="importState === 'preview'">
                {{ importFileName }}
                · Week {{ props.week?.week_id }} ({{ fmtDate(props.week?.week_start) }} – {{ fmtDate(props.week?.week_end) }})
                <span v-if="importEntries.length"> · <strong>{{ importEntries.length }}</strong> rows</span>
                <span v-if="importOutOfRange"> · <span style="color:var(--amber)">{{ importOutOfRange }} out of range</span></span>
                <span v-if="importSkipped"> · <span style="color:var(--ink-3)">{{ importSkipped }} invalid</span></span>
              </div>
            </div>
            <button type="button" class="btn" data-variant="ghost" data-size="sm" style="padding: 0 6px" @click="cancelImport">
              <span class="ic"><component :is="I.x" /></span>
            </button>
          </div>

          <!-- Loading state -->
          <div v-if="importState === 'loading'" class="import-loading">
            Parsing {{ importFileName }}…
          </div>

          <!-- Error state -->
          <div v-else-if="importState === 'error'" class="import-error">
            <p>{{ importError }}</p>
            <p class="import-hint">Make sure the file has columns: <strong>Rig</strong>, <strong>Date</strong>, <strong>Fuel (L)</strong></p>
          </div>

          <!-- Preview table -->
          <div v-else-if="importState === 'preview'" class="import-table-wrap">
            <p v-if="!importEntries.length" class="note" style="text-align:center; color:var(--ink-3); padding: 24px 0">
              No valid rows found. Check that your Excel has Rig, Date, and Fuel columns.
            </p>
            <table v-else class="tbl">
              <thead>
                <tr>
                  <th>Rig</th>
                  <th>Date</th>
                  <th>Shift</th>
                  <th class="r">Fuel (L)</th>
                  <th>Refuel Meter</th>
                  <th style="width:36px" />
                </tr>
              </thead>
              <tbody>
                <tr v-for="(e, i) in importEntries" :key="i">
                  <td class="mono" style="font-size:12px">{{ e.rig_id }}</td>
                  <td class="num">{{ fmtShortDate(e.work_date) }}</td>
                  <td>
                    <span class="mono" style="font-size:11px" :style="{ color: e.shift === 'day' ? 'var(--ink)' : 'var(--ink-3)' }">
                      {{ e.shift }}
                    </span>
                  </td>
                  <td class="num r"><strong>{{ fnum(e.fuel_litres, 0) }}</strong></td>
                  <td class="dim" style="font-size:12px">{{ e.refuel_meter ? fnum(e.refuel_meter, 1) : '—' }}</td>
                  <td class="c">
                    <button type="button" class="btn" data-variant="ghost" data-size="sm" style="padding:0 4px; color:var(--red)" @click="importEntries.splice(i, 1)">
                      <span class="ic"><component :is="I.x" /></span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Saving state -->
          <div v-else-if="importState === 'saving'" class="import-loading">
            Importing {{ importProgress }} / {{ importTotal }}…
          </div>

          <div class="import-modal-foot">
            <p v-if="importError && importState === 'preview'" class="note" style="color:var(--red); margin:0">{{ importError }}</p>
            <div class="save-entry-row" style="margin-top: 0">
              <button type="button" class="btn" data-variant="ghost" @click="cancelImport">
                {{ importState === 'saving' ? 'Close' : 'Cancel' }}
              </button>
              <button
                v-if="importState === 'preview'"
                type="button"
                class="btn"
                data-variant="primary"
                :disabled="!importEntries.length"
                @click="doImport"
              >
                <span class="ic"><component :is="I.check" /></span>
                Import {{ importEntries.length }} {{ importEntries.length === 1 ? 'entry' : 'entries' }}
              </button>
            </div>
          </div>

        </div>
      </div>
    </teleport>

    <div class="log-shell">

    <!-- ── Left: rig list ── -->
    <div class="log-list">
      <div class="fuel-list-header">
        <span class="ic"><component :is="I.search" /></span>
        <input v-model="rigQuery" placeholder="Filter rigs..." />
      </div>
      <div class="fuel-import-wrap">
        <button type="button" class="btn-import-block" @click="triggerImport">
          <span class="ic"><component :is="I.upload" /></span>
          Import Excel
        </button>
        <input ref="fileInput" type="file" accept=".xlsx,.xls" style="display:none" @change="onFileChange" />
      </div>

      <div v-if="!rigsStore.rigIds.length" class="fuel-list-empty">No rigs configured.</div>

      <div
        v-for="r in filteredRigs"
        :key="r"
        class="log-list-item"
        :data-active="r === selectedRig ? 'true' : undefined"
        @click="selectRig(r)"
      >
        <div class="log-list-id">{{ r }}</div>
        <div class="log-list-meta">
          <span class="num">{{ fnum(rigLitres(r), 0) }}</span> L ·
          <span class="num">{{ rigEntries(r) }}</span> {{ rigEntries(r) === 1 ? 'entry' : 'entries' }}
        </div>
      </div>
    </div>

    <!-- ── Right: entry form + recent entries ── -->
    <div>
      <Card v-if="selectedRig" :sub="`Week ${props.week?.week_id} · ${fmtDate(props.week?.week_start)} – ${fmtDate(props.week?.week_end)}`">
        <template #title>
          <span class="mono">{{ selectedRig }}</span>
        </template>
        <template #action>
          <div class="fuel-rig-kpis">
            <span class="fuel-kpi-chip">
              <span class="num">{{ fnum(rigLitres(selectedRig), 0) }}</span>
              <span class="fuel-kpi-unit">L total</span>
            </span>
            <span class="fuel-kpi-chip">
              <span class="num">{{ rigEntries(selectedRig) }}</span>
              <span class="fuel-kpi-unit">{{ rigEntries(selectedRig) === 1 ? 'entry' : 'entries' }}</span>
            </span>
          </div>
        </template>

        <!-- Form row 1: date + shift -->
        <div class="form-grid">
          <Field label="Work date" class="span-2">
            <input v-model="form.work_date" type="date" />
          </Field>
          <Field label="Shift" class="span-2">
            <div class="shift-toggle">
              <button type="button" :data-active="form.shift === 'day' ? 'true' : undefined" @click="form.shift = 'day'">Day</button>
              <button type="button" :data-active="form.shift === 'night' ? 'true' : undefined" @click="form.shift = 'night'">Night</button>
            </div>
          </Field>
        </div>

        <div class="hr" />

        <!-- Form row 2: fuel + notes -->
        <div class="form-grid">
          <Field label="Fuel (litres)" class="span-2">
            <input v-model.number="form.fuel_litres" class="mono" type="number" min="0" step="1" placeholder="0" />
          </Field>
          <Field label="Refuel Meter" class="span-2">
            <input v-model.number="form.refuel_meter" class="mono" type="number" min="0" step="0.1" placeholder="0.0" />
          </Field>
        </div>

        <p v-if="saveError" class="note" style="margin-top:10px; color: var(--red)">{{ saveError }}</p>

        <div class="save-entry-row">
          <button type="button" class="btn" data-variant="ghost" @click="clearForm">Clear</button>
          <button type="button" class="btn" data-variant="primary" :disabled="!canSave || store.saving" @click="saveEntry">
            <span class="ic"><component :is="I.check" /></span>
            {{ editingId ? 'Update entry' : 'Save entry' }}
          </button>
        </div>

        <div class="hr" />

        <!-- Recent entries for this rig -->
        <div class="recent-head">
          <div>Recent entries — {{ selectedRig }}</div>
        </div>

        <div v-if="store.loading" class="note" style="text-align:center">Loading…</div>
        <p v-else-if="!rigLog.length" class="note" style="text-align:center; color: var(--ink-3)">
          No entries yet for this rig this week.
        </p>
        <table v-else class="tbl">
          <thead>
            <tr>
              <th>Date</th>
              <th>Shift</th>
              <th class="r">Fuel (L)</th>
              <th>Refuel Meter</th>
              <th style="width: 72px" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in rigLog" :key="e.id" :data-editing="editingId === e.id ? 'true' : undefined">
              <td class="num">{{ fmtShortDate(e.work_date) }}</td>
              <td>
                <span class="mono" style="font-size:11px" :style="{ color: e.shift === 'day' ? 'var(--ink)' : 'var(--ink-3)' }">
                  {{ e.shift }}
                </span>
              </td>
              <td class="num r"><strong>{{ fnum(e.fuel_litres, 0) }}</strong></td>
              <td class="dim" style="font-size:12px">{{ e.refuel_meter ? fnum(e.refuel_meter, 1) : '—' }}</td>
              <td class="c" style="white-space:nowrap">
                <button type="button" class="btn" data-variant="ghost" data-size="sm" style="padding:0 6px" @click="loadEntry(e)">
                  <span class="ic"><component :is="I.edit" /></span>
                </button>
                <button type="button" class="btn" data-variant="ghost" data-size="sm" style="padding:0 6px; color: var(--red)" @click="deleteRow(e)">
                  <span class="ic"><component :is="I.x" /></span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>

      </Card>

      <Card v-else title="No rig selected" sub="Select a rig from the list to add or view fuel entries." />
    </div>

    </div><!-- /.log-shell -->
  </div><!-- /.fuel-page -->
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { fnum, fmtDate, I } from '../components/format.js';
import { parseFuelExcel } from '../components/fuelImport.js';
import { useFuelLogStore } from '../stores/FuelLog.stores.ts';
import { useRigsStore } from '../stores/Rigs.stores.ts';
import Card from '../components/Card.vue';
import Field from '../components/Field.vue';

const props = defineProps({
  week: { type: Object, required: true },
});

const store     = useFuelLogStore();
const rigsStore = useRigsStore();

watch(() => props.week?.week_id, (id) => {
  if (id != null) {
    store.loadedWeekId = null;
    store.loadByWeek(Number(id));
  }
}, { immediate: true });

// ── rig list ──────────────────────────────────────────────────────────────────
const rigQuery   = ref('');
const selectedRig = ref('');

const filteredRigs = computed(() => {
  const q = rigQuery.value.trim().toLowerCase();
  return rigsStore.rigIds.filter(r => !q || r.toLowerCase().includes(q));
});

function rigEntries(rig) {
  return store.fuelLog.filter(e => e.rig_id === rig).length;
}
function rigLitres(rig) {
  return store.fuelLog.filter(e => e.rig_id === rig).reduce((s, e) => s + Number(e.fuel_litres || 0), 0);
}

const rigLog = computed(() =>
  store.fuelLog
    .filter(e => e.rig_id === selectedRig.value)
    .sort((a, b) => String(b.work_date).localeCompare(String(a.work_date))),
);

// ── form ──────────────────────────────────────────────────────────────────────
const editingId = ref(null);
const saveError = ref('');

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function freshForm() {
  return { work_date: todayIso(), shift: 'day', rig_id: selectedRig.value, fuel_litres: null, refuel_meter: null };
}

const form = ref(freshForm());

const canSave = computed(() => form.value.work_date && Number(form.value.fuel_litres) > 0);

function clearForm() {
  editingId.value = null;
  saveError.value = '';
  form.value = freshForm();
  form.value.rig_id = selectedRig.value;
}

function selectRig(rig) {
  selectedRig.value = rig;
  clearForm();
  form.value.rig_id = rig;
}

// auto-select first rig
watch(filteredRigs, (list) => {
  if (!selectedRig.value && list.length) selectRig(list[0]);
}, { immediate: true });

function loadEntry(e) {
  editingId.value = e.id;
  saveError.value = '';
  form.value = {
    work_date:    fmtIso(e.work_date),
    shift:        e.shift,
    rig_id:       e.rig_id,
    fuel_litres:  e.fuel_litres,
    refuel_meter: e.refuel_meter,
  };
}

async function saveEntry() {
  saveError.value = '';
  if (!canSave.value) { saveError.value = 'Fill in date and fuel amount.'; return; }
  const payload = { ...form.value, rig_id: selectedRig.value, week_id: props.week.week_id };
  if (editingId.value) {
    await store.updateEntry(editingId.value, payload);
  } else {
    await store.addEntry(payload);
  }
  if (store.error) { saveError.value = store.error; return; }
  clearForm();
}

async function deleteRow(e) {
  if (confirm('Delete this fuel entry?')) {
    if (editingId.value === e.id) clearForm();
    await store.deleteEntry(e.id);
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────
function fmtShortDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' });
}

function fmtIso(value) {
  if (!value) return todayIso();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return todayIso();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── excel import ──────────────────────────────────────────────────────────────
const fileInput       = ref(null);
const importState     = ref('idle'); // idle | loading | preview | saving | error
const importFileName  = ref('');
const importEntries   = ref([]);
const importSkipped   = ref(0);
const importOutOfRange = ref(0);
const importError     = ref('');
const importProgress  = ref(0);
const importTotal     = ref(0);

function triggerImport() {
  if (fileInput.value) {
    fileInput.value.value = '';
    fileInput.value.click();
  }
}

function toIsoStr(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

async function onFileChange(evt) {
  const file = evt.target.files?.[0];
  if (!file) return;
  importFileName.value  = file.name;
  importError.value     = '';
  importOutOfRange.value = 0;
  importState.value     = 'loading';
  try {
    const { entries, skipped } = await parseFuelExcel(file);
    const weekStart = toIsoStr(props.week?.week_start);
    const weekEnd   = toIsoStr(props.week?.week_end);
    const inRange   = entries.filter(e => e.work_date >= weekStart && e.work_date <= weekEnd);
    importOutOfRange.value = entries.length - inRange.length;
    importEntries.value    = inRange;
    importSkipped.value    = skipped;
    if (!inRange.length) {
      const base = 'No rows fall within this week\'s date range';
      importError.value = entries.length
        ? `${base} (${weekStart} – ${weekEnd}). Found ${entries.length} row(s) outside the range.`
        : 'No valid rows found. Make sure the file has Rig, Date, and Fuel columns.';
      importState.value = 'error';
    } else {
      importState.value = 'preview';
    }
  } catch (err) {
    importError.value = err?.message ?? String(err);
    importState.value = 'error';
  }
}

async function doImport() {
  if (!importEntries.value.length) return;
  importTotal.value    = importEntries.value.length;
  importProgress.value = 0;
  importState.value    = 'saving';
  const weekId = props.week.week_id;
  for (const entry of importEntries.value) {
    await store.addEntry({ ...entry, week_id: weekId });
    importProgress.value++;
  }
  importState.value = 'idle';
}

function cancelImport() {
  importState.value   = 'idle';
  importEntries.value = [];
  importError.value   = '';
}
</script>

<style scoped>
.fuel-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 24px 32px 80px;
  max-width: 1480px;
  margin: 0 auto;
}

.fuel-import-wrap {
  padding: 8px 10px;
  border-bottom: 1px solid var(--line);
}

.btn-import-block {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 100%;
  height: 34px;
  border: none;
  border-radius: var(--radius);
  background: var(--green);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: background .15s, box-shadow .15s;
}
.btn-import-block:hover {
  background: #245f3b;
  box-shadow: 0 2px 8px rgba(46, 122, 76, 0.30);
}

.fuel-list-header {
  padding: 8px 10px;
  border-bottom: 1px solid var(--line);
  display: flex;
  gap: 6px;
  align-items: center;
  color: var(--ink-3);
}
.fuel-list-header input {
  border: 0;
  background: transparent;
  flex: 1;
  font-size: 12px;
  outline: none;
  color: var(--ink);
}

.fuel-list-empty {
  padding: 20px 14px;
  font-size: 12px;
  color: var(--ink-4);
  text-align: center;
}

.fuel-rig-kpis {
  display: flex;
  gap: 8px;
  align-items: center;
}

.fuel-kpi-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  padding: 3px 10px;
  background: var(--accent-soft);
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
}

.fuel-kpi-unit {
  font-size: 10px;
  font-weight: 400;
  color: var(--accent-ink);
}

.save-entry-row {
  margin-top: 20px;
}

.recent-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.recent-head > div {
  color: var(--ink-3);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

tr[data-editing="true"] td {
  background: var(--accent-soft);
}

/* ── import modal ── */
.import-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.import-modal {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  width: min(760px, 96vw);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.import-modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}

.import-modal-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
}

.import-modal-sub {
  font-size: 12px;
  color: var(--ink-3);
  margin-top: 2px;
}

.import-table-wrap {
  overflow-y: auto;
  flex: 1;
  padding: 0;
}

.import-loading,
.import-error {
  padding: 32px 20px;
  text-align: center;
  font-size: 13px;
  color: var(--ink-3);
  flex: 1;
}

.import-error {
  color: var(--red);
}

.import-hint {
  color: var(--ink-3);
  font-size: 12px;
  margin-top: 8px;
}

.import-modal-foot {
  border-top: 1px solid var(--line);
  padding: 12px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}
</style>
