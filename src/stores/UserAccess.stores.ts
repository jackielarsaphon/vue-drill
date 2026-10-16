import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getSupabase } from '../lib/supabaseClient.js'

export interface Profile {
  id: string
  username: string
  display_name: string
  role: string
  job_title: string
  created_at?: string
  updated_at?: string
}

export interface CreateProfileInput {
  username: string
  name: string
  role: string
}

export interface UpdateProfileInput {
  display_name?: string
  username?: string
  role?: string
  job_title?: string
}

function configuredClient() {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

// PostgREST answers a unique-key clash with HTTP 409 / code 23505; the only
// unique column a user can hit here is username.
function isDuplicateUsername(err: any): boolean {
  return err?.code === '23505'
}

// The browser only logs "409" for a failed request; spell out why.
function logDbError(op: string, err: any) {
  console.error(`[userAccess.${op}] error:`, err?.code, err?.message, err?.details ?? '', err?.hint ?? '')
}

function normalizeProfile(p: Partial<Profile>): Profile {
  return {
    id:           String(p.id || ''),
    username:     String(p.username || ''),
    display_name: String(p.display_name || ''),
    role:         String(p.role || 'viewer'),
    job_title:    String(p.job_title || ''),
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
        .select('id, username, display_name, role, job_title, created_at, updated_at')
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
    const username = data.username.trim().toLowerCase()
    try {
      const sb       = configuredClient()
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
        })
      if (err) throw err

      await getAll()
      return { error: null as Error | null }
    } catch (err: any) {
      logDbError('create', err)
      if (isDuplicateUsername(err)) {
        // The list was stale (another tab or admin added it) — show it now.
        await getAll()
        return { error: new Error(`Username "${username}" already exists.`) }
      }
      error.value = err?.message ?? String(err)
      return { error: err instanceof Error ? err : new Error(error.value) }
    } finally {
      loading.value = false
    }
  }

  const update = async (id: string, data: UpdateProfileInput) => {
    loading.value = true
    error.value   = ''
    const patch: Record<string, unknown> = {}
    try {
      const sb    = configuredClient()

      if (data.display_name !== undefined) patch.display_name = data.display_name.trim()
      if (data.username !== undefined) {
        const u = data.username.trim().toLowerCase()
        if (!u) throw new Error('Username required')
        patch.username = u
      }
      if (data.role !== undefined)      patch.role      = data.role
      if (data.job_title !== undefined) patch.job_title = data.job_title.trim()

      if (Object.keys(patch).length > 0) {
        const { error: err } = await sb.from('tdl_profiles').update(patch).eq('id', id)
        if (err) throw err
      }

      await getAll()
      return { error: null as Error | null }
    } catch (err: any) {
      logDbError('update', err)
      if (isDuplicateUsername(err)) {
        await getAll()
        return { error: new Error(`Username "${patch.username}" already exists.`) }
      }
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
      logDbError('destroy', err)
      error.value = err?.message ?? String(err)
      return { error: err instanceof Error ? err : new Error(error.value) }
    } finally {
      loading.value = false
    }
  }

  return { profiles, loading, error, getAll, create, update, destroy }
})
