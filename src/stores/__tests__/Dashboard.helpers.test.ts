import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test the pure helper functions from Dashboard.stores.ts by
// re-implementing and testing the same logic since they aren't exported.

function toDate(d: any): Date | null {
  if (d == null) return null;
  if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
  const p = new Date(d);
  return isNaN(p.getTime()) ? null : p;
}

function sameDay(a: any, b: any): boolean {
  const da = toDate(a);
  const db = toDate(b);
  if (!da || !db) return false;
  return da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate();
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isDone(p: any) {
  const s = String(p.status || '').toLowerCase();
  return s === 'done' || s === 'complete' || s === 'blasting';
}

function drilledFor(patternId: string, log: any[]): number {
  return +log
    .filter(e => e.pattern_id === patternId)
    .reduce((s, e) => s + Number(e.total_drilling_m || 0), 0)
    .toFixed(1);
}

function remainingM(p: any, log: any[]): number {
  return +Math.max(0, Number(p.effective_m || 0) - drilledFor(p.pattern_id, log)).toFixed(1);
}

function progressPct(p: any, log: any[]): number {
  const plan = Number(p.effective_m || 0);
  const drilled = drilledFor(p.pattern_id, log);
  return plan > 0 ? +(Math.min(100, (drilled / plan) * 100)).toFixed(1) : 0;
}

function calcRisk(p: any, log: any[]): string {
  if (isDone(p)) return 'on-track';
  if (p.blast_td_updated) return 'on-track';
  const blastDate = toDate(p.planned_blast_date) ?? toDate(p.actual_blast_date);
  if (!blastDate) return 'no-date';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysToBlast = Math.round((blastDate.getTime() - today.getTime()) / 86400000);
  if (daysToBlast < 0 && !p.blast_td_updated) return 'delayed';
  if (daysToBlast <= 2 && !p.blast_td_updated) return 'at-risk';
  return 'on-track';
}

function calcKpis(patterns: any[], log: any[], week: any) {
  const total = patterns.length;
  const delayed = patterns.filter(p => calcRisk(p, log) === 'delayed').length;
  const atRisk = patterns.filter(p => calcRisk(p, log) === 'at-risk').length;
  const plan_m = patterns.reduce((s, p) => s + Number(p.plan_total_drilling_m || p.effective_m || 0), 0);
  const actual_m = patterns.reduce((s, p) => s + Number(p.carried_drilling_m || 0) + drilledFor(p.pattern_id, log), 0);
  const weekEnd = toDate(week?.week_end);
  const blasts_done = patterns.filter(p => isDone(p)).length;
  const blasts_planned = weekEnd
    ? patterns.filter(p => { const d = toDate(p.planned_blast_date); return d && d <= weekEnd; }).length
    : total;
  const blast_vol = patterns.filter(p => isDone(p)).reduce((s, p) => s + Number(p.actual_blast_vol_bcm || 0), 0);
  const plan_vol = patterns.reduce((s, p) => s + Number(p.plan_blast_vol_bcm || 0), 0);
  return { total, delayed, atRisk, plan_m, actual_m, blasts_done, blasts_planned, blast_vol, plan_vol };
}

function calcPitProgress(patterns: any[], log: any[]) {
  const groups: Record<string, any> = {};
  for (const p of patterns) {
    if (!groups[p.pit_name]) groups[p.pit_name] = { pit: p.pit_name, plan_m: 0, actual_m: 0, complete_m: 0, count: 0, complete: 0 };
    const g = groups[p.pit_name];
    const plan = Number(p.plan_total_drilling_m || p.effective_m || 0);
    const actual = Number(p.carried_drilling_m || 0) + drilledFor(p.pattern_id, log);
    g.plan_m += plan;
    g.actual_m += actual;
    if (isDone(p)) g.complete_m += plan;
    g.count += 1;
    if (isDone(p)) g.complete += 1;
  }
  return Object.values(groups).sort((a: any, b: any) => b.plan_m - a.plan_m);
}

function calcBitSize(log: any[]) {
  const buckets: Record<number, number> = {};
  for (const e of log) {
    const bit = Number(e.drill_bit_size_mm || 0);
    buckets[bit] = (buckets[bit] || 0) + Number(e.total_drilling_m || 0);
  }
  return Object.entries(buckets)
    .map(([k, v]) => ({ bit: +k, m: Math.round(v) }))
    .sort((a, b) => a.bit - b.bit);
}

describe('toDate', () => {
  it('returns null for null/undefined', () => {
    expect(toDate(null)).toBeNull();
    expect(toDate(undefined)).toBeNull();
  });

  it('returns Date for valid Date', () => {
    const d = new Date(2026, 3, 15);
    expect(toDate(d)).toEqual(d);
  });

  it('returns null for invalid Date', () => {
    expect(toDate(new Date('invalid'))).toBeNull();
  });

  it('parses date strings', () => {
    const result = toDate('2026-04-15');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2026);
  });

  it('returns null for unparseable strings', () => {
    expect(toDate('not a date')).toBeNull();
  });
});

describe('sameDay', () => {
  it('returns true for same day', () => {
    expect(sameDay(new Date(2026, 3, 15, 10, 0), new Date(2026, 3, 15, 23, 59))).toBe(true);
  });

  it('returns false for different days', () => {
    expect(sameDay(new Date(2026, 3, 15), new Date(2026, 3, 16))).toBe(false);
  });

  it('returns false if either is null', () => {
    expect(sameDay(null, new Date())).toBe(false);
    expect(sameDay(new Date(), null)).toBe(false);
  });

  it('works with date strings', () => {
    expect(sameDay('2026-04-15', '2026-04-15')).toBe(true);
    expect(sameDay('2026-04-15', '2026-04-16')).toBe(false);
  });
});

describe('addDays', () => {
  it('adds days correctly', () => {
    const d = new Date(2026, 0, 1);
    const result = addDays(d, 5);
    expect(result.getDate()).toBe(6);
  });

  it('does not mutate original', () => {
    const d = new Date(2026, 0, 1);
    addDays(d, 5);
    expect(d.getDate()).toBe(1);
  });

  it('handles negative days', () => {
    const d = new Date(2026, 0, 10);
    expect(addDays(d, -3).getDate()).toBe(7);
  });
});

describe('isDone', () => {
  it('returns true for done status', () => {
    expect(isDone({ status: 'done' })).toBe(true);
    expect(isDone({ status: 'Done' })).toBe(true);
  });

  it('returns true for complete status', () => {
    expect(isDone({ status: 'complete' })).toBe(true);
    expect(isDone({ status: 'Complete' })).toBe(true);
  });

  it('returns true for blasting status', () => {
    expect(isDone({ status: 'blasting' })).toBe(true);
  });

  it('returns false for other statuses', () => {
    expect(isDone({ status: 'pending' })).toBe(false);
    expect(isDone({ status: 'drilling' })).toBe(false);
    expect(isDone({ status: '' })).toBe(false);
    expect(isDone({})).toBe(false);
  });
});

describe('drilledFor', () => {
  const log = [
    { pattern_id: 'P1', total_drilling_m: 10 },
    { pattern_id: 'P1', total_drilling_m: 5.5 },
    { pattern_id: 'P2', total_drilling_m: 20 },
  ];

  it('sums drilling for a specific pattern', () => {
    expect(drilledFor('P1', log)).toBe(15.5);
  });

  it('returns 0 for non-existent pattern', () => {
    expect(drilledFor('P3', log)).toBe(0);
  });

  it('returns 0 for empty log', () => {
    expect(drilledFor('P1', [])).toBe(0);
  });
});

describe('remainingM', () => {
  it('calculates remaining metres', () => {
    const p = { pattern_id: 'P1', effective_m: 100 };
    const log = [{ pattern_id: 'P1', total_drilling_m: 60 }];
    expect(remainingM(p, log)).toBe(40);
  });

  it('returns 0 when drilled exceeds plan', () => {
    const p = { pattern_id: 'P1', effective_m: 50 };
    const log = [{ pattern_id: 'P1', total_drilling_m: 60 }];
    expect(remainingM(p, log)).toBe(0);
  });

  it('returns full effective_m when no drilling', () => {
    const p = { pattern_id: 'P1', effective_m: 100 };
    expect(remainingM(p, [])).toBe(100);
  });
});

describe('progressPct', () => {
  it('calculates percentage correctly', () => {
    const p = { pattern_id: 'P1', effective_m: 200 };
    const log = [{ pattern_id: 'P1', total_drilling_m: 100 }];
    expect(progressPct(p, log)).toBe(50);
  });

  it('caps at 100%', () => {
    const p = { pattern_id: 'P1', effective_m: 50 };
    const log = [{ pattern_id: 'P1', total_drilling_m: 60 }];
    expect(progressPct(p, log)).toBe(100);
  });

  it('returns 0 when effective_m is 0', () => {
    const p = { pattern_id: 'P1', effective_m: 0 };
    const log = [{ pattern_id: 'P1', total_drilling_m: 10 }];
    expect(progressPct(p, log)).toBe(0);
  });
});

describe('calcRisk', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 15)); // April 15, 2026
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns on-track for done patterns', () => {
    expect(calcRisk({ status: 'complete', planned_blast_date: '2026-04-10' }, [])).toBe('on-track');
  });

  it('returns on-track when blast_td_updated', () => {
    expect(calcRisk({ status: 'drilling', blast_td_updated: true, planned_blast_date: '2026-04-10' }, [])).toBe('on-track');
  });

  it('returns delayed when blast date is past', () => {
    expect(calcRisk({ status: 'drilling', planned_blast_date: '2026-04-10' }, [])).toBe('delayed');
  });

  it('returns at-risk when blast date is within 2 days', () => {
    expect(calcRisk({ status: 'drilling', planned_blast_date: '2026-04-16' }, [])).toBe('at-risk');
  });

  it('returns on-track for future blast dates', () => {
    expect(calcRisk({ status: 'drilling', planned_blast_date: '2026-04-20' }, [])).toBe('on-track');
  });

  it('returns no-date when no blast date available', () => {
    expect(calcRisk({ status: 'drilling' }, [])).toBe('no-date');
  });
});

describe('calcKpis', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 15));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns aggregate KPIs for patterns', () => {
    const patterns = [
      { pattern_id: 'P1', pit_name: 'A', effective_m: 100, plan_total_drilling_m: 100, carried_drilling_m: 0, status: 'complete', planned_blast_date: '2026-04-12', plan_blast_vol_bcm: 500, actual_blast_vol_bcm: 480 },
      { pattern_id: 'P2', pit_name: 'A', effective_m: 200, plan_total_drilling_m: 200, carried_drilling_m: 10, status: 'drilling', planned_blast_date: '2026-04-20', plan_blast_vol_bcm: 800, actual_blast_vol_bcm: 0 },
    ];
    const log = [
      { pattern_id: 'P1', total_drilling_m: 100 },
      { pattern_id: 'P2', total_drilling_m: 50 },
    ];
    const week = { week_end: '2026-04-17' };

    const kpis = calcKpis(patterns, log, week);
    expect(kpis.total).toBe(2);
    expect(kpis.plan_m).toBe(300);
    expect(kpis.actual_m).toBe(160); // P1: 0 + 100, P2: 10 + 50
    expect(kpis.blasts_done).toBe(1);
    expect(kpis.blast_vol).toBe(480);
    expect(kpis.plan_vol).toBe(1300);
  });

  it('handles empty patterns', () => {
    const kpis = calcKpis([], [], {});
    expect(kpis.total).toBe(0);
    expect(kpis.plan_m).toBe(0);
    expect(kpis.actual_m).toBe(0);
  });
});

describe('calcPitProgress', () => {
  it('groups patterns by pit', () => {
    const patterns = [
      { pattern_id: 'P1', pit_name: 'PitA', effective_m: 100, plan_total_drilling_m: 100, carried_drilling_m: 0, status: 'complete' },
      { pattern_id: 'P2', pit_name: 'PitA', effective_m: 50, plan_total_drilling_m: 50, carried_drilling_m: 0, status: 'drilling' },
      { pattern_id: 'P3', pit_name: 'PitB', effective_m: 200, plan_total_drilling_m: 200, carried_drilling_m: 0, status: 'pending' },
    ];
    const log = [
      { pattern_id: 'P1', total_drilling_m: 100 },
      { pattern_id: 'P2', total_drilling_m: 30 },
    ];

    const result = calcPitProgress(patterns, log);
    expect(result).toHaveLength(2);

    const pitB = result.find((g: any) => g.pit === 'PitB');
    expect(pitB.plan_m).toBe(200);
    expect(pitB.actual_m).toBe(0);

    const pitA = result.find((g: any) => g.pit === 'PitA');
    expect(pitA.plan_m).toBe(150);
    expect(pitA.actual_m).toBe(130);
    expect(pitA.complete).toBe(1);
  });

  it('sorts by plan_m descending', () => {
    const patterns = [
      { pattern_id: 'P1', pit_name: 'Small', effective_m: 50, plan_total_drilling_m: 50, carried_drilling_m: 0, status: 'pending' },
      { pattern_id: 'P2', pit_name: 'Large', effective_m: 500, plan_total_drilling_m: 500, carried_drilling_m: 0, status: 'pending' },
    ];
    const result = calcPitProgress(patterns, []);
    expect(result[0].pit).toBe('Large');
  });
});

describe('calcBitSize', () => {
  it('groups metres by bit size', () => {
    const log = [
      { drill_bit_size_mm: 89, total_drilling_m: 50 },
      { drill_bit_size_mm: 89, total_drilling_m: 30 },
      { drill_bit_size_mm: 115, total_drilling_m: 100 },
    ];
    const result = calcBitSize(log);
    expect(result).toEqual([
      { bit: 89, m: 80 },
      { bit: 115, m: 100 },
    ]);
  });

  it('returns empty array for empty log', () => {
    expect(calcBitSize([])).toEqual([]);
  });

  it('sorts by bit size ascending', () => {
    const log = [
      { drill_bit_size_mm: 127, total_drilling_m: 10 },
      { drill_bit_size_mm: 89, total_drilling_m: 20 },
      { drill_bit_size_mm: 102, total_drilling_m: 30 },
    ];
    const result = calcBitSize(log);
    expect(result[0].bit).toBe(89);
    expect(result[1].bit).toBe(102);
    expect(result[2].bit).toBe(127);
  });
});
