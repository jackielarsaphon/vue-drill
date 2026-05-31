import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { usePatternsStore } from './Patterns.stores'
import { useDrillLogStore } from './DrillLog.stores'

const PENDING_KEY = 'tdl_pending_patterns'

function loadPending(): any {
  try {
    const s = localStorage.getItem(PENDING_KEY)
    return s ? JSON.parse(s) : null
  } catch { return null }
}

export const useNotificationsStore = defineStore('notifications', () => {
  const notifications      = ref<any[]>([])
  const pendingNewPatterns = ref<any>(loadPending())
  const confirmingPending  = ref(false)

  watch(pendingNewPatterns, (val) => {
    if (val) localStorage.setItem(PENDING_KEY, JSON.stringify(val))
    else localStorage.removeItem(PENDING_KEY)
  }, { deep: true })

  // restore bell badge after page reload
  if (pendingNewPatterns.value) {
    const n = pendingNewPatterns.value.patterns?.length ?? 0
    pushPersistent(
      `${n} Pattern ใหม่รอยืนยัน — กดยืนยันเพื่อเพิ่มใน Blast Patterns`,
      'pending',
    )
  }

  const count      = computed(() => notifications.value.length)
  const hasPending = computed(() => !!pendingNewPatterns.value)

  // ── toast helpers ─────────────────────────────────────────────────────────
  function push(message: string, type = 'info', duration = 6000, showGoToLog = false) {
    const id = Date.now() + Math.random()
    notifications.value.push({ id, message, type, duration, showGoToLog })
    if (duration > 0) setTimeout(() => dismiss(id), duration)
    return id
  }

  function pushPersistent(message: string, type = 'pending') {
    const id = 'pending-patterns'
    notifications.value = notifications.value.filter(n => n.id !== id)
    notifications.value.push({ id, message, type, duration: 0, persistent: true })
  }

  function dismiss(id: any) {
    notifications.value = notifications.value.filter(n => n.id !== id)
  }

  // ── pending patterns ──────────────────────────────────────────────────────
  function setPendingPatterns(data: {
    patterns: any[]
    rows: any[]
    fallbackDate: string
    weekId: number
  }) {
    pendingNewPatterns.value = data
    pushPersistent(
      `${data.patterns.length} Pattern ใหม่รอยืนยัน — กดยืนยันเพื่อเพิ่มใน Blast Patterns`,
      'pending',
    )
  }

  async function _savePatternsAndRows(patterns: any[], rows: any[], fallbackDate: string, weekId: number) {
    const patternsStore = usePatternsStore()
    const drillLogStore = useDrillLogStore()

    // compute next pit_priority per pit (continue from existing max)
    const pitMaxPriority: Record<string, number> = {}
    const newRows = patterns.map((p: any) => {
      const pit = p.pit_name
      if (pitMaxPriority[pit] === undefined) {
        const existing = patternsStore.patterns.filter(
          (ep: any) => ep.pit_name === pit && Number(ep.week_id) === weekId,
        )
        pitMaxPriority[pit] = existing.length > 0
          ? Math.max(...existing.map((ep: any) => Number(ep.pit_priority || 0)))
          : 0
      }
      pitMaxPriority[pit] += 1
      const numHoles = Number(p.num_holes || 0)
      const bench    = Number(p.bench_height_m || 0)
      const planM    = Number(p.plan_total_drilling_m || 0)
      const effM     = Number(p.effective_m || 0) || planM
      return {
        pattern_id:            p.pattern_id,
        week_id:               p.week_id,
        pit_name:              p.pit_name,
        pattern_type:          p.pattern_type,
        rl_level:              p.rl_level,
        bench_height_m:        bench,
        hole_diameter_mm:      p.hole_diameter_mm || 115,
        num_holes:             numHoles,
        plan_total_drilling_m: planM,
        effective_m:           effM,
        planned_blast_date:    p.blast_date || p.planned_blast_date || null,
        plan_blast_vol_bcm:    Math.round(Number(p.plan_blast_vol_bcm) || 0),
        blast_area_m2:         Math.round(numHoles * 45),
        status:                'pending',
        risk:                  'on-track',
        pit_priority:          pitMaxPriority[pit],
      }
    })

    const { error } = await patternsStore.upsertMany(newRows)
    if (error) {
      push(`สร้าง Pattern ผิดพลาด: ${(error as any).message ?? error}`, 'error')
      return { ok: 0, failed: true }
    }

    let ok = 0
    for (const row of rows) {
      const workDate = row.work_date || fallbackDate
      const safeShift = row.shift === 'night' ? 'night' : 'day'
      const smuS = Number(row.smu_start) || 0
      const smuE = Number(row.smu_end) || 0
      const dftS = Number(row.drifter_start) || 0
      const dftE = Number(row.drifter_end) || 0
      const { error: e } = await drillLogStore.upsertEntry({
        pattern_id: row.pattern_id, week_id: weekId,
        work_date: workDate, shift: safeShift, rig_id: row.rig_id || '',
        employee_name: row.employee_name || 'Unknown',
        drill_bit_size_mm: Number(row.drill_bit_size_mm) || 115,
        total_drilling_m:  Number(row.total_drilling_m) || 0,
        redrill_m:         Number(row.redrill_m) || 0,
        smu_start: smuS, smu_end: smuE, smu_hr: Math.max(0, smuE - smuS),
        drifter_start: dftS, drifter_end: dftE, drifter_hr: Math.max(0, dftE - dftS),
        fuel_l: 0,
      })
      if (!e) ok++
    }
    return { ok, failed: false }
  }

  function _afterConfirmOrReject(remainingPatterns: any[], remainingRows: any[]) {
    if (remainingPatterns.length) {
      pendingNewPatterns.value = { ...pendingNewPatterns.value, patterns: remainingPatterns, rows: remainingRows }
      pushPersistent(
        `${remainingPatterns.length} Pattern ใหม่รอยืนยัน — กดยืนยันเพื่อเพิ่มใน Blast Patterns`,
        'pending',
      )
    } else {
      pendingNewPatterns.value = null
      dismiss('pending-patterns')
    }
  }

  // ── confirm specific pattern IDs ─────────────────────────────────────────
  async function confirmSpecific(patternIds: string[]) {
    if (!pendingNewPatterns.value || confirmingPending.value) return
    confirmingPending.value = true
    try {
      const { patterns, rows, fallbackDate, weekId } = pendingNewPatterns.value
      const idSet      = new Set(patternIds)
      const toConfirm  = patterns.filter((p: any) => idSet.has(p.pattern_id))
      const toRows     = rows.filter((r: any) => idSet.has(r.pattern_id))

      const { ok, failed } = await _savePatternsAndRows(toConfirm, toRows, fallbackDate, weekId)
      if (failed) return

      const remaining     = patterns.filter((p: any) => !idSet.has(p.pattern_id))
      const remainingRows = rows.filter((r: any) => !idSet.has(r.pattern_id))
      _afterConfirmOrReject(remaining, remainingRows)
      push(`ยืนยันแล้ว · สร้าง ${toConfirm.length} Pattern · บันทึก ${ok} รายการ`, 'success', 10000)
    } finally {
      confirmingPending.value = false
    }
  }

  // ── confirm/reject all ────────────────────────────────────────────────────
  async function confirmPendingPatterns() {
    if (!pendingNewPatterns.value || confirmingPending.value) return
    confirmingPending.value = true
    try {
      const { patterns, rows, fallbackDate, weekId } = pendingNewPatterns.value
      const { ok, failed } = await _savePatternsAndRows(patterns, rows, fallbackDate, weekId)
      if (failed) return
      pendingNewPatterns.value = null
      dismiss('pending-patterns')
      push(`ยืนยันแล้ว · สร้าง ${patterns.length} Pattern · บันทึก ${ok} รายการ`, 'success', 10000)
    } finally {
      confirmingPending.value = false
    }
  }

  function rejectPendingPatterns() {
    pendingNewPatterns.value = null
    dismiss('pending-patterns')
    push('ปฏิเสธ Pattern ใหม่ทั้งหมดแล้ว', 'info')
  }

  // ── confirm/reject by pit ─────────────────────────────────────────────────
  async function confirmPendingByPit(pitName: string) {
    if (!pendingNewPatterns.value || confirmingPending.value) return
    confirmingPending.value = true
    try {
      const { patterns, rows, fallbackDate, weekId } = pendingNewPatterns.value
      const pitPatterns = patterns.filter((p: any) => p.pit_name === pitName)
      const pitIds      = new Set(pitPatterns.map((p: any) => p.pattern_id))
      const pitRows     = rows.filter((r: any) => pitIds.has(r.pattern_id))

      const { ok, failed } = await _savePatternsAndRows(pitPatterns, pitRows, fallbackDate, weekId)
      if (failed) return

      const remainingPatterns = patterns.filter((p: any) => p.pit_name !== pitName)
      const remainingRows     = rows.filter((r: any) => !pitIds.has(r.pattern_id))
      _afterConfirmOrReject(remainingPatterns, remainingRows)
      push(`ยืนยันบ่อ ${pitName} · ${pitPatterns.length} Pattern · ${ok} รายการ`, 'success', 8000)
    } finally {
      confirmingPending.value = false
    }
  }

  function rejectPendingByPit(pitName: string) {
    if (!pendingNewPatterns.value) return
    const { patterns, rows } = pendingNewPatterns.value
    const pitIds = new Set(patterns.filter((p: any) => p.pit_name === pitName).map((p: any) => p.pattern_id))
    _afterConfirmOrReject(
      patterns.filter((p: any) => p.pit_name !== pitName),
      rows.filter((r: any) => !pitIds.has(r.pattern_id)),
    )
    push(`ปฏิเสธบ่อ ${pitName} แล้ว`, 'info')
  }

  return {
    notifications,
    pendingNewPatterns,
    confirmingPending,
    count,
    hasPending,
    push,
    pushPersistent,
    dismiss,
    setPendingPatterns,
    confirmSpecific,
    confirmPendingPatterns,
    rejectPendingPatterns,
    confirmPendingByPit,
    rejectPendingByPit,
  }
})
