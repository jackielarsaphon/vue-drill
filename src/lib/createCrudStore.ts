/**
 * Factory for creating CRUD Pinia stores that follow the common pattern
 * used by DownTime, FuelLog, and similar table-backed stores.
 *
 * Each generated store provides: entries, loading, saving, error, loadedWeekId,
 * loadByWeek, addEntry, updateEntry, deleteEntry.
 */
import { ref } from 'vue'
import { configuredClient, isSupabaseConfigured } from './supabaseHelpers'

export interface CrudStoreOptions {
  /** Supabase table name (e.g. 'tdl_downtime') */
  table: string
  /** Transform an entry to the shape expected by the DB. */
  toDbRow: (entry: any) => Record<string, unknown>
  /** Starting ID for offline/demo mode entries. */
  startId?: number
}

export function createCrudStore(options: CrudStoreOptions) {
  const { table, toDbRow, startId = 80000 } = options
  let nextId = startId

  const entries = ref<any[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')
  const loadedWeekId = ref<number | null>(null)

  async function loadByWeek(weekId: number) {
    if (loadedWeekId.value === weekId) return
    loading.value = true
    error.value = ''
    loadedWeekId.value = weekId
    try {
      if (isSupabaseConfigured()) {
        const sb = configuredClient()
        const { data, error: err } = await sb
          .from(table)
          .select('*')
          .eq('week_id', weekId)
          .order('work_date', { ascending: false })
          .order('id', { ascending: false })
        if (err) throw err
        entries.value = data ?? []
      } else {
        await new Promise((r) => setTimeout(r, 60))
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
    error.value = ''
    try {
      if (isSupabaseConfigured()) {
        const sb = configuredClient()
        const { data, error: err } = await sb
          .from(table)
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
    const idx = entries.value.findIndex((e) => e.id === id)
    if (idx < 0) return
    entries.value[idx] = { ...entries.value[idx], ...patch }
    if (!isSupabaseConfigured()) return
    saving.value = true
    try {
      const sb = configuredClient()
      const { error: err } = await sb
        .from(table)
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
    entries.value = entries.value.filter((e) => e.id !== id)
    if (!isSupabaseConfigured()) return
    try {
      const sb = configuredClient()
      const { error: err } = await sb.from(table).delete().eq('id', id)
      if (err) throw err
    } catch (err: any) {
      error.value = err?.message ?? String(err)
    }
  }

  return {
    entries,
    loading,
    saving,
    error,
    loadedWeekId,
    loadByWeek,
    addEntry,
    updateEntry,
    deleteEntry,
  }
}
