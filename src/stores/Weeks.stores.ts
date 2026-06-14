import { defineStore } from 'pinia'
import { ref } from 'vue'
import { isSupabaseConfigured } from '../lib/supabaseClient.js'
import { configuredClient } from '../lib/supabaseHelpers'
import { WEEKS } from '../components/data.js'

export interface Week {
  week_id: number
  week_start: string | Date
  week_end: string | Date
  status: 'draft' | 'active' | 'locked' | 'archived'
  plan_source: string
  header_locked: boolean
}

type WeekPayload = Omit<Week, 'week_id'>

function mapRow(w: any): Week {
  return {
    week_id:       w.week_id,
    week_start:    w.week_start,
    week_end:      w.week_end,
    status:        w.status ?? 'draft',
    plan_source:   w.plan_source ?? 'LXML',
    header_locked: w.header_locked ?? false,
  }
}

export const useWeeksStore = defineStore('weeks', () => {
  const weeks = ref<Week[]>([])
  const loading = ref(false)
  const error = ref('')

  async function loadAll() {
    loading.value = true
    error.value = ''
    try {
      if (isSupabaseConfigured()) {
        const sb = configuredClient()
        const { data, error: err } = await sb
          .from('tdl_weeks')
          .select('week_id, week_start, week_end, status, plan_source, header_locked')
          .order('week_id', { ascending: true })
        if (err) throw err
        weeks.value = (data ?? []).map(mapRow)
      } else {
        await new Promise((r) => setTimeout(r, 80))
        weeks.value = (WEEKS as any[]).map((w) => ({ ...w, header_locked: w.header_locked ?? false }))
      }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
    } finally {
      loading.value = false
    }
  }

  async function create(payload: Partial<WeekPayload>): Promise<{ data: Week | null; error: Error | null }> {
    try {
      if (isSupabaseConfigured()) {
        const sb = configuredClient()
        const { data, error: err } = await sb
          .from('tdl_weeks')
          .insert({
            week_start:    payload.week_start,
            week_end:      payload.week_end,
            status:        payload.status ?? 'draft',
            plan_source:   payload.plan_source ?? 'LXML',
            header_locked: payload.header_locked ?? false,
          })
          .select('week_id, week_start, week_end, status, plan_source, header_locked')
          .single()
        if (err) throw err
        const created = mapRow(data)
        weeks.value.push(created)
        return { data: created, error: null }
      } else {
        const week_id = (WEEKS as any[]).reduce((max: number, w: any) => Math.max(max, w.week_id), 0) + 1
        const created: Week = {
          week_id,
          week_start:    payload.week_start!,
          week_end:      payload.week_end!,
          status:        payload.status ?? 'draft',
          plan_source:   payload.plan_source ?? 'LXML',
          header_locked: payload.header_locked ?? false,
        }
        ;(WEEKS as any[]).push(created)
        weeks.value.push({ ...created })
        return { data: created, error: null }
      }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
      return { data: null, error: err instanceof Error ? err : new Error(error.value) }
    }
  }

  async function update(weekId: number, payload: Partial<Week>): Promise<{ data: Week | null; error: Error | null }> {
    const idx = weeks.value.findIndex((w) => w.week_id === weekId)
    if (idx < 0) return { data: null, error: new Error('Week not found') }
    try {
      if (isSupabaseConfigured()) {
        const sb = configuredClient()
        const { error: err } = await sb.from('tdl_weeks').update(payload).eq('week_id', weekId)
        if (err) throw err
      } else {
        const master = (WEEKS as any[]).find((w: any) => w.week_id === weekId)
        if (master) Object.assign(master, payload)
      }
      Object.assign(weeks.value[idx], payload)
      return { data: { ...weeks.value[idx] }, error: null }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
      return { data: null, error: err instanceof Error ? err : new Error(error.value) }
    }
  }

  async function destroy(weekId: number): Promise<{ error: Error | null }> {
    try {
      if (isSupabaseConfigured()) {
        const sb = configuredClient()
        const { error: err } = await sb.from('tdl_weeks').delete().eq('week_id', weekId)
        if (err) throw err
      } else {
        const idx = (WEEKS as any[]).findIndex((w: any) => w.week_id === weekId)
        if (idx >= 0) (WEEKS as any[]).splice(idx, 1)
      }
      weeks.value = weeks.value.filter((w) => w.week_id !== weekId)
      return { error: null }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
      return { error: err instanceof Error ? err : new Error(error.value) }
    }
  }

  return { weeks, loading, error, loadAll, create, update, destroy }
})
