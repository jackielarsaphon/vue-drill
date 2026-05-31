import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient.js'

export const useDownTimeReportStore = defineStore('downTimeReport', () => {
  const entries = ref<any[]>([])
  const loading = ref(false)
  const error   = ref('')

  async function load(from: string, to: string) {
    loading.value = true
    error.value   = ''
    entries.value = []
    try {
      if (isSupabaseConfigured()) {
        const sb = getSupabase()!
        const { data, error: err } = await sb
          .from('tdl_downtime')
          .select('*')
          .gte('work_date', from)
          .lte('work_date', to)
          .order('work_date', { ascending: true })
          .order('start_time', { ascending: true })
        if (err) throw err
        entries.value = data ?? []
      } else {
        entries.value = []
      }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
    } finally {
      loading.value = false
    }
  }

  return { entries, loading, error, load }
})
