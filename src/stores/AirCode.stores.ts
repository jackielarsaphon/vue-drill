import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient.js'

let nextId = 60000

export const useAirCodeStore = defineStore('airCode', () => {
  const codes   = ref<any[]>([])
  const loading = ref(false)
  const error   = ref('')

  async function loadAll() {
    if (codes.value.length) return
    loading.value = true
    error.value   = ''
    try {
      if (isSupabaseConfigured()) {
        const sb = getSupabase()!
        const { data, error: err } = await sb
          .from('tdl_air_codes')
          .select('*')
          .order('code', { ascending: true })
        if (err) throw err
        codes.value = data ?? []
      } else {
        await new Promise(r => setTimeout(r, 60))
        codes.value = []
      }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
    } finally {
      loading.value = false
    }
  }

  async function add(code: string, description: string) {
    try {
      if (isSupabaseConfigured()) {
        const sb = getSupabase()!
        const { data, error: err } = await sb
          .from('tdl_air_codes')
          .insert({ code: code.trim(), description: description.trim() })
          .select()
          .single()
        if (err) throw err
        codes.value.push(data)
        codes.value.sort((a, b) => String(a.code).localeCompare(String(b.code)))
      } else {
        codes.value.push({ id: nextId++, code: code.trim(), description: description.trim() })
      }
      return ''
    } catch (err: any) {
      return err?.message ?? String(err)
    }
  }

  async function update(id: number, patch: { code?: string; description?: string }) {
    const idx = codes.value.findIndex(c => c.id === id)
    if (idx < 0) return
    codes.value[idx] = { ...codes.value[idx], ...patch }
    if (!isSupabaseConfigured()) return
    try {
      const sb = getSupabase()!
      const { error: err } = await sb.from('tdl_air_codes').update(patch).eq('id', id)
      if (err) throw err
    } catch (err: any) {
      error.value = err?.message ?? String(err)
    }
  }

  async function remove(id: number) {
    codes.value = codes.value.filter(c => c.id !== id)
    if (!isSupabaseConfigured()) return
    try {
      const sb = getSupabase()!
      const { error: err } = await sb.from('tdl_air_codes').delete().eq('id', id)
      if (err) throw err
    } catch (err: any) {
      error.value = err?.message ?? String(err)
    }
  }

  return { codes, loading, error, loadAll, add, update, remove }
})
