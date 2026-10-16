// @ts-nocheck  — Deno runtime types; ignore TS errors in VS Code
import { createClient } from '@supabase/supabase-js'

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || ''

const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN || 'null',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // ── Verify caller session ────────────────────────────────────────────────────
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  if (!token) return json({ error: 'Unauthorized' }, 401)

  const { data: { user: caller }, error: callerErr } = await admin.auth.getUser(token)
  if (callerErr || !caller) return json({ error: 'Unauthorized' }, 401)

  const { data: callerProfile } = await admin
    .from('tdl_profiles')
    .select('role')
    .eq('id', caller.id)
    .single()

  const callerRole = callerProfile?.role ?? ''
  if (!['admin', 'manager'].includes(callerRole)) {
    return json({ error: 'Insufficient permissions' }, 403)
  }

  const body = await req.json()
  const { action } = body

  // ── Delete user ──────────────────────────────────────────────────────────────
  if (action === 'delete') {
    if (callerRole !== 'admin') return json({ error: 'Only admin can delete users' }, 403)
    const { user_id } = body
    if (!user_id) return json({ error: 'user_id required' }, 400)
    const { error } = await admin.auth.admin.deleteUser(user_id)
    if (error) return json({ error: error.message }, 400)
    return json({ ok: true })
  }

  // ── Create user ──────────────────────────────────────────────────────────────
  const { username, password, display_name, role, job_title = '', is_active = true } = body

  if (!username || !password || !display_name) {
    return json({ error: 'username, password and display_name are required' }, 400)
  }

  const targetRole = role === 'admin' ? 'admin' : 'manager'

  if (callerRole === 'manager' && targetRole === 'admin') {
    return json({ error: 'Managers cannot create Admin accounts' }, 403)
  }

  const domain = Deno.env.get('AUTH_EMAIL_DOMAIN') ?? 'tdl-drill.local'
  const cleanUsername = username.trim().toLowerCase()
  const email = `${cleanUsername}@${domain}`

  // 1. Create auth user (trigger will auto-create tdl_profiles row)
  const { data, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: cleanUsername, display_name, role: targetRole },
  })

  if (createErr) return json({ error: createErr.message }, 400)

  const userId = data.user.id

  // 2. Upsert tdl_profiles with all fields (handles trigger race condition)
  const { error: profileErr } = await admin
    .from('tdl_profiles')
    .upsert({
      id: userId,
      username: cleanUsername,
      display_name,
      role: targetRole,
      job_title,
      is_active,
    }, { onConflict: 'id' })

  if (profileErr) {
    // Auth user created but profile upsert failed — still return success
    console.error('Profile upsert error:', profileErr.message)
  }

  return json({ id: userId, username: cleanUsername, display_name, role: targetRole, job_title, is_active })
})
