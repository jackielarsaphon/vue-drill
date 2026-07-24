<template>
  <div class="dt-page">

    <div class="page-head">
      <div>
        <h1 class="page-title">Down Time</h1>
        <p class="page-sub">บันทึกเวลาหยุดทำงานรายวัน</p>
      </div>
      <div class="page-head-kpis">
        <span class="kpi-chip">
          <span class="num">{{ totalHr }}</span>
          <span class="kpi-unit">hrs total</span>
        </span>
        <span class="kpi-chip">
          <span class="num">{{ store.entries.length }}</span>
          <span class="kpi-unit">entries</span>
        </span>
      </div>
    </div>

    <!-- ── Form ── -->
    <Card title="New Entry">
      <div class="form-grid-dt">
        <Field label="Date">
          <input v-model="form.work_date" type="date" />
        </Field>

        <Field label="Shift">
          <div class="shift-toggle">
            <button type="button" :data-active="form.shift === 'day' ? 'true' : undefined" @click="form.shift = 'day'">Day</button>
            <button type="button" :data-active="form.shift === 'night' ? 'true' : undefined" @click="form.shift = 'night'">Night</button>
          </div>
        </Field>

        <Field label="Rig">
          <select v-model="form.air_code" class="field-select">

            <option v-for="r in rigsStore.rigs" :key="r.rig_id" :value="r.rig_id">
              {{ r.rig_id }}
            </option>
          </select>
        </Field>

        <Field label="Reason Code" hint="Type code or description to filter">
          <div class="op-combo">
            <input
              v-model="rcQuery"
              placeholder="Code or description…"
              autocomplete="off"
              @focus="showRcDrop = true"
              @input="showRcDrop = true"
              @blur="onRcBlur"
            />
            <ul v-if="showRcDrop && filteredReasonCodes.length" class="op-drop">
              <li
                v-for="c in filteredReasonCodes"
                :key="c.id"
                :data-active="c.code === form.reason_code ? 'true' : undefined"
                @mousedown.prevent="selectReasonCode(c)"
              >
                <span class="op-code">{{ c.code }}</span>
                <span class="op-name">{{ c.description }}</span>
              </li>
            </ul>
          </div>
        </Field>

        <Field label="Operator" hint="Type code or name to filter">
          <div class="op-combo">
            <input
              v-model="opQuery"
              placeholder="Code or name…"
              autocomplete="off"
              @focus="showOpDrop = true"
              @input="showOpDrop = true"
              @blur="onOpBlur"
            />
            <ul v-if="showOpDrop && filteredOperators.length" class="op-drop">
              <li
                v-for="o in filteredOperators"
                :key="o.operator_id"
                :data-active="o.name === form.operator ? 'true' : undefined"
                @mousedown.prevent="selectOperator(o)"
              >
                <span class="op-code">{{ o.operator_id }}</span>
                <span class="op-name">{{ o.name }}</span>
              </li>
            </ul>
          </div>
        </Field>

        <Field label="Start Time">
          <TimePickerClock v-model="form.start_time" />
        </Field>

        <Field label="End Time">
          <TimePickerClock v-model="form.end_time" />
        </Field>

        <Field label="Sum (H:MM)">
          <input :value="calcHr" type="text" readonly class="mono" style="background:var(--surface-2); color:var(--ink-3)" />
        </Field>

        <Field label="Remark" class="span-3">
          <input v-model="form.remark" type="text" placeholder="Optional remark" />
        </Field>
      </div>

      <p v-if="saveError" class="note" style="margin-top:10px; color:var(--red)">{{ saveError }}</p>

      <div class="save-entry-row">
        <button type="button" class="btn" data-variant="ghost" @click="clearForm">Clear</button>
        <button type="button" class="btn" data-variant="primary" :disabled="!canSave || store.saving" @click="saveEntry">
          <span class="ic"><component :is="I.check" /></span>
          {{ editingId ? 'Update entry' : 'Save entry' }}
        </button>
      </div>
    </Card>

    <!-- ── Table ── -->
    <Card title="Entries this week">
      <div v-if="store.loading" class="note" style="text-align:center">Loading…</div>
      <p v-else-if="!store.entries.length" class="note" style="text-align:center; color:var(--ink-3)">
        No entries yet this week.
      </p>
      <div v-else class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Date</th>
              <th>Shift</th>
              <th>Rig</th>
              <th>Reason Code</th>
              <th>Operator</th>
              <th>Start</th>
              <th>End</th>
              <th class="r">Sum (H:MM)</th>
              <th>Remark</th>
              <th style="width:72px" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in store.entries" :key="e.id" :data-editing="editingId === e.id ? 'true' : undefined">
              <td class="num">{{ fmtShortDate(e.work_date) }}</td>
              <td>
                <span class="mono" style="font-size:11px" :style="{ color: e.shift === 'day' ? 'var(--ink)' : 'var(--ink-3)' }">
                  {{ e.shift }}
                </span>
              </td>
              <td class="mono">{{ e.air_code || '—' }}</td>
              <td class="mono">{{ e.reason_code || '—' }}</td>
              <td>{{ e.operator || '—' }}</td>
              <td class="mono">{{ e.start_time || '—' }}</td>
              <td class="mono">{{ e.end_time || '—' }}</td>
              <td class="num r"><strong>{{ fmtHrMin(e.sum_hr) }}</strong></td>
              <td class="dim" style="max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">
                {{ e.remark || '—' }}
              </td>
              <td class="c" style="white-space:nowrap">
                <button type="button" class="btn" data-variant="ghost" data-size="sm" style="padding:0 6px" @click="loadEntry(e)">
                  <span class="ic"><component :is="I.edit" /></span>
                </button>
                <button type="button" class="btn" data-variant="ghost" data-size="sm" style="padding:0 6px; color:var(--red)" @click="deleteRow(e)">
                  <span class="ic"><component :is="I.x" /></span>
                </button>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="8" style="text-align:right; font-size:11px; color:var(--ink-3); font-weight:700; letter-spacing:.08em; text-transform:uppercase; padding-right:8px">Total</td>
              <td class="num r"><strong>{{ fmtHrMin(totalHr) }}</strong></td>
              <td colspan="2" />
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { I } from '../components/format.js'
import { useDownTimeStore }   from '../stores/DownTime.stores.ts'
import { useRigsStore }       from '../stores/Rigs.stores.ts'
import { useReasonCodeStore } from '../stores/ReasonCode.stores.ts'
import { useOperatorsStore }  from '../stores/Operators.stores.ts'
import Card from '../components/Card.vue'
import Field from '../components/Field.vue'
import TimePickerClock from '../components/TimePickerClock.vue'

const props = defineProps({
  week: { type: Object, required: true },
})

const store         = useDownTimeStore()
const rigsStore     = useRigsStore()
const rcStore       = useReasonCodeStore()
const operatorsStore = useOperatorsStore()

const opQuery    = ref('')
const showOpDrop = ref(false)

const filteredOperators = computed(() => {
  const q = opQuery.value.trim().toLowerCase()
  if (!q) return operatorsStore.operators
  return operatorsStore.operators.filter(
    o => o.operator_id.toLowerCase().includes(q) || o.name.toLowerCase().includes(q)
  )
})

function selectOperator(o) {
  form.value.operator = o.name
  opQuery.value       = o.name
  showOpDrop.value    = false
}

function onOpBlur() {
  setTimeout(() => { showOpDrop.value = false }, 160)
  const val = opQuery.value.trim()
  const byCode = operatorsStore.operators.find(o => o.operator_id.toLowerCase() === val.toLowerCase())
  if (byCode) selectOperator(byCode)
  else if (val) form.value.operator = val
}

const rcQuery    = ref('')
const showRcDrop = ref(false)

const filteredReasonCodes = computed(() => {
  const q = rcQuery.value.trim().toLowerCase()
  if (!q) return rcStore.codes
  return rcStore.codes.filter(
    c => c.code.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q)
  )
})

function selectReasonCode(c) {
  form.value.reason_code = c.code
  rcQuery.value          = c.code
  showRcDrop.value       = false
  if (c.description) form.value.remark = c.description
}

function onRcBlur() {
  setTimeout(() => { showRcDrop.value = false }, 160)
  const val = rcQuery.value.trim()
  const found = rcStore.codes.find(c => c.code.toLowerCase() === val.toLowerCase())
  if (found) selectReasonCode(found)
  else form.value.reason_code = val
}

watch(() => props.week?.week_id, (id) => {
  if (id != null) {
    store.loadedWeekId = null
    store.loadByWeek(Number(id))
  }
}, { immediate: true })

// ── form ────────────────────────────────────────────────────────────────────
const editingId = ref(null)
const saveError = ref('')

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function freshForm() {
  return { work_date: todayIso(), shift: 'day', air_code: '', reason_code: '', operator: '', start_time: '', end_time: '', remark: '' }
}

const form = ref(freshForm())

watch(() => rigsStore.rigs, (rigs) => {
  if (rigs.length && !form.value.air_code) {
    form.value.air_code = rigs[0].rig_id
  }
}, { immediate: true })

watch(() => operatorsStore.operators, (list) => {
  if (list.length && !form.value.operator) {
    form.value.operator = list[0].name
    opQuery.value       = list[0].name
  }
}, { immediate: true })


const calcHr = computed(() => {
  const hr = computeHr(form.value.start_time, form.value.end_time)
  return hr > 0 ? fmtHrMin(hr) : '—'
})

// แปลงชั่วโมงทศนิยม (เก็บใน DB) → รูปแบบ ชม:นาที เช่น 0.083 → "0:05"
function fmtHrMin(hr) {
  const totalMins = Math.round((Number(hr) || 0) * 60)
  const hh = Math.floor(totalMins / 60)
  const mm = totalMins % 60
  return `${hh}:${String(mm).padStart(2, '0')}`
}

const canSave = computed(() => form.value.work_date && form.value.start_time && form.value.end_time)

const totalHr = computed(() => store.entries.reduce((s, e) => s + Number(e.sum_hr || 0), 0))

function computeHr(start, end) {
  const s = toHHMM(start), e = toHHMM(end)
  if (!s || !e) return 0
  const [sh, sm] = s.split(':').map(Number)
  const [eh, em] = e.split(':').map(Number)
  let mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins < 0) mins += 24 * 60  // overnight
  return Math.round((mins / 60) * 100) / 100
}

// normalize ค่าเวลา → HH:MM (24 ชม.)
// เช่น 600 → 06:00, 0605 → 06:05, 6:5 → 06:05
function toHHMM(v) {
  const digits = String(v || '').replace(/\D/g, '')
  if (!digits) return ''
  let hh, mm
  if (digits.length <= 2)      { hh = digits;            mm = '00' }
  else if (digits.length === 3){ hh = digits.slice(0, 1); mm = digits.slice(1) }
  else                         { hh = digits.slice(0, 2); mm = digits.slice(2, 4) }
  const h = Math.min(23, parseInt(hh, 10) || 0)
  const m = Math.min(59, parseInt(mm, 10) || 0)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function clearForm() {
  editingId.value = null
  saveError.value = ''
  // คงค่า Date / Shift / Rig / Operator ที่เลือกไว้ล่าสุด จนกว่าผู้ใช้จะเปลี่ยนเอง
  const keepDate     = form.value.work_date || todayIso()
  const keepShift    = form.value.shift || 'day'
  const keepAirCode  = form.value.air_code || (rigsStore.rigs[0]?.rig_id ?? '')
  const keepOperator = form.value.operator || (operatorsStore.operators[0]?.name ?? '')
  form.value = freshForm()
  form.value.work_date = keepDate
  form.value.shift     = keepShift
  form.value.air_code  = keepAirCode
  form.value.operator  = keepOperator
  opQuery.value = keepOperator
  rcQuery.value = ''
}

function loadEntry(e) {
  editingId.value = e.id
  saveError.value = ''
  form.value = {
    work_date:   fmtIso(e.work_date),
    shift:       e.shift,
    air_code:    e.air_code,
    reason_code: e.reason_code,
    operator:    e.operator,
    start_time:  e.start_time,
    end_time:    e.end_time,
    remark:      e.remark,
  }
  opQuery.value = e.operator || ''
  rcQuery.value = e.reason_code || ''
}

async function saveEntry() {
  saveError.value = ''
  if (!canSave.value) { saveError.value = 'กรุณากรอก Date, Start Time และ End Time'; return }
  form.value.start_time = toHHMM(form.value.start_time)
  form.value.end_time   = toHHMM(form.value.end_time)
  const sum_hr = computeHr(form.value.start_time, form.value.end_time)
  const payload = { ...form.value, sum_hr, week_id: props.week.week_id }
  if (editingId.value) {
    await store.updateEntry(editingId.value, payload)
  } else {
    await store.addEntry(payload)
  }
  if (store.error) { saveError.value = store.error; return }
  clearForm()
}

async function deleteRow(e) {
  if (confirm('Delete this down time entry?')) {
    if (editingId.value === e.id) clearForm()
    await store.deleteEntry(e.id)
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────
onMounted(() => {
  rigsStore.loadAll()
  rcStore.loadAll()
  operatorsStore.loadAll()
})

function fmtShortDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10)
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })
}


function fmtIso(value) {
  if (!value) return todayIso()
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return todayIso()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
</script>

<style scoped>
.dt-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px 32px 80px;
  max-width: 1480px;
  margin: 0 auto;
}

.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.page-head-kpis {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}

.kpi-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  padding: 4px 12px;
  background: var(--accent-soft);
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  color: var(--accent);
}

.kpi-unit {
  font-size: 10px;
  font-weight: 400;
  color: var(--accent-ink);
}

.form-grid-dt {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px 16px;
}

.span-3 {
  grid-column: span 3;
}

@media (max-width: 768px) {
  .dt-page { padding: 16px 16px 72px; }
  .page-head { flex-direction: column; align-items: stretch; }
  .form-grid-dt { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .form-grid-dt .span-3 { grid-column: span 2; }
}

@media (max-width: 480px) {
  .form-grid-dt { grid-template-columns: minmax(0, 1fr); }
  .form-grid-dt .span-3 { grid-column: span 1; }
}

.save-entry-row {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.tbl-wrap {
  overflow-x: auto;
}

tfoot td {
  padding-top: 8px;
  border-top: 2px solid var(--line);
}

tr[data-editing="true"] td {
  background: var(--accent-soft);
}

/* shift toggle reuse from FuelDataPage */
.field-select {
  width: 100%;
  height: 34px;
  border: 1px solid var(--accent);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--ink);
  padding: 0 32px 0 10px;
  font-size: 13px;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%232541B2' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
}
.field-select:focus {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
}

.shift-toggle {
  display: flex;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
}
.shift-toggle button {
  flex: 1;
  border: none;
  background: transparent;
  padding: 6px 0;
  font-size: 12px;
  cursor: pointer;
  color: var(--ink-3);
  transition: background .12s, color .12s;
}
.shift-toggle button[data-active] {
  background: var(--accent);
  color: #fff;
  font-weight: 600;
}

/* operator combobox */
.op-combo { position: relative; }
.op-combo input { width: 100%; }
.op-drop {
  position: absolute;
  z-index: 50;
  top: calc(100% + 2px);
  left: 0; right: 0;
  margin: 0; padding: 4px 0;
  list-style: none;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0,0,0,.12);
  max-height: 220px;
  overflow-y: auto;
}
.op-drop li {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 13px;
}
.op-drop li:hover, .op-drop li[data-active="true"] { background: var(--surface-2); }
.op-code { font-family: var(--font-mono); font-size: 11px; color: var(--ink-3); min-width: 36px; }
.op-name { color: var(--ink); }
</style>
