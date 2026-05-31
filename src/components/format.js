import { h, defineComponent } from 'vue';

export function pct(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${Math.round(n)}%`;
}

export function fnum(n, digits = 0) {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const fmtDisplayDate = (d, fallback = '—') => {
  if (!d) return fallback;
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime()) || dt.getFullYear() <= 1970) return fallback;
  return `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()}`;
};

export const fmtDate = (d) => fmtDisplayDate(d);

export const relDay = (d) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dt = d instanceof Date ? new Date(d) : new Date(d); dt.setHours(0, 0, 0, 0);
  const diff = Math.round((dt - today) / 86400000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  return diff > 0 ? `in ${diff}d` : `${-diff}d ago`;
};

function svgIcon(children, className = '') {
  return h(
    'svg',
    {
      class: ['ic', className].filter(Boolean),
      width: 14,
      height: 14,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.6,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    },
    children,
  );
}

function def(name, children) {
  return defineComponent({
    name,
    setup() {
      return () => svgIcon(children);
    },
  });
}

export const I = {
  chev: def('IconChev', [h('polyline', { points: '6 9 12 15 18 9' })]),
  chevR: def('IconChevR', [h('polyline', { points: '9 6 15 12 9 18' })]),
  chevL: def('IconChevL', [h('polyline', { points: '15 6 9 12 15 18' })]),
  plus: def('IconPlus', [
    h('line', { x1: 12, y1: 5, x2: 12, y2: 19 }),
    h('line', { x1: 5, y1: 12, x2: 19, y2: 12 }),
  ]),
  check: def('IconCheck', [h('polyline', { points: '20 6 9 17 4 12' })]),
  x: def('IconX', [
    h('line', { x1: 18, y1: 6, x2: 6, y2: 18 }),
    h('line', { x1: 6, y1: 6, x2: 18, y2: 18 }),
  ]),
  search: def('IconSearch', [
    h('circle', { cx: 11, cy: 11, r: 7 }),
    h('line', { x1: 20, y1: 20, x2: 16.65, y2: 16.65 }),
  ]),
  alert: def('IconAlert', [
    h('path', {
      d: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    }),
    h('line', { x1: 12, y1: 9, x2: 12, y2: 13 }),
    h('line', { x1: 12, y1: 17, x2: 12.01, y2: 17 }),
  ]),
  filter: def('IconFilter', [h('polygon', { points: '22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3' })]),
  save: def('IconSave', [
    h('path', { d: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z' }),
    h('polyline', { points: '17 21 17 13 7 13 7 21' }),
    h('polyline', { points: '7 3 7 8 15 8' }),
  ]),
  download: def('IconDownload', [
    h('path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }),
    h('polyline', { points: '7 10 12 15 17 10' }),
    h('line', { x1: 12, y1: 15, x2: 12, y2: 3 }),
  ]),
  edit: def('IconEdit', [
    h('path', { d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' }),
    h('path', { d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' }),
  ]),
  more: def('IconMore', [
    h('circle', { cx: 12, cy: 12, r: 1 }),
    h('circle', { cx: 19, cy: 12, r: 1 }),
    h('circle', { cx: 5, cy: 12, r: 1 }),
  ]),
  upload: def('IconUpload', [
    h('path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }),
    h('polyline', { points: '17 8 12 3 7 8' }),
    h('line', { x1: 12, y1: 3, x2: 12, y2: 15 }),
  ]),
  eye: def('IconEye', [
    h('path', { d: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z' }),
    h('circle', { cx: 12, cy: 12, r: 3 }),
  ]),
  eyeOff: def('IconEyeOff', [
    h('path', { d: 'M9.88 9.88a3 3 0 1 0 4.24 4.24' }),
    h('path', { d: 'M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68' }),
    h('path', { d: 'M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61' }),
    h('line', { x1: 2, y1: 2, x2: 22, y2: 22 }),
  ]),
  target: def('IconTarget', [
    h('circle', { cx: 12, cy: 12, r: 10 }),
    h('circle', { cx: 12, cy: 12, r: 6 }),
    h('circle', { cx: 12, cy: 12, r: 2 }),
  ]),
};
