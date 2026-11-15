// ARGALLAX data layer: loads the Step 8 files and computes area series in the browser.
// AI-assisted code. Licensed under Apache-2.0.

export interface Era { month: string; sensor: 'aqua' | 'snpp' | 'noaa20'; kind: 'harmonized' | 'observed' | 'bridged'; status: 'archive' | 'provisional'; complete: boolean }
export interface Meta {
  aoi_notice: string; aoi_bounds_lon_lat: [number, number, number, number]; unit: string; unit_short: string; cell_deg: number;
  regions: { name: string; lat_min: number | null; lat_max: number | null }[]; regions_note: string;
  seasons: { dry: number[]; rest: number[] };
  sensors: { key: string; name: string }[]; eras: Era[];
  era_summary: { from: string; to: string; sensor: string; label: string }[];
  current_month: { month: string; last_complete_date: string; elapsed_days: number; complete: boolean; rule: string };
  harmonization: { method: string; ratios: Record<string, number>; fit_period: string[]; reference: string };
  intervals: { apply_to: string; whole_area: Q; region: Q; other_box: { uses: string; label: string }; formula: string; caveat: string };
  small_area_warning: { threshold_deg: number; label: string; basis: string; diagnostic_block_error: Record<string, { raw: number; harmonized: number }> };
  validation: any; labels: Record<string, string>; credits: Record<string, string>;
  files: { cells: string; hotspots_by_year: string[]; hotspots_bytes: Record<string, number> };
  question: string; title: string;
}
interface Q { q10: number; q90: number; label: string }
interface Cells { cells: [number, number, number][]; months: string[]; rows: Record<'s' | 'd' | 'm' | 'c' | 'v' | 'u' | 'ev' | 'eu', number[]> }

export type Scope = 'whole_area' | 'region' | 'other_box';
export interface Box { w: number; s: number; e: number; n: number }

export interface MonthPoint {
  i: number; month: string; year: number; cal: number; era: Era;
  value: number;          // main series: estimated VIIRS-equivalent (Aqua era), observed S-NPP, or NOAA-20
  early: number;          // same, days 1..elapsed (only filled for the current calendar month)
  rawStitched: number;    // raw Aqua before Feb 2012, VIIRS after
  aquaRaw: number;        // Aqua daytime cell-days (any era)
  provisional: boolean;
  conv?: { lo: number; hi: number; label: string };  // sensor-conversion range (Aqua era only)
  ref?: { p10: number; p50: number; p90: number; n: number; early: boolean };
  flag?: 'above' | 'below' | 'within';
}

export class Atlas {
  meta!: Meta; cells!: Cells;
  private bySD = new Map<number, Int32Array[]>();  // key s*2+d -> per month list of row indices
  async load(base = './data/') {
    const [m, c] = await Promise.all([fetch(base + 'meta.json').then((r) => r.json()), fetch(base + 'cells.json').then((r) => r.json())]);
    this.meta = m; this.cells = c;
    const R = c.rows, nM = c.months.length, buckets = new Map<number, number[][]>();
    for (let k = 0; k < R.s.length; k++) {
      const key = R.s[k] * 2 + R.d[k];
      if (!buckets.has(key)) buckets.set(key, Array.from({ length: nM }, () => []));
      buckets.get(key)![R.m[k]].push(k);
    }
    for (const [k, arr] of buckets) this.bySD.set(k, arr.map((a) => Int32Array.from(a)));
  }
  cellBox(i: number): Box { const [iy, ix] = this.cells.cells[i]; const d = this.meta.cell_deg; return { s: iy * d, n: (iy + 1) * d, w: ix * d, e: (ix + 1) * d }; }
  aoiBox(): Box { const [w, s, e, n] = this.meta.aoi_bounds_lon_lat; return { w, s, e, n }; }
  regionBox(r: number): Box { const a = this.aoiBox(); const g = this.meta.regions[r]; return { w: a.w, e: a.e, s: g.lat_min ?? a.s, n: g.lat_max ?? a.n }; }

  /** Snap a box outward to the 0.25° grid and clamp it to the screening area. */
  snap(b: Box): Box {
    const d = this.meta.cell_deg, a = this.aoiBox();
    const w = Math.max(Math.floor(Math.min(b.w, b.e) / d) * d, Math.floor(a.w / d) * d);
    const e = Math.min(Math.ceil(Math.max(b.w, b.e) / d) * d, Math.ceil(a.e / d) * d);
    const s = Math.max(Math.floor(Math.min(b.s, b.n) / d) * d, Math.floor(a.s / d) * d);
    const n = Math.min(Math.ceil(Math.max(b.s, b.n) / d) * d, Math.ceil(a.n / d) * d);
    return { w, e: Math.max(e, w + d), s, n: Math.max(n, s + d) };
  }
  mask(b: Box): Uint8Array {
    const d = this.meta.cell_deg, m = new Uint8Array(this.cells.cells.length);
    this.cells.cells.forEach(([iy, ix], i) => { const la = (iy + 0.5) * d, lo = (ix + 0.5) * d; if (la >= b.s && la <= b.n && lo >= b.w && lo <= b.e) m[i] = 1; });
    return m;
  }
  season(month: string) { return this.meta.seasons.dry.includes(+month.slice(5, 7)) ? 'dry' : 'rest'; }

  private sum(s: number, d: number, mi: number, mask: Uint8Array, harm: boolean, early: boolean) {
    const idx = this.bySD.get(s * 2 + d)?.[mi]; if (!idx) return 0;
    const R = this.cells.rows, sea = harm ? this.season(this.cells.months[mi]) : '';
    let t = 0;
    for (const k of idx) {
      const c = R.c[k]; if (!mask[c]) continue;
      const n = early ? R.ev[k] + R.eu[k] : R.v[k] + R.u[k];
      if (!n) continue;
      t += harm ? n * this.meta.harmonization.ratios[`${this.meta.regions[this.cells.cells[c][2]].name}|${sea}`] : n;
    }
    return t;
  }

  /** Aqua daytime cell-days converted to the S-NPP scale for any month. For side-by-side display only. */
  aquaScaled(mi: number, mask: Uint8Array) { return this.sum(0, 0, mi, mask, true, false); }
  /** Adds each cell's daytime cell-days for month mi, as recorded by that month's main-series satellite (not harmonized). */
  addCellMonth(mi: number, out: Float32Array) {
    const era = this.meta.eras[mi], s = { aqua: 0, snpp: 1, noaa20: 2 }[era.sensor];
    const idx = this.bySD.get(s * 2)?.[mi]; if (!idx) return;
    const R = this.cells.rows;
    for (const k of idx) out[R.c[k]] += era.complete ? R.v[k] + R.u[k] : R.ev[k] + R.eu[k];
  }

  series(mask: Uint8Array, scope: Scope): MonthPoint[] {
    const M = this.meta, months = this.cells.months, cur = M.current_month;
    const sIdx = { aqua: 0, snpp: 1, noaa20: 2 } as const;
    const curCal = +cur.month.slice(5, 7);
    const q = scope === 'whole_area' ? M.intervals.whole_area : M.intervals.region;
    const qLabel = scope === 'other_box' ? M.intervals.other_box.label : q.label;
    const pts: MonthPoint[] = months.map((month, i) => {
      const era = M.eras[i], s = sIdx[era.sensor], harm = era.sensor === 'aqua', cal = +month.slice(5, 7);
      const value = this.sum(s, 0, i, mask, harm, false);
      const aquaRaw = this.sum(0, 0, i, mask, false, false);
      const p: MonthPoint = {
        i, month, year: +month.slice(0, 4), cal, era, value, aquaRaw,
        early: cal === curCal ? this.sum(s, 0, i, mask, harm, true) : 0,
        rawStitched: harm ? aquaRaw : value, provisional: era.status === 'provisional',
      };
      if (harm) p.conv = { lo: Math.max((value + 1) * Math.exp(q.q10) - 1, 0), hi: Math.max((value + 1) * Math.exp(q.q90) - 1, 0), label: qLabel };
      return p;
    });
    // historical reference range: same calendar month, other years, complete archive months only
    for (const p of pts) {
      const partial = !p.era.complete;
      const refs = pts.filter((o) => o.cal === p.cal && o.year !== p.year && o.era.complete && o.era.status === 'archive').map((o) => (partial ? o.early : o.value));
      if (refs.length >= 5) {
        refs.sort((a, b) => a - b);
        p.ref = { p10: pct(refs, 0.1), p50: pct(refs, 0.5), p90: pct(refs, 0.9), n: refs.length, early: partial };
        const v = partial ? p.early : p.value;
        p.flag = v > p.ref.p90 ? 'above' : v < p.ref.p10 ? 'below' : 'within';
      }
    }
    return pts;
  }
}

export function pct(sorted: number[], q: number) {
  const h = (sorted.length - 1) * q, lo = Math.floor(h), hi = Math.ceil(h);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (h - lo);
}

/** Median per calendar month over complete archive months in [y0, y1]; returns month indices sorted by median. */
export function activeMonths(pts: MonthPoint[], y0: number, y1: number) {
  const out: { cal: number; median: number }[] = [];
  for (let c = 1; c <= 12; c++) {
    const v = pts.filter((p) => p.cal === c && p.year >= y0 && p.year <= y1 && p.era.complete && p.era.status === 'archive').map((p) => p.value).sort((a, b) => a - b);
    if (v.length) out.push({ cal: c, median: pct(v, 0.5) });
  }
  return out.sort((a, b) => b.median - a.median);
}

/** Annual totals for full calendar years only. */
export function annual(pts: MonthPoint[]) {
  const by = new Map<number, MonthPoint[]>();
  for (const p of pts) { if (!by.has(p.year)) by.set(p.year, []); by.get(p.year)!.push(p); }
  const out: { year: number; harmonized: number; raw: number; aqua: number }[] = [];
  for (const [y, ps] of by) {
    if (ps.length !== 12 || ps.some((p) => !p.era.complete || p.provisional)) continue;
    out.push({ year: y, harmonized: sumOf(ps, 'value'), raw: sumOf(ps, 'rawStitched'), aqua: sumOf(ps, 'aquaRaw') });
  }
  return out.sort((a, b) => a.year - b.year);
}
const sumOf = (ps: MonthPoint[], k: 'value' | 'rawStitched' | 'aquaRaw') => ps.reduce((t, p) => t + p[k], 0);

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const fmt = (x: number) => (x >= 100 ? Math.round(x).toLocaleString('en-US') : x >= 10 ? x.toFixed(0) : x.toFixed(1).replace(/\.0$/, ''));
