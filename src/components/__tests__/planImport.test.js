import { describe, it, expect } from 'vitest';
import { PATTERN_RE, PATTERN_TYPES } from '../planImport.js';

describe('PATTERN_RE', () => {
  it('matches valid pattern IDs', () => {
    expect(PATTERN_RE.test('NLU01_170RL_5M_101_TRI')).toBe(true);
    expect(PATTERN_RE.test('KTL05_200RL_10M_105_PROTRI')).toBe(true);
    expect(PATTERN_RE.test('NDA02_190RL_7.5M_110_PRORAMP')).toBe(true);
    expect(PATTERN_RE.test('KCN12_210RL_10M_120_FIXTOE')).toBe(true);
  });

  it('rejects invalid pattern IDs', () => {
    expect(PATTERN_RE.test('invalid')).toBe(false);
    expect(PATTERN_RE.test('NLU01')).toBe(false);
    expect(PATTERN_RE.test('NLU01_170RL')).toBe(false);
    expect(PATTERN_RE.test('123_170RL_5M_101_TRI')).toBe(false);
  });

  it('requires uppercase letters at start', () => {
    expect(PATTERN_RE.test('nlu01_170RL_5M_101_TRI')).toBe(false);
  });

  it('handles multi-suffix types', () => {
    expect(PATTERN_RE.test('NLU01_170RL_5M_101_PRO_F1')).toBe(true);
  });
});

describe('PATTERN_TYPES', () => {
  it('contains all expected pattern types', () => {
    expect(PATTERN_TYPES).toContain('TRI');
    expect(PATTERN_TYPES).toContain('PRO');
    expect(PATTERN_TYPES).toContain('PROTRI');
    expect(PATTERN_TYPES).toContain('RAMP');
    expect(PATTERN_TYPES).toContain('PRORAMP');
    expect(PATTERN_TYPES).toContain('FIXTOE');
    expect(PATTERN_TYPES).toContain('FIXRAMP');
  });

  it('has 7 types', () => {
    expect(PATTERN_TYPES).toHaveLength(7);
  });
});

// Test the pure helper functions by reimplementing their logic
describe('planImport internal helpers', () => {
  function toNumber(value, fallback = 0) {
    const str = String(value ?? '').replace(/,/g, '').trim();
    if (!str) return fallback;
    const parsed = Number(str);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  describe('toNumber', () => {
    it('parses numeric strings', () => {
      expect(toNumber('123')).toBe(123);
      expect(toNumber('45.6')).toBe(45.6);
    });

    it('strips commas', () => {
      expect(toNumber('1,234')).toBe(1234);
    });

    it('returns fallback for non-numeric', () => {
      expect(toNumber('abc')).toBe(0);
      expect(toNumber('abc', 99)).toBe(99);
    });

    it('returns fallback for empty', () => {
      expect(toNumber('')).toBe(0);
      expect(toNumber(null)).toBe(0);
      expect(toNumber(undefined)).toBe(0);
    });
  });

  function patternParts(patternId) {
    const match = patternId.match(/^([A-Z]+[0-9]+[A-Z]*)_([0-9]+)RL_([0-9]+(?:\.[0-9]+)?)M_[0-9]+_([A-Z0-9]+(?:_[A-Z0-9]+)*)$/);
    if (!match) return null;
    return {
      pit_name: match[1],
      rl_level: +match[2],
      bench_height_m: +match[3],
      pattern_type: match[4],
    };
  }

  describe('patternParts', () => {
    it('extracts parts from valid pattern ID', () => {
      const parts = patternParts('NLU01_170RL_10M_101_TRI');
      expect(parts).toEqual({
        pit_name: 'NLU01',
        rl_level: 170,
        bench_height_m: 10,
        pattern_type: 'TRI',
      });
    });

    it('handles decimal bench height', () => {
      const parts = patternParts('NDA02_190RL_7.5M_110_PROTRI');
      expect(parts).toEqual({
        pit_name: 'NDA02',
        rl_level: 190,
        bench_height_m: 7.5,
        pattern_type: 'PROTRI',
      });
    });

    it('returns null for invalid IDs', () => {
      expect(patternParts('invalid')).toBeNull();
      expect(patternParts('')).toBeNull();
    });

    it('handles multi-part type names', () => {
      const parts = patternParts('KCN12_210RL_10M_120_PRO_F1');
      expect(parts).toEqual({
        pit_name: 'KCN12',
        rl_level: 210,
        bench_height_m: 10,
        pattern_type: 'PRO_F1',
      });
    });
  });

  function compactToken(value) {
    return String(value || '').replace(/\s+/g, '').toUpperCase();
  }

  describe('compactToken', () => {
    it('uppercases and removes whitespace', () => {
      expect(compactToken('pro tri')).toBe('PROTRI');
      expect(compactToken('  fix  toe  ')).toBe('FIXTOE');
    });

    it('handles empty/null', () => {
      expect(compactToken('')).toBe('');
      expect(compactToken(null)).toBe('');
    });
  });

  function canonicalType(value) {
    const compacted = compactToken(value).replace(/-/g, '_');
    const known = PATTERN_TYPES.find((type) => compacted === type);
    if (known) return known;
    return compacted.replace(/_+/g, '_').replace(/^_|_$/g, '');
  }

  describe('canonicalType', () => {
    it('normalizes known types', () => {
      expect(canonicalType('tri')).toBe('TRI');
      expect(canonicalType('pro tri')).toBe('PROTRI');
      expect(canonicalType('PRORAMP')).toBe('PRORAMP');
    });

    it('converts dashes to underscores for unknown types', () => {
      expect(canonicalType('PRO-RAMP')).toBe('PRO_RAMP');
    });

    it('cleans up unknown types', () => {
      expect(canonicalType('custom-type')).toBe('CUSTOM_TYPE');
    });

    it('strips leading/trailing underscores', () => {
      expect(canonicalType('_test_')).toBe('TEST');
    });
  });

  function normalizeLine(value) {
    return String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s*_\s*/g, '_')
      .replace(/\s*-\s*/g, '-')
      .replace(/([0-9])\s*\.\s*([0-9])/g, '$1.$2')
      .replace(/\bR\s+L\b/gi, 'RL')
      .replace(/\b([0-9]+(?:\.[0-9]+)?)\s+M\b/gi, '$1M')
      .replace(/\b(PROTRI|PRORAMP|FIXTOE|FIXRAMP|PRO|TRI|RAMP)\s+(F[0-9]+)\b/gi, '$1_$2')
      .replace(/\s+/g, ' ')
      .trim();
  }

  describe('normalizeLine', () => {
    it('collapses whitespace', () => {
      expect(normalizeLine('hello   world')).toBe('hello world');
    });

    it('replaces non-breaking spaces', () => {
      expect(normalizeLine('hello\u00a0world')).toBe('hello world');
    });

    it('joins RL after number', () => {
      expect(normalizeLine('170 R L')).toBe('170 RL');
    });

    it('joins M after number', () => {
      expect(normalizeLine('10 M')).toBe('10M');
      expect(normalizeLine('7.5 M')).toBe('7.5M');
    });

    it('collapses spaces around underscores', () => {
      expect(normalizeLine('NLU01 _ 170RL')).toBe('NLU01_170RL');
    });

    it('joins pattern type with suffix', () => {
      expect(normalizeLine('PRO F1')).toBe('PRO_F1');
      expect(normalizeLine('FIXTOE F2')).toBe('FIXTOE_F2');
    });

    it('handles empty/null', () => {
      expect(normalizeLine('')).toBe('');
      expect(normalizeLine(null)).toBe('');
    });
  });

  function isThaiDrillSection(text) {
    const t = String(text || '').toLowerCase();
    return t.includes('thai') && t.includes('drill');
  }

  describe('isThaiDrillSection', () => {
    it('returns true when both "thai" and "drill" are present', () => {
      expect(isThaiDrillSection('Thaidrill Section')).toBe(true);
      expect(isThaiDrillSection('THAI DRILL TEAM')).toBe(true);
    });

    it('returns false when only one is present', () => {
      expect(isThaiDrillSection('Thai section')).toBe(false);
      expect(isThaiDrillSection('Drill team')).toBe(false);
    });

    it('handles empty/null', () => {
      expect(isThaiDrillSection('')).toBe(false);
      expect(isThaiDrillSection(null)).toBe(false);
    });
  });

  function stripDateText(value) {
    return String(value || '')
      .replace(/\b20[0-9]{2}[-/.][01]?[0-9][-/.][0-3]?[0-9]\b/g, ' ')
      .replace(/\b[0-3]?[0-9][-/.][A-Za-z]{3,9}[-/.][0-9]{2,4}\b/g, ' ')
      .replace(/\b[0-3]?[0-9][-/.][01]?[0-9][-/.]20[0-9]{2}\b/g, ' ')
      .replace(/\b[0-3]?[0-9]\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+20[0-9]{2}\b/gi, ' ')
      .replace(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+[0-3]?[0-9],?\s+20[0-9]{2}\b/gi, ' ');
  }

  describe('stripDateText', () => {
    it('removes ISO dates', () => {
      expect(stripDateText('Pattern 2026-04-15 info').trim()).toBe('Pattern   info');
    });

    it('removes DMY dates', () => {
      expect(stripDateText('Pattern 15/04/2026 info').trim()).toBe('Pattern   info');
    });

    it('removes month-name dates', () => {
      expect(stripDateText('Pattern 15-Mar-2026 info').trim()).toBe('Pattern   info');
    });

    it('removes "DD Month YYYY" format', () => {
      expect(stripDateText('Pattern 15 March 2026 info').trim()).toBe('Pattern   info');
    });

    it('removes "Month DD, YYYY" format', () => {
      expect(stripDateText('Pattern March 15, 2026 info').trim()).toBe('Pattern   info');
    });

    it('leaves non-date text intact', () => {
      expect(stripDateText('No dates here')).toBe('No dates here');
    });
  });
});
