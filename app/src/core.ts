// ARGALLAX shared application state and display rules. Both views read and write this one store.
// AI-assisted code. Licensed under Apache-2.0.
import { interpolateInferno, interpolatePuOr } from 'd3-scale-chromatic';
import { Atlas, Box, MonthPoint, Scope, MONTHS, MONTHS_LONG, fmt } from './data';

export const REPO = 'https://github.com/kennethmejes-web/argallax';
export const atlas = new Atlas();
export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
// Colours are CSS variables, so every chart follows the view's theme (paper for Classic, night for Living).
export const PAPER = 'var(--paper)', PAPER2 = 'var(--paper-2)', INK = 'var(--ink)', INK2 = 'var(--ink-2)', INK3 = 'var(--ink-3)', RULE = 'var(--rule)', ACCENT = 'var(--accent)', EST = 'var(--est)', SNPP = 'var(--snpp)';
export const cssVar = (name: string) => getComputedStyle(document.body).getPropertyValue(name).trim();
/** Sequential ramp for counts: light-to-dark on paper, dark-to-bright on the night theme. */
export const seq = (v: number, max: number) => {
  const t = Math.sqrt(Math.min(v / Math.max(max, 1), 1));
  return state.view === 'living' ? interpolateInferno(0.36 + 0.62 * t) : interpolateInferno(0.96 - 0.8 * t);
};
export const div = (v: number, med: number) => interpolatePuOr(0.5 - Math.max(-2, Math.min(2, Math.log2((v + 1) / (med + 1)))) / 4);
export const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export type View = 'living' | 'classic';
export type BenchTab = 'sel' | 'record' | 'method' | 'limits' | 'sources';
export const state = {
  box: { w: 0, s: 0, e: 0, n: 0 } as Box, scope: 'whole_area' as Scope, scopeName: '',
  pts: [] as MonthPoint[], mask: new Uint8Array() as Uint8Array,
  sel: -1, focus: -1,
  y0: 2002, y1: 2026,
  view: 'living' as View,
  measure: 'counts' as 'counts' | 'anom',     // Classic calendar colouring
  series: 'harm' as 'harm' | 'raw',           // Living strip: harmonized or as recorded
  mapPeriod: 'month' as 'month' | 'year' | 'avg',
  intro: 1,                                    // Discover step 1–4; 0 = closed
  bench: 'sel' as BenchTab, benchOpen: false,
  playing: false, speed: 1, eraHold: false,     // playback of the record, month by month
  last: 'Nothing changed yet. Pick an area, a year or a month.', rev: 0,
};

// ---------------- rendering and URL ----------------
const renderers: (() => void)[] = [];
export const onRender = (f: () => void) => { renderers.push(f); };
let ready = false;
export function start() { ready = true; refresh(); }
/** Re-render everything from the store. A message describes what the last action changed. */
export function refresh(msg?: string) {
  if (msg !== undefined) { state.last = msg; state.rev++; }
  if (!ready) return;
  document.body.dataset.view = state.view;
  document.body.dataset.intro = state.intro > 0 ? 'on' : 'off';
  if (!state.playing) writeHash();
  for (const r of renderers) r();
}
function writeHash() {
  const b = state.box, p = cur();
  const h = `v=${state.view}&a=${b.w},${b.s},${b.e},${b.n}&m=${p ? p.month : ''}&y=${state.y0}-${state.y1}&c=${state.measure}&s=${state.series}&p=${state.mapPeriod}&i=${state.intro}&w=${state.benchOpen ? state.bench : ''}`;
  try { history.replaceState(null, '', '#' + h); } catch { /* file:// or sandboxed */ }
}
/** Restore a saved investigation from the URL. Unknown or invalid parts are ignored. */
export function readHash() {
  const q = new URLSearchParams(location.hash.replace(/^#/, ''));
  const out: { box?: Box; month?: string; had: boolean } = { had: q.has('v') };
  const pick = <T extends string>(k: string, ok: readonly T[]) => (ok.includes(q.get(k) as T) ? (q.get(k) as T) : undefined);
  state.view = pick('v', ['living', 'classic'] as const) ?? state.view;
  state.measure = pick('c', ['counts', 'anom'] as const) ?? state.measure;
  state.series = pick('s', ['harm', 'raw'] as const) ?? state.series;
  state.mapPeriod = pick('p', ['month', 'year', 'avg'] as const) ?? state.mapPeriod;
  const w = pick('w', ['sel', 'record', 'method', 'limits', 'sources'] as const);
  if (w) { state.bench = w; state.benchOpen = true; }
  if (q.has('i')) { const i = +q.get('i')!; if (i >= 0 && i <= 4) state.intro = Math.round(i); }
  const y = /^(\d{4})-(\d{4})$/.exec(q.get('y') ?? '');
  if (y && +y[1] >= 2002 && +y[2] <= 2026 && +y[1] <= +y[2]) { state.y0 = +y[1]; state.y1 = +y[2]; }
  const a = (q.get('a') ?? '').split(',').map(Number);
  if (a.length === 4 && a.every((x) => isFinite(x))) out.box = { w: a[0], s: a[1], e: a[2], n: a[3] };
  if (/^\d{4}-\d{2}$/.test(q.get('m') ?? '')) out.month = q.get('m')!;
  return out;
}

// ---------------- labels ----------------
export const cur = () => state.pts[state.sel] as MonthPoint | undefined;
export const elapsed = () => atlas.meta.current_month.elapsed_days;
export function monthLabel(p: MonthPoint) { return `${MONTHS_LONG[p.cal - 1]} ${p.year}${p.era.complete ? '' : ` (days 1–${elapsed()})`}`; }
export function monthShort(p: MonthPoint) { return `${MONTHS[p.cal - 1]} ${p.year}`; }
export function kindText(p: MonthPoint) {
  return p.era.kind === 'harmonized' ? 'Estimated VIIRS-equivalent (from Aqua MODIS)' : p.era.kind === 'observed' ? 'Observed S-NPP VIIRS' : 'NOAA-20 VIIRS (continuing S-NPP)';
}
export function sensorShort(p: MonthPoint) { return p.era.sensor === 'aqua' ? 'Aqua MODIS, estimated' : p.era.sensor === 'snpp' ? 'S-NPP VIIRS' : 'NOAA-20 VIIRS'; }
/** The value shown for a month: the full month, or days 1–N for the incomplete current month. */
export function shown(p: MonthPoint) { return p.era.complete ? p.value : p.early; }

/**
 * Display rule (docs/DECISIONS.md, 15 Nov 2026): a provisional month is never shown or counted as a confirmed
 * above/below month. Where it lies outside the range, that is stated with a provisional qualification.
 */
export interface Verdict { kind: 'above' | 'below' | 'within' | 'none'; provisional: boolean; confirmed: boolean; text: string; short: string }
export function verdict(p: MonthPoint): Verdict {
  if (!p.ref || !p.flag) return { kind: 'none', provisional: p.provisional, confirmed: false, text: 'Not enough history to compare.', short: 'no comparison' };
  const where = p.flag === 'within' ? 'within' : p.flag;
  if (p.provisional) {
    return {
      kind: p.flag, provisional: true, confirmed: false,
      text: `Provisional: currently ${where} the historical reference range. This can change when science-quality data replaces the near-real-time data.`,
      short: `provisional, currently ${where} range`,
    };
  }
  return { kind: p.flag, provisional: false, confirmed: true, text: `${where[0].toUpperCase() + where.slice(1)} the historical reference range`, short: `${where} range` };
}
/** Confirmed (non-provisional) month outside its historical reference range. */
export const isUnusual = (p: MonthPoint) => !p.provisional && (p.flag === 'above' || p.flag === 'below');
export const provOutside = (p: MonthPoint) => p.provisional && (p.flag === 'above' || p.flag === 'below');
export function csvFlag(p: MonthPoint) { return !p.flag ? '' : p.provisional ? `${p.flag}_provisional` : p.flag; }

// ---------------- actions ----------------
function sameBox(a: Box, b: Box) { return Math.abs(a.w - b.w) < 1e-9 && Math.abs(a.e - b.e) < 1e-9 && Math.abs(a.s - b.s) < 1e-9 && Math.abs(a.n - b.n) < 1e-9; }
/** Index of the preset the current box matches: 0 = whole area, 1..4 = latitude bands, -1 = custom box. */
export function presetIndex() {
  if (state.scope === 'whole_area') return 0;
  if (state.scope === 'region') return 1 + atlas.meta.regions.findIndex((_, i) => sameBox(state.box, atlas.snap(atlas.regionBox(i))));
  return -1;
}
export function setBox(b: Box, name?: string, silent = false) {
  const sb = atlas.snap(b), before = cur(), oldName = state.scopeName, oldV = before ? shown(before) : NaN;
  state.box = sb;
  if (sameBox(sb, atlas.snap(atlas.aoiBox()))) { state.scope = 'whole_area'; state.scopeName = 'Whole screening area'; }
  else {
    const r = atlas.meta.regions.findIndex((_, i) => sameBox(sb, atlas.snap(atlas.regionBox(i))));
    if (r >= 0) { state.scope = 'region'; state.scopeName = atlas.meta.regions[r].name + ' (latitude band)'; }
    else { state.scope = 'other_box'; state.scopeName = name ?? 'Custom box'; }
  }
  state.mask = atlas.mask(sb);
  state.pts = atlas.series(state.mask, state.scope);
  if (state.sel < 0 || state.sel >= state.pts.length) state.sel = defaultMonth();
  const p = cur()!;
  if (silent) return refresh();
  const same = oldName === state.scopeName && state.scope !== 'other_box';
  refresh(same ? `Area unchanged: ${state.scopeName}.`
    : `Area: ${oldName || 'none'} → ${state.scopeName}. ${monthShort(p)} is now ${fmt(shown(p))} cell-days${isFinite(oldV) ? ` (was ${fmt(oldV)})` : ''}. The month did not change.`);
}
/** Latest complete science-quality month. */
function defaultMonth() {
  for (let i = state.pts.length - 1; i >= 0; i--) if (state.pts[i].era.complete && !state.pts[i].provisional) return i;
  return state.pts.length - 1;
}
export function monthIndex(month: string) { return state.pts.findIndex((p) => p.month === month); }
export function selectMonth(i: number, quiet = false) {
  i = Math.max(0, Math.min(state.pts.length - 1, i));
  const a = cur(), b = state.pts[i];
  if (!b) return;
  if (state.playing) stopTimer();
  if (i === state.sel) return refresh();
  state.sel = state.focus = i;
  if (quiet) return refresh();
  const sat = a && a.era.sensor !== b.era.sensor ? ` Satellite: ${sensorShort(a)} → ${sensorShort(b)}.` : '';
  refresh(`Month: ${a ? monthShort(a) : 'none'} → ${monthShort(b)}, ${fmt(shown(b))} cell-days. The area did not change.${sat}`);
}
/** Move to another year, keeping the calendar month where that month exists. */
export function selectYear(y: number) {
  const p = cur(); if (!p) return;
  const inYear = state.pts.filter((o) => o.year === y); if (!inYear.length || y === p.year) return;
  const best = inYear.reduce((a, o) => (Math.abs(o.cal - p.cal) < Math.abs(a.cal - p.cal) ? o : a));
  selectMonth(best.i);
}
/** Direct date selection: go to a calendar month and year. The record is monthly, so there is no day. */
export function goTo(year: number, cal: number) {
  const exact = state.pts.find((p) => p.year === year && p.cal === cal);
  if (exact) return selectMonth(exact.i);
  const inYear = state.pts.filter((p) => p.year === year); if (!inYear.length) return;
  const best = inYear.reduce((a, o) => (Math.abs(o.cal - cal) < Math.abs(a.cal - cal) ? o : a));
  if (state.playing) stopTimer();
  state.sel = state.focus = best.i;
  refresh(`${MONTHS_LONG[cal - 1]} ${year} is outside the record (it runs from ${monthShort(state.pts[0])} to ${monthShort(state.pts[state.pts.length - 1])}). Showing ${monthShort(best)} instead.`);
}

// ---------------- playback: the record, month by month ----------------
let timer: number | undefined;
function stopTimer() { state.playing = false; state.eraHold = false; clearTimeout(timer); }
function tick() {
  if (!state.playing) return;
  const next = state.sel + 1;
  if (next >= state.pts.length) { stopTimer(); return refresh(`Playback reached the end of the record, ${monthShort(cur()!)}.`); }
  const changed = state.pts[next].era.sensor !== state.pts[state.sel].era.sensor;
  state.sel = state.focus = next; state.eraHold = changed;
  refresh();
  timer = window.setTimeout(tick, (changed ? 2600 : 0) + 170 / state.speed);
}
export function togglePlay() {
  if (state.playing) { stopTimer(); return refresh(`Playback paused at ${monthShort(cur()!)}.`); }
  if (state.sel >= state.pts.length - 1) state.sel = state.focus = 0;
  state.playing = true;
  refresh('Playing the record month by month. The area did not change. It pauses briefly where the satellite changes.');
  timer = window.setTimeout(tick, 400);
}
export function setSpeed(x: number) { state.speed = x; refresh(); }

export function stepUnusual(dir: 1 | -1) {
  for (let i = state.sel + dir; i >= 0 && i < state.pts.length; i += dir) if (isUnusual(state.pts[i])) return selectMonth(i);
  refresh(dir > 0 ? 'No later confirmed month lies outside its historical reference range in this area.' : 'No earlier confirmed month lies outside its historical reference range in this area.');
}
export function setYears(a: number, b: number) {
  if (a > b) [a, b] = [b, a];
  state.y0 = a; state.y1 = b;
  refresh(`Years for the calendar and downloads: ${a}–${b}. Area and month did not change.`);
}
export function setView(v: View) {
  if (v === state.view) return;
  if (state.playing) stopTimer();
  state.view = v;
  refresh(`View: ${v === 'living' ? 'Living View' : 'Classic View'}. Same area, same month, same numbers.`);
}
export function setMeasure(m: 'counts' | 'anom') { state.measure = m; refresh(m === 'counts' ? 'Calendar colours now show counts.' : 'Calendar colours now compare each month with the median of the same month in other years.'); }
export function setSeries(s: 'harm' | 'raw') {
  if (s === state.series) return;
  state.series = s;
  refresh(s === 'raw' ? 'Timeline now shows values as each satellite recorded them. Months before Feb 2012 shrink: that is the satellite, not a finding about burning.'
    : 'Timeline now shows the harmonized record: months before Feb 2012 are estimated VIIRS-equivalent.');
}
export function setMapPeriod(m: 'month' | 'year' | 'avg') { state.mapPeriod = m; refresh(m === 'month' ? 'Map now shows the selected month.' : m === 'year' ? 'Map now shows the selected year.' : 'Map now shows a typical year (2013–2025 average).'); }
export function setIntro(i: number) { state.intro = Math.max(0, Math.min(4, i)); refresh(); }
export function openBench(tab?: BenchTab, scroll = true) {
  if (tab) state.bench = tab;
  state.benchOpen = true; refresh();
  if (state.view === 'living') $('bench-h').focus({ preventScroll: true });
  else if (scroll) $('workbench').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
}
export function closeBench() { state.benchOpen = false; refresh(); }

export function niceTicks(max: number, n: number) {
  const step0 = max / n, mag = 10 ** Math.floor(Math.log10(step0)), f = step0 / mag;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
  const out: number[] = []; for (let t = 0; t <= max; t += step) out.push(t); return out;
}
export function swatch(content: string, w = 22, h = 14) { return `<svg width="${w}" height="${h}" aria-hidden="true">${content}</svg>`; }
