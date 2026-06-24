import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient.js'
import { toIsoDate, cloneRow } from '../components/demo.js'

// In-memory store used when Supabase is not configured (demo mode).
const DEMO_DAILY_PLAN: any[] = []
let nextLocalId = 70000

function configuredClient() {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')
  return sb
}

function ensureLocalId(row: any) {
  if (!row.id) row.id = nextLocalId++
  return row
}

function toDbRow(r: any) {
  return {
    pattern_id: r.pattern_id,
    week_id:    Number(r.week_id),
    plan_date:  toIsoDate(r.plan_date),
    plan_m:     Number(r.plan_m) || 0,
  }
}

export const useDailyPlanStore = defineStore('dailyPlan', () => {
  const dailyPlans   = ref<any[]>([])
  const loading      = ref(false)
  const saving       = ref(false)
  const error        = ref('')
  const loadedWeekId = ref<number | null>(null)

  // ── loadByWeek ─────────────────────────────────────────────────────────────
  async function loadByWeek(weekId: number) {
    if (weekId == null || Number.isNaN(Number(weekId))) return
    loading.value = true
    error.value = ''
    loadedWeekId.value = weekId
    try {
      if (isSupabaseConfigured()) {
        const sb = configuredClient()
        const { data, error: err } = await sb
          .from('tdl_pattern_daily_plan')
          .select('*')
          .eq('week_id', weekId)
        if (err) throw err
        dailyPlans.value = data ?? []
      } else {
        await new Promise((r) => setTimeout(r, 40))
        const id = Number(weekId)
        dailyPlans.value = DEMO_DAILY_PLAN
          .filter((r) => Number(r.week_id) === id)
          .map((r) => cloneRow(r))
      }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
    } finally {
      loading.value = false
    }
  }

  // ── saveMany (bulk upsert; rows with plan_m <= 0 are removed) ───────────────
  async function saveMany(rows: any[], weekId: number) {
    const id = Number(weekId)
    const toUpsert = rows.filter((r) => Number(r.plan_m) > 0)
    const toDelete = rows.filter((r) => !(Number(r.plan_m) > 0))
    saving.value = true
    error.value = ''
    try {
      if (isSupabaseConfigured()) {
        const sb = configuredClient()

        if (toUpsert.length) {
          const { error: err } = await sb
            .from('tdl_pattern_daily_plan')
            .upsert(toUpsert.map(toDbRow), { onConflict: 'pattern_id,week_id,plan_date' })
          if (err) throw err
        }

        // Clear out any zeroed-out cells that previously held a value.
        for (const r of toDelete) {
          const isoDate = toIsoDate(r.plan_date)
          if (!isoDate) continue
          const { error: err } = await sb
            .from('tdl_pattern_daily_plan')
            .delete()
            .eq('pattern_id', r.pattern_id)
            .eq('week_id', id)
            .eq('plan_date', isoDate)
          if (err) throw err
        }

        await loadByWeek(id)
        return { error: null }
      } else {
        await new Promise((r) => setTimeout(r, 40))
        for (const r of toUpsert) {
          const isoDate = toIsoDate(r.plan_date)
          const mi = DEMO_DAILY_PLAN.findIndex(
            (x) => x.pattern_id === r.pattern_id && Number(x.week_id) === id && toIsoDate(x.plan_date) === isoDate,
          )
          const row = ensureLocalId({ pattern_id: r.pattern_id, week_id: id, plan_date: isoDate, plan_m: Number(r.plan_m) || 0 })
          if (mi >= 0) DEMO_DAILY_PLAN[mi] = { ...DEMO_DAILY_PLAN[mi], ...row }
          else DEMO_DAILY_PLAN.push(row)
        }
        for (const r of toDelete) {
          const isoDate = toIsoDate(r.plan_date)
          const mi = DEMO_DAILY_PLAN.findIndex(
            (x) => x.pattern_id === r.pattern_id && Number(x.week_id) === id && toIsoDate(x.plan_date) === isoDate,
          )
          if (mi >= 0) DEMO_DAILY_PLAN.splice(mi, 1)
        }
        await loadByWeek(id)
        return { error: null }
      }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
      return { error: err instanceof Error ? err : new Error(error.value) }
    } finally {
      saving.value = false
    }
  }

  return { dailyPlans, loading, saving, error, loadedWeekId, loadByWeek, saveMany }
})
