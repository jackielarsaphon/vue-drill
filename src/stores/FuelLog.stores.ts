import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createCrudStore } from '../lib/createCrudStore'
import { configuredClient, isSupabaseConfigured } from '../lib/supabaseHelpers'

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
  const crud = createCrudStore({ table: 'tdl_fuel_log', toDbRow, startId: 90000 })

  // Rename entries → fuelLog for backward-compatible API
  const fuelLog = crud.entries

  const monthlyLog     = ref<any[]>([])
  const monthlyLoading = ref(false)
  const loadedMonth    = ref('')

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
      crud.error.value = err?.message ?? String(err)
    } finally {
      monthlyLoading.value = false
    }
  }

  return {
    fuelLog,
    loading: crud.loading,
    saving: crud.saving,
    error: crud.error,
    loadedWeekId: crud.loadedWeekId,
    monthlyLog,
    monthlyLoading,
    loadedMonth,
    loadByWeek: crud.loadByWeek,
    loadByMonth,
    addEntry: crud.addEntry,
    updateEntry: crud.updateEntry,
    deleteEntry: crud.deleteEntry,
  }
})
