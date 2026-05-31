import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient.js'

let nextId = 80000

function toDbRow(e: any) {
  return {
    week_id:     Number(e.week_id),
    work_date:   e.work_date,
    shift:       e.shift ?? 'day',
    air_code:    e.air_code ?? '',
    reason_code: e.reason_code ?? '',
    operator:    e.operator ?? '',
    start_time:  e.start_time ?? '',
    end_time:    e.end_time ?? '',
    sum_hr:      Number(e.sum_hr) || 0,
    remark:      e.remark ?? '',
  }
}

export const useDownTimeStore = defineStore('downTime', () => {
  const entries      = ref<any[]>([])
  const loading      = ref(false)
  const saving       = ref(false)
  const error        = ref('')
  const loadedWeekId = ref<number | null>(null)

  async function loadByWeek(weekId: number) {
    if (loadedWeekId.value === weekId) return
    loading.value      = true
    error.value        = ''
    loadedWeekId.value = weekId
    try {
      if (isSupabaseConfigured()) {
        const sb = getSupabase()!
        const { data, error: err } = await sb
          .from('tdl_downtime')
          .select('*')
          .eq('week_id', weekId)
          .order('work_date', { ascending: false })
          .order('id',        { ascending: false })
        if (err) throw err
        entries.value = data ?? []
      } else {
        await new Promise(r => setTimeout(r, 60))
        entries.value = []
      }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
    } finally {
      loading.value = false
    }
  }

  async function addEntry(entry: any) {
    saving.value = true
    error.value  = ''
    try {
      if (isSupabaseConfigured()) {
        const sb = getSupabase()!
        const { data, error: err } = await sb
          .from('tdl_downtime')
          .insert(toDbRow(entry))
          .select()
          .single()
        if (err) throw err
        entries.value.unshift(data)
      } else {
        entries.value.unshift({ ...entry, id: nextId++ })
      }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
    } finally {
      saving.value = false
    }
  }

  async function updateEntry(id: number, patch: any) {
    const idx = entries.value.findIndex(e => e.id === id)
    if (idx < 0) return
    entries.value[idx] = { ...entries.value[idx], ...patch }
    if (!isSupabaseConfigured()) return
    saving.value = true
    try {
      const sb = getSupabase()!
      const { error: err } = await sb
        .from('tdl_downtime')
        .update(toDbRow(entries.value[idx]))
        .eq('id', id)
      if (err) throw err
    } catch (err: any) {
      error.value = err?.message ?? String(err)
    } finally {
      saving.value = false
    }
  }

  async function deleteEntry(id: number) {
    entries.value = entries.value.filter(e => e.id !== id)
    if (!isSupabaseConfigured()) return
    try {
      const sb = getSupabase()!
      const { error: err } = await sb
        .from('tdl_downtime')
        .delete()
        .eq('id', id)
      if (err) throw err
    } catch (err: any) {
      error.value = err?.message ?? String(err)
    }
  }

  return {
    entries, loading, saving, error, loadedWeekId,
    loadByWeek, addEntry, updateEntry, deleteEntry,
  }
})
