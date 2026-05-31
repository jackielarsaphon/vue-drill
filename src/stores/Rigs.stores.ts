import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient.js'
import { RIGS } from '../components/data.js'

export interface Rig {
  rig_id: string
  contractor: string
  is_active: boolean
}

function configuredClient() {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')
  return sb
}

export const useRigsStore = defineStore('rigs', () => {
  const rigs = ref<Rig[]>([])
  const loading = ref(false)
  const error = ref('')

  const rigIds = computed(() => rigs.value.map((r) => r.rig_id))

  async function loadAll() {
    if (rigs.value.length) return
    loading.value = true
    error.value = ''
    try {
      if (isSupabaseConfigured()) {
        const sb = configuredClient()
        const { data, error: err } = await sb
          .from('tdl_rigs')
          .select('rig_id, contractor, is_active')
          .order('sort_order', { ascending: true })
        if (err) throw err
        rigs.value = (data ?? []).map((r: any) => ({
          rig_id: r.rig_id,
          contractor: r.contractor ?? '',
          is_active: r.is_active ?? true,
        }))
      } else {
        await new Promise((r) => setTimeout(r, 40))
        rigs.value = (RIGS as any[]).map((r) => ({
          rig_id: r.rig_id,
          contractor: r.contractor ?? '',
          is_active: true,
        }))
      }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
    } finally {
      loading.value = false
    }
  }

  async function add(rig_id: string, contractor = ''): Promise<string | null> {
    const id = rig_id.trim().toUpperCase()
    if (!id || rigs.value.find((r) => r.rig_id === id)) return null
    const row: Rig = { rig_id: id, contractor: contractor.trim(), is_active: true }
    if (isSupabaseConfigured()) {
      const sb = configuredClient()
      const { error: err } = await sb.from('tdl_rigs').insert({ rig_id: id, contractor: contractor.trim(), is_active: true })
      if (err) { error.value = err.message; return err.message }
    } else {
      ;(RIGS as any[]).push({ rig_id: id, contractor: contractor.trim() })
    }
    rigs.value.push(row)
    return null
  }

  async function update(rig_id: string, patch: Partial<Rig>) {
    const idx = rigs.value.findIndex((r) => r.rig_id === rig_id)
    if (idx < 0) return
    if (isSupabaseConfigured()) {
      const sb = configuredClient()
      const { error: err } = await sb.from('tdl_rigs').update(patch).eq('rig_id', rig_id)
      if (err) { error.value = err.message; return }
    }
    Object.assign(rigs.value[idx], patch)
  }

  async function remove(rig_id: string) {
    if (isSupabaseConfigured()) {
      const sb = configuredClient()
      const { error: err } = await sb.from('tdl_rigs').delete().eq('rig_id', rig_id)
      if (err) { error.value = err.message; return }
    }
    rigs.value = rigs.value.filter((r) => r.rig_id !== rig_id)
  }

  return { rigs, loading, error, rigIds, loadAll, add, update, remove }
})
