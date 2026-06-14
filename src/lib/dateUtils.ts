/**
 * Shared date utility functions used across stores and components.
 * Consolidates duplicated date helpers from Dashboard.stores, Patterns.stores,
 * format.js, and data.js.
 */

/** Safely parse any value into a Date or null. */
export function toDate(d: unknown): Date | null {
  if (d == null) return null
  if (d instanceof Date) return isNaN(d.getTime()) ? null : d
  const p = new Date(d as string | number)
  return isNaN(p.getTime()) ? null : p
}

/** Check if two date-like values fall on the same calendar day. */
export function sameDay(a: unknown, b: unknown): boolean {
  const da = toDate(a)
  const db = toDate(b)
  if (!da || !db) return false
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}

/** Return a new Date that is `n` days offset from the given date. */
export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

/**
 * Convert a date-like value to an ISO date string (YYYY-MM-DD) or null.
 * Replaces `isoDate()` in Patterns.stores and `toIsoDate()` in demo.js.
 */
export function toIsoDate(d: unknown): string | null {
  if (!d) return null
  if (d instanceof Date) {
    if (isNaN(d.getTime())) return null
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${d.getFullYear()}-${mm}-${dd}`
  }
  const s = String(d).slice(0, 10)
  return s || null
}
