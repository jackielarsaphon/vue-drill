// OCR fallback for plan pages whose table is a picture rather than text (e.g. the
// "(TD - VDC)" page of the LXML Week 44 plan). tesseract.js is loaded only when a
// page needs it; its worker, engine and English data come from the jsDelivr CDN.
//
// A page is rendered once and read twice — as rendered, and in grey with the red
// BLASTING cells inverted — because each reading drops a few different rows; the
// importer keeps the most complete parse of every pattern. BLASTING is taken from
// the red cell colour, which is far more reliable than OCR of white-on-red text.

const OCR_SCALE = 4; // a 720 pt slide → ~2900 px wide: the table's small digits stay legible

const isRed = (r, g, b) => r > 150 && g < 110 && b < 110;

function defaultCreateCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function levenshtein(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const up = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length];
}

// Undo the usual OCR slips in a pattern-ID word, e.g. "DSWO04B_170RL_SM_103_PRO"
// → "DSW04B_170RL_5M_103_PRO". The pit comes from the page title, which is text.
function fixPatternWord(text, pit) {
  if (!/RL/i.test(text)) return text;
  let t = text.toUpperCase()
    .replace(/[¢#|!'"‘’`]/g, '_') // junk read in place of underscores
    .replace(/^_+/, '');
  const cut = t.indexOf('_');
  if (pit && cut > 0) {
    const head = t.slice(0, cut);
    if (head !== pit && levenshtein(head, pit) <= 2) t = pit + t.slice(cut);
  }
  return t
    .replace(/RL_+S5?M(?=_)/, 'RL_5M') // "5M" read as "SM" / "S5M"
    .replace(/RL_+5W(?=_)/, 'RL_5M')
    .replace(/_TR_?$/, '_TRI')
    .replace(/_+$/, '');
}

function wordsOf(data, pit) {
  const words = [];
  for (const block of data.blocks || []) {
    for (const para of block.paragraphs) {
      for (const line of para.lines) {
        for (const w of line.words) {
          const text = w.text.trim();
          // Grid lines come back as "|", ":" … — they would glue cells together.
          if (!text || /^[|!:;,.'"‘’`_\-–—]+$/.test(text)) continue;
          words.push({ text: fixPatternWord(text, pit), ...w.bbox });
        }
      }
    }
  }
  return words;
}

// Words → lines (by vertical centre) → phrases (words closer than ~a letter
// height, so "Sat, 24 Oct" stays one cell while table columns stay apart).
function groupLines(words) {
  const rows = [];
  for (const w of [...words].sort((a, b) => (a.y0 + a.y1) - (b.y0 + b.y1))) {
    const cy = (w.y0 + w.y1) / 2;
    const tolerance = Math.max(6, (w.y1 - w.y0) * 0.45);
    let row = rows.find((r) => Math.abs(r.cy - cy) < tolerance);
    if (!row) rows.push((row = { cy, words: [] }));
    row.words.push(w);
  }
  return rows
    .sort((a, b) => a.cy - b.cy)
    .map((row) => {
      const phrases = [];
      for (const w of row.words.sort((a, b) => a.x0 - b.x0)) {
        const last = phrases[phrases.length - 1];
        if (last && w.x0 - last.x1 < (w.y1 - w.y0) * 0.8) {
          last.text += ` ${w.text}`;
          last.x1 = w.x1;
        } else {
          phrases.push({ text: w.text, x0: w.x0, x1: w.x1 });
        }
      }
      return { cy: row.cy, phrases, line: phrases.map((p) => p.text).join(' ') };
    });
}

export function createPdfOcr({ createCanvas = defaultCreateCanvas } = {}) {
  let workerPromise = null;

  function worker() {
    workerPromise ??= (async () => {
      const mod = await import('tesseract.js');
      const createWorker = mod.createWorker || mod.default?.createWorker;
      const w = await createWorker('eng', 1, { logger: () => {} });
      await w.setParameters({ tessedit_pageseg_mode: '11' }); // sparse text: table cells
      return w;
    })();
    return workerPromise;
  }

  async function recognize(canvas) {
    // Browsers hand tesseract the canvas; Node (tests) needs encoded bytes.
    const input = typeof canvas.toBuffer === 'function' ? canvas.toBuffer('image/png') : canvas;
    const { data } = await (await worker()).recognize(input, {}, { blocks: true });
    return data;
  }

  // Reads a pdf.js page. `parseDate(text)` and `patternIdOf(text)` are the
  // importer's own helpers. Returns the table lines of both readings (only lines
  // below the date header, when there is one) and pattern ID → blast date.
  async function readTablePage(page, { pit, parseDate, patternIdOf }) {
    const viewport = page.getViewport({ scale: OCR_SCALE });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const grey = createCanvas(canvas.width, canvas.height);
    const greyCtx = grey.getContext('2d');
    const greyPixels = greyCtx.createImageData(canvas.width, canvas.height);
    const src = pixels.data;
    const dst = greyPixels.data;
    for (let i = 0; i < src.length; i += 4) {
      const r = src[i], g = src[i + 1], b = src[i + 2];
      const v = 0.299 * r + 0.587 * g + 0.114 * b;
      dst[i] = dst[i + 1] = dst[i + 2] = isRed(r, g, b) ? 255 - v : v;
      dst[i + 3] = 255;
    }
    greyCtx.putImageData(greyPixels, 0, 0);

    const passes = [];
    for (const image of [canvas, grey]) passes.push(groupLines(wordsOf(await recognize(image), pit)));

    // The date header ("Sat, 24 Oct" …) marks where the table starts and gives
    // the day columns; map labels above it are dropped. Days OCR merged or missed
    // are filled in between the ones it read — the columns are evenly spaced.
    let header = null;
    for (const line of passes[0]) {
      const read = line.phrases
        .map((p) => ({ date: parseDate(p.text), x: (p.x0 + p.x1) / 2 }))
        .filter((d) => d.date)
        .sort((a, b) => a.date - b.date);
      if (read.length < 2) continue;
      const first = read[0];
      const last = read[read.length - 1];
      const span = Math.round((last.date - first.date) / 86400000);
      const step = span > 0 ? (last.x - first.x) / span : 0;
      const days = [];
      for (let k = 0; k <= span; k += 1) {
        const date = new Date(first.date.getFullYear(), first.date.getMonth(), first.date.getDate() + k);
        days.push({ date, x: first.x + step * k });
      }
      header = { cy: line.cy, days };
      break;
    }
    const tableLines = passes.map((lines) => (header ? lines.filter((l) => l.cy > header.cy) : lines));

    const blastDates = new Map();
    if (header) {
      const halfW = Math.max(6, Math.round(canvas.width * 0.004));
      for (const line of tableLines.flat()) {
        const id = patternIdOf(line.line);
        if (!id || blastDates.has(id)) continue;
        for (const day of header.days) {
          let red = 0, total = 0;
          for (let y = Math.round(line.cy) - 3; y <= Math.round(line.cy) + 3; y += 1) {
            for (let x = Math.round(day.x) - halfW; x <= Math.round(day.x) + halfW; x += 1) {
              const i = (y * canvas.width + x) * 4;
              total += 1;
              if (isRed(src[i], src[i + 1], src[i + 2])) red += 1;
            }
          }
          if (red / total > 0.4) {
            blastDates.set(id, day.date);
            break;
          }
        }
      }
    }

    return { passes: tableLines, blastDates };
  }

  async function terminate() {
    if (!workerPromise) return;
    const w = await workerPromise.catch(() => null);
    workerPromise = null;
    await w?.terminate();
  }

  return { readTablePage, terminate };
}
