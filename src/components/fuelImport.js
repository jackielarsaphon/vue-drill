import * as XLSX from 'xlsx';

const HEADER_ALIASES = {
  rig_id: [
    'rig', 'rig id', 'rig_id', 'rig no', 'rig no.',
    'machine', 'equipment', 'drill rig', 'rig name', 'unit', 'rig number', 'drill',
  ],
  work_date: ['date', 'work date', 'work_date', 'shift date', 'day', 'work day'],
  shift: ['shift', 'shift type', 'shift name'],
  fuel_litres: [
    'liter', 'litre', 'litres', 'liters',
    'fuel', 'fuel l', 'fuel litres', 'fuel_litres', 'ltr',
    'fuel ltr', 'fuel amount', 'refuel litres', 'fuel qty', 'fuel liter', 'fuel litre',
  ],
  refuel_meter: [
    'refuel meter', 'refuel_meter', 'meter', 'meter reading',
    'odometer', 'counter', 'hour meter', 'smu', 'eng hrs', 'eng hours',
    'engine hours', 'machine hours', 'machine hrs', 'hours',
  ],
};

function compactHeader(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/[_/.:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MONTH_MAP = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function toIsoDate(value) {
  if (!value && value !== 0) return null;
  // Excel serial date (e.g. 46280)
  if (typeof value === 'number' && value > 40000 && value < 60000) {
    const d = new Date(Math.round((value - 25569) * 86400 * 1000));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  // JavaScript Date object (xlsx cellDates: true)
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  const text = String(value).trim();
  if (!text) return null;
  // ISO: YYYY-MM-DD or YYYY/MM/DD
  const iso = text.match(/^(20\d{2})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  // DMY numeric: DD/MM/YYYY or DD-MM-YYYY
  const dmy = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](20\d{2})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  // DD-MMM-YYYY e.g. "21-Mar-2026" or "21/Mar/2026"
  const dmmy = text.match(/^(\d{1,2})[-/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-/](20\d{2})$/i);
  if (dmmy) {
    const mm = MONTH_MAP[dmmy[2].toLowerCase().slice(0, 3)];
    return `${dmmy[3]}-${mm}-${dmmy[1].padStart(2, '0')}`;
  }
  return null;
}

function toShift(value) {
  const t = String(value || '').trim().toLowerCase();
  // numeric: 2 = night, 1 = day
  if (t === '2' || t.startsWith('n') || t === 'pm') return 'night';
  return 'day';
}

function toNum(value) {
  const n = Number(String(value || '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function findHeaderRow(rows) {
  let best = { index: -1, map: {}, score: 0 };
  rows.forEach((row, index) => {
    const normalized = row.map(compactHeader);
    const map = {};
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      const i = normalized.findIndex(h => aliases.includes(h));
      if (i >= 0) map[field] = i;
    }
    const score = Object.keys(map).length
      + (map.rig_id !== undefined ? 3 : 0)
      + (map.work_date !== undefined ? 2 : 0)
      + (map.fuel_litres !== undefined ? 2 : 0);
    if (score > best.score) best = { index, map, score };
  });
  return best.score >= 4 ? best : null;
}

function sheetToRows(sheet) {
  if (!sheet['!ref']) return [];
  const range = XLSX.utils.decode_range(sheet['!ref']);
  const rows = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      row.push(cell ? (cell.t === 'd' ? cell.v : (cell.v ?? '')) : '');
    }
    if (row.some(v => String(v || '').trim())) rows.push(row);
  }
  return rows;
}

export async function parseFuelExcel(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { cellDates: true });
  const entries = [];
  let skipped = 0;
  let sheetsProcessed = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = sheetToRows(sheet);
    if (!rows.length) continue;

    const header = findHeaderRow(rows);
    if (
      !header ||
      header.map.rig_id === undefined ||
      header.map.work_date === undefined ||
      header.map.fuel_litres === undefined
    ) continue;

    sheetsProcessed++;

    for (let i = header.index + 1; i < rows.length; i++) {
      const row = rows[i];
      const get = (field) => header.map[field] !== undefined ? row[header.map[field]] : '';
      const rig_id = String(get('rig_id') || '').trim();
      const work_date = toIsoDate(get('work_date'));
      const fuel_litres = toNum(get('fuel_litres'));

      if (!rig_id || !work_date || fuel_litres <= 0) {
        if (rig_id || work_date) skipped++;
        continue;
      }

      entries.push({
        rig_id,
        work_date,
        shift: header.map.shift !== undefined ? toShift(get('shift')) : 'day',
        fuel_litres,
        refuel_meter: header.map.refuel_meter !== undefined ? toNum(get('refuel_meter')) : 0,
      });
    }
  }

  return { entries, skipped, sheetsProcessed };
}
