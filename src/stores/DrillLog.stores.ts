import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient.js'
import { DRILL_LOG } from '../components/data.js'
import { cloneRow, toIsoDate } from '../components/demo.js'

let nextLogId = 50000

function configuredClient() {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')
  return sb
}

function ensureLogId(row: any) {
  if (!row.id) row.id = nextLogId++
  return row
}

function entryKey(e: any) {
  const date = toIsoDate(e.work_date) ?? String(e.work_date ?? '')
  return `${e.pattern_id}|${e.week_id}|${date}|${e.shift}|${e.rig_id}`
}

function toDbRow(e: any) {
  return {
    pattern_id:        e.pattern_id,
    week_id:           Number(e.week_id),
    work_date:         toIsoDate(e.work_date) ?? null,
    shift:             e.shift          ?? 'day',
    rig_id:            e.rig_id         ?? '',
    employee_name:     e.employee_name  ?? '',
    drill_bit_size_mm: Math.round(Number(e.drill_bit_size_mm) || 115),
    total_drilling_m:  Number(e.total_drilling_m) || 0,
    redrill_m:         Number(e.redrill_m)        || 0,
    smu_start:         Number(e.smu_start)         || 0,
    smu_end:           e.smu_end != null ? Number(e.smu_end) : null,
    smu_hr:            Number(e.smu_hr)            || 0,
    drifter_start:     Number(e.drifter_start)     || 0,
    drifter_end:       e.drifter_end != null ? Number(e.drifter_end) : null,
    drifter_hr:        Number(e.drifter_hr)        || 0,
    fuel_l:            Number(e.fuel_l)            || 0,
  }
}

export const useDrillLogStore = defineStore('drillLog', () => {
  const drillLog        = ref<any[]>([])
  const loading         = ref(false)
  const saving          = ref(false)
  const error           = ref('')
  const loadedWeekId    = ref<number | null>(null)
  const monthlyDrillLog = ref<any[]>([])
  const monthlyLoading  = ref(false)
  const loadedMonth     = ref('')

  // ── loadByWeek ─────────────────────────────────────────────────────────────
  async function loadByWeek(weekId: number) {
    if (Number.isNaN(weekId) || weekId == null) return
    loading.value = true
    error.value = ''
    loadedWeekId.value = weekId
    try {
      if (isSupabaseConfigured()) {
        const sb = configuredClient()
        const { data, error: err } = await sb
          .from('tdl_drill_log')
          .select('*')
          .eq('week_id', weekId)
          .order('work_date', { ascending: false })
          .order('id',        { ascending: false })
        if (err) throw err
        drillLog.value = data ?? []
      } else {
        await new Promise((r) => setTimeout(r, 80))
        const id = Number(weekId)
        drillLog.value = (DRILL_LOG as any[])
          .filter((e) => Number(e.week_id) === id)
          .map((e) => ensureLogId(cloneRow(e)))
      }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
    } finally {
      loading.value = false
    }
  }

  // ── loadByMonth ────────────────────────────────────────────────────────────
  async function loadByMonth(year: number, month: number) {
    const key = `${year}-${String(month).padStart(2, '0')}`
    if (loadedMonth.value === key) return
    monthlyLoading.value = true
    loadedMonth.value    = key
    try {
      const mm      = String(month).padStart(2, '0')
      const startDt = `${year}-${mm}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const endDt   = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`
      if (isSupabaseConfigured()) {
        const sb = configuredClient()
        const { data, error: err } = await sb
          .from('tdl_drill_log')
          .select('work_date, shift, rig_id, total_drilling_m, smu_hr')
          .gte('work_date', startDt)
          .lte('work_date', endDt)
          .order('work_date', { ascending: true })
        if (err) throw err
        monthlyDrillLog.value = data ?? []
      } else {
        await new Promise(r => setTimeout(r, 60))
        const startMs = new Date(startDt).getTime()
        const endMs   = new Date(endDt).getTime() + 86400000
        monthlyDrillLog.value = (DRILL_LOG as any[]).filter(e => {
          const t = new Date(e.work_date).getTime()
          return t >= startMs && t < endMs
        })
      }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
    } finally {
      monthlyLoading.value = false
    }
  }

  // ── upsertEntry ────────────────────────────────────────────────────────────
  async function upsertEntry(entry: any) {
    saving.value = true
    try {
      if (isSupabaseConfigured()) {
        const sb = configuredClient()
        const row = toDbRow(entry)
        let data: any
        if (entry.id) {
          // editing existing — update by primary key
          const { data: d, error: err } = await sb
            .from('tdl_drill_log')
            .update(row)
            .eq('id', entry.id)
            .select()
            .single()
          if (err) throw err
          data = d
          const idx = drillLog.value.findIndex((e) => e.id === entry.id)
          if (idx >= 0) drillLog.value[idx] = data
          else drillLog.value.unshift(data)
        } else {
          // new entry — always insert (allow multiple entries per shift/rig/pattern/date)
          const { data: d, error: err } = await sb
            .from('tdl_drill_log')
            .insert(row)
            .select()
            .single()
          if (err) throw err
          data = d
          drillLog.value.unshift(data)
        }
        return { data: [data], error: null }
      } else {
        // demo mode — sync to master DRILL_LOG array
        await new Promise((r) => setTimeout(r, 80))
        const normalized = { ...entry }
        if (normalized.work_date && !(normalized.work_date instanceof Date)) {
          normalized.work_date = new Date(normalized.work_date)
        }
        const saved = ensureLogId(normalized)
        const idxById = entry.id ? drillLog.value.findIndex((e) => e.id === entry.id) : -1
        if (idxById >= 0) {
          // editing existing entry — update in place
          drillLog.value[idxById] = cloneRow(saved)
          const masterIdx = (DRILL_LOG as any[]).findIndex((e) => e.id === entry.id)
          if (masterIdx >= 0) (DRILL_LOG as any[])[masterIdx] = { ...(DRILL_LOG as any[])[masterIdx], ...saved }
        } else {
          // new entry — always insert, never merge duplicates
          ;(DRILL_LOG as any[]).unshift(saved)
          drillLog.value.unshift(cloneRow(saved))
        }
        return { data: [cloneRow(saved)], error: null }
      }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
      return { data: null, error: err instanceof Error ? err : new Error(error.value) }
    } finally {
      saving.value = false
    }
  }

  // ── deleteEntry ────────────────────────────────────────────────────────────
  async function deleteEntry(id: number) {
    const row = drillLog.value.find((e) => e.id === id)
    if (!row) return { error: new Error('Entry not found') }
    try {
      if (isSupabaseConfigured()) {
        const sb = configuredClient()
        const { error: err } = await sb.from('tdl_drill_log').delete().eq('id', id)
        if (err) throw err
      } else {
        await new Promise((r) => setTimeout(r, 80))
        const masterIdx = (DRILL_LOG as any[]).findIndex((e) => e.id === id)
        if (masterIdx >= 0) (DRILL_LOG as any[]).splice(masterIdx, 1)
      }
      drillLog.value = drillLog.value.filter((e) => e.id !== id)
      return { error: null }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
      return { error: err instanceof Error ? err : new Error(error.value) }
    }
  }

  return {
    drillLog, loading, saving, error, loadedWeekId,
    monthlyDrillLog, monthlyLoading, loadedMonth,
    loadByWeek, loadByMonth, upsertEntry, deleteEntry,
  }
})
