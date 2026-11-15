// ARGALLAX web app. AI-assisted code. Licensed under Apache-2.0.
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import * as maplibregl from 'maplibre-gl';
import { interpolateInferno, interpolatePuOr } from 'd3-scale-chromatic';
import { Atlas, Box, MonthPoint, Scope, MONTHS, MONTHS_LONG, activeMonths, annual, fmt } from './data';

const REPO = 'https://github.com/kennethmejes-web/argallax';
const atlas = new Atlas();
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const PAPER = '#f4f1ea', PAPER2 = '#ebe6da', INK = '#1b1b1b', INK2 = '#4a4740', INK3 = '#6e6a60', RULE = '#cfc8b8', ACCENT = '#b5401a';

const state = {
  box: { w: 0, s: 0, e: 0, n: 0 } as Box, scope: 'whole_area' as Scope, scopeName: '',
  y0: 2002, y1: 2026, view: 'counts' as 'counts' | 'anom', sel: -1, focus: -1,
  pts: [] as MonthPoint[], mask: new Uint8Array() as Uint8Array,
};
let map: maplibregl.Map | undefined;
let svgMap: { draw: () => void } | undefined;

// ---------------- colour ----------------
const seq = (v: number, max: number) => interpolateInferno(0.96 - 0.8 * Math.sqrt(Math.min(v / Math.max(max, 1), 1)));
const div = (v: number, med: number) => interpolatePuOr(0.5 - Math.max(-2, Math.min(2, Math.log2((v + 1) / (med + 1)))) / 4);

// ---------------- selection ----------------
function sameBox(a: Box, b: Box) { return Math.abs(a.w - b.w) < 1e-9 && Math.abs(a.e - b.e) < 1e-9 && Math.abs(a.s - b.s) < 1e-9 && Math.abs(a.n - b.n) < 1e-9; }
function setBox(b: Box, name?: string) {
  const sb = atlas.snap(b);
  state.box = sb;
  if (sameBox(sb, atlas.snap(atlas.aoiBox()))) { state.scope = 'whole_area'; state.scopeName = 'Whole screening area'; }
  else {
    const r = atlas.meta.regions.findIndex((_, i) => sameBox(sb, atlas.snap(atlas.regionBox(i))));
    if (r >= 0) { state.scope = 'region'; state.scopeName = atlas.meta.regions[r].name + ' (latitude band)'; }
    else { state.scope = 'other_box'; state.scopeName = name ?? 'Custom box'; }
  }
  state.mask = atlas.mask(sb);
  state.pts = atlas.series(state.mask, state.scope);
  if (state.sel < 0) state.sel = state.pts.length - 1;
  for (const [k, v] of Object.entries({ s: sb.s, n: sb.n, w: sb.w, e: sb.e })) ($(`in-${k}`) as HTMLInputElement).value = String(v);
  updateMapSelection();
  renderAll();
}

function renderSelection() {
  const b = state.box, n = state.mask.reduce((t, x) => t + x, 0);
  const wDeg = b.e - b.w, hDeg = b.n - b.s, thr = atlas.meta.small_area_warning.threshold_deg;
  const scopeText = state.scope === 'other_box'
    ? 'Custom box: ranges here are approximate and not validated at this size.'
    : 'Scale at which the method was tested.';
  let html = `<p><strong>${esc(state.scopeName)}</strong><br><span class="box">${b.s.toFixed(2)}–${b.n.toFixed(2)}°N, ${b.w.toFixed(2)}–${b.e.toFixed(2)}°E</span> <span class="hint">(snapped to the 0.25° grid)</span></p>
    <p class="hint">${scopeText} ${n} grid cells in this box have at least one detection in 2002–2026.</p>`;
  if (wDeg < thr || hDeg < thr) html += `<p class="warn"><strong>${esc(atlas.meta.small_area_warning.label)}</strong> ${esc(atlas.meta.small_area_warning.basis)}</p>`;
  if (n === 0) html += `<p class="warn">${esc(atlas.meta.labels.zero)}</p>`;
  $('selection-summary').innerHTML = html;
}

// ---------------- calendar ----------------
function monthLabel(p: MonthPoint) { return `${MONTHS_LONG[p.cal - 1]} ${p.year}${p.era.complete ? '' : ` (days 1–${atlas.meta.current_month.elapsed_days})`}`; }
function kindText(p: MonthPoint) {
  return p.era.kind === 'harmonized' ? 'Estimated VIIRS-equivalent (from Aqua MODIS)' : p.era.kind === 'observed' ? 'Observed S-NPP VIIRS' : 'NOAA-20 VIIRS (continuing S-NPP)';
}
function shown(p: MonthPoint) { return p.era.complete ? p.value : p.early; }

function renderCalendar() {
  const host = $('calendar'), W = Math.max(host.clientWidth, 300), small = W < 600;
  const left = small ? 38 : 48, top = 22, cw = (W - left - 2) / 12, rh = small ? 17 : 20;
  const years: number[] = []; for (let y = state.y0; y <= state.y1; y++) years.push(y);
  const H = top + years.length * rh + 4;
  const byYM = new Map(state.pts.map((p) => [p.year * 100 + p.cal, p]));
  const inRange = state.pts.filter((p) => p.year >= state.y0 && p.year <= state.y1);
  const max = Math.max(...inRange.map((p) => (p.provisional ? 0 : p.value)), ...inRange.map(shown), 1);
  const parts: string[] = [];
  parts.push(`<defs>
    <pattern id="h-est" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="${INK}" stroke-opacity="0.32" stroke-width="1.2"/></pattern>
    <pattern id="h-prov" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(135)"><line x1="0" y1="0" x2="0" y2="5" stroke="${INK}" stroke-opacity="0.55" stroke-width="1.4"/></pattern>
  </defs>`);
  MONTHS.forEach((m, j) => parts.push(`<text x="${left + j * cw + cw / 2}" y="${top - 7}" text-anchor="middle" font-size="${small ? 10 : 12}" fill="${INK2}">${small ? m[0] : m}</text>`));
  years.forEach((y, r) => {
    const yy = top + r * rh;
    parts.push(`<text x="${left - 6}" y="${yy + rh / 2 + 4}" text-anchor="end" font-size="${small ? 10 : 12}" font-family="IBM Plex Mono, monospace" fill="${INK2}">${y}</text>`);
    for (let c = 1; c <= 12; c++) {
      const x = left + (c - 1) * cw, p = byYM.get(y * 100 + c);
      if (!p) { parts.push(`<rect x="${x + 1}" y="${yy + 1}" width="${cw - 2}" height="${rh - 2}" fill="${PAPER2}" opacity="0.5"/>`); continue; }
      const v = shown(p);
      let fill = PAPER;
      if (state.view === 'counts') fill = v > 0 ? seq(v, max) : PAPER;
      else fill = p.ref ? div(v, p.ref.p50) : PAPER2;
      parts.push(`<rect class="cell" data-i="${p.i}" x="${x + 1}" y="${yy + 1}" width="${cw - 2}" height="${rh - 2}" fill="${fill}" stroke="${RULE}" stroke-width="0.5"/>`);
      if (v === 0 && state.view === 'counts') parts.push(`<circle cx="${x + cw / 2}" cy="${yy + rh / 2}" r="1.6" fill="${INK3}" pointer-events="none"/>`);
      if (p.era.kind === 'harmonized') parts.push(`<rect x="${x + 1}" y="${yy + 1}" width="${cw - 2}" height="${rh - 2}" fill="url(#h-est)" pointer-events="none"/>`);
      if (p.provisional) parts.push(`<rect x="${x + 1}" y="${yy + 1}" width="${cw - 2}" height="${rh - 2}" fill="url(#h-prov)" pointer-events="none"/>`);
      if (!p.era.complete) parts.push(`<rect x="${x + 1.5}" y="${yy + 1.5}" width="${cw - 3}" height="${rh - 3}" fill="none" stroke="${INK}" stroke-width="1.2" stroke-dasharray="3 2" pointer-events="none"/>`);
      if (!p.provisional && (p.flag === 'above' || p.flag === 'below')) {
        const tx = x + cw - 4, ty = yy + 3, s = Math.min(7, rh / 2.5);
        parts.push(p.flag === 'above'
          ? `<path d="M${tx - s} ${ty + s} L${tx} ${ty + s} L${tx - s / 2} ${ty} Z" fill="${INK}" stroke="${PAPER}" stroke-width="0.8" pointer-events="none"/>`
          : `<path d="M${tx - s} ${ty} L${tx} ${ty} L${tx - s / 2} ${ty + s} Z" fill="${PAPER}" stroke="${INK}" stroke-width="1.1" pointer-events="none"/>`);
      }
      if (p.i === state.sel) parts.push(`<rect x="${x}" y="${yy}" width="${cw}" height="${rh}" fill="none" stroke="${INK}" stroke-width="2.4" pointer-events="none"/>`);
      if (p.i === state.focus && p.i !== state.sel) parts.push(`<rect x="${x}" y="${yy}" width="${cw}" height="${rh}" fill="none" stroke="#1d5fb8" stroke-width="2" pointer-events="none"/>`);
    }
  });
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="grid" tabindex="0" aria-label="Hotspot calendar, years by months. Use arrow keys to move between months and Enter to open a month.">${parts.join('')}</svg>`;
  const svg = host.querySelector('svg')!;
  svg.addEventListener('mousemove', (ev) => {
    const t = (ev.target as Element).closest('.cell') as SVGRectElement | null;
    if (!t) return hideTip();
    showTip(+t.dataset.i!, t);
  });
  svg.addEventListener('mouseleave', hideTip);
  svg.addEventListener('click', (ev) => {
    const t = (ev.target as Element).closest('.cell') as SVGRectElement | null;
    if (t) { state.sel = state.focus = +t.dataset.i!; renderCalendar(); renderMonth(); }
  });
  svg.addEventListener('keydown', onCalKey);
  svg.addEventListener('focus', () => { if (state.focus < 0) state.focus = state.sel; });
  svg.addEventListener('blur', hideTip);
  renderLegend(max);
  renderProvenance(W, left, cw);
}

function onCalKey(ev: KeyboardEvent) {
  const d: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -12, ArrowDown: 12 };
  const valid = state.pts.filter((p) => p.year >= state.y0 && p.year <= state.y1);
  if (!valid.length) return;
  if (state.focus < valid[0].i || state.focus > valid[valid.length - 1].i) state.focus = state.sel >= valid[0].i && state.sel <= valid[valid.length - 1].i ? state.sel : valid[valid.length - 1].i;
  if (ev.key in d) {
    ev.preventDefault();
    state.focus = Math.max(valid[0].i, Math.min(valid[valid.length - 1].i, state.focus + d[ev.key]));
  } else if (ev.key === 'Enter' || ev.key === ' ') {
    ev.preventDefault(); state.sel = state.focus; renderMonth();
  } else if (ev.key === 'Escape') { hideTip(); return; } else return;
  renderCalendar();
  const svg = $('calendar').querySelector('svg') as SVGElement; svg.focus();
  const r = svg.querySelector(`.cell[data-i="${state.focus}"]`) as SVGRectElement | null;
  if (r) showTip(state.focus, r);
}

function showTip(i: number, el: Element) {
  const p = state.pts[i], tip = $('tooltip'), sec = $('calendar-section');
  const v = shown(p);
  let ref = '';
  if (p.ref) ref = `<br>Historical reference range: <span class="tab">${fmt(p.ref.p10)}–${fmt(p.ref.p90)}</span>${p.flag !== 'within' ? ` · <strong style="display:inline">${p.flag === 'above' ? 'above' : 'below'}</strong>${p.provisional ? ' (provisional, not confirmed)' : ''}` : ' · within'}`;
  tip.innerHTML = `<strong>${monthLabel(p)}</strong><span class="tab">${fmt(v)}</span> cell-days<br>${kindText(p)}${p.provisional ? '<br><em>Provisional</em>' : ''}${ref}`;
  tip.hidden = false;
  const r = el.getBoundingClientRect(), s = sec.getBoundingClientRect();
  let x = r.left - s.left + r.width + 8, y = r.top - s.top - 4;
  if (x + 300 > s.width) x = r.left - s.left - 8 - Math.min(300, tip.offsetWidth);
  tip.style.left = `${Math.max(0, x)}px`; tip.style.top = `${y}px`;
}
function hideTip() { $('tooltip').hidden = true; }

function swatch(content: string, w = 22, h = 14) { return `<svg width="${w}" height="${h}" aria-hidden="true">${content}</svg>`; }
function renderLegend(max: number) {
  const items: string[] = [];
  if (state.view === 'counts') {
    const stops = Array.from({ length: 11 }, (_, k) => `<stop offset="${k * 10}%" stop-color="${seq(max * (k / 10) ** 2, max)}"/>`).join('');
    items.push(`<span class="item">${swatch(`<defs><linearGradient id="lg">${stops}</linearGradient></defs><rect width="120" height="12" fill="url(#lg)" stroke="${RULE}"/>`, 120, 12)} <span class="tab">0 → ${fmt(max)}</span> cell-days per month</span>`);
    items.push(`<span class="item">${swatch(`<rect width="22" height="14" fill="${PAPER}" stroke="${RULE}"/><circle cx="11" cy="7" r="1.6" fill="${INK3}"/>`)} no detections (not proof of no fire)</span>`);
  } else {
    const stops = Array.from({ length: 11 }, (_, k) => `<stop offset="${k * 10}%" stop-color="${interpolatePuOr(1 - k / 10)}"/>`).join('');
    items.push(`<span class="item">${swatch(`<defs><linearGradient id="lg2">${stops}</linearGradient></defs><rect width="120" height="12" fill="url(#lg2)" stroke="${RULE}"/>`, 120, 12)} ¼× · typical (median) · 4× the usual for that month</span>`);
  }
  items.push(`<span class="item">${swatch(`<rect width="22" height="14" fill="${PAPER2}"/><rect width="22" height="14" fill="url(#h-est)"/>`)} estimated from Aqua MODIS (before Feb 2012)</span>`);
  items.push(`<span class="item">${swatch(`<rect width="22" height="14" fill="${PAPER2}"/><rect width="22" height="14" fill="url(#h-prov)"/>`)} provisional (near-real-time)</span>`);
  items.push(`<span class="item">${swatch(`<path d="M5 12 L15 12 L10 3 Z" fill="${INK}"/>`)} above / ${swatch(`<path d="M5 3 L15 3 L10 12 Z" fill="${PAPER}" stroke="${INK}"/>`)} below the historical reference range (confirmed months only)</span>`);
  items.push(`<span class="item">${swatch(`<rect x="1" y="1" width="20" height="12" fill="none" stroke="${INK}" stroke-dasharray="3 2"/>`)} incomplete month</span>`);
  $('cal-legend').innerHTML = items.join('');
}

function renderProvenance(W: number, left: number, _cw: number) {
  const small = W < 600;
  const y0 = state.y0, y1 = state.y1 + 1, span = y1 - y0, wide = W - left - 2;
  const x = (m: string) => left + ((+m.slice(0, 4) + (+m.slice(5, 7) - 1) / 12 - y0) / span) * wide;
  const next = (m: string) => { const y = +m.slice(0, 4), k = +m.slice(5, 7); return k === 12 ? `${y + 1}-01` : `${y}-${String(k + 1).padStart(2, '0')}`; };
  const fills: Record<string, string> = { aqua: `url(#h-est)`, snpp: '#9b9585', noaa20: INK2 };
  const names: Record<string, string> = { aqua: 'Aqua MODIS → estimated VIIRS-equivalent', snpp: 'S-NPP VIIRS (reference)', noaa20: 'NOAA-20 VIIRS (provisional)' };
  const parts: string[] = [], labels: string[] = [];
  for (const e of atlas.meta.era_summary) {
    const a = Math.max(x(e.from), left), b = Math.min(x(next(e.to)), left + wide);
    if (b <= a) continue;
    if (e.sensor === 'aqua') parts.push(`<rect x="${a}" y="0" width="${b - a}" height="12" fill="${PAPER2}"/>`);
    parts.push(`<rect x="${a}" y="0" width="${b - a}" height="12" fill="${fills[e.sensor]}" stroke="${INK}" stroke-width="0.6"/>`);
    const sw = e.sensor === 'aqua' ? `<rect width="22" height="12" fill="${PAPER2}"/><rect width="22" height="12" fill="url(#h-est)" stroke="${INK}" stroke-width="0.6"/>` : `<rect width="22" height="12" fill="${fills[e.sensor]}" stroke="${INK}" stroke-width="0.6"/>`;
    labels.push(`<span class="item">${swatch(sw, 22, 12)}<span>${names[e.sensor]} · ${e.from} to ${e.to}</span></span>`);
  }
  const H = 14;
$('provenance').innerHTML = `<p class="hint" style="margin:0 0 4px ${left}px">Which satellite recorded each period</p><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Aqua MODIS from August 2002 to January 2012, S-NPP VIIRS from February 2012 to July 2026, NOAA-20 VIIRS from August 2026, provisional.">${parts.join('')}</svg><div class="legend prov-legend" style="margin-left:${small ? 0 : left}px;margin-top:4px">${labels.join('')}</div>`;
}

function renderCalSummary() {
  const act = activeMonths(state.pts, state.y0, state.y1).filter((a) => a.median > 0);
  const inR = state.pts.filter((p) => p.year >= state.y0 && p.year <= state.y1);
  const conf = inR.filter((p) => !p.provisional), above = conf.filter((p) => p.flag === 'above').length, below = conf.filter((p) => p.flag === 'below').length;
  const provOut = inR.filter((p) => p.provisional && (p.flag === 'above' || p.flag === 'below')).length;
  const top = act.slice(0, 3).map((a) => `<strong>${MONTHS_LONG[a.cal - 1]}</strong> (<span class="tab">${fmt(a.median)}</span>)`).join(', ');
  $('cal-summary').innerHTML = act.length
    ? `<p>In this area the most active months are usually ${top}: typical cell-days per month, ${state.y0}–${state.y1}. ${above} confirmed months are above and ${below} below their historical reference range.${provOut ? ` ${provOut} provisional month${provOut > 1 ? 's are' : ' is'} currently outside the range and not counted.` : ''} Select any month to compare it with history.</p>`
    : `<p>${esc(atlas.meta.labels.zero)}</p>`;
  $('cal-explain').textContent = state.view === 'counts'
    ? 'Each square is one month. Darker means hotspots were detected on more grid-cell-days (a 0.25° square on one day with at least one detection). All years are on the S-NPP VIIRS scale.'
    : 'Each square compares a month with the median of the same month in other years: orange is more than usual, purple less, white typical.';
}

// ---------------- month vs history ----------------
function renderMonth() {
  const p = state.pts[state.sel]; if (!p) return;
  const L = atlas.meta.labels, partial = !p.era.complete, v = shown(p);
  const tags = [`<span class="tag">${p.era.kind === 'harmonized' ? 'estimated' : p.era.kind === 'observed' ? 'observed S-NPP' : 'NOAA-20'}</span>`];
  if (p.provisional) tags.push('<span class="tag prov">provisional</span>');
  if (partial) tags.push('<span class="tag prov">incomplete</span>');
  let verdict = 'Not enough history to compare.';
  if (p.ref) verdict = p.flag === 'above' ? 'Above the historical reference range' : p.flag === 'below' ? 'Below the historical reference range' : 'Within the historical reference range';
  if (p.ref && p.provisional && p.flag !== 'within') verdict = `Currently ${p.flag} the historical reference range, but provisional: not a confirmed unusual month`;
  const rows: string[] = [];
  if (p.ref) {
    rows.push(`<tr><th>Historical reference range<br><span class="hint">10th–90th percentile of ${MONTHS_LONG[p.cal - 1]} in ${p.ref.n} other years${p.ref.early ? `, days 1–${atlas.meta.current_month.elapsed_days} only` : ''}. Descriptive: not a prediction or a significance test.</span></th><td>${fmt(p.ref.p10)}–${fmt(p.ref.p90)}<br><span class="hint">median ${fmt(p.ref.p50)}</span></td></tr>`);
  }
  if (p.conv) rows.push(`<tr><th>Sensor-conversion range<br><span class="hint">${esc(p.conv.label)} ${esc(atlas.meta.intervals.caveat)}</span></th><td>${fmt(p.conv.lo)}–${fmt(p.conv.hi)}</td></tr>`);
  const notes: string[] = [];
  if (p.era.kind === 'harmonized') notes.push(L.harmonized_month + ' ' + L.pre2012);
  if (p.era.kind === 'bridged') notes.push(L.bridged_month);
  if (p.provisional) notes.push(L.provisional_month);
  if (partial) notes.push(L.incomplete_month);
  if (v === 0) notes.push(L.zero);
  notes.push(L.clouds);
  $('month-text').innerHTML = `
    <h3 style="margin-top:0">${monthLabel(p)} · ${esc(state.scopeName)}</h3>
    <div class="big">${fmt(v)} <small>cell-days${p.conv ? ' (estimated)' : ''}</small></div>
    <div class="tags">${tags.join('')}</div>
    <p class="verdict">${verdict}</p>
    <table class="ranges">${rows.join('')}</table>
    ${notes.map((n) => `<p class="note">${esc(n)}</p>`).join('')}`;
  renderStrip(p);
}

function renderStrip(p: MonthPoint) {
  const host = $('month-chart'), W = Math.max(host.clientWidth, 300), H = 240, m = { l: 46, r: 14, t: 10, b: 30 };
  const partial = !p.era.complete;
  const same = state.pts.filter((o) => o.cal === p.cal);
  const val = (o: MonthPoint) => (partial ? o.early : o.value);
  const years = same.map((o) => o.year), x0 = Math.min(...years), x1 = Math.max(...years);
  const ymax = Math.max(...same.map(val), p.ref?.p90 ?? 0, p.conv?.hi ?? 0, 1) * 1.08;
  const X = (y: number) => m.l + ((y - x0) / Math.max(x1 - x0, 1)) * (W - m.l - m.r);
  const Y = (v: number) => H - m.b - (v / ymax) * (H - m.t - m.b);
  const parts: string[] = [];
  const ticks = niceTicks(ymax, 4);
  for (const t of ticks) parts.push(`<line x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}" stroke="${RULE}" stroke-width="0.6"/><text x="${m.l - 6}" y="${Y(t) + 4}" text-anchor="end" font-size="11" font-family="IBM Plex Mono" fill="${INK3}">${fmt(t)}</text>`);
  if (p.ref) {
    parts.push(`<rect x="${m.l}" y="${Y(p.ref.p90)}" width="${W - m.l - m.r}" height="${Math.max(Y(p.ref.p10) - Y(p.ref.p90), 1)}" fill="${PAPER2}" stroke="${RULE}"/>`);
    parts.push(`<line x1="${m.l}" x2="${W - m.r}" y1="${Y(p.ref.p50)}" y2="${Y(p.ref.p50)}" stroke="${INK2}" stroke-dasharray="4 3"/>`);
  }
  if (p.conv) parts.push(`<line x1="${X(p.year)}" x2="${X(p.year)}" y1="${Y(p.conv.lo)}" y2="${Y(p.conv.hi)}" stroke="${ACCENT}" stroke-width="2"/>`);
  for (const o of same) {
    const est = o.era.kind === 'harmonized', me = o.i === p.i;
    parts.push(`<circle cx="${X(o.year)}" cy="${Y(val(o))}" r="${me ? 6 : 3.6}" fill="${me ? ACCENT : est ? PAPER : INK2}" stroke="${me ? INK : INK2}" stroke-width="${me ? 1.5 : 1.1}" ${o.provisional ? 'stroke-dasharray="2 1.5"' : ''}><title>${o.year}: ${fmt(val(o))}</title></circle>`);
  }
  for (const y of [x0, 2012, x1].filter((y, k, a) => a.indexOf(y) === k && y >= x0 && y <= x1)) parts.push(`<text x="${X(y)}" y="${H - 10}" text-anchor="middle" font-size="11" font-family="IBM Plex Mono" fill="${INK3}">${y}</text>`);
  const cap = `<p class="hint" style="margin:0 0 6px">${MONTHS_LONG[p.cal - 1]} in every year${partial ? `, days 1–${atlas.meta.current_month.elapsed_days} only` : ''}, cell-days. Shaded band: historical reference range (10th–90th percentile); dashed line: median. Hollow dots: estimated from Aqua MODIS; large orange dot: selected month${p.conv ? ', with its sensor-conversion range' : ''}.</p>`;
  host.innerHTML = cap + `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${MONTHS_LONG[p.cal - 1]} values for every year in this area, with the selected year highlighted.">${parts.join('')}</svg>`;
}

function niceTicks(max: number, n: number) {
  const step0 = max / n, mag = 10 ** Math.floor(Math.log10(step0)), f = step0 / mag;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
  const out: number[] = []; for (let t = 0; t <= max; t += step) out.push(t); return out;
}

// ---------------- satellite switch ----------------
function renderSwitch() {
  const host = $('switch-chart'), W = Math.max(host.clientWidth, 300), small = W < 600, H = small ? 260 : 320;
  const m = { l: 52, r: small ? 12 : 215, t: 16, b: 30 };
  const a = annual(state.pts);
  if (a.length < 4) { host.innerHTML = ''; $('switch-text').textContent = ''; return; }
  const ymax = Math.max(...a.map((d) => Math.max(d.harmonized, d.raw, d.aqua)), 1) * 1.08;
  const xs = a.map((d) => d.year), x0 = Math.min(...xs), x1 = Math.max(...xs);
  const X = (y: number) => m.l + ((y - x0) / (x1 - x0)) * (W - m.l - m.r), Y = (v: number) => H - m.b - (v / ymax) * (H - m.t - m.b);
  const line = (k: 'harmonized' | 'raw' | 'aqua') => a.map((d, i) => `${i ? 'L' : 'M'}${X(d.year).toFixed(1)} ${Y(d[k]).toFixed(1)}`).join(' ');
  const parts: string[] = [];
  for (const t of niceTicks(ymax, 4)) parts.push(`<line x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}" stroke="${RULE}" stroke-width="0.6"/><text x="${m.l - 6}" y="${Y(t) + 4}" text-anchor="end" font-size="11" font-family="IBM Plex Mono" fill="${INK3}">${fmt(t)}</text>`);
  parts.push(`<line x1="${X(2011.5)}" x2="${X(2011.5)}" y1="${m.t}" y2="${H - m.b}" stroke="${INK}" stroke-dasharray="2 3"/><text x="${X(2011.5) + 5}" y="${m.t + 10}" font-size="11" fill="${INK2}">VIIRS starts (2012)</text>`);
  parts.push(`<path d="${line('raw')}" fill="none" stroke="#8f8a7e" stroke-width="2"/>`);
  parts.push(`<path d="${line('aqua')}" fill="none" stroke="${INK}" stroke-width="1.6" stroke-dasharray="5 3"/>`);
  parts.push(`<path d="${line('harmonized')}" fill="none" stroke="${ACCENT}" stroke-width="2.4"/>`);
  for (const d of a) parts.push(`<circle cx="${X(d.year)}" cy="${Y(d.harmonized)}" r="2.6" fill="${ACCENT}"><title>${d.year}: harmonized ${fmt(d.harmonized)}, joined raw ${fmt(d.raw)}, Aqua alone ${fmt(d.aqua)}</title></circle>`);
  const tk: number[] = []; for (const y of [x0, 2005, 2010, 2015, 2020, x1]) if (y >= x0 && y <= x1 && tk.every((t) => Math.abs(X(t) - X(y)) > 44)) tk.push(y);
  for (const y of tk) parts.push(`<text x="${X(y)}" y="${H - 10}" text-anchor="middle" font-size="11" font-family="IBM Plex Mono" fill="${INK3}">${y}</text>`);
  const last = a[a.length - 1];
  if (!small) {
    const lab = [{ k: 'harmonized' as const, t: 'ARGALLAX harmonized', c: ACCENT }, { k: 'raw' as const, t: 'Simply joined (same after 2012)', c: '#6f6a5e' }, { k: 'aqua' as const, t: 'Aqua MODIS alone', c: INK }];
    const ys = lab.map((l) => ({ ...l, y: Y(last[l.k]) })).sort((p, q) => p.y - q.y);
    for (let i = 1; i < ys.length; i++) if (ys[i].y - ys[i - 1].y < 14) ys[i].y = ys[i - 1].y + 14;
    for (const l of ys) parts.push(`<text x="${W - m.r + 8}" y="${l.y + 4}" font-size="12" fill="${l.c}">${l.t}</text>`);
  }
  const legend = small ? `<div class="legend"><span class="item" style="color:${ACCENT}">━ ARGALLAX harmonized</span><span class="item">━ satellites simply joined (grey; same as harmonized after 2012)</span><span class="item">╍ Aqua MODIS alone</span></div>` : '';
  host.innerHTML = `<p class="hint" style="margin:0 0 4px">Yearly totals, cell-days, full years only</p><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Yearly totals for this area: satellites simply joined jump in 2012; Aqua alone and the harmonized record do not.">${parts.join('')}</svg>${legend}`;
  // finding text for this area (2003–2011 vs 2013–2021 means, full years)
  const mean = (k: 'harmonized' | 'raw' | 'aqua', y0: number, y1: number) => { const v = a.filter((d) => d.year >= y0 && d.year <= y1); return v.length ? v.reduce((t, d) => t + d[k], 0) / v.length : NaN; };
  const r = mean('raw', 2013, 2021) / mean('raw', 2003, 2011), aq = mean('aqua', 2013, 2021) / mean('aqua', 2003, 2011), h = mean('harmonized', 2013, 2021) / mean('harmonized', 2003, 2011);
  const f = (x: number) => (isFinite(x) ? x.toFixed(1) + '×' : 'n/a');
  let txt = `In this area, the simply joined record changes ${f(r)} from 2003–2011 to 2013–2021 (yearly averages). Aqua MODIS alone, the same instrument across both periods, changes ${f(aq)}. `;
  if (mean('aqua', 2003, 2011) < 20) txt += 'Aqua detected too little here to judge.';
  else if (r >= 2 && aq <= 1.5) txt += 'So the jump in the joined record is a sensor artifact. (The harmonized record, ' + f(h) + ', follows Aqua by construction; it is a consistency check, not separate evidence.)';
  else if (aq > 1.5) txt += 'Detections rose on the older satellite too, so the change is not only a sensor artifact. Detections are not fire counts.';
  else txt += 'The satellite switch does not create a large jump here.';
  $('switch-text').textContent = txt;
}

// ---------------- trust ----------------
function renderTrust() {
  const M = atlas.meta, V = M.validation, ft = V.final_test, L = M.labels;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  $('trust').innerHTML = `
  <div>
    <h3 style="margin-top:0">What was tested</h3>
    <div class="stat"><span class="n">${pct(ft.regional_error_raw)} → ${pct(ft.regional_error_harmonized)}</span><span>Difference from S-NPP VIIRS in regional monthly totals, raw Aqua vs ARGALLAX, on 18 months not used for fitting or method selection (Jan 2020 – Jun 2021).</span>
    <span class="n">${pct(1 - ft.whole_area_ratio_raw)} → ${pct(1 - ft.whole_area_ratio_harmonized)}</span><span>How far the whole-area total fell short of S-NPP: raw Aqua vs ARGALLAX, same months.</span>
    <span class="n">+${pct(V.bridge.whole_area_ratio_noaa20_over_snpp - 1)}</span><span>NOAA-20 against S-NPP, whole-area totals 2022 – Jul 2026 (1–7% by year): within the preregistered 5% tolerance.</span></div>
    <h3>How</h3>
    <p>Aqua MODIS counts are scaled to the S-NPP VIIRS scale with eight ratios (four latitude bands × two seasons) fitted on 2012–2017. The test design, periods, scoring and success rule were written down before any model was fitted. ${esc(L.selection_amendment)} ${esc(L.not_better_than_one_ratio)}</p>
    <p>Sensor-conversion ranges (Aqua years only). Whole area: ${esc(M.intervals.whole_area.label)} Regions: ${esc(M.intervals.region.label)} Other boxes: approximate, not validated at that size. The historical reference range used for “unusual” months is descriptive and separate from these.</p>
    <p><a href="${REPO}/blob/main/analysis/PREREGISTRATION.md">Preregistration</a> · <a href="${REPO}/blob/main/analysis/RESULTS_SUMMARY.md">Results</a> · <a href="${REPO}/blob/main/analysis/SCIENCE_REVIEW.md">Independent science review</a> · <a href="${REPO}">Code and data pipeline</a></p>
  </div>
  <div>
    <h3 style="margin-top:0">Limits</h3>
    <ul>
      <li>${esc(L.what_it_measures)} ${esc(L.agreement_scope)}</li>
      <li>${esc(L.zero)}</li>
      <li>${esc(L.clouds)}</li>
      <li>The improvement is for regional and whole-area totals. For single 0.25° cells the scaled record was no closer to S-NPP than raw Aqua. No minimum area size is validated.</li>
      <li>${esc(L.pre2012)}</li>
      <li>${esc(L.bridged_month)}</li>
      <li>${esc(L.drift)}</li>
      <li>${esc(L.provisional_month)}</li>
      <li>${esc(M.regions_note)} ${esc(M.aoi_notice)}</li>
    </ul>
  </div>`;
}

// ---------------- downloads ----------------
function download(name: string, text: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const boxTag = () => `${state.box.s}-${state.box.n}N_${state.box.w}-${state.box.e}E`;
function headerLines() {
  const b = state.box, M = atlas.meta;
  return [`# ARGALLAX export. ${M.aoi_notice}`, `# Area: ${state.scopeName}, ${b.s}-${b.n} N, ${b.w}-${b.e} E (snapped to 0.25 deg grid; cells counted by centre)`,
    `# Unit: ${M.unit}. Detections are not fire counts or burned area. Source: NASA FIRMS. ${M.credits.ai}`];
}
function downloadCalendar() {
  const rows = state.pts.filter((p) => p.year >= state.y0 && p.year <= state.y1);
  const lines = [...headerLines(), '# value: main series on the S-NPP VIIRS scale. reference range: 10th-90th percentile of the same month in other years (descriptive). conversion range: Aqua-era sensor-conversion range.',
    'month,satellite,kind,status,complete,value_cell_days,aqua_raw_cell_days,conversion_range_low,conversion_range_high,reference_p10,reference_median,reference_p90,reference_years,reference_days_1_to_n,flag'];
  for (const p of rows) {
    lines.push([p.month, atlas.meta.sensors.find((s) => s.key === p.era.sensor)!.name, p.era.kind, p.era.status, p.era.complete, shown(p).toFixed(2), p.aquaRaw,
      p.conv ? p.conv.lo.toFixed(2) : '', p.conv ? p.conv.hi.toFixed(2) : '', p.ref ? p.ref.p10.toFixed(2) : '', p.ref ? p.ref.p50.toFixed(2) : '', p.ref ? p.ref.p90.toFixed(2) : '',
      p.ref ? p.ref.n : '', p.ref?.early ? atlas.meta.current_month.elapsed_days : '', p.flag && p.provisional && p.flag !== 'within' ? `${p.flag} (provisional, not confirmed)` : (p.flag ?? '')].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','));
  }
  download(`argallax_calendar_${boxTag()}_${state.y0}-${state.y1}.csv`, lines.join('\n') + '\n');
}
function hotYears() { return atlas.meta.files.hotspots_by_year.filter((y) => +y >= state.y0 && +y <= state.y1); }
function renderDownloadHint() {
  const bytes = hotYears().reduce((t, y) => t + (atlas.meta.files.hotspots_bytes?.[y] ?? 0), 0);
  $('dl-hot-hint').textContent = `Individual detections from all three satellites inside your box, ${state.y0}–${state.y1}, each row labeled by satellite and status. Fetches about ${(bytes / 1e6).toFixed(0)} MB before filtering.`;
}
async function downloadHotspots() {
  const years = hotYears(), b = state.box, st = $('dl-status');
  const out: string[] = [...headerLines()];
  let header = '', n = 0;
  for (const [k, y] of years.entries()) {
    st.textContent = `Fetching ${y} (${k + 1} of ${years.length})…`;
    const text = await fetch(`./data/hotspots/${y}.csv`).then((r) => r.text());
    const lines = text.split('\n');
    let i = 0;
    while (lines[i]?.startsWith('#')) { if (!header && k === 0) out.push(lines[i]); i++; }
    if (!header) { header = lines[i]; out.push(header); }
    for (i = i + 1; i < lines.length; i++) {
      const l = lines[i]; if (!l) continue;
      const c = l.split(','), la = +c[2], lo = +c[3];
      if (la >= b.s && la <= b.n && lo >= b.w && lo <= b.e) { out.push(l); n++; }
    }
  }
  download(`argallax_hotspots_${boxTag()}_${state.y0}-${state.y1}.csv`, out.join('\n') + '\n');
  st.textContent = `Downloaded ${n.toLocaleString('en-US')} detections.`;
}

// ---------------- map ----------------
function boxGeo(b: Box) { return { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [[[b.w, b.s], [b.e, b.s], [b.e, b.n], [b.w, b.n], [b.w, b.s]]] } }; }
function cellsGeo() {
  // average yearly S-NPP daytime cell-days per cell, 2013–2025 (full archive years)
  const C = atlas.cells, R = C.rows, tot = new Float64Array(C.cells.length);
  for (let k = 0; k < R.s.length; k++) if (R.s[k] === 1 && R.d[k] === 0) { const m = C.months[R.m[k]]; if (m >= '2013-01' && m <= '2025-12') tot[R.c[k]] += R.v[k]; }
  const feats = C.cells.map((_, i) => ({ type: 'Feature' as const, properties: { v: tot[i] / 13 }, geometry: boxGeo(atlas.cellBox(i)).geometry })).filter((f) => f.properties.v > 0);
  const max = Math.max(...feats.map((f) => f.properties.v));
  return { fc: { type: 'FeatureCollection' as const, features: feats }, max };
}
function hasWebGL2() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

/** Fallback map without WebGL: same layers drawn as SVG, no zoom; box drawing still works. */
function initSvgMap(reason: string) {
  const host = $('map'), aoi = atlas.aoiBox(), { fc, max } = cellsGeo();
  host.classList.add('svgmap');
  host.setAttribute('role', 'img');
  host.setAttribute('aria-label', 'Simplified map of the screening area with hotspot shading and the selected box.');
  let land: any = null;
  fetch('./land.json').then((r) => r.json()).then((d) => { land = d; draw(); }).catch(() => {});
  const view = { w: aoi.w - 0.3, e: aoi.e + 0.3, s: aoi.s - 0.2, n: aoi.n + 0.2 };
  const kx = Math.cos(((view.s + view.n) / 2) * Math.PI / 180);
  let P = (lon: number, lat: number): [number, number] => [lon, lat];
  let inv = (x: number, y: number) => ({ lng: x, lat: y });
  let drawing = false, start: { lng: number; lat: number } | null = null, draft: Box | null = null;
  const rect = (b: Box) => { const [x0, y0] = P(b.w, b.n), [x1, y1] = P(b.e, b.s); return `x="${x0}" y="${y0}" width="${Math.max(x1 - x0, 0)}" height="${Math.max(y1 - y0, 0)}"`; };
  function draw() {
    const W = host.clientWidth || 600, H = host.clientHeight || 470, pad = 10, bottom = 26;
    const vw = (view.e - view.w) * kx, vh = view.n - view.s;
    const sc = Math.min((W - 2 * pad) / vw, (H - pad - bottom) / vh);
    const ox = (W - vw * sc) / 2, oy = pad + (H - pad - bottom - vh * sc) / 2;
    P = (lon, lat) => [ox + (lon - view.w) * kx * sc, oy + (view.n - lat) * sc];
    inv = (x, y) => ({ lng: view.w + (x - ox) / (kx * sc), lat: view.n - (y - oy) / sc });
    const parts: string[] = [`<rect width="${W}" height="${H}" fill="#d9e1e3"/>`];
    if (land) {
      const d = land.features[0].geometry.coordinates.map((poly: number[][][]) => poly.map((ring) => 'M' + ring.map(([x, y]) => P(x, y).map((v) => v.toFixed(1)).join(' ')).join('L') + 'Z').join('')).join('');
      parts.push(`<path d="${d}" fill="#f8f6f0" stroke="none"/>`);
    }
    for (const f of fc.features) {
      const g = f.geometry.coordinates[0]; const b = { w: g[0][0], s: g[0][1], e: g[2][0], n: g[2][1] };
      parts.push(`<rect ${rect(b)} fill="${seq(f.properties.v, max)}" fill-opacity="0.72"/>`);
    }
    if (land) {
      const d = land.features[0].geometry.coordinates.map((poly: number[][][]) => poly.map((ring) => 'M' + ring.map(([x, y]) => P(x, y).map((v) => v.toFixed(1)).join(' ')).join('L') + 'Z').join('')).join('');
      parts.push(`<path d="${d}" fill="none" stroke="#5f5a4f" stroke-width="0.8"/>`);
    }
    parts.push(`<rect ${rect(aoi)} fill="none" stroke="${INK2}" stroke-dasharray="4 3"/>`);
    parts.push(`<rect ${rect(state.box)} fill="${ACCENT}" fill-opacity="0.05" stroke="${ACCENT}" stroke-width="2.2"/>`);
    if (draft) parts.push(`<rect ${rect(draft)} fill="none" stroke="${INK}" stroke-width="1.5" stroke-dasharray="4 4"/>`);
    parts.push(`<rect x="0" y="${H - 20}" width="${W}" height="20" fill="${PAPER}" fill-opacity="0.85"/><text x="6" y="${H - 6}" font-size="11" fill="${INK2}">${W < 560 ? 'Simplified map (no zoom) · Natural Earth · NASA FIRMS' : `Simplified map (${esc(reason)}). Land: Natural Earth · Hotspots: NASA FIRMS`}</text>`);
    host.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;touch-action:${drawing ? 'none' : 'auto'}">${parts.join('')}</svg>`;
  }
  const toLL = (ev: PointerEvent) => { const r = host.getBoundingClientRect(); return inv(ev.clientX - r.left, ev.clientY - r.top); };
  const box = (a: { lng: number; lat: number }, b: { lng: number; lat: number }): Box => ({ w: Math.min(a.lng, b.lng), e: Math.max(a.lng, b.lng), s: Math.min(a.lat, b.lat), n: Math.max(a.lat, b.lat) });
  const btn = $('draw-btn');
  btn.addEventListener('click', () => { drawing = !drawing; btn.setAttribute('aria-pressed', String(drawing)); host.classList.toggle('drawing', drawing); draw(); });
  host.addEventListener('pointerdown', (ev) => { if (!drawing) return; start = toLL(ev); host.setPointerCapture(ev.pointerId); ev.preventDefault(); });
  host.addEventListener('pointermove', (ev) => { if (!drawing || !start) return; draft = box(start, toLL(ev)); draw(); });
  host.addEventListener('pointerup', (ev) => {
    if (!drawing || !start) return; const b = box(start, toLL(ev)); start = null; draft = null;
    drawing = false; btn.setAttribute('aria-pressed', 'false'); host.classList.remove('drawing');
    state.sel = -1; setBox(b, 'Custom box');
  });
  window.addEventListener('resize', () => draw());
  svgMap = { draw };
  draw();
}

function initMap() {
  if (!hasWebGL2()) return initSvgMap('this browser has no WebGL2, so zoom is unavailable');
  try { initWebGLMap(); } catch (e) { map = undefined; $('map').innerHTML = ''; initSvgMap('the interactive map could not start'); }
}

function initWebGLMap() {
  maplibregl.setWorkerUrl(new URL('./maplibre-gl-worker.mjs', document.baseURI).href);
  const aoi = atlas.aoiBox(), { fc, max } = cellsGeo();
  const stops: any[] = []; for (let k = 0; k <= 6; k++) { const v = max * (k / 6) ** 2; stops.push(v, seq(v, max)); }
  const m = new maplibregl.Map({
    container: 'map', attributionControl: false, dragRotate: false, pitchWithRotate: false,
    style: {
      version: 8,
      sources: {
        land: { type: 'geojson', data: './land.json', attribution: 'Land outline: Natural Earth' },
        cells: { type: 'geojson', data: fc, attribution: 'Hotspots: NASA FIRMS' },
        aoi: { type: 'geojson', data: boxGeo(aoi) },
        sel: { type: 'geojson', data: boxGeo(state.box) },
        draft: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': '#d9e1e3' } },
        { id: 'land', type: 'fill', source: 'land', paint: { 'fill-color': '#f8f6f0' } },
        { id: 'cells', type: 'fill', source: 'cells', paint: { 'fill-color': ['interpolate', ['linear'], ['get', 'v'], ...stops], 'fill-opacity': 0.72 } },
        { id: 'coast', type: 'line', source: 'land', paint: { 'line-color': '#5f5a4f', 'line-width': 0.8 } },
        { id: 'aoi', type: 'line', source: 'aoi', paint: { 'line-color': INK2, 'line-width': 1, 'line-dasharray': [3, 2] } },
        { id: 'sel-fill', type: 'fill', source: 'sel', paint: { 'fill-color': ACCENT, 'fill-opacity': 0.05 } },
        { id: 'sel-line', type: 'line', source: 'sel', paint: { 'line-color': ACCENT, 'line-width': 2.2 } },
        { id: 'draft', type: 'line', source: 'draft', paint: { 'line-color': INK, 'line-width': 1.5, 'line-dasharray': [2, 2] } },
      ],
    },
    bounds: [[aoi.w - 0.6, aoi.s - 0.4], [aoi.e + 0.6, aoi.n + 0.4]],
  });
  map = m;
  m.on('load', () => m.fitBounds([[aoi.w - 0.3, aoi.s - 0.2], [aoi.e + 0.3, aoi.n + 0.2]], { padding: { top: 12, bottom: 30, left: 12, right: 12 }, duration: 0 }));
  m.addControl(new maplibregl.AttributionControl({ compact: false, customAttribution: 'Shading: average yearly S-NPP VIIRS hotspot cell-days, 2013–2025' }));
  m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  // box drawing
  const btn = $('draw-btn'); let drawing = false, start: maplibregl.LngLat | null = null;
  const setMode = (on: boolean) => { drawing = on; btn.setAttribute('aria-pressed', String(on)); $('map').classList.toggle('drawing', on); on ? m.dragPan.disable() : m.dragPan.enable(); };
  btn.addEventListener('click', () => setMode(!drawing));
  const canvas = m.getCanvasContainer();
  const toLL = (ev: PointerEvent) => { const r = canvas.getBoundingClientRect(); return m.unproject([ev.clientX - r.left, ev.clientY - r.top]); };
  canvas.addEventListener('pointerdown', (ev: PointerEvent) => { if (!drawing) return; start = toLL(ev); canvas.setPointerCapture(ev.pointerId); ev.preventDefault(); });
  canvas.addEventListener('pointermove', (ev: PointerEvent) => {
    if (!drawing || !start) return; const p = toLL(ev);
    (m.getSource('draft') as maplibregl.GeoJSONSource).setData(boxGeo({ w: Math.min(start.lng, p.lng), e: Math.max(start.lng, p.lng), s: Math.min(start.lat, p.lat), n: Math.max(start.lat, p.lat) }));
  });
  canvas.addEventListener('pointerup', (ev: PointerEvent) => {
    if (!drawing || !start) return; const p = toLL(ev);
    const b = { w: Math.min(start.lng, p.lng), e: Math.max(start.lng, p.lng), s: Math.min(start.lat, p.lat), n: Math.max(start.lat, p.lat) };
    start = null; (m.getSource('draft') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features: [] });
    setMode(false); state.sel = -1; setBox(b, 'Custom box');
  });
}
function updateMapSelection() {
  if (svgMap) return svgMap.draw();
  const s = map?.getSource('sel') as maplibregl.GeoJSONSource | undefined; s?.setData(boxGeo(state.box));
}

// ---------------- wiring ----------------
function renderAll() { renderSelection(); renderCalSummary(); renderCalendar(); renderMonth(); renderSwitch(); renderDownloadHint(); }

async function init() {
  await atlas.load();
  const M = atlas.meta;
  $('aoi-notice').textContent = `${M.aoi_notice} Hotspot detections are not fire counts or burned area. ${M.regions_note}`;
  // presets
  const pre = $('presets');
  const add = (label: string, fn: () => void) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.addEventListener('click', fn); pre.appendChild(b); };
  add('Whole screening area', () => { state.sel = -1; setBox(atlas.aoiBox()); });
  M.regions.forEach((r, i) => add(r.name, () => { state.sel = -1; setBox(atlas.regionBox(i)); }));
  // years
  const ys = Array.from({ length: 2026 - 2002 + 1 }, (_, k) => 2002 + k);
  for (const id of ['y0', 'y1']) { const s = $<HTMLSelectElement>(id); s.innerHTML = ys.map((y) => `<option>${y}</option>`).join(''); }
  $<HTMLSelectElement>('y0').value = '2002'; $<HTMLSelectElement>('y1').value = '2026';
  const onYears = () => {
    let a = +$<HTMLSelectElement>('y0').value, b = +$<HTMLSelectElement>('y1').value; if (a > b) [a, b] = [b, a];
    state.y0 = a; state.y1 = b; renderCalSummary(); renderCalendar(); renderDownloadHint();
  };
  $('y0').addEventListener('change', onYears); $('y1').addEventListener('change', onYears);
  $('apply-box').addEventListener('click', () => {
    const v = (k: string) => parseFloat(($(`in-${k}`) as HTMLInputElement).value);
    const b = { s: v('s'), n: v('n'), w: v('w'), e: v('e') };
    if ([b.s, b.n, b.w, b.e].some((x) => !isFinite(x))) return;
    state.sel = -1; setBox(b, 'Custom box');
  });
  const view = (v: 'counts' | 'anom') => { state.view = v; $('view-counts').setAttribute('aria-pressed', String(v === 'counts')); $('view-anom').setAttribute('aria-pressed', String(v === 'anom')); renderCalSummary(); renderCalendar(); };
  $('view-counts').addEventListener('click', () => view('counts')); $('view-anom').addEventListener('click', () => view('anom'));
  $('dl-calendar').addEventListener('click', downloadCalendar);
  $('dl-hotspots').addEventListener('click', () => downloadHotspots().catch((e) => ($('dl-status').textContent = 'Download failed: ' + e)));
  renderTrust();
  $('footer').innerHTML = `
    <p><strong>Data.</strong> ${esc(M.credits.data)} We acknowledge the use of data from NASA's Fire Information for Resource Management System (FIRMS) (<a href="${M.credits.citation_url}">${M.credits.citation_url}</a>), part of NASA's Earth Science Data and Information System (ESDIS). Land outline: Natural Earth (public domain), via world-atlas (ISC).</p>
    <p><strong>Software.</strong> MapLibre GL JS (BSD-3-Clause), d3-scale-chromatic (ISC), topojson-client (ISC), Vite (MIT). Type: IBM Plex Sans and Mono (SIL Open Font License 1.1).</p>
    <p><strong>AI disclosure.</strong> ARGALLAX was created by Kenneth Mejes for Project Sidequest, a solo entry in NASA Space Apps Challenge 2026. Development was AI-assisted, with the project direction, scientific decisions, and final accountability held by the creator.</p>
    <p>AI tools used: Claude (Anthropic); ChatGPT and Codex (OpenAI).</p>
    <p>Code licence: Apache-2.0. Not affiliated with or endorsed by NASA.</p>`;
  setBox(atlas.aoiBox());
  initMap();
  let t: number | undefined;
  window.addEventListener('resize', () => { clearTimeout(t); t = window.setTimeout(() => { renderCalendar(); renderMonth(); renderSwitch(); }, 150); });
}
init().catch((e) => { document.body.insertAdjacentHTML('afterbegin', `<p style="padding:16px">Could not load data: ${esc(String(e))}</p>`); });
