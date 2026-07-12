/* Mock data — single seed so the prototype is deterministic.
   Mirrors the schema in 2026-05-12-database-schema.sql. */

const RIGS = [
  { rig_id: 'HE-001', contractor: 'Thaidrill' },
  { rig_id: 'HE-002', contractor: 'Thaidrill' },
  { rig_id: 'HE-003', contractor: 'Thaidrill' },
  { rig_id: 'HE-004', contractor: 'Thaidrill' },
  { rig_id: 'HE-005', contractor: 'Thaidrill' },
  { rig_id: 'HE-006', contractor: 'Thaidrill' },
  { rig_id: 'HE-007', contractor: 'Thaidrill' },
  { rig_id: 'HE-008', contractor: 'Thaidrill' },
  { rig_id: 'HE-009', contractor: 'Thaidrill' },
  { rig_id: 'H-108',  contractor: '' },
  { rig_id: 'H-112',  contractor: '' },
  { rig_id: 'H-116',  contractor: '' },
  { rig_id: 'H-117',  contractor: '' },
  { rig_id: 'H-118',  contractor: '' },
  { rig_id: 'H-119',  contractor: '' },
  { rig_id: 'H-120',  contractor: '' },
  { rig_id: 'SL-01',  contractor: '' },
  { rig_id: 'SL-02',  contractor: '' },
  { rig_id: 'SL-03',  contractor: '' },
  { rig_id: 'SL-04',  contractor: '' },
  { rig_id: 'SL-05',  contractor: '' },
  { rig_id: 'SL-06',  contractor: '' },
  { rig_id: 'SL-07',  contractor: '' },
  { rig_id: 'SL-08',  contractor: '' },
  { rig_id: 'SL-09',  contractor: '' },
  { rig_id: 'SL-10',  contractor: '' },
  { rig_id: 'SL-11',  contractor: '' },
  { rig_id: 'SL-12',  contractor: '' },
];

const PIT_NAMES = ['NLU01','NLU03A','NLU03B','NDA02','KTL05','KTL07','KCN12'];

const TODAY = new Date(2026, 3, 15); // 2026-04-15
const fmtDate = (d) => {
  if (!d) return '—';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime()) || dt.getFullYear() <= 1970) return '—';
  return `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()}`;
};
const fmtDateFull = fmtDate;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };

// Current active week — Sat 09 May → Fri 15 May 2026
const WEEK = {
  week_id: 16,
  week_start: new Date(2026,3,11),
  week_end:   new Date(2026,3,17),
  status: 'active',
  plan_source: 'LXML',
};
const WEEKS = [
  { week_id: 16, ...WEEK, week_start: WEEK.week_start, week_end: WEEK.week_end, status: 'active' },
];

// Deterministic PRNG
function mulberry32(seed){ return function(){ let t=seed+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; } }
const rand = mulberry32(42);
const ri = (a,b) => Math.floor(rand()*(b-a+1))+a;
const rf = (a,b) => +(rand()*(b-a)+a).toFixed(1);

const TYPES = ['TRI','PRO','PROTRI','RAMP','PRORAMP','FIXTOE'];
const BITS = [89, 102, 115, 127];

// Generate a realistic set of patterns
function genPatterns() {
  const out = [];
  const counts = { 'NLU01':4, 'NLU03A':5, 'NLU03B':3, 'NDA02':4, 'KTL05':3, 'KTL07':2, 'KCN12':3 };
  let idx = 0;
  for (const pit of PIT_NAMES) {
    const n = counts[pit];
    for (let p = 0; p < n; p++) {
      idx++;
      const rl = [170,180,190,200,210][ri(0,4)];
      const bench = [5, 7.5, 10][ri(0,2)];
      const seq = 100 + idx;
      const type = TYPES[ri(0, TYPES.length-1)];
      const isCarry = p === 0 && rand() < 0.35;
      const pid = `${pit}_${rl}RL_${bench}M_${seq}_${type}`;
      const num_holes = ri(40, 220);
      const hole_dia = BITS[ri(0,BITS.length-1)];
      const depth_each = bench + 1; // sub-drill ~1m
      const plan_total = +(num_holes * depth_each).toFixed(1);
      const carried = isCarry ? +(plan_total * rf(0.2, 0.55)).toFixed(1) : 0;
      const effective = +(plan_total - carried).toFixed(1);

      // blast date — spread across the week + a couple after
      const blastOffset = ri(-2, 6);
      const planned_blast_date = addDays(TODAY, blastOffset);

      // actual drilling — biased so we get a mix of statuses
      let pct;
      if (isCarry) pct = rf(0.55, 0.95);
      else if (blastOffset < 0) pct = rf(0.4, 1.0); // delayed-eligible
      else if (blastOffset <= 2) pct = rf(0.5, 0.95);
      else pct = rf(0.05, 0.7);
      const actual = +(effective * pct).toFixed(1);
      const drilling_pct = +((actual / effective) * 100).toFixed(1);

      // risk
      let risk = 'on-track';
      const daysToBlast = blastOffset;
      const drilledFull = actual >= effective - 0.1;
      if (daysToBlast < 0 && !drilledFull) risk = 'delayed';
      else if (daysToBlast <= 2) risk = 'at-risk';

      // status field
      let status = 'pending';
      if (drilledFull && daysToBlast < 0) status = 'complete';
      else if (actual > 0) status = 'drilling';
      if (status === 'complete' && rand() < 0.5) status = 'blasting';

      const plan_blast_vol_bcm = +(num_holes * bench * rf(35, 55)).toFixed(0);
      const actual_blast_vol_bcm = status === 'complete' || status === 'blasting'
        ? +(plan_blast_vol_bcm * rf(0.9, 1.05)).toFixed(2)
        : 0;

      out.push({
        pattern_id: pid,
        week_id: WEEK.week_id,
        pit_name: pit,
        pit_priority: isCarry ? 0 : p, // 0 = carryover
        pattern_type: type,
        rl_level: rl,
        bench_height_m: bench,
        hole_diameter_mm: hole_dia,
        num_holes,
        plan_total_drilling_m: plan_total,
        carried_drilling_m: carried,
        effective_m: effective,
        actual_drilling_m: actual,
        drilling_pct,
        planned_blast_date,
        plan_blast_vol_bcm,
        actual_blast_vol_bcm,
        blast_td_updated: false,
        status,
        risk,
        blast_area_m2: +(num_holes * rf(35, 55)).toFixed(0),
      });
    }
  }
  return out;
}

const PATTERNS = genPatterns();

// Generate drill_log entries (last 7 days)
function genDrillLog() {
  const out = [];
  // Choose a subset of rigs that are active this week
  const activeRigs = RIGS.slice(0, 18).map((r) => r.rig_id);
  const employees = ['B. Khampheng','S. Nouanthavong','V. Phimmasone','T. Bounkham','K. Sengphachanh','P. Vongsay','M. Inthavong','A. Sayasith','J. Latsavong','D. Phomma'];
  for (let d = 0; d < 7; d++) {
    const day = addDays(TODAY, -d);
    for (const rig of activeRigs) {
      for (const shift of ['day','night']) {
        if (rand() < 0.18) continue; // a few rigs idle
        // pick an in-progress pattern
        const candidate = PATTERNS.filter(p => p.actual_drilling_m < p.effective_m + 5);
        const pat = candidate[ri(0, candidate.length-1)];
        const m = +(rf(40, 180)).toFixed(1);
        const redrill = rand() < 0.3 ? +(m * rf(0.02, 0.08)).toFixed(1) : 0;
        const bit = pat.hole_diameter_mm;
        const smu_hr = +rf(7, 11.5).toFixed(1);
        const fuel_l = Math.round(smu_hr * rf(30, 50));
        out.push({
          pattern_id: pat.pattern_id,
          week_id: WEEK.week_id,
          rig_id: rig,
          work_date: day,
          shift,
          employee_name: employees[ri(0, employees.length-1)],
          drill_bit_size_mm: bit,
          total_drilling_m: m,
          redrill_m: redrill,
          smu_start: rf(2400, 8200),
          smu_hr,
          drifter_start: rf(900, 4200),
          drifter_hr: rf(4.5, 8.5),
          fuel_l,
        });
      }
    }
  }
  return out;
}
const DRILL_LOG = genDrillLog();

function seedAdjacentWeeks() {
  const sourcePatterns = PATTERNS.filter(p => p.week_id === WEEK.week_id);
  const sourceLogs = DRILL_LOG.filter(e => e.week_id === WEEK.week_id);
  for (const week of WEEKS.filter(w => w.week_id !== WEEK.week_id)) {
    const dayOffset = Math.round((week.week_start - WEEK.week_start) / 86400000);
    if (!PATTERNS.some(p => p.week_id === week.week_id)) {
      for (const p of sourcePatterns) {
        const copy = { ...p };
        copy.week_id = week.week_id;
        copy.pattern_id = p.pattern_id.replace(/_([0-9]+)_/, `_${week.week_id}$1_`);
        copy.planned_blast_date = addDays(p.planned_blast_date, dayOffset);
        if (week.status === 'draft') {
          copy.actual_drilling_m = 0;
          copy.drilling_pct = 0;
          copy.status = 'pending';
          copy.risk = 'on-track';
        }
        PATTERNS.push(copy);
      }
    }
    if (week.status !== 'draft' && !DRILL_LOG.some(e => e.week_id === week.week_id)) {
      for (const e of sourceLogs) {
        const copy = { ...e };
        copy.week_id = week.week_id;
        copy.pattern_id = e.pattern_id.replace(/_([0-9]+)_/, `_${week.week_id}$1_`);
        copy.work_date = addDays(e.work_date, dayOffset);
        DRILL_LOG.push(copy);
      }
    }
  }
}

seedAdjacentWeeks();

function asWeekId(weekId) {
  return Number(weekId);
}

function patternsFor(weekId = WEEK.week_id) {
  const id = asWeekId(weekId);
  return PATTERNS.filter((p) => asWeekId(p.week_id) === id);
}

function drillLogFor(weekId = WEEK.week_id) {
  const id = asWeekId(weekId);
  return DRILL_LOG.filter((e) => asWeekId(e.week_id) === id);
}

function drillEntryMetres(entry) {
  return Number(entry.total_drilling_m || 0) + Number(entry.redrill_m || 0);
}

function toDate(d) {
  if (d == null) return null;
  if (d instanceof Date) return d;
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function coerceEndDate(endDate) {
  if (endDate == null) return null;
  if (typeof endDate === 'number') return null;
  return toDate(endDate);
}

function drilledMetresForPattern(patternId, weekId, endDate = null) {
  const end = coerceEndDate(endDate);
  return +DRILL_LOG
    .filter((e) => asWeekId(e.week_id) === asWeekId(weekId) && e.pattern_id === patternId)
    .filter((e) => {
      if (!end) return true;
      const work = toDate(e.work_date);
      if (!work) return false;
      return work <= end || sameDay(work, end);
    })
    .reduce((sum, e) => sum + drillEntryMetres(e), 0)
    .toFixed(1);
}

function remainingMetresForPattern(pattern, endDate = null) {
  const drilled = drilledMetresForPattern(pattern.pattern_id, pattern.week_id, endDate);
  return +Math.max(0, Number(pattern.effective_m || 0) - drilled).toFixed(1);
}

function progressPctForPattern(pattern, endDate = null) {
  const plan = Number(pattern.plan_total_drilling_m || pattern.effective_m || 0);
  const carried = Number(pattern.carried_drilling_m || 0);
  const drilled = drilledMetresForPattern(pattern.pattern_id, pattern.week_id, endDate);
  return plan > 0 ? +(Math.min(100, ((carried + drilled) / plan) * 100)).toFixed(1) : 0;
}

function isDoneStatus(pattern) {
  const status = String(pattern.status || '').toLowerCase();
  return status === 'done' || status === 'complete' || status === 'blasting';
}

// Aggregations
function kpis(weekId = WEEK.week_id) {
  const patterns = patternsFor(weekId);
  const total = patterns.length;
  const delayed = patterns.filter(p => p.risk === 'delayed').length;
  const atRisk = patterns.filter(p => p.risk === 'at-risk').length;
  const onTrack = total - delayed - atRisk;
  const plan_m = patterns.reduce((s,p) => s + Number(p.plan_total_drilling_m || p.effective_m || 0), 0);
  const actual_m = patterns.reduce((s,p) => s + Number(p.carried_drilling_m || 0) + drilledMetresForPattern(p.pattern_id, weekId), 0);
  const progress_pct = plan_m > 0 ? (actual_m / plan_m) * 100 : 0;
  const week = WEEKS.find((w) => asWeekId(w.week_id) === asWeekId(weekId)) || WEEK;
  const blasts_done = patterns.filter(p => isDoneStatus(p)).length;
  const blasts_planned = patterns.filter(p => p.planned_blast_date <= week.week_end).length;
  const blast_vol = patterns
    .filter(p => isDoneStatus(p))
    .reduce((s,p) => s + Number(p.actual_blast_vol_bcm || 0), 0);
  const plan_vol = patterns.reduce((s,p) => s + p.plan_blast_vol_bcm, 0);
  return { total, delayed, atRisk, onTrack, plan_m, actual_m, progress_pct, blasts_done, blasts_planned, blast_vol, plan_vol };
}

function pitProgress(weekId = WEEK.week_id) {
  const groups = {};
  for (const p of patternsFor(weekId)) {
    if (!groups[p.pit_name]) groups[p.pit_name] = { pit: p.pit_name, plan_m:0, actual_m:0, complete_m:0, count:0, complete:0 };
    const g = groups[p.pit_name];
    const plan = Number(p.plan_total_drilling_m || p.effective_m || 0);
    const actual = Number(p.carried_drilling_m || 0) + drilledMetresForPattern(p.pattern_id, weekId);
    g.plan_m += plan;
    g.actual_m += actual;
    if (isDoneStatus(p)) g.complete_m += plan;
    g.count += 1;
    if (isDoneStatus(p)) g.complete += 1;
  }
  return Object.values(groups).sort((a,b) => b.plan_m - a.plan_m);
}

function bitSizeDistribution(weekId = WEEK.week_id) {
  const buckets = {};
  for (const e of drillLogFor(weekId)) {
    buckets[e.drill_bit_size_mm] = (buckets[e.drill_bit_size_mm] || 0) + Number(e.total_drilling_m || 0) + Number(e.redrill_m || 0);
  }
  return Object.entries(buckets).map(([k,v]) => ({ bit: +k, m: +v.toFixed(0) })).sort((a,b) => a.bit-b.bit);
}

function cumulativeProgress(weekId = WEEK.week_id) {
  const week = WEEKS.find((w) => asWeekId(w.week_id) === asWeekId(weekId)) || WEEK;
  const days = [];
  for (let i = 0; i < 7; i++) days.push(addDays(week.week_start, i));
  if (week.status === 'active' || week.status === 'draft') {
    for (let i = 1; i <= 5; i++) days.push(addDays(week.week_end, i));
  }
  const patterns = patternsFor(weekId);
  const log = drillLogFor(weekId);
  const plan_m_total = patterns.reduce((s,p) => s + Number(p.plan_total_drilling_m || p.effective_m || 0), 0);
  const carried_m_total = patterns.reduce((s,p) => s + Number(p.carried_drilling_m || 0), 0);
  const lastActualDate = log.length
    ? log.reduce((latest, entry) => (entry.work_date > latest ? entry.work_date : latest), log[0].work_date)
    : (carried_m_total > 0 ? week.week_start : null);
  const result = [];
  let cum = carried_m_total;
  // sum actuals up to each day
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    if (lastActualDate && day <= lastActualDate) {
      const daily = log.filter(e => sameDay(e.work_date, day)).reduce((s,e) => s + Number(e.total_drilling_m || 0) + Number(e.redrill_m || 0), 0);
      cum += daily;
    }
    const planCum = Math.min(plan_m_total, plan_m_total * (i+1) / days.length);
    result.push({
      date: day,
      actual: lastActualDate && day <= lastActualDate ? cum : null,
      plan: +planCum.toFixed(0),
    });
  }
  return result;
}
export function sameDay(a, b) {
  const da = toDate(a);
  const db = toDate(b);
  if (!da || !db) return false;
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function weekBounds(weekId = WEEK.week_id) {
  const id = asWeekId(weekId);
  const week = WEEKS.find((w) => asWeekId(w.week_id) === id) || WEEK;
  const start = week.week_start instanceof Date ? week.week_start : new Date(week.week_start);
  return { start, end: week.week_end instanceof Date ? week.week_end : new Date(week.week_end) };
}

function dailyShift(weekId = WEEK.week_id) {
  const { start } = weekBounds(weekId);
  const days = [];
  for (let i = 0; i < 7; i++) days.push(addDays(start, i));
  return days.map((d) => {
    const log = drillLogFor(weekId);
    const day = log.filter((e) => sameDay(e.work_date, d) && e.shift === 'day').reduce((s, e) => s + Number(e.total_drilling_m || 0) + Number(e.redrill_m || 0), 0);
    const night = log.filter((e) => sameDay(e.work_date, d) && e.shift === 'night').reduce((s, e) => s + Number(e.total_drilling_m || 0) + Number(e.redrill_m || 0), 0);
    return { date: d, day: +day.toFixed(0), night: +night.toFixed(0) };
  });
}

function dailyShiftNet(weekId = WEEK.week_id) {
  const { start } = weekBounds(weekId);
  const days = [];
  for (let i = 0; i < 7; i++) days.push(addDays(start, i));
  const log = drillLogFor(weekId);
  return days.map((d) => {
    const net = (shift) =>
      log
        .filter((e) => sameDay(e.work_date, d) && e.shift === shift)
        .reduce((s, e) => s + Number(e.total_drilling_m || 0) + Number(e.redrill_m || 0), 0);
    return { date: d, day: Math.round(net('day')), night: Math.round(net('night')) };
  });
}

function perRig(weekId = WEEK.week_id) {
  const groups = {};
  for (const e of drillLogFor(weekId)) {
    if (!groups[e.rig_id]) groups[e.rig_id] = { rig: e.rig_id, m: 0, smu: 0 };
    const g = groups[e.rig_id];
    g.m += Number(e.total_drilling_m || 0) + Number(e.redrill_m || 0);
    g.smu += e.smu_hr;
  }
  return Object.values(groups).map(g => ({ ...g, m: +g.m.toFixed(0), smu: +g.smu.toFixed(1) })).sort((a,b) => b.m - a.m);
}

function operatorMetres(weekId = WEEK.week_id) {
  const groups = {};
  for (const e of drillLogFor(weekId)) {
    if (!groups[e.employee_name]) groups[e.employee_name] = { name: e.employee_name, m: 0, shifts: 0, redrill: 0 };
    const g = groups[e.employee_name];
    g.m += Number(e.total_drilling_m || 0);
    g.redrill += e.redrill_m;
    g.shifts += 1;
  }
  return Object.values(groups)
    .map(g => ({ ...g, m: +g.m.toFixed(0), redrill: +g.redrill.toFixed(1), avg: +(g.m/g.shifts).toFixed(0) }))
    .sort((a,b) => b.m - a.m);
}

function remainingPatterns(weekId = WEEK.week_id) {
  return patternsFor(weekId)
    .filter(p => remainingMetresForPattern(p) > 0)
    .sort((a,b) => a.planned_blast_date - b.planned_blast_date);
}

function nextWeekFor(weekId) {
  const index = WEEKS.findIndex(w => w.week_id === weekId);
  return index >= 0 ? WEEKS[index + 1] : null;
}

function riskForPattern(plannedBlastDate, drillingPct) {
  const daysToBlast = Math.round((plannedBlastDate - TODAY) / 86400000);
  if (daysToBlast < 0 && drillingPct < 100) return 'delayed';
  if (daysToBlast <= 2) return 'at-risk';
  return 'on-track';
}

function carryOverIncompletePatterns(weekId) {
  const sourceWeek = WEEKS.find(w => w.week_id === weekId);
  const targetWeek = nextWeekFor(weekId);
  if (!sourceWeek || !targetWeek) {
    return { targetWeek: null, candidates: 0, added: 0, updated: 0, skipped: 0, rows: [] };
  }

  const dayOffset = Math.round((targetWeek.week_start - sourceWeek.week_start) / 86400000);
  const candidates = patternsFor(weekId).filter(p => remainingMetresForPattern(p) > 0);
  let added = 0;
  let updated = 0;
  let skipped = 0;
  const rows = [];

  for (const source of candidates) {
    const drilled = drilledMetresForPattern(source.pattern_id, weekId);
    const carried = +(Number(source.carried_drilling_m || 0) + drilled).toFixed(1);
    const remaining = remainingMetresForPattern(source);
    if (remaining <= 0) {
      skipped += 1;
      continue;
    }

    const planned_blast_date = addDays(source.planned_blast_date, dayOffset);
    const row = {
      ...source,
      week_id: targetWeek.week_id,
      pit_priority: 0,
      carried_drilling_m: carried,
      effective_m: remaining,
      actual_drilling_m: 0,
      drilling_pct: 0,
      planned_blast_date,
      actual_blast_vol_bcm: 0,
      blast_td_updated: false,
      status: 'pending',
      risk: riskForPattern(planned_blast_date, 0),
    };

    source.effective_m = 0;
    source.drilling_pct = 100;
    source.status = 'complete';
    source.risk = 'on-track';

    const existing = PATTERNS.find(p => p.week_id === targetWeek.week_id && p.pattern_id === source.pattern_id);
    if (existing) {
      Object.assign(existing, row);
      updated += 1;
      rows.push(existing);
    } else {
      PATTERNS.push(row);
      added += 1;
      rows.push(row);
    }
  }

  return { targetWeek, candidates: candidates.length, added, updated, skipped, rows };
}

function carryOverPatternToNextWeek(source, weekId) {
  const sourceWeek = WEEKS.find(w => w.week_id === weekId);
  const targetWeek = nextWeekFor(weekId);
  if (!source || !sourceWeek || !targetWeek) {
    return { targetWeek: null, row: null, added: false, updated: false, skipped: true };
  }

  const remaining = remainingMetresForPattern(source);
  if (remaining <= 0) {
    return { targetWeek, row: null, added: false, updated: false, skipped: true };
  }

  const drilled = drilledMetresForPattern(source.pattern_id, weekId);
  const carried = +(Number(source.carried_drilling_m || 0) + drilled).toFixed(1);
  const dayOffset = Math.round((targetWeek.week_start - sourceWeek.week_start) / 86400000);
  const planned_blast_date = addDays(source.planned_blast_date, dayOffset);
  const row = {
    ...source,
    week_id: targetWeek.week_id,
    pit_priority: 0,
    carried_drilling_m: carried,
    effective_m: remaining,
    actual_drilling_m: 0,
    drilling_pct: 0,
    planned_blast_date,
    actual_blast_vol_bcm: 0,
    blast_td_updated: false,
    status: 'pending',
    risk: riskForPattern(planned_blast_date, 0),
  };

  source.effective_m = 0;
  source.drilling_pct = 100;
  source.status = 'complete';
  source.risk = 'on-track';

  const existing = PATTERNS.find(p => p.week_id === targetWeek.week_id && p.pattern_id === source.pattern_id);
  if (existing) {
    Object.assign(existing, row);
    return { targetWeek, row: existing, added: false, updated: true, skipped: false };
  }

  PATTERNS.push(row);
  return { targetWeek, row, added: true, updated: false, skipped: false };
}

function highRiskByPit(weekId = WEEK.week_id) {
  const out = {};
  for (const p of patternsFor(weekId)) {
    if (p.risk === 'on-track') continue;
    if (!out[p.pit_name]) out[p.pit_name] = [];
    out[p.pit_name].push(p);
  }
  return Object.entries(out).map(([pit, list]) => ({ pit, list })).sort((a,b) => b.list.length - a.list.length);
}

function patternsByPit() {
  const out = {};
  for (const p of PATTERNS) {
    if (!out[p.pit_name]) out[p.pit_name] = [];
    out[p.pit_name].push(p);
  }
  for (const k of Object.keys(out)) {
    out[k].sort((a,b) => a.pit_priority - b.pit_priority);
  }
  return out;
}

function patternsByRisk() {
  const order = { 'delayed': 0, 'at-risk': 1, 'on-track': 2 };
  return [...PATTERNS].sort((a,b) => {
    if (order[a.risk] !== order[b.risk]) return order[a.risk] - order[b.risk];
    return a.planned_blast_date - b.planned_blast_date;
  });
}

// Day-relative descriptor
function relDay(d) {
  const diff = Math.round((d - TODAY) / 86400000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  if (diff > 0) return `in ${diff}d`;
  return `${-diff}d ago`;
}

const OPERATORS = [
  { operator_id: 'OP-001', name: 'B. Khampheng' },
  { operator_id: 'OP-002', name: 'S. Nouanthavong' },
  { operator_id: 'OP-003', name: 'V. Phimmasone' },
  { operator_id: 'OP-004', name: 'T. Bounkham' },
  { operator_id: 'OP-005', name: 'K. Sengphachanh' },
  { operator_id: 'OP-006', name: 'P. Vongsay' },
  { operator_id: 'OP-007', name: 'M. Inthavong' },
  { operator_id: 'OP-008', name: 'A. Sayasith' },
  { operator_id: 'OP-009', name: 'J. Latsavong' },
  { operator_id: 'OP-010', name: 'D. Phomma' },
];

export {
  OPERATORS,
  RIGS,
  PIT_NAMES,
  WEEK,
  WEEKS,
  TODAY,
  PATTERNS,
  DRILL_LOG,
  drillLogFor,
  fmtDate,
  fmtDateFull,
  addDays,
  relDay,
  kpis,
  pitProgress,
  bitSizeDistribution,
  cumulativeProgress,
  dailyShift,
  dailyShiftNet,
  weekBounds,
  perRig,
  operatorMetres,
  drilledMetresForPattern,
  remainingMetresForPattern,
  progressPctForPattern,
  remainingPatterns,
  carryOverIncompletePatterns,
  carryOverPatternToNextWeek,
  highRiskByPit,
  patternsByPit,
  patternsByRisk,
};
