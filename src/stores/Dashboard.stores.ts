import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient.js'
import { toDate, sameDay, addDays } from '../lib/dateUtils'

function isDone(p: any) {
  const s = String(p.status || '').toLowerCase()
  return s === 'done' || s === 'complete' || s === 'blasting'
}

function drilledFor(patternId: string, log: any[]): number {
  return +log
    .filter(e => e.pattern_id === patternId)
    .reduce((s, e) => s + Number(e.total_drilling_m || 0), 0)
    .toFixed(1)
}

function remainingM(p: any, log: any[]): number {
  return +Math.max(0, Number(p.effective_m || 0) - drilledFor(p.pattern_id, log)).toFixed(1)
}

function progressPct(p: any, log: any[]): number {
  const plan = Number(p.effective_m || 0)
  const drilled = drilledFor(p.pattern_id, log)
  return plan > 0 ? +(Math.min(100, (drilled / plan) * 100)).toFixed(1) : 0
}

function calcRisk(p: any, log: any[]): string {
  if (isDone(p)) return 'on-track'
  if (p.blast_td_updated) return 'on-track'
  const blastDate = toDate(p.planned_blast_date) ?? toDate(p.actual_blast_date)
  if (!blastDate) return 'no-date'
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const daysToBlast = Math.round((blastDate.getTime() - today.getTime()) / 86400000)
  if (daysToBlast < 0 && !p.blast_td_updated) return 'delayed'
  if (daysToBlast <= 2 && !p.blast_td_updated) return 'at-risk'
  return 'on-track'
}

// ── aggregate functions ───────────────────────────────────────────────────────

function calcKpis(patterns: any[], log: any[], week: any) {
  const total     = patterns.length
  const delayed   = patterns.filter(p => calcRisk(p, log) === 'delayed').length
  const atRisk    = patterns.filter(p => calcRisk(p, log) === 'at-risk').length
  const plan_m    = patterns.reduce((s, p) => s + Number(p.plan_total_drilling_m || p.effective_m || 0), 0)
  const actual_m  = patterns.reduce((s, p) => s + Number(p.carried_drilling_m || 0) + drilledFor(p.pattern_id, log), 0)
  const weekEnd   = toDate(week?.week_end)
  const blasts_done    = patterns.filter(p => isDone(p)).length
  const blasts_planned = weekEnd
    ? patterns.filter(p => { const d = toDate(p.planned_blast_date); return d && d <= weekEnd }).length
    : total
  const blast_vol = patterns.filter(p => isDone(p)).reduce((s, p) => s + Number(p.actual_blast_vol_bcm || 0), 0)
  const plan_vol  = patterns.reduce((s, p) => s + Number(p.plan_blast_vol_bcm || 0), 0)
  return { total, delayed, atRisk, plan_m, actual_m, blasts_done, blasts_planned, blast_vol, plan_vol }
}

function calcPitProgress(patterns: any[], log: any[]) {
  const groups: Record<string, any> = {}
  for (const p of patterns) {
    if (!groups[p.pit_name]) groups[p.pit_name] = { pit: p.pit_name, plan_m: 0, actual_m: 0, complete_m: 0, count: 0, complete: 0 }
    const g = groups[p.pit_name]
    const plan   = Number(p.plan_total_drilling_m || p.effective_m || 0)
    const actual = Number(p.carried_drilling_m || 0) + drilledFor(p.pattern_id, log)
    g.plan_m  += plan
    g.actual_m += actual
    if (isDone(p)) g.complete_m += plan
    g.count   += 1
    if (isDone(p)) g.complete += 1
  }
  return Object.values(groups).sort((a, b) => b.plan_m - a.plan_m)
}

function calcBitSize(log: any[]) {
  const buckets: Record<number, number> = {}
  for (const e of log) {
    const bit = Number(e.drill_bit_size_mm || 0)
    buckets[bit] = (buckets[bit] || 0) + Number(e.total_drilling_m || 0)
  }
  return Object.entries(buckets)
    .map(([k, v]) => ({ bit: +k, m: Math.round(v) }))
    .sort((a, b) => a.bit - b.bit)
}

function calcCumulative(patterns: any[], log: any[], week: any) {
  if (!week) return []
  const start  = toDate(week.week_start)
  const end    = toDate(week.week_end)
  if (!start || !end) return []
  const days: Date[] = []
  for (let i = 0; i < 7; i++) days.push(addDays(start, i))
  if (week.status === 'active' || week.status === 'draft') {
    for (let i = 1; i <= 5; i++) days.push(addDays(end, i))
  }
  const plan_m_total    = patterns.reduce((s, p) => s + Number(p.plan_total_drilling_m || p.effective_m || 0), 0)
  const carried_m_total = patterns.reduce((s, p) => s + Number(p.carried_drilling_m || 0), 0)
  const lastActualDate  = log.length
    ? log.reduce((lat, e) => {
        const d = toDate(e.work_date); return d && (!lat || d > lat) ? d : lat
      }, null as Date | null)
    : (carried_m_total > 0 ? start : null)
  let cum = carried_m_total
  return days.map((day, i) => {
    if (lastActualDate && day <= lastActualDate) {
      cum += log.filter(e => sameDay(e.work_date, day)).reduce((s, e) => s + Number(e.total_drilling_m || 0), 0)
    }
    const planCum = Math.min(plan_m_total, plan_m_total * (i + 1) / days.length)
    return {
      date:   day,
      actual: lastActualDate && day <= lastActualDate ? cum : null,
      plan:   Math.round(planCum),
    }
  })
}

function calcHighRisk(patterns: any[], log: any[]) {
  const out: Record<string, any[]> = {}
  const order: Record<string, number> = { delayed: 0, 'at-risk': 1, 'on-track': 2 }
  for (const p of patterns) {
    const risk = calcRisk(p, log)
    if (!out[p.pit_name]) out[p.pit_name] = []
    out[p.pit_name].push({ ...p, _risk: risk, drilling_pct: progressPct(p, log) })
  }
  return Object.entries(out)
    .map(([pit, list]) => ({
      pit,
      list: list.sort((a, b) => order[a._risk] - order[b._risk] || String(a.pattern_id).localeCompare(String(b.pattern_id))),
    }))
    .sort((a, b) => b.list.length - a.list.length)
}

function calcRigOutput(log: any[]) {
  const groups: Record<string, any> = {}
  for (const e of log) {
    if (!groups[e.rig_id]) groups[e.rig_id] = { rig: e.rig_id, m: 0, smu: 0 }
    const g = groups[e.rig_id]
    g.m   += Number(e.total_drilling_m || 0) + Number(e.redrill_m || 0)
    g.smu += Number(e.smu_hr || 0)
  }
  return Object.values(groups)
    .map(g => ({ ...g, m: Math.round(g.m), smu: +g.smu.toFixed(1) }))
    .sort((a, b) => b.m - a.m)
}

function calcOperatorMetres(log: any[]) {
  const groups: Record<string, any> = {}
  for (const e of log) {
    const name = e.employee_name || 'Unknown'
    if (!groups[name]) groups[name] = { name, m: 0, shifts: 0, redrill: 0 }
    const g = groups[name]
    g.m      += Number(e.total_drilling_m || 0)
    g.redrill += Number(e.redrill_m || 0)
    g.shifts  += 1
  }
  return Object.values(groups)
    .map(g => ({ ...g, m: Math.round(g.m), redrill: +g.redrill.toFixed(1), avg: g.shifts ? Math.round(g.m / g.shifts) : 0 }))
    .sort((a, b) => b.m - a.m)
}

function calcDailyShiftNet(log: any[], week: any) {
  if (!week) return []
  const start = toDate(week.week_start)
  if (!start) return []
  const days: Date[] = []
  for (let i = 0; i < 7; i++) days.push(addDays(start, i))
  return days.map(d => {
    const net = (shift: string) =>
      log.filter(e => sameDay(e.work_date, d) && e.shift === shift)
        .reduce((s, e) => s + Number(e.total_drilling_m || 0) + Number(e.redrill_m || 0), 0)
    return { date: d, day: Math.round(net('day')), night: Math.round(net('night')) }
  })
}

function calcRemaining(patterns: any[], log: any[]) {
  return patterns
    .filter(p => remainingM(p, log) > 0)
    .sort((a, b) => {
      const da = toDate(a.planned_blast_date)
      const db = toDate(b.planned_blast_date)
      if (!da && !db) return 0
      if (!da) return 1
      if (!db) return -1
      return da.getTime() - db.getTime()
    })
    .map(p => ({ ...p, _drilled: drilledFor(p.pattern_id, log) }))
}

// ── store ─────────────────────────────────────────────────────────────────────

export const useDashboardStore = defineStore('dashboard', () => {
  const patterns     = ref<any[]>([])
  const drillLog     = ref<any[]>([])
  const weekMeta     = ref<any>(null)
  const loading      = ref(false)
  const error        = ref('')
  const loadedWeekId = ref<number | null>(null)

  // ── computed aggregates (auto-recompute when patterns/drillLog/weekMeta change)
  const kpisData        = computed(() => calcKpis(patterns.value, drillLog.value, weekMeta.value))
  const pitProgressData = computed(() => calcPitProgress(patterns.value, drillLog.value))
  const bitSizeData     = computed(() => calcBitSize(drillLog.value))
  const cumulData       = computed(() => calcCumulative(patterns.value, drillLog.value, weekMeta.value))
  const highRiskData    = computed(() => calcHighRisk(patterns.value, drillLog.value))
  const rigData         = computed(() => calcRigOutput(drillLog.value))
  const operatorData    = computed(() => calcOperatorMetres(drillLog.value))
  const shiftsData      = computed(() => calcDailyShiftNet(drillLog.value, weekMeta.value))
  const remainingData   = computed(() => calcRemaining(patterns.value, drillLog.value))

  // ── progressPct helper for remaining patterns ──────────────────────────────
  function patternProgressPct(p: any): number {
    return progressPct(p, drillLog.value)
  }
  function patternRemainingM(p: any): number {
    return remainingM(p, drillLog.value)
  }
  function patternRisk(p: any): string {
    return calcRisk(p, drillLog.value)
  }

  // ── load ───────────────────────────────────────────────────────────────────
  async function loadByWeek(weekId: number, week: any) {
    if (loadedWeekId.value === weekId) return   // already loaded — skip
    loading.value  = true
    error.value    = ''
    loadedWeekId.value = weekId
    weekMeta.value = week ?? null

    try {
      if (isSupabaseConfigured()) {
        const sb = getSupabase()!
        const [pRes, lRes] = await Promise.all([
          sb.from('tdl_patterns')
            .select('*')
            .eq('week_id', weekId)
            .order('pit_priority', { ascending: true }),
          sb.from('tdl_drill_log')
            .select('*')
            .eq('week_id', weekId)
            .order('work_date', { ascending: true }),
        ])
        if (pRes.error) throw pRes.error
        if (lRes.error) throw lRes.error
        patterns.value = pRes.data ?? []
        drillLog.value = lRes.data ?? []
      } else {
        await new Promise(r => setTimeout(r, 80))
        const id = Number(weekId)
        // Reuse data.js arrays for demo mode
        const { PATTERNS, DRILL_LOG } = await import('../components/data.js')
        patterns.value = (PATTERNS as any[]).filter(p => Number(p.week_id) === id)
        drillLog.value = (DRILL_LOG as any[]).filter(e => Number(e.week_id) === id)
      }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
    } finally {
      loading.value = false
    }
  }

  async function refresh(weekId: number, week: any) {
    loadedWeekId.value = null
    await loadByWeek(weekId, week)
  }

  return {
    patterns, drillLog, weekMeta, loading, error, loadedWeekId,
    kpisData, pitProgressData, bitSizeData, cumulData,
    highRiskData, rigData, operatorData, shiftsData, remainingData,
    patternProgressPct, patternRemainingM, patternRisk,
    loadByWeek, refresh,
  }
})
