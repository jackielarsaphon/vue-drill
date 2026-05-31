import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient.js'
import { OPERATORS } from '../components/data.js'

export interface Operator {
  operator_id: string
  name: string
  db_id?: number
}

function configuredClient() {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')
  return sb
}

export const useOperatorsStore = defineStore('operators', () => {
  const operators = ref<Operator[]>([])
  const loading = ref(false)
  const error = ref('')

  async function loadAll() {
    if (operators.value.length) return
    loading.value = true
    error.value = ''
    try {
      if (isSupabaseConfigured()) {
        const sb = configuredClient()
        const { data, error: err } = await sb
          .from('tdl_operators')
          .select('operator_id, employee_code, display_name')
          .order('operator_id', { ascending: true })
        if (err) throw err
        operators.value = (data ?? []).map((o: any) => ({
          db_id: o.operator_id,
          operator_id: o.employee_code || String(o.operator_id),
          name: o.display_name ?? '',
        }))
      } else {
        await new Promise((r) => setTimeout(r, 40))
        operators.value = (OPERATORS as any[]).map((o) => ({
          operator_id: o.operator_id,
          name: o.name ?? '',
        }))
      }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
    } finally {
      loading.value = false
    }
  }

  async function add(operator_id: string, name: string) {
    const code = operator_id.trim().toUpperCase()
    const nameVal = name.trim()
    if (!code || !nameVal || operators.value.find((o) => o.operator_id === code)) return
    if (isSupabaseConfigured()) {
      const sb = configuredClient()
      const { data, error: err } = await sb
        .from('tdl_operators')
        .insert({ employee_code: code, display_name: nameVal, is_active: true })
        .select('operator_id')
        .single()
      if (err) { error.value = err.message; return }
      operators.value.push({ db_id: data?.operator_id, operator_id: code, name: nameVal })
    } else {
      ;(OPERATORS as any[]).push({ operator_id: code, name: nameVal })
      operators.value.push({ operator_id: code, name: nameVal })
    }
  }

  async function update(operator_id: string, patch: Partial<Operator>) {
    const idx = operators.value.findIndex((o) => o.operator_id === operator_id)
    if (idx < 0) return
    if (isSupabaseConfigured()) {
      const sb = configuredClient()
      const dbPatch: Record<string, unknown> = {}
      if (patch.name !== undefined) dbPatch.display_name = patch.name
      if (patch.operator_id !== undefined) dbPatch.employee_code = patch.operator_id
      const { error: err } = await sb
        .from('tdl_operators')
        .update(dbPatch)
        .eq('operator_id', operators.value[idx].db_id!)
      if (err) { error.value = err.message; return }
    }
    Object.assign(operators.value[idx], patch)
  }

  async function remove(operator_id: string) {
    const target = operators.value.find((o) => o.operator_id === operator_id)
    if (!target) return
    if (isSupabaseConfigured()) {
      const sb = configuredClient()
      const { error: err } = await sb
        .from('tdl_operators')
        .delete()
        .eq('operator_id', target.db_id!)
      if (err) { error.value = err.message; return }
    }
    operators.value = operators.value.filter((o) => o.operator_id !== operator_id)
  }

  return { operators, loading, error, loadAll, add, update, remove }
})
