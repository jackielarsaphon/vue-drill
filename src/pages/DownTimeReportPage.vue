<template>
  <div class="dtr-page">

    <div class="page-head">
      <div>
        <h1 class="page-title">Down Time Report</h1>
        <p class="page-sub">สรุปข้อมูลเวลาหยุดทำงาน</p>
      </div>
    </div>

    <!-- Filter -->
    <Card title="ช่วงเวลา">
      <div class="filter-row">
        <Field label="From">
          <input v-model="from" type="date" />
        </Field>
        <Field label="To">
          <input v-model="to" type="date" />
        </Field>
        <Field label="Rig">
          <select v-model="filterRig" class="field-select">
            <option value="">ทั้งหมด</option>
            <option v-for="r in uniqueRigs" :key="r" :value="r">{{ r }}</option>
          </select>
        </Field>
        <Field label="Reason Code">
          <select v-model="filterReason" class="field-select">
            <option value="">ทั้งหมด</option>
            <option v-for="r in uniqueReasons" :key="r" :value="r">{{ r }}</option>
          </select>
        </Field>
        <button type="button" class="btn" data-variant="primary" :disabled="rStore.loading" @click="loadReport">
          {{ rStore.loading ? 'Loading…' : 'Load Report' }}
        </button>
      </div>
      <p v-if="rStore.error" class="note" style="margin-top:10px;color:var(--red)">{{ rStore.error }}</p>
    </Card>

    <!-- KPIs -->
    <div v-if="rStore.entries.length" class="kpi-row">
      <div class="kpi">
        <div class="kpi-label">Total Down Time</div>
        <div class="kpi-val">{{ fnum(filteredTotalHr, 2) }}<span class="kpi-unit">hrs</span></div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Entries</div>
        <div class="kpi-val">{{ filteredEntries.length }}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Rigs Affected</div>
        <div class="kpi-val">{{ uniqueRigs.length }}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Reason Codes Used</div>
        <div class="kpi-val">{{ uniqueReasons.length }}</div>
      </div>
    </div>

    <!-- Detail -->
    <Card v-if="rStore.entries.length" title="รายละเอียดทั้งหมด">
      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Date</th>
              <th>Shift</th>
              <th>Rig</th>
              <th>Reason</th>
              <th>Operator</th>
              <th>Start</th>
              <th>End</th>
              <th class="r">Hrs</th>
              <th>Remark</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in filteredEntries" :key="e.id">
              <td class="num">{{ fmtDate(e.work_date) }}</td>
              <td><span class="mono" style="font-size:11px" :style="{ color: e.shift === 'night' ? 'var(--ink-3)' : 'var(--ink)' }">{{ e.shift }}</span></td>
              <td class="mono">{{ e.air_code || '—' }}</td>
              <td class="mono">{{ e.reason_code || '—' }}</td>
              <td>{{ e.operator || '—' }}</td>
              <td class="mono">{{ e.start_time || '—' }}</td>
              <td class="mono">{{ e.end_time || '—' }}</td>
              <td class="num r"><strong>{{ fnum(e.sum_hr, 2) }}</strong></td>
              <td class="dim" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ e.remark || '—' }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="7" style="text-align:right;font-size:11px;color:var(--ink-3);font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding-right:8px">Total</td>
              <td class="num r"><strong>{{ fnum(filteredTotalHr, 2) }}</strong></td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>

    <p v-else-if="!rStore.loading" class="note" style="text-align:center">
      เลือกช่วงเวลาแล้วกด Load Report
    </p>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { fnum } from '../components/format.js'
import { useDownTimeReportStore } from '../stores/DownTimeReport.stores.ts'
import { useReasonCodeStore }     from '../stores/ReasonCode.stores.ts'
import Card  from '../components/Card.vue'
import Field from '../components/Field.vue'

const rStore  = useDownTimeReportStore()
const rcStore = useReasonCodeStore()

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function monthAgoIso() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

const from        = ref(monthAgoIso())
const to          = ref(todayIso())
const filterRig    = ref('')
const filterReason = ref('')

async function loadReport() {
  filterRig.value    = ''
  filterReason.value = ''
  await rStore.load(from.value, to.value)
}

const uniqueRigs    = computed(() => [...new Set(rStore.entries.map(e => e.air_code).filter(Boolean))].sort())
const uniqueReasons = computed(() => [...new Set(rStore.entries.map(e => e.reason_code).filter(Boolean))].sort())

const filteredEntries = computed(() => rStore.entries.filter(e => {
  if (filterRig.value    && e.air_code    !== filterRig.value)    return false
  if (filterReason.value && e.reason_code !== filterReason.value) return false
  return true
}))

const totalHr         = computed(() => rStore.entries.reduce((s, e) => s + Number(e.sum_hr || 0), 0))
const filteredTotalHr = computed(() => filteredEntries.value.reduce((s, e) => s + Number(e.sum_hr || 0), 0))

const byReason = computed(() => {
  const map = new Map()
  for (const e of rStore.entries) {
    const key = e.reason_code || '—'
    if (!map.has(key)) {
      const rc = rcStore.codes.find(c => c.code === key)
      map.set(key, { code: key, description: rc?.description || '', count: 0, total: 0 })
    }
    const r = map.get(key)
    r.count++
    r.total += Number(e.sum_hr || 0)
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
})

const byRig = computed(() => {
  const map = new Map()
  for (const e of rStore.entries) {
    const key = e.air_code || '—'
    if (!map.has(key)) map.set(key, { rig: key, count: 0, total: 0 })
    const r = map.get(key)
    r.count++
    r.total += Number(e.sum_hr || 0)
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
})

function fmtDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10)
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: '2-digit' })
}

onMounted(() => {
  rcStore.loadAll()
  loadReport()
})
</script>

<style scoped>
.dtr-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px 32px 80px;
  max-width: 1480px;
  margin: 0 auto;
}
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-title { margin: 0; font-size: 18px; }
.page-sub   { margin: 4px 0 0; color: var(--ink-3); font-size: 12px; }

.filter-row {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  flex-wrap: wrap;
}

.field-select {
  height: 32px;
  border: 1px solid var(--accent);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--ink);
  padding: 0 28px 0 10px;
  font-size: 13px;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%232541B2' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  min-width: 120px;
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.tbl-wrap { overflow-x: auto; }

tfoot td {
  padding-top: 8px;
  border-top: 2px solid var(--line);
}
</style>
