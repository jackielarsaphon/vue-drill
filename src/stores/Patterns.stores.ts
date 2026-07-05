import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient.js'
import { PATTERNS } from '../components/data.js'
import { cloneRow } from '../components/demo.js'

let nextLocalId = 100000

function configuredClient() {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')
  return sb
}

function ensureLocalId(row: any) {
  if (!row.id) row.id = nextLocalId++
  return row
}

function isoDate(d: any): string | null {
  if (!d) return null
  if (d instanceof Date) return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
  const s = String(d).slice(0, 10)
  return s || null
}

function toDbRow(p: any) {
  return {
    pattern_id:            p.pattern_id,
    week_id:               Math.round(Number(p.week_id)       || 0),
    pit_name:              p.pit_name              ?? '',
    pit_priority:          Number.isFinite(Number(p.pit_priority)) ? Math.round(Number(p.pit_priority)) : 0,
    pattern_type:          p.pattern_type          ?? 'TRI',
    rl_level:              p.rl_level              ?? 0,
    bench_height_m:        p.bench_height_m        ?? 0,
    hole_diameter_mm:      p.hole_diameter_mm      ?? 115,
    num_holes:             +(Number(p.num_holes) || 0).toFixed(2),
    plan_total_drilling_m: p.plan_total_drilling_m ?? 0,
    carried_drilling_m:    p.carried_drilling_m    ?? 0,
    carried_progress_pct:  p.carried_progress_pct  ?? 0,
    effective_m:           p.effective_m           ?? 0,
    actual_drilling_m:     p.actual_drilling_m     ?? 0,
    drilling_pct:          p.drilling_pct          ?? 0,
    planned_blast_date:    isoDate(p.planned_blast_date),
    actual_blast_date:     isoDate(p.actual_blast_date),
    plan_blast_vol_bcm:    p.plan_blast_vol_bcm    ?? 0,
    actual_blast_vol_bcm:  p.actual_blast_vol_bcm  ?? 0,
    blast_td_updated:      p.blast_td_updated      ?? false,
    blast_area_m2:         p.blast_area_m2         ?? 0,
    status:                p.status                ?? 'pending',
    risk:                  p.risk                  ?? 'on-track',
    carried_from_id:       p.carried_from_id       ?? null,
  }
}

export const usePatternsStore = defineStore('patterns', () => {
  const patterns = ref<any[]>([])
  const loading  = ref(false)
  const saving   = ref(false)
  const error    = ref('')
  const loadedWeekId = ref<number | null>(null)
  const monthlyPatterns = ref<any[]>([])
  const monthlyLoading  = ref(false)
  const loadedMonth     = ref('')

  const pitNames = computed(() => [...new Set(patterns.value.map((p: any) => p.pit_name))].sort())

  // ── load ──────────────────────────────────────────────────────────────────
  async function loadByWeek(weekId: number) {
    loading.value = true
    error.value = ''
    loadedWeekId.value = weekId
    try {
      if (isSupabaseConfigured()) {
        const sb = configuredClient()
        const { data, error: err } = await sb
          .from('tdl_patterns')
          .select('*')
          .eq('week_id', weekId)
          .order('pit_priority', { ascending: true })
          .order('pattern_id',   { ascending: true })
        if (err) throw err
        patterns.value = (data ?? []).map((p: any) => ({
          ...p,
          effective_m: Math.min(
            Number(p.effective_m || 0),
            Number(p.plan_total_drilling_m || 0)
          ),
        }))
      } else {
        await new Promise((r) => setTimeout(r, 80))
        const id = Number(weekId)
        patterns.value = (PATTERNS as any[])
          .filter((p) => Number(p.week_id) === id)
          .map((p) => ensureLocalId(cloneRow(p)))
      }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
    } finally {
      loading.value = false
    }
  }

  // ── loadByMonth (by actual_blast_date range; for monthly Plan vs Actual) ───
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
          .from('tdl_patterns')
          .select('actual_blast_date, actual_blast_vol_bcm, blast_td_updated')
          .gte('actual_blast_date', startDt)
          .lte('actual_blast_date', endDt)
        if (err) throw err
        monthlyPatterns.value = data ?? []
      } else {
        await new Promise((r) => setTimeout(r, 80))
        const startMs = new Date(startDt).getTime()
        const endMs   = new Date(endDt).getTime() + 86400000
        monthlyPatterns.value = (PATTERNS as any[]).filter((p) => {
          const iso = isoDate(p.actual_blast_date)
          if (!iso) return false
          const t = new Date(iso).getTime()
          return t >= startMs && t < endMs
        })
      }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
    } finally {
      monthlyLoading.value = false
    }
  }

  // ── loadByRange (by actual_blast_date; explicit start/end date range) ───────
  async function loadByRange(startDt: string, endDt: string) {
    if (!startDt || !endDt) return
    monthlyLoading.value = true
    error.value = ''
    loadedMonth.value = `${startDt}..${endDt}`
    try {
      if (isSupabaseConfigured()) {
        const sb = configuredClient()
        const { data, error: err } = await sb
          .from('tdl_patterns')
          .select('actual_blast_date, actual_blast_vol_bcm, blast_td_updated')
          .gte('actual_blast_date', startDt)
          .lte('actual_blast_date', endDt)
        if (err) throw err
        monthlyPatterns.value = data ?? []
      } else {
        await new Promise((r) => setTimeout(r, 80))
        const startMs = new Date(startDt).getTime()
        const endMs   = new Date(endDt).getTime() + 86400000
        monthlyPatterns.value = (PATTERNS as any[]).filter((p) => {
          const iso = isoDate(p.actual_blast_date)
          if (!iso) return false
          const t = new Date(iso).getTime()
          return t >= startMs && t < endMs
        })
      }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
    } finally {
      monthlyLoading.value = false
    }
  }

  // ── save (bulk upsert) ────────────────────────────────────────────────────
  async function save() {
    if (!patterns.value.length) return { error: null }
    saving.value = true
    try {
      if (isSupabaseConfigured()) {
        const sb = configuredClient()
        const rows = patterns.value.map(toDbRow)
        console.log('[patterns.save] upserting', rows.length, 'rows, sample:', rows[0])
        const { data, error: err } = await sb
          .from('tdl_patterns')
          .upsert(rows, { onConflict: 'pattern_id,week_id' })
          .select()
        if (err) {
          console.error('[patterns.save] error:', err.code, err.message, err.details, err.hint)
          throw err
        }
        if (data) patterns.value = data
        return { error: null }
      } else {
        // demo: sync to master PATTERNS array
        for (const row of patterns.value) {
          const saved = ensureLocalId({ ...row })
          const idx = (PATTERNS as any[]).findIndex(
            (p: any) => p.pattern_id === saved.pattern_id && p.week_id === saved.week_id,
          )
          if (idx >= 0) (PATTERNS as any[])[idx] = { ...(PATTERNS as any[])[idx], ...saved }
          else (PATTERNS as any[]).push(saved)
          const li = patterns.value.findIndex(
            (p) => p.pattern_id === saved.pattern_id && p.week_id === saved.week_id,
          )
          if (li >= 0) patterns.value[li] = cloneRow(saved)
        }
        return { error: null }
      }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
      return { error: err }
    } finally {
      saving.value = false
    }
  }

  // ── updateRow (by pattern_id + week_id) ───────────────────────────────────
  async function updateRow(patternId: string, weekId: number, payload: any) {
    const idx = patterns.value.findIndex(
      (p) => p.pattern_id === patternId && p.week_id === weekId,
    )
    if (idx < 0) return { data: null, error: new Error('Pattern not found') }
    try {
      if (isSupabaseConfigured()) {
        const sb = configuredClient()
        const { data, error: err } = await sb
          .from('tdl_patterns')
          .update(payload)
          .eq('pattern_id', patternId)
          .eq('week_id', weekId)
          .select()
          .single()
        if (err) throw err
        patterns.value[idx] = data
        return { data, error: null }
      } else {
        const updated = { ...patterns.value[idx], ...payload }
        patterns.value[idx] = updated
        const mi = (PATTERNS as any[]).findIndex(
          (p: any) => p.pattern_id === patternId && p.week_id === weekId,
        )
        if (mi >= 0) (PATTERNS as any[])[mi] = { ...(PATTERNS as any[])[mi], ...payload }
        return { data: updated, error: null }
      }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
      return { data: null, error: err instanceof Error ? err : new Error(error.value) }
    }
  }

  // ── updateById (by surrogate PK) ─────────────────────────────────────────
  async function updateById(id: number, payload: any) {
    const idx = patterns.value.findIndex((p) => p.id === id)
    if (idx < 0) return { data: null, error: new Error('Pattern not found') }
    try {
      if (isSupabaseConfigured()) {
        const sb = configuredClient()
        const { data, error: err } = await sb
          .from('tdl_patterns')
          .update(payload)
          .eq('id', id)
          .select()
          .single()
        if (err) throw err
        patterns.value[idx] = data
        return { data, error: null }
      } else {
        const updated = { ...patterns.value[idx], ...payload }
        patterns.value[idx] = updated
        return { data: updated, error: null }
      }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
      return { data: null, error: err instanceof Error ? err : new Error(error.value) }
    }
  }

  // ── deleteById ────────────────────────────────────────────────────────────
  async function deleteById(id: number) {
    const row = patterns.value.find((p) => p.id === id)
    if (!row) return { error: new Error('Pattern not found') }
    try {
      if (isSupabaseConfigured()) {
        const sb = configuredClient()
        const { error: err } = await sb.from('tdl_patterns').delete().eq('id', id)
        if (err) throw err
      } else {
        const mi = (PATTERNS as any[]).findIndex(
          (p: any) => p.pattern_id === row.pattern_id && p.week_id === row.week_id,
        )
        if (mi >= 0) (PATTERNS as any[]).splice(mi, 1)
      }
      patterns.value = patterns.value.filter((p) => p.id !== id)
      return { error: null }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
      return { error: err instanceof Error ? err : new Error(error.value) }
    }
  }

  // ── upsertMany (carryover) ────────────────────────────────────────────────
  async function upsertMany(rows: any[]) {
    try {
      if (isSupabaseConfigured()) {
        const sb = configuredClient()
        const { data, error: err } = await sb
          .from('tdl_patterns')
          .upsert(rows.map(toDbRow), { onConflict: 'pattern_id,week_id' })
          .select()
        if (err) throw err
        const saved = data ?? []
        for (const r of saved) {
          const li = patterns.value.findIndex(
            (p) => p.pattern_id === r.pattern_id && p.week_id === r.week_id,
          )
          if (li >= 0) patterns.value[li] = r
          else patterns.value.push(r)
        }
        return { data: saved, error: null }
      } else {
        const saved: any[] = []
        for (const row of rows) {
          const withId = ensureLocalId({ ...row })
          const mi = (PATTERNS as any[]).findIndex(
            (p: any) => p.pattern_id === withId.pattern_id && p.week_id === withId.week_id,
          )
          if (mi >= 0) (PATTERNS as any[])[mi] = { ...(PATTERNS as any[])[mi], ...withId }
          else (PATTERNS as any[]).push(withId)
          saved.push(withId)
          const li = patterns.value.findIndex(
            (p) => p.pattern_id === withId.pattern_id && p.week_id === withId.week_id,
          )
          if (li >= 0) patterns.value[li] = cloneRow(withId)
          else patterns.value.push(cloneRow(withId))
        }
        return { data: saved, error: null }
      }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
      return { data: null, error: err instanceof Error ? err : new Error(error.value) }
    }
  }

  return {
    patterns, pitNames, loading, saving, error, loadedWeekId,
    monthlyPatterns, monthlyLoading, loadedMonth,
    loadByWeek, loadByMonth, loadByRange, save, updateRow, updateById, deleteById, upsertMany,
  }
})
