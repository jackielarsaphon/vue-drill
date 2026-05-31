import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getSupabase } from '../lib/supabaseClient.js'

export interface Profile {
  id: string
  username: string
  display_name: string
  role: string
  job_title: string
  password?: string
  created_at?: string
  updated_at?: string
}

export interface CreateProfileInput {
  username: string
  name: string
  role: string
  password?: string
}

export interface UpdateProfileInput {
  display_name?: string
  username?: string
  role?: string
  job_title?: string
  password?: string
}

function configuredClient() {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

function normalizeProfile(p: Partial<Profile>): Profile {
  return {
    id:           String(p.id || ''),
    username:     String(p.username || ''),
    display_name: String(p.display_name || ''),
    role:         String(p.role || 'viewer'),
    job_title:    String(p.job_title || ''),
    password:     p.password ?? undefined,
    created_at:   p.created_at,
    updated_at:   p.updated_at,
  }
}

export const useUserAccessStore = defineStore('userAccess', () => {
  const profiles = ref<Profile[]>([])
  const loading  = ref(false)
  const error    = ref('')

  const getAll = async () => {
    loading.value = true
    error.value   = ''
    try {
      const sb = configuredClient()
      const { data, error: err } = await sb
        .from('tdl_profiles')
        .select('id, username, display_name, role, job_title, password, created_at, updated_at')
        .order('created_at', { ascending: true })

      if (err) throw err
      profiles.value = (data ?? []).map(normalizeProfile)
    } catch (err: any) {
      profiles.value = []
      error.value = err?.message ?? String(err)
    } finally {
      loading.value = false
    }
  }

  const create = async (data: CreateProfileInput) => {
    loading.value = true
    error.value   = ''
    try {
      const sb       = configuredClient()
      const username = data.username.trim().toLowerCase()
      const displayName = data.name.trim()
      const role     = ['admin', 'manager', 'viewer'].includes(data.role) ? data.role : 'manager'

      if (!username || !displayName) throw new Error('Missing fields')

      const { error: err } = await sb
        .from('tdl_profiles')
        .insert({
          id:           crypto.randomUUID(),
          username,
          display_name: displayName,
          role,
          job_title:    '',
          password:     data.password ?? null,
        })
      if (err) throw err

      await getAll()
      return { error: null as Error | null }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
      return { error: err instanceof Error ? err : new Error(error.value) }
    } finally {
      loading.value = false
    }
  }

  const update = async (id: string, data: UpdateProfileInput) => {
    loading.value = true
    error.value   = ''
    try {
      const sb    = configuredClient()
      const patch: Record<string, unknown> = {}

      if (data.display_name !== undefined) patch.display_name = data.display_name.trim()
      if (data.username !== undefined) {
        const u = data.username.trim().toLowerCase()
        if (!u) throw new Error('Username required')
        patch.username = u
      }
      if (data.role !== undefined)      patch.role      = data.role
      if (data.job_title !== undefined) patch.job_title = data.job_title.trim()
      if (data.password !== undefined)  patch.password  = data.password

      if (Object.keys(patch).length > 0) {
        const { error: err } = await sb.from('tdl_profiles').update(patch).eq('id', id)
        if (err) throw err
      }

      await getAll()
      return { error: null as Error | null }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
      return { error: err instanceof Error ? err : new Error(error.value) }
    } finally {
      loading.value = false
    }
  }

  const destroy = async (id: string) => {
    loading.value = true
    error.value   = ''
    try {
      const sb = configuredClient()
      const { error: err } = await sb.from('tdl_profiles').delete().eq('id', id)
      if (err) throw err

      await getAll()
      return { error: null as Error | null }
    } catch (err: any) {
      error.value = err?.message ?? String(err)
      return { error: err instanceof Error ? err : new Error(error.value) }
    } finally {
      loading.value = false
    }
  }

  return { profiles, loading, error, getAll, create, update, destroy }
})
