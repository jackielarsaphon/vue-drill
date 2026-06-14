import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { pct, fnum, addDays, fmtDisplayDate, fmtDate, relDay } from '../format.js';

describe('pct', () => {
  it('returns dash for null', () => {
    expect(pct(null)).toBe('—');
  });

  it('returns dash for undefined', () => {
    expect(pct(undefined)).toBe('—');
  });

  it('returns dash for NaN', () => {
    expect(pct(NaN)).toBe('—');
  });

  it('rounds to integer and appends %', () => {
    expect(pct(42.7)).toBe('43%');
    expect(pct(0)).toBe('0%');
    expect(pct(100)).toBe('100%');
    expect(pct(99.4)).toBe('99%');
  });
});

describe('fnum', () => {
  it('returns dash for null', () => {
    expect(fnum(null)).toBe('—');
  });

  it('returns dash for NaN', () => {
    expect(fnum(NaN)).toBe('—');
  });

  it('formats number with locale separators', () => {
    expect(fnum(1000)).toBe('1,000');
    expect(fnum(1234567)).toBe('1,234,567');
  });

  it('respects digits parameter', () => {
    expect(fnum(1234.567, 2)).toBe('1,234.57');
    expect(fnum(5, 1)).toBe('5.0');
  });

  it('formats zero', () => {
    expect(fnum(0)).toBe('0');
  });
});

describe('addDays', () => {
  it('adds positive days', () => {
    const d = new Date(2026, 0, 1); // Jan 1
    const result = addDays(d, 5);
    expect(result.getDate()).toBe(6);
    expect(result.getMonth()).toBe(0);
  });

  it('subtracts days with negative value', () => {
    const d = new Date(2026, 0, 10);
    const result = addDays(d, -3);
    expect(result.getDate()).toBe(7);
  });

  it('does not mutate the original date', () => {
    const d = new Date(2026, 0, 1);
    addDays(d, 5);
    expect(d.getDate()).toBe(1);
  });

  it('handles month rollover', () => {
    const d = new Date(2026, 0, 30); // Jan 30
    const result = addDays(d, 3);
    expect(result.getMonth()).toBe(1); // Feb
    expect(result.getDate()).toBe(2);
  });
});

describe('fmtDisplayDate', () => {
  it('returns fallback for falsy input', () => {
    expect(fmtDisplayDate(null)).toBe('—');
    expect(fmtDisplayDate(undefined)).toBe('—');
    expect(fmtDisplayDate('')).toBe('—');
  });

  it('uses custom fallback', () => {
    expect(fmtDisplayDate(null, 'N/A')).toBe('N/A');
  });

  it('formats a Date object as d/m/yyyy', () => {
    const d = new Date(2026, 3, 15); // April 15, 2026
    expect(fmtDisplayDate(d)).toBe('15/4/2026');
  });

  it('formats a date string', () => {
    expect(fmtDisplayDate('2026-04-15')).toBe('15/4/2026');
  });

  it('returns fallback for invalid date', () => {
    expect(fmtDisplayDate('not-a-date')).toBe('—');
  });

  it('returns fallback for year <= 1970', () => {
    expect(fmtDisplayDate(new Date(1970, 0, 1))).toBe('—');
  });
});

describe('fmtDate', () => {
  it('is an alias for fmtDisplayDate', () => {
    const d = new Date(2026, 5, 20);
    expect(fmtDate(d)).toBe(fmtDisplayDate(d));
  });
});

describe('relDay', () => {
  let realDate;

  beforeEach(() => {
    realDate = Date;
    const mockDate = new Date(2026, 3, 15); // April 15, 2026
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "today" for current date', () => {
    expect(relDay(new Date(2026, 3, 15))).toBe('today');
  });

  it('returns "tomorrow" for next day', () => {
    expect(relDay(new Date(2026, 3, 16))).toBe('tomorrow');
  });

  it('returns "yesterday" for previous day', () => {
    expect(relDay(new Date(2026, 3, 14))).toBe('yesterday');
  });

  it('returns "in Xd" for future dates', () => {
    expect(relDay(new Date(2026, 3, 20))).toBe('in 5d');
  });

  it('returns "Xd ago" for past dates', () => {
    expect(relDay(new Date(2026, 3, 12))).toBe('3d ago');
  });
});
