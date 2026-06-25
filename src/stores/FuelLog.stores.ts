import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient.js'

let nextId = 90000

function toDbRow(e: any) {
  return {
    week_id:     Number(e.week_id),
    work_date:   e.work_date,
    shift:       e.shift ?? 'day',
    rig_id:      e.rig_id ?? '',
    fuel_litres:  Number(e.fuel_litres)  || 0,
    refuel_meter: Number(e.refuel_meter) || 0,
  }
}

export const useFuelLogStore = defineStore('fuelLog', () => {
  const fuelLog        = ref<any[]>([])
  const loading        = ref(false)
  const saving         = ref(false)
  const error          = ref('')
  const loadedWeekId   = ref<number | null>(null)
  const monthlyLog     = ref<any[]>([])
  const monthlyLoading = ref(false)
  const loadedMonth    = ref('')

  async function loadByWeek(weekId: number) {
    if (loadedWeekId.value === weekId) return
    loading.value      = true
    error.value        = ''
    loadedWeekId.value = weekId
    try {
      if (isSupabaseConfigured()) {
        const sb = getSupabase()!
        const { data, error: err } = await sb
          .from('tdl_fuel_log')
          .select('*')
          .eq('week_id', weekId)
          .order('work_date', { ascending: false })
          .order('id',        { ascending: false })
        if (err) throw err
        fuelLog.value = data ?? []
      } else {
        await new Promise(r => setTimeout(r, 60))
        fuelLog.value = []
      }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
    } finally {
      loading.value = false
    }
  }

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
        const sb = getSupabase()!
        const { data, error: err } = await sb
          .from('tdl_fuel_log')
          .select('*')
          .gte('work_date', startDt)
          .lte('work_date', endDt)
          .order('work_date', { ascending: true })
        if (err) throw err
        monthlyLog.value = data ?? []
      } else {
        await new Promise(r => setTimeout(r, 60))
        monthlyLog.value = []
      }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
    } finally {
      monthlyLoading.value = false
    }
  }

  async function loadByRange(startDt: string, endDt: string) {
    if (!startDt || !endDt) return
    const key = `${startDt}..${endDt}`
    if (loadedMonth.value === key) return
    monthlyLoading.value = true
    loadedMonth.value    = key
    try {
      if (isSupabaseConfigured()) {
        const sb = getSupabase()!
        const { data, error: err } = await sb
          .from('tdl_fuel_log')
          .select('*')
          .gte('work_date', startDt)
          .lte('work_date', endDt)
          .order('work_date', { ascending: true })
        if (err) throw err
        monthlyLog.value = data ?? []
      } else {
        await new Promise(r => setTimeout(r, 60))
        monthlyLog.value = []
      }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
    } finally {
      monthlyLoading.value = false
    }
  }

  async function addEntry(entry: any) {
    saving.value = true
    error.value  = ''
    try {
      if (isSupabaseConfigured()) {
        const sb = getSupabase()!
        const { data, error: err } = await sb
          .from('tdl_fuel_log')
          .insert(toDbRow(entry))
          .select()
          .single()
        if (err) throw err
        fuelLog.value.unshift(data)
      } else {
        fuelLog.value.unshift({ ...entry, id: nextId++ })
      }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
    } finally {
      saving.value = false
    }
  }

  async function updateEntry(id: number, patch: any) {
    const idx = fuelLog.value.findIndex(e => e.id === id)
    if (idx < 0) return
    fuelLog.value[idx] = { ...fuelLog.value[idx], ...patch }
    if (!isSupabaseConfigured()) return
    saving.value = true
    try {
      const sb = getSupabase()!
      const { error: err } = await sb
        .from('tdl_fuel_log')
        .update(toDbRow(fuelLog.value[idx]))
        .eq('id', id)
      if (err) throw err
    } catch (err: any) {
      error.value = err?.message ?? String(err)
    } finally {
      saving.value = false
    }
  }

  async function deleteEntry(id: number) {
    fuelLog.value = fuelLog.value.filter(e => e.id !== id)
    if (!isSupabaseConfigured()) return
    try {
      const sb = getSupabase()!
      const { error: err } = await sb
        .from('tdl_fuel_log')
        .delete()
        .eq('id', id)
      if (err) throw err
    } catch (err: any) {
      error.value = err?.message ?? String(err)
    }
  }

  return {
    fuelLog, loading, saving, error, loadedWeekId,
    monthlyLog, monthlyLoading, loadedMonth,
    loadByWeek, loadByMonth, loadByRange, addEntry, updateEntry, deleteEntry,
  }
})
