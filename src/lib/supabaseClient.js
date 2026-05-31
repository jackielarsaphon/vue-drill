import { createClient } from '@supabase/supabase-js';

const url       = import.meta.env.VITE_SUPABASE_URL?.trim();
const publicKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

const SINGLETON_KEY = '__tdl_supabase__';

export function getDemoOverrideRole() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return '';
  const demo = new URLSearchParams(window.location.search).get('demo');
  if (demo === 'admin' || demo === 'manager') return demo;
  return demo === '1' || demo === 'true' ? 'manager' : '';
}

export function isSupabaseConfigured() {
  if (getDemoOverrideRole()) return false;
  return Boolean(url && publicKey);
}

export function getSupabase() {
  if (!url || !publicKey) return null;
  if (!globalThis[SINGLETON_KEY]) {
    globalThis[SINGLETON_KEY] = createClient(url, publicKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storage: typeof localStorage !== 'undefined' ? localStorage : undefined,
      },
    });
  }
  return globalThis[SINGLETON_KEY];
}
