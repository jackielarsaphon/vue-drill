import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { WEEK, TODAY, addDays } from './data.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const PATTERN_TYPES = ['TRI', 'PRO', 'PROTRI', 'RAMP', 'PRORAMP', 'FIXTOE', 'FIXRAMP'];
const PATTERN_RE = /^[A-Z]+[0-9]+[A-Z]*_[0-9]+RL_[0-9]+(\.[0-9]+)?M_[0-9]+_[A-Z0-9]+(?:_[A-Z0-9]+)*$/;
const TABLE_PATTERN_RE = /\b([A-Z]+[0-9]+[A-Z]*_[0-9]+RL_[0-9]+(?:\.[0-9]+)?M_[0-9]+_[A-Z0-9]+(?:_[A-Z0-9]+)*)\b/;
const TABLE_PATTERN_GLOBAL_RE = /\b([A-Z]+[0-9]+[A-Z]*_[0-9]+RL_[0-9]+(?:\.[0-9]+)?M_[0-9]+_[A-Z0-9]+(?:_[A-Z0-9]+)*)\b/g;
const FLEX_PATTERN_SOURCE = String.raw`\b([A-Z]+\s*[0-9]+\s*[A-Z]*)\s*(?:_|-|\s)+([0-9]+)\s*R\s*L\s*(?:_|-|\s)+([0-9]+(?:\s*\.\s*[0-9]+)?)\s*M\s*(?:_|-|\s)+([0-9]+)\s*(?:_|-|\s)+(PRO\s*TRI|PRO\s*RAMP|FIX\s*TOE|FIX\s*RAMP|TRI|PRO|RAMP|[A-Z0-9]+(?:\s*_\s*[A-Z0-9]+)*)\b`;
const FLEX_TABLE_PATTERN_RE = new RegExp(FLEX_PATTERN_SOURCE);
const FLEX_TABLE_PATTERN_GLOBAL_RE = new RegExp(FLEX_PATTERN_SOURCE, 'g');
const NUM_RE = /\b[0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?\b/g;

export { PATTERN_RE, PATTERN_TYPES };

function isThaiDrillSection(text) {
  const t = String(text || '').toLowerCase();
  return t.includes('thai') && t.includes('drill');
}

function toNumber(value, fallback = 0) {
  const str = String(value ?? '').replace(/,/g, '').trim();
  if (!str) return fallback;
  const parsed = Number(str);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stripDateText(value) {
  return String(value || '')
    .replace(/\b20[0-9]{2}[-/.][01]?[0-9][-/.][0-3]?[0-9]\b/g, ' ')
    .replace(/\b[0-3]?[0-9][-/.][A-Za-z]{3,9}[-/.][0-9]{2,4}\b/g, ' ')
    .replace(/\b[0-3]?[0-9][-/.][01]?[0-9][-/.]20[0-9]{2}\b/g, ' ')
    .replace(/\b[0-3]?[0-9]\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+20[0-9]{2}\b/gi, ' ')
    .replace(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+[0-3]?[0-9],?\s+20[0-9]{2}\b/gi, ' ');
}

function parseDate(value) {
  const text = String(value || '').trim();
  const iso = text.match(/\b(20[0-9]{2})[-/.]([01]?[0-9])[-/.]([0-3]?[0-9])\b/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);

  const dmy = text.match(/\b([0-3]?[0-9])[-/.]([01]?[0-9])[-/.](20[0-9]{2})\b/);
  if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);

  const shortDmy = text.match(/\b([0-3]?[0-9])[-/.]([01]?[0-9])[-/.]([0-9]{2})\b/);
  if (shortDmy) return new Date(2000 + +shortDmy[3], +shortDmy[2] - 1, +shortDmy[1]);

  const monthName = text.match(/\b([0-3]?[0-9])[-\s/.](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*[-\s/.]([0-9]{2,4})\b/i);
  if (monthName) {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const year = +monthName[3] < 100 ? 2000 + +monthName[3] : +monthName[3];
    return new Date(year, months.indexOf(monthName[2].slice(0, 3).toLowerCase()), +monthName[1]);
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? addDays(TODAY, 5) : parsed;
}

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

function compactToken(value) {
  return String(value || '').replace(/\s+/g, '').toUpperCase();
}

function canonicalType(value) {
  const compacted = compactToken(value).replace(/-/g, '_');
  const known = PATTERN_TYPES.find((type) => compacted === type);
  if (known) return known;
  return compacted.replace(/_+/g, '_').replace(/^_|_$/g, '');
}

function canonicalPatternIdFromMatch(match) {
  if (!match) return '';
  if (match.length === 2) return compactToken(match[1]);
  const pit = compactToken(match[1]);
  const rl = compactToken(match[2]);
  const bench = compactToken(match[3]);
  const seq = compactToken(match[4]);
  const type = canonicalType(match[5]);
  return `${pit}_${rl}RL_${bench}M_${seq}_${type}`;
}

function findPatternMatches(value) {
  const text = normalizeLine(value);
  const matches = [...text.matchAll(TABLE_PATTERN_GLOBAL_RE)].map((match) => ({
    pattern_id: canonicalPatternIdFromMatch(match),
    index: match.index,
    raw: match[0],
  }));

  for (const match of text.matchAll(FLEX_TABLE_PATTERN_GLOBAL_RE)) {
    const pattern_id = canonicalPatternIdFromMatch(match);
    if (!PATTERN_RE.test(pattern_id)) continue;
    if (matches.some((candidate) => candidate.pattern_id === pattern_id)) continue;
    matches.push({ pattern_id, index: match.index, raw: match[0] });
  }

  return matches.sort((a, b) => a.index - b.index);
}

function normalizeLine(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s*_\s*/g, '_')
    .replace(/\s*-\s*/g, '-')
    .replace(/([0-9])\s*\.\s*([0-9])/g, '$1.$2')
    .replace(/\bR\s+L\b/gi, 'RL')
    .replace(/\b([0-9]+(?:\.[0-9]+)?)\s+M\b/gi, '$1M')
    // Re-join pattern type suffixes split by space (e.g. "PRO F1" \u2192 "PRO_F1")
    .replace(/\b(PROTRI|PRORAMP|FIXTOE|FIXRAMP|PRO|TRI|RAMP)\s+(F[0-9]+)\b/gi, '$1_$2')
    .replace(/\s+/g, ' ')
    .trim();
}

function rowTextItems(textContent) {
  const rows = [];
  for (const item of textContent.items) {
    const value = item.str?.trim();
    if (!value) continue;
    const [, , , , x, y] = item.transform;
    let row = rows.find((candidate) => Math.abs(candidate.y - y) < 4.5);
    if (!row) {
      row = { y, items: [] };
      rows.push(row);
    }
    row.items.push({ x, value });
  }

  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => normalizeLine(row.items.sort((a, b) => a.x - b.x).map((item) => item.value).join(' ')))
    .filter(Boolean);
}

function rowObjects(textContent) {
  const rows = [];
  for (const item of textContent.items) {
    const value = item.str?.trim();
    if (!value) continue;
    const [, , , , x, y] = item.transform;
    let row = rows.find((candidate) => Math.abs(candidate.y - y) < 4.5);
    if (!row) {
      row = { y, items: [] };
      rows.push(row);
    }
    row.items.push({ x, value });
  }

  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => {
      const items = row.items.sort((a, b) => a.x - b.x);
      return {
        y: row.y,
        items,
        line: normalizeLine(items.map((item) => item.value).join(' ')),
      };
    })
    .filter((row) => row.line);
}

function pageTextSegments(rows) {
  const pageText = normalizeLine(rows.map((row) => row.line).join(' '));
  const matches = findPatternMatches(pageText);
  return matches.map((match, index) => {
    const next = matches[index + 1];
    return pageText.slice(match.index, next?.index || pageText.length);
  });
}

function patternOnlyCandidates(rows) {
  const ids = new Set();
  for (const row of rows) {
    for (const match of findPatternMatches(row.line)) {
      ids.add(match.pattern_id);
    }
  }
  return [...ids];
}

function rowCandidates(rows) {
  const candidates = [];
  for (let i = 0; i < rows.length; i += 1) {
    let merged = '';
    for (let span = 0; span < 4 && i + span < rows.length; span += 1) {
      merged = normalizeLine(`${merged} ${rows[i + span].line}`);
      candidates.push(merged);
    }
  }

  candidates.push(...pageTextSegments(rows));
  candidates.push(...patternOnlyCandidates(rows));
  return candidates;
}

function nextPitPriority(pitName, existingRows) {
  const existing = existingRows.filter((p) => p.pit_name === pitName);
  if (!existing.length) return 1;
  return Math.max(...existing.map((p) => p.pit_priority)) + 1;
}

function riskForNew(plannedBlastDate, drillingPct) {
  const daysToBlast = Math.round((plannedBlastDate - TODAY) / 86400000);
  if (daysToBlast < 0 && drillingPct < 100) return 'delayed';
  if (daysToBlast <= 2) return 'at-risk';
  return 'on-track';
}

function numericColumns(afterPattern, parts) {
  // When a span candidate absorbs the next row, its pattern ID text appears in afterPattern.
  // Truncate there so numbers embedded in "NLU03A_180RL_5M_110_PRO" don't corrupt the pfIdx scan.
  const nextPat = TABLE_PATTERN_RE.exec(afterPattern) ?? FLEX_TABLE_PATTERN_RE.exec(afterPattern);
  const safeAfter = nextPat ? afterPattern.slice(0, nextPat.index) : afterPattern;
  let values = (stripDateText(safeAfter).match(NUM_RE) || []).map((value) => toNumber(value));

  // Excel/PDF tables often repeat rl_level and bench_height as separate columns
  // after the pattern ID. Strip these known duplicates from the front so they
  // are not misidentified as hole count or bit diameter.
  while (values.length > 0 && (values[0] === parts.rl_level || values[0] === parts.bench_height_m)) {
    values = values.slice(1);
  }

  // LXML format columns (after pattern ID): BlastArea, PowderFactor(>0,≤2), BitDia(75-251mm),
  // HoleDepth, PenRate, DrillPerDay, TotalDrilling, Stemming, NumberOfHoles, BlastVolumes, Explosive
  // Weekly schedule fractions may follow — only the first 11 data columns matter.
  // Anchor on the PowderFactor+BitDia pair because PDF text extraction sometimes emits extra
  // tokens before the standard columns (e.g. "2891.910 0.000 2,892" instead of just "2,892").
  let pfIdx = -1;
  for (let i = 0; i < values.length - 8; i++) {
    if (values[i] > 0 && values[i] <= 2 && values[i + 1] >= 75 && values[i + 1] <= 251) {
      pfIdx = i;
      break;
    }
  }
  if (pfIdx >= 0) {
    // Locate Blast Volumes (bcm) — the single largest value to the right of the
    // bit-diameter column — and Number of Holes, which sits immediately before it.
    const searchStart = pfIdx + 3;
    let vIdx = -1;
    for (let i = searchStart; i < values.length; i++) {
      if (vIdx < 0 || values[i] > values[vIdx]) vIdx = i;
    }
    // Newer LXML exports insert extra geometry columns (Total drill rig, Days,
    // Burden, Spacing, No Rows, Max No Drills) between Total Drilling and Blast
    // Volumes, so the classic fixed offsets no longer line up. Detect that
    // "extended" layout by how far Blast Volumes sits from the bit-dia anchor and
    // read the columns by value instead of position.
    const extended = vIdx - pfIdx >= 10;
    if (extended && vIdx > searchStart) {
      const holeDepth = values[pfIdx + 2];
      const volume = values[vIdx];
      const holes = values[vIdx - 1];
      // Total Drilling ≈ Number of Holes × Hole Depth — use it to tell the real
      // plan-metres column apart from the similar-magnitude "Drilling meter per day".
      let plan = 0;
      if (holeDepth > 0 && holeDepth <= 30 && holes > 0) {
        const expected = holes * holeDepth;
        let best = -1;
        for (let i = searchStart; i < vIdx - 1; i++) {
          if (values[i] <= 0) continue;
          if (best < 0 || Math.abs(values[i] - expected) < Math.abs(values[best] - expected)) best = i;
        }
        plan = best >= 0 ? values[best] : expected;
      }
      if (volume >= holes && holes > 0 && plan > 0) {
        const result = { holes: +holes.toFixed(2), bit: 115, plan, carried: 0, effective: plan, volume, blastArea: pfIdx > 0 ? values[pfIdx - 1] : 0 };
        console.log('[parse] LXML(extended) pfIdx=' + pfIdx + ' vIdx=' + vIdx + ' → holes=' + result.holes + ' plan=' + result.plan + ' vol=' + result.volume);
        return result;
      }
    }
    const result = {
      holes: +(values[pfIdx + 7] || 0).toFixed(2),
      bit: 115,
      plan: values[pfIdx + 5] || 0,
      carried: 0,
      effective: values[pfIdx + 5] || 0,
      volume: values[pfIdx + 8] || 0,
      blastArea: pfIdx > 0 ? values[pfIdx - 1] : 0,
    };
    console.log('[parse] LXML pfIdx=' + pfIdx + ' values=' + JSON.stringify(values.slice(0, 12)) + ' → holes=' + result.holes + ' plan=' + result.plan + ' vol=' + result.volume);
    return result;
  }

  // No powder+bit anchor — e.g. a plan (often a PDF) without a Hole Diameter column:
  // BlastArea, PowderFactor, DrillPerDay, TotalDrilling, Stemming, NumberOfHoles, BlastVolumes.
  // Anchor on Blast Volumes (the largest value in the row) and read Number of Holes just
  // before it; recover Total Drilling as the column closest to holes × hole depth
  // (hole depth ≈ bench height + 0.5 m sub-drill, taken from the pattern ID).
  {
    let vIdx = -1;
    for (let i = 1; i < values.length; i++) {
      if (values[i] > 0 && (vIdx < 0 || values[i] > values[vIdx])) vIdx = i;
    }
    if (vIdx > 1) {
      const volume = values[vIdx];
      const holes = values[vIdx - 1];
      const holeDepth = parts.bench_height_m > 0 ? parts.bench_height_m + 0.5 : 6;
      const expected = holes * holeDepth;
      let best = -1;
      for (let i = 0; i < vIdx - 1; i++) {
        if (values[i] <= 0) continue;
        if (best < 0 || Math.abs(values[i] - expected) < Math.abs(values[best] - expected)) best = i;
      }
      const plan = best >= 0 ? values[best] : expected;
      if (volume >= holes && holes > 0 && plan > 0) {
        console.log('[parse] LXML(no-bit) vIdx=' + vIdx + ' → holes=' + holes + ' plan=' + plan + ' vol=' + volume);
        return { holes: +holes.toFixed(2), bit: 115, plan, carried: 0, effective: plan, volume, blastArea: values[0] > 0 ? values[0] : 0 };
      }
    }
  }

  for (let i = 0; i < values.length - 7; i++) {
    const [bitDia, holeDepth, penRate, drillPerDay, totalDrilling, stemming, holeCount, blastVolume] = values.slice(i, i + 8);
    if (
      bitDia >= 75 && bitDia <= 251 &&
      holeDepth > 0 && holeDepth <= 30 &&
      penRate > 0 && penRate <= 100 &&
      drillPerDay >= 100 &&
      totalDrilling >= 20 &&
      stemming >= 0 && stemming <= 50 &&
      Number.isInteger(holeCount) && holeCount > 0 && holeCount <= 2000 &&
      blastVolume >= holeCount
    ) {
      return {
        holes: Math.round(holeCount),
        bit: bitDia,
        plan: totalDrilling,
        carried: 0,
        effective: totalDrilling,
        volume: blastVolume,
        blastArea: i >= 2 && values[i - 1] > 0 && values[i - 1] <= 2 ? values[i - 2] : 0,
      };
    }
  }

  const holesIndex = values.findIndex((value) => Number.isInteger(value) && value > 0 && value <= 2000);
  const holes = holesIndex >= 0 ? values[holesIndex] : 0;
  const afterHoles = holesIndex >= 0 ? values.slice(holesIndex + 1) : values;
  const bitIndex = afterHoles.findIndex((value) => Number.isInteger(value) && value >= 75 && value <= 251);
  const bit = bitIndex >= 0 ? afterHoles[bitIndex] : 115;
  const afterBit = bitIndex >= 0 ? afterHoles.slice(bitIndex + 1) : afterHoles;
  const fallbackHoles = holes || 1;
  const fallbackPlan = +(fallbackHoles * (parts.bench_height_m + 1)).toFixed(1);
  const plan = afterBit[0] || fallbackPlan;
  const tail = afterBit.slice(1);
  let carried = 0;
  let effective = plan;
  let volume = Math.round(fallbackHoles * parts.bench_height_m * 45);

  if (tail.length >= 4) {
    carried = tail[0];
    effective = tail[1];
    volume = tail[tail.length - 1];
  } else if (tail.length === 3) {
    const [a, b, c] = tail;
    if (Math.abs(b - (plan - a)) <= Math.max(10, plan * 0.12)) {
      carried = a;
      effective = b;
      volume = c;
    } else {
      effective = a;
      volume = c;
    }
  } else if (tail.length === 2) {
    const [a, b] = tail;
    if (b > plan * 1.4) {
      effective = a;
      volume = b;
    } else {
      carried = a;
      effective = b;
    }
  } else if (tail.length === 1) {
    effective = tail[0];
  }

  carried = Math.max(0, carried);
  effective = Math.max(0, effective || plan - carried);
  volume = Math.max(0, volume);

  return { holes: +(holes || 0).toFixed(2), bit, plan, carried, effective, volume, blastArea: Math.round((holes || 0) * 45) };
}

export function parseTableRow(input, existingRows, week = WEEK) {
  const normalized = normalizeLine(typeof input === 'string' ? input : input.line);
  const [patternMatch] = findPatternMatches(normalized);
  if (!patternMatch) return null;

  const pattern_id = patternMatch.pattern_id;
  const parts = patternParts(pattern_id);
  if (!parts) return null;

  const afterPattern = normalized.slice(patternMatch.index + patternMatch.raw.length);
  const beforePattern = normalized.slice(0, patternMatch.index);
  const priority = parsePriority(beforePattern, parts.pit_name, existingRows);
  const { holes, bit, plan, carried, effective, volume, blastArea } = numericColumns(afterPattern, parts);

  return {
    pattern_id,
    week_id: week.week_id,
    pit_name: parts.pit_name,
    pit_priority: priority,
    pattern_type: parts.pattern_type,
    rl_level: parts.rl_level,
    bench_height_m: parts.bench_height_m,
    hole_diameter_mm: 115, // Bit dia is not imported — default per plan spec
    num_holes: holes,
    plan_total_drilling_m: +plan.toFixed(1),
    carried_drilling_m: +carried.toFixed(1),
    effective_m: +effective.toFixed(1),
    actual_drilling_m: 0,
    drilling_pct: 0,
    planned_blast_date: null,
    plan_blast_vol_bcm: Math.round(volume),
    actual_blast_vol_bcm: 0,
    blast_td_updated: false,
    status: 'pending',
    risk: 'on-track',
    blast_area_m2: Math.round(blastArea),
  };
}

function parsePriority(beforePattern, pitName, existingRows) {
  const values = (beforePattern.match(NUM_RE) || []).map((value) => toNumber(value));
  const candidate = values.length ? values[values.length - 1] : null;
  if (Number.isInteger(candidate) && candidate >= 0 && candidate <= 999) return candidate;
  return nextPitPriority(pitName, existingRows);
}

function parseQuality(row) {
  // Higher score = more complete parse. Used to resolve split-row candidates where
  // pdfjs emits partial text groups before the full merged group.
  return (row.plan_total_drilling_m > 20 ? 8 : 0)
    + (row.num_holes > 0 ? 4 : 0)
    + (row.plan_blast_vol_bcm > 0 ? 2 : 0)
    + (row.hole_diameter_mm !== 115 ? 1 : 0);
}

// ── blast-date schedule helpers ───────────────────────────────────────────────

const MONTH_NAMES = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

function parseDayDate(value, year) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number' && Number.isFinite(value) && value > 40000 && value < 60000) {
    const utcDays = Math.floor(value - 25569);
    const date = new Date(utcDays * 86400 * 1000);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
  const text = String(value || '').trim();
  if (!text) return null;
  // "Sat, 9 May" / "Sun, 10 May 2026" / "9 May" / "9 May 2026"
  const m = text.match(/^(?:[A-Za-z]{2,3}\.?,?\s+)?([0-9]{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep(?:t)?|Oct|Nov|Dec)[a-z]*(?:\s+([0-9]{4}))?$/i);
  if (m) {
    const day = +m[1];
    const month = MONTH_NAMES.indexOf(m[2].toLowerCase().slice(0, 3));
    const y = m[3] ? +m[3] : year;
    if (month >= 0 && day >= 1 && day <= 31) return new Date(y, month, day);
  }
  // ISO: "2026-05-09"
  const iso = text.match(/^(20[0-9]{2})[-/.]([01]?[0-9])[-/.]([0-3]?[0-9])$/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  return null;
}

function scheduleYear(week) {
  const d = week?.week_start ? new Date(week.week_start) : null;
  return (d && !isNaN(d.getTime())) ? d.getFullYear() : new Date().getFullYear();
}

function findScheduleCols(sheetRows, year) {
  let best = [];
  for (const row of sheetRows) {
    const cols = [];
    for (let i = 0; i < row.length; i++) {
      const d = parseDayDate(row[i], year);
      if (d) cols.push({ colIndex: i, date: d });
    }
    if (cols.length > best.length) best = cols;
  }
  if (best.length >= 2) {
    console.log('[blast-date] schedule cols found:', best.length,
      best.slice(0, 4).map(c => `col${c.colIndex}=${c.date.toISOString().slice(0,10)}`).join(', '));
  }
  return best.length >= 2 ? best : [];
}

// Returns { byId: Map<pattern_id, date>, byOrder: Date[] }
// byOrder = blast dates in row order for fallback matching when pattern IDs are absent
function parseScheduleTable(sheetRows, year) {
  const byId = new Map();
  const byOrder = [];
  const scheduleCols = findScheduleCols(sheetRows, year);
  if (!scheduleCols.length) return { byId, byOrder };
  const dateColSet = new Set(scheduleCols.map((s) => s.colIndex));
  for (const row of sheetRows) {
    let blastDate = null;
    for (const { colIndex, date } of scheduleCols) {
      if (/^blast(ing)?$/i.test(String(row[colIndex] || '').trim())) { blastDate = date; break; }
    }
    if (!blastDate) continue;
    let patternId = null;
    for (let i = 0; i < row.length; i++) {
      if (dateColSet.has(i)) continue;
      const [match] = findPatternMatches(normalizeLine(String(row[i] || '')));
      if (match && PATTERN_RE.test(match.pattern_id)) { patternId = match.pattern_id; break; }
    }
    if (patternId) {
      byId.set(patternId, blastDate);
    } else {
      // Log non-date cell values for debugging
      const nonDateVals = row.filter((_, i) => !dateColSet.has(i)).map(v => String(v ?? '').trim()).filter(Boolean);
      console.log('[blast-date] blasting row (no pattern ID) cells:', nonDateVals.slice(0, 6).join(' | '), '→', blastDate.toISOString().slice(0, 10));
      byOrder.push(blastDate);
    }
  }
  console.log('[blast-date] byId:', byId.size, 'byOrder:', byOrder.length);
  return { byId, byOrder };
}

// Returns { byId: Map<pattern_id, date>, byOrder: Date[] }
function extractPdfBlastDates(rows, year) {
  const byId = new Map();
  const byOrder = [];
  let headerY = null;
  let dateCols = [];
  for (const row of rows) {
    const found = [];
    for (const item of row.items) {
      const d = parseDayDate(item.value, year);
      if (d) found.push({ x: item.x, date: d });
    }
    if (found.length >= 2) {
      headerY = row.y;
      dateCols = found.sort((a, b) => a.x - b.x);
      console.log('[blast-date] PDF date header found:', dateCols.length, 'cols', dateCols.slice(0,3).map(c => c.date.toISOString().slice(0,10)).join(', '));
      break;
    }
  }
  if (!dateCols.length) return { byId, byOrder };
  const colXs = dateCols.map((c) => c.x);
  const bounds = colXs.slice(0, -1).map((x, i) => (x + colXs[i + 1]) / 2);
  function classifyX(x) {
    for (let i = 0; i < bounds.length; i++) { if (x < bounds[i]) return i; }
    return colXs.length - 1;
  }
  for (const row of rows) {
    if (row.y >= headerY) continue;
    const blastItem = row.items.find(item =>
      /^blast(ing)?$/i.test(item.value.trim()) &&
      item.x >= colXs[0] - 20 && item.x <= colXs[colXs.length - 1] + 20
    );
    if (!blastItem) continue;
    const blastDate = dateCols[classifyX(blastItem.x)].date;
    const [patternMatch] = findPatternMatches(row.line);
    if (patternMatch) {
      byId.set(patternMatch.pattern_id, blastDate);
    } else {
      console.log('[blast-date] PDF blasting row (no pattern ID):', row.line.slice(0, 60), '→', blastDate.toISOString().slice(0,10));
      byOrder.push(blastDate);
    }
  }
  return { byId, byOrder };
}

export async function extractPlanRowsFromPdf(file, existingRows, week = WEEK) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const year = scheduleYear(week);

  // Phase 1 — load all pages, extract patterns from Thai Drill pages
  const rowQualityMap = new Map();
  let textLines = 0;
  let skippedPages = 0;
  const foundPatternIds = new Set();
  const allPageLines = [];

  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const textContent = await page.getTextContent();
    const lines = rowObjects(textContent);
    allPageLines.push(lines);

    const pageHeader = lines.slice(0, 6).map((l) => l.line).join(' ');
    if (!isThaiDrillSection(pageHeader)) {
      console.log('[import] skip page', pageNo, '— not Thai drill:', pageHeader.slice(0, 80));
      skippedPages += 1;
      continue;
    }

    const candidates = rowCandidates(lines);
    textLines += lines.length;
    for (const candidate of candidates) {
      for (const match of findPatternMatches(candidate)) {
        foundPatternIds.add(match.pattern_id);
      }
    }
    for (const candidate of candidates) {
      const currentRows = [...rowQualityMap.values()].map((e) => e.row);
      const row = parseTableRow(candidate, [...existingRows, ...currentRows], week);
      if (!row) continue;
      const q = parseQuality(row);
      const existing = rowQualityMap.get(row.pattern_id);
      if (!existing) {
        rowQualityMap.set(row.pattern_id, { row, quality: q, index: rowQualityMap.size });
      } else if (q > existing.quality) {
        console.log('[parse] better candidate for', row.pattern_id, 'quality', existing.quality, '→', q);
        rowQualityMap.set(row.pattern_id, { row, quality: q, index: existing.index });
      }
    }
  }

  const rows = [...rowQualityMap.values()].sort((a, b) => a.index - b.index).map((e) => e.row);

  // Phase 2 — extract blast dates from all pages; apply ID match, then row-order fallback
  const blastDates = new Map();
  let orderDates = [];
  for (const lines of allPageLines) {
    const { byId, byOrder } = extractPdfBlastDates(lines, year);
    byId.forEach((date, id) => blastDates.set(id, date));
    if (byOrder.length > 0 && byId.size === 0 && byOrder.length > orderDates.length) {
      orderDates = byOrder;
    }
  }
  if (blastDates.size === 0 && orderDates.length > 0) {
    console.log('[blast-date] PDF row-order fallback:', orderDates.length, 'dates →', rows.length, 'patterns');
    rows.forEach((row, i) => {
      if (i < orderDates.length) blastDates.set(row.pattern_id, orderDates[i]);
    });
  }
  for (const row of rows) {
    const d = blastDates.get(row.pattern_id);
    if (d) row.planned_blast_date = d;
  }
  console.log('[blast-date] PDF applied', rows.filter(r => r.planned_blast_date).length, '/', rows.length, 'blast dates');

  const parsedIds = new Set(rows.map((r) => r.pattern_id));
  return {
    rows,
    pages: pdf.numPages,
    skippedPages,
    textLines,
    foundPatternCount: foundPatternIds.size,
    unparsedPatternIds: [...foundPatternIds].filter((id) => !parsedIds.has(id)).sort(),
  };
}

const HEADER_ALIASES = {
  pattern_id: [
    'pattern id', 'pattern', 'blast pattern', 'pattern_id',
    'pattern no', 'pattern name', 'blast id', 'drill pattern', 'pattern code', 'id',
  ],
  pit_priority: [
    '#', 'priority', 'pit priority', 'seq', 'no',
    'no.', 'sequence', 'order', 'pit no', 'row no', 'item no', 'item',
  ],
  pattern_type: [
    'type', 'pattern type', 'blast type', 'drill type', 'method',
  ],
  rl_level: [
    'rl', 'rl level', 'level', 'rl (m)', 'elevation', 'elev',
    'bench level', 'rl m', 'rl(m)',
  ],
  bench_height_m: [
    'bench', 'bench height', 'bench height m', 'bench (m)',
    'bench ht', 'bench ht m', 'bh', 'bh m', 'bench(m)',
  ],
  num_holes: [
    'holes', 'no holes', 'num holes', 'number of holes',
    'no of holes', 'no. of holes', 'no. holes', 'total holes',
    'hole count', 'holes planned', '# holes', 'no hole', 'no.holes',
  ],
  hole_diameter_mm: [
    'bit dia', 'bit diameter', 'hole diameter', 'hole diameter mm', 'dia',
    'bit size', 'drill bit', 'hole dia', 'bit', 'diameter mm',
    'hole dia mm', 'drill dia', 'dia (mm)', 'dia(mm)',
  ],
  plan_total_drilling_m: [
    'plan m', 'plan', 'plan total drilling m', 'total drilling',
    'plan total m', 'total m', 'plan (m)', 'total plan m',
    'planned m', 'plan drill m', 'plan metres', 'plan meters',
    'plan total', 'total plan', 'plan(m)', 'total (m)',
  ],
  carried_drilling_m: [
    'carried', 'carried m', 'carried drilling m',
    'b/f', 'b/f m', 'brought forward', 'carry m', 'carry',
    'carried over', 'carryover m', 'bf m', 'prev m', 'c/f',
  ],
  effective_m: [
    'remain', 'remaining', 'effective', 'effective m',
    'remain m', 'remaining m', 'balance m', 'net m',
    'balance', 'net', 'to drill', 'to drill m', 'eff m', 'eff(m)',
  ],
  plan_blast_vol_bcm: [
    'vol bcm', 'volume', 'blast volume', 'blast volumes', 'plan blast vol bcm',
    'bcm', 'vol', 'blast vol', 'volume bcm', 'bcm vol',
    'plan vol', 'plan bcm', 'target bcm', 'design bcm', 'vol (bcm)', 'vol(bcm)',
  ],
  blast_area_m2: [
    'blast area', 'blast areas', 'area', 'blast area m2', 'blast areas m2',
    'area m2', 'blast footprint', 'pattern area',
  ],
  planned_blast_date: [
    'blast date', 'planned blast date', 'date',
    'target date', 'fire date', 'b/d', 'blast day',
    'target blast date', 'planned date', 'fire day',
  ],
};

function compactHeader(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .replace(/[_()[\]/.:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function excelDateToDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const utcDays = Math.floor(value - 25569);
    const utcValue = utcDays * 86400;
    const date = new Date(utcValue * 1000);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  const text = String(value || '').trim();
  const iso = text.match(/\b(20[0-9]{2})[-/.]([01]?[0-9])[-/.]([0-3]?[0-9])\b/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);

  const dmy = text.match(/\b([0-3]?[0-9])[-/.]([01]?[0-9])[-/.](20[0-9]{2})\b/);
  if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? addDays(TODAY, 5) : parsed;
}

function patternPartsExcel(patternId) {
  const match = String(patternId || '').trim().toUpperCase().match(/^([A-Z]+[0-9]+[A-Z]*)_([0-9]+)RL_([0-9]+(?:\.[0-9]+)?)M_[0-9]+_([A-Z0-9]+(?:_[A-Z0-9]+)*)$/);
  if (!match) return null;
  return {
    pit_name: match[1],
    rl_level: +match[2],
    bench_height_m: +match[3],
    pattern_type: match[4],
  };
}

function nextPitPriorityExcel(pitName, existingRows) {
  const existing = existingRows.filter((p) => p.pit_name === pitName);
  if (!existing.length) return 1;
  return Math.max(...existing.map((p) => Number(p.pit_priority || 0))) + 1;
}

function headerMap(row) {
  const normalized = row.map(compactHeader);
  const map = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const index = normalized.findIndex((header) => aliases.includes(header));
    if (index >= 0) map[field] = index;
  }
  return map;
}

function lxmlHeaderMap(row) {
  const normalized = row.map(compactHeader);
  const indexOf = (...aliases) => normalized.findIndex((header) => aliases.includes(header));
  const map = {};
  const priority = indexOf('priority', 'no', 'no.');
  const blastArea = indexOf('blast areas', 'blast area');
  const bit = indexOf('hole diameter', 'bit dia', 'bit diameter');
  const plan = indexOf('total drilling');
  const holes = indexOf('number of holes');
  const volume = indexOf('blast volumes', 'blast volume');

  if (priority >= 0) map.pit_priority = priority;
  if (blastArea >= 0) map.blast_area_m2 = blastArea;
  if (bit >= 0) map.hole_diameter_mm = bit;
  if (plan >= 0) map.plan_total_drilling_m = plan;
  if (holes >= 0) map.num_holes = holes;
  if (volume >= 0) map.plan_blast_vol_bcm = volume;

  const score = [blastArea, bit, plan, holes, volume].filter((index) => index >= 0).length;
  return score >= 4 ? map : null;
}

function canonicalPatternIdFromCell(value) {
  const text = normalizeLine(value);
  const [match] = findPatternMatches(text);
  return match?.pattern_id || compactToken(value);
}

function findHeaderRow(rows) {
  let best = { index: -1, map: {}, score: 0 };
  rows.forEach((row, index) => {
    const lxmlMap = lxmlHeaderMap(row);
    const map = lxmlMap || headerMap(row);
    const score = Object.keys(map).length + (map.pattern_id !== undefined ? 4 : 0) + (lxmlMap ? 6 : 0);
    if (score > best.score) best = { index, map, score };
  });

  // Auto-detect pattern_id column when header label is a pit name (e.g. LXML uses "KHN03G")
  if (best.index >= 0 && best.map.pattern_id === undefined) {
    const dataRows = rows.slice(best.index + 1, best.index + 8).filter((r) => r.some(Boolean));
    const colCount = rows[best.index]?.length ?? 0;
    for (let col = 0; col < colCount; col++) {
      const matchCount = dataRows.filter((row) =>
        PATTERN_RE.test(canonicalPatternIdFromCell(row[col])),
      ).length;
      if (matchCount >= 1) {
        best.map.pattern_id = col;
        best.score += 4;
        console.log('[import] auto-detected pattern_id at column', col);
        break;
      }
    }
  }

  const found = best.score >= 3 && best.map.pattern_id !== undefined ? best : null;
  if (found) {
    const headerRow = rows[found.index] ?? [];
    const fieldColNames = Object.entries(found.map)
      .map(([f, c]) => `${f}=col${c}(${String(headerRow[c] || '').trim().slice(0, 20)})`)
      .join(', ');
    console.log('[import] header row', found.index, '| score:', found.score, '\n  mapped:', fieldColNames);
  } else {
    const sample = rows[0]?.map((c, i) => `[${i}] ${compactHeader(c)}`) ?? [];
    console.warn('[import] no structured header (score=' + best.score + '). Compact headers:\n ', sample.join(', '), '\n  — falling back to text parsing');
  }
  return found;
}

function cell(row, map, field) {
  const index = map[field];
  return index === undefined ? '' : row[index];
}

let _buildLog = true;
function buildStructuredRow(row, map, existingRows, week) {
  const pattern_id = canonicalPatternIdFromCell(cell(row, map, 'pattern_id'));
  if (!PATTERN_RE.test(pattern_id)) return null;

  const parts = patternPartsExcel(pattern_id);
  if (!parts) return null;

  // Blast date is set from the Blast page only, not imported
  const plan = toNumber(cell(row, map, 'plan_total_drilling_m'), 0);

  if (_buildLog) {
    _buildLog = false;
    console.log('[import] first structured row:', pattern_id,
      '\n  plan_total_drilling_m: col', map.plan_total_drilling_m, '=', cell(row, map, 'plan_total_drilling_m'),
      '\n  num_holes: col', map.num_holes, '=', cell(row, map, 'num_holes'),
      '\n  plan_blast_vol_bcm: col', map.plan_blast_vol_bcm, '=', cell(row, map, 'plan_blast_vol_bcm'),
      '\n  hole_diameter_mm: col', map.hole_diameter_mm, '=', cell(row, map, 'hole_diameter_mm'),
    );
  }
  const carried = toNumber(cell(row, map, 'carried_drilling_m'), 0);
  const effective = toNumber(cell(row, map, 'effective_m'), Math.max(0, plan - carried));
  // Number of Holes is a computed LXML value that carries decimals — keep 2dp, don't round to int
  const holes = +toNumber(cell(row, map, 'num_holes'), 0).toFixed(2);
  const volume = toNumber(cell(row, map, 'plan_blast_vol_bcm'), Math.round(holes * parts.bench_height_m * 45));
  const priority = toNumber(cell(row, map, 'pit_priority'), nextPitPriorityExcel(parts.pit_name, existingRows));
  const blastArea = map.blast_area_m2 !== undefined
    ? toNumber(cell(row, map, 'blast_area_m2'), Math.round(holes * 45))
    : Math.round(holes * 45);

  return {
    pattern_id,
    week_id: week.week_id,
    pit_name: parts.pit_name,
    pit_priority: priority,
    pattern_type: String(cell(row, map, 'pattern_type') || parts.pattern_type).trim().toUpperCase().replace(/\s+/g, '_'),
    rl_level: toNumber(cell(row, map, 'rl_level'), parts.rl_level),
    bench_height_m: toNumber(cell(row, map, 'bench_height_m'), parts.bench_height_m),
    hole_diameter_mm: 115, // Bit dia is not imported — default per plan spec
    num_holes: holes,
    plan_total_drilling_m: +plan.toFixed(1),
    carried_drilling_m: +carried.toFixed(1),
    effective_m: +effective.toFixed(1),
    actual_drilling_m: 0,
    drilling_pct: 0,
    planned_blast_date: null,
    plan_blast_vol_bcm: Math.round(volume),
    actual_blast_vol_bcm: 0,
    blast_td_updated: false,
    status: 'pending',
    risk: 'on-track',
    blast_area_m2: Math.round(blastArea),
  };
}

function rowLine(row) {
  return row.map((value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value)).join(' ');
}

function sheetToRowsSkipHidden(sheet) {
  if (!sheet['!ref']) return [];
  const range = XLSX.utils.decode_range(sheet['!ref']);
  const rowDefs = sheet['!rows'] || [];
  const colDefs = sheet['!cols'] || [];
  const result = [];

  // Build list of visible column indices only
  const visibleCols = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    if (!colDefs[c]?.hidden) visibleCols.push(c);
  }

  for (let r = range.s.r; r <= range.e.r; r++) {
    if (rowDefs[r]?.hidden) continue;
    const row = [];
    for (const c of visibleCols) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (!cell) { row.push(''); continue; }
      row.push(cell.t === 'd' ? cell.v : (cell.v ?? ''));
    }
    result.push(row);
  }

  return result.filter((row) => row.some((v) => String(v || '').trim()));
}

export async function extractPlanRowsFromExcel(file, existingRows, week = WEEK) {
  _buildLog = true;
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { cellDates: true });
  const rows = [];
  const seen = new Set();
  let sheetCount = 0;
  let skippedSheets = 0;
  let sourceRows = 0;
  const foundPatternIds = new Set();
  const year = scheduleYear(week);

  // Cache all sheet rows so we only decode each sheet once
  const allSheets = workbook.SheetNames.map((sheetName) => ({
    sheetName,
    sheetRows: sheetToRowsSkipHidden(workbook.Sheets[sheetName]),
  }));

  // Phase 1 — extract patterns from Thai Drill sheets
  for (const { sheetName, sheetRows } of allSheets) {
    if (!isThaiDrillSection(sheetName)) {
      console.log('[import] skip sheet', JSON.stringify(sheetName), '— not Thai drill');
      skippedSheets += 1;
      continue;
    }
    sheetCount += 1;
    sourceRows += sheetRows.length;
    const header = findHeaderRow(sheetRows);
    for (let index = 0; index < sheetRows.length; index += 1) {
      const source = sheetRows[index];
      const line = rowLine(source);
      const patternMatches = line.match(/[A-Z]+[0-9]+[A-Z]*_[0-9]+RL_[0-9]+(?:\.[0-9]+)?M_[0-9]+_[A-Z0-9]+(?:_[A-Z0-9]+)*/gi) || [];
      patternMatches.forEach((patternId) => foundPatternIds.add(patternId.toUpperCase()));
      let row;
      if (header) {
        if (index <= header.index) continue;
        row = buildStructuredRow(source, header.map, [...existingRows, ...rows], week);
      } else {
        row = parseTableRow(line, [...existingRows, ...rows], week);
      }
      if (!row || seen.has(row.pattern_id)) continue;
      seen.add(row.pattern_id);
      rows.push(row);
    }
  }

  // Phase 2 — extract blast dates from ALL sheets, apply to rows
  const blastDates = new Map();
  let orderDates = []; // fallback: blast dates in row order (when pattern IDs absent)

  for (const { sheetRows } of allSheets) {
    const { byId, byOrder } = parseScheduleTable(sheetRows, year);
    byId.forEach((date, id) => blastDates.set(id, date));
    if (byOrder.length > 0 && byId.size === 0) {
      // Prefer the sheet that yielded the most order-based dates (likely the schedule sheet)
      if (byOrder.length > orderDates.length) orderDates = byOrder;
    }
  }

  // If ID-based matching found nothing, fall back to row-order matching
  if (blastDates.size === 0 && orderDates.length > 0) {
    console.log('[blast-date] using row-order fallback:', orderDates.length, 'dates →', rows.length, 'patterns');
    rows.forEach((row, i) => {
      if (i < orderDates.length) blastDates.set(row.pattern_id, orderDates[i]);
    });
  }

  for (const row of rows) {
    const d = blastDates.get(row.pattern_id);
    if (d) row.planned_blast_date = d;
  }
  console.log('[blast-date] applied', rows.filter(r => r.planned_blast_date).length, '/', rows.length, 'blast dates');

  const parsedIds = new Set(rows.map((r) => r.pattern_id));
  return {
    rows,
    sheets: sheetCount,
    skippedSheets,
    sourceRows,
    foundPatternCount: foundPatternIds.size,
    unparsedPatternIds: [...foundPatternIds].filter((id) => !parsedIds.has(id)).sort(),
  };
}
