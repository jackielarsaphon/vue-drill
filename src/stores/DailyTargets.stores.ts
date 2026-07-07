import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient.js'
import { toIsoDate, cloneRow } from '../components/demo.js'

// In-memory store used when Supabase is not configured (demo mode).
const DEMO_DAILY_TARGETS: any[] = []
let nextLocalId = 80000

function configuredClient() {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')
  return sb
}

function ensureLocalId(row: any) {
  if (!row.id) row.id = nextLocalId++
  return row
}

function pitKey(v: any) {
  return String(v ?? '').trim()
}

function toDbRow(r: any) {
  return {
    week_id:       Number(r.week_id),
    plan_date:     toIsoDate(r.plan_date),
    pit_name:      pitKey(r.pit_name),
    drilling_m:    Number(r.drilling_m) || 0,
    blast_vol_bcm: Number(r.blast_vol_bcm) || 0,
  }
}

function isEmpty(r: any) {
  return !(Number(r.drilling_m) > 0) && !(Number(r.blast_vol_bcm) > 0)
}

export const useDailyTargetsStore = defineStore('dailyTargets', () => {
  const targets        = ref<any[]>([])
  const loading        = ref(false)
  const saving         = ref(false)
  const error          = ref('')
  const loadedWeekId   = ref<number | null>(null)
  const monthlyTargets = ref<any[]>([])
  const monthlyLoading = ref(false)
  const loadedMonth    = ref('')

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
          .from('tdl_daily_targets')
          .select('*')
          .eq('week_id', weekId)
        if (err) throw err
        targets.value = data ?? []
      } else {
        await new Promise((r) => setTimeout(r, 40))
        const id = Number(weekId)
        targets.value = DEMO_DAILY_TARGETS
          .filter((r) => Number(r.week_id) === id)
          .map((r) => cloneRow(r))
      }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
    } finally {
      loading.value = false
    }
  }

  // ── loadByMonth (date-range, ignores week_id) ──────────────────────────────
  async function loadByMonth(year: number, month: number) {
    monthlyLoading.value = true
    error.value = ''
    loadedMonth.value = `${year}-${String(month).padStart(2, '0')}`
    try {
      const mm      = String(month).padStart(2, '0')
      const startDt = `${year}-${mm}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const endDt   = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`
      if (isSupabaseConfigured()) {
        const sb = configuredClient()
        const { data, error: err } = await sb
          .from('tdl_daily_targets')
          .select('plan_date, drilling_m, blast_vol_bcm')
          .gte('plan_date', startDt)
          .lte('plan_date', endDt)
        if (err) throw err
        monthlyTargets.value = data ?? []
      } else {
        await new Promise((r) => setTimeout(r, 40))
        const startMs = new Date(startDt).getTime()
        const endMs   = new Date(endDt).getTime() + 86400000
        monthlyTargets.value = DEMO_DAILY_TARGETS
          .filter((r) => {
            const iso = toIsoDate(r.plan_date)
            if (!iso) return false
            const t = new Date(iso).getTime()
            return t >= startMs && t < endMs
          })
          .map((r) => cloneRow(r))
      }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
    } finally {
      monthlyLoading.value = false
    }
  }

  // ── loadByRange (explicit start/end date range) ────────────────────────────
  async function loadByRange(startDt: string, endDt: string) {
    if (!startDt || !endDt) return
    monthlyLoading.value = true
    error.value = ''
    loadedMonth.value = `${startDt}..${endDt}`
    try {
      if (isSupabaseConfigured()) {
        const sb = configuredClient()
        const { data, error: err } = await sb
          .from('tdl_daily_targets')
          .select('plan_date, drilling_m, blast_vol_bcm')
          .gte('plan_date', startDt)
          .lte('plan_date', endDt)
        if (err) throw err
        monthlyTargets.value = data ?? []
      } else {
        await new Promise((r) => setTimeout(r, 40))
        const startMs = new Date(startDt).getTime()
        const endMs   = new Date(endDt).getTime() + 86400000
        monthlyTargets.value = DEMO_DAILY_TARGETS
          .filter((r) => {
            const iso = toIsoDate(r.plan_date)
            if (!iso) return false
            const t = new Date(iso).getTime()
            return t >= startMs && t < endMs
          })
          .map((r) => cloneRow(r))
      }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
    } finally {
      monthlyLoading.value = false
    }
  }

  // ── saveMany (upsert rows with values; delete rows that became empty) ───────
  async function saveMany(rows: any[], weekId: number) {
    const id = Number(weekId)
    const toUpsert = rows.filter((r) => !isEmpty(r))
    const toDelete = rows.filter((r) => isEmpty(r))
    saving.value = true
    error.value = ''
    try {
      if (isSupabaseConfigured()) {
        const sb = configuredClient()

        if (toUpsert.length) {
          const { error: err } = await sb
            .from('tdl_daily_targets')
            .upsert(toUpsert.map(toDbRow), { onConflict: 'week_id,plan_date,pit_name' })
          if (err) throw err
        }

        for (const r of toDelete) {
          const iso = toIsoDate(r.plan_date)
          if (!iso) continue
          const { error: err } = await sb
            .from('tdl_daily_targets')
            .delete()
            .eq('week_id', id)
            .eq('plan_date', iso)
            .eq('pit_name', pitKey(r.pit_name))
          if (err) throw err
        }

        await loadByWeek(id)
        return { error: null }
      } else {
        await new Promise((r) => setTimeout(r, 40))
        for (const r of toUpsert) {
          const iso = toIsoDate(r.plan_date)
          const pit = pitKey(r.pit_name)
          const mi = DEMO_DAILY_TARGETS.findIndex(
            (x) => Number(x.week_id) === id && toIsoDate(x.plan_date) === iso && pitKey(x.pit_name) === pit,
          )
          const row = ensureLocalId({ week_id: id, plan_date: iso, pit_name: pit, drilling_m: Number(r.drilling_m) || 0, blast_vol_bcm: Number(r.blast_vol_bcm) || 0 })
          if (mi >= 0) DEMO_DAILY_TARGETS[mi] = { ...DEMO_DAILY_TARGETS[mi], ...row }
          else DEMO_DAILY_TARGETS.push(row)
        }
        for (const r of toDelete) {
          const iso = toIsoDate(r.plan_date)
          const pit = pitKey(r.pit_name)
          const mi = DEMO_DAILY_TARGETS.findIndex(
            (x) => Number(x.week_id) === id && toIsoDate(x.plan_date) === iso && pitKey(x.pit_name) === pit,
          )
          if (mi >= 0) DEMO_DAILY_TARGETS.splice(mi, 1)
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

  return {
    targets, loading, saving, error, loadedWeekId,
    monthlyTargets, monthlyLoading, loadedMonth,
    loadByWeek, loadByMonth, loadByRange, saveMany,
  }
})
