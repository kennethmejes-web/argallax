// ARGALLAX views of the shared store: context bar, area controls, record strip, year row, Classic calendar, month reading.
// AI-assisted code. Licensed under Apache-2.0.
import { interpolatePuOr } from 'd3-scale-chromatic';
import { MonthPoint, MONTHS, MONTHS_LONG, activeMonths, fmt } from './data';
import {
  $, atlas, cur, div, esc, isUnusual, kindText, monthLabel, niceTicks, onRender, openBench, presetIndex, provOutside, selectMonth, selectYear,
  sensorShort, seq, setBox, setMeasure, setSeries, setYears, shown, state, stepUnusual, swatch, verdict, elapsed,
  ACCENT, EST, INK, INK2, INK3, PAPER, PAPER2, RULE, SNPP,
} from './core';

const Y0 = 2002, Y1 = 2026, SLOTS = (Y1 - Y0 + 1) * 12;
const slot = (p: MonthPoint) => (p.year - Y0) * 12 + p.cal - 1;

// ---------------- context bar: where, when, what changed ----------------
let lastRev = -1;
function renderContext() {
  const p = cur(); if (!p) return;
  const v = verdict(p);
  $('ctx-where').textContent = state.scopeName;
  $('ctx-when').innerHTML = `${p.era.complete ? '' : `days 1–${elapsed()} · `}<span class="tab">${fmt(shown(p))}</span> cell-days · ${esc(v.short)} <span class="ctx-sat">· ${esc(sensorShort(p))}</span>`;
  const last = $('ctx-last');
  last.textContent = state.last;
  if (state.rev !== lastRev) {
    if (lastRev >= 0) { last.classList.remove('flash'); void last.offsetWidth; last.classList.add('flash'); }
    lastRev = state.rev;
  }
  ($('ctx-prev') as HTMLButtonElement).disabled = p.i === 0;
  ($('ctx-next') as HTMLButtonElement).disabled = p.i === state.pts.length - 1;
  $('view-living').setAttribute('aria-pressed', String(state.view === 'living'));
  $('view-classic').setAttribute('aria-pressed', String(state.view === 'classic'));
  document.documentElement.style.setProperty('--ctx-h', `${$('ctx').offsetHeight}px`);
}

// ---------------- area controls ----------------
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
  const pi = presetIndex();
  Array.from($('presets').querySelectorAll('button')).forEach((btn, i) => btn.setAttribute('aria-pressed', String(i === pi)));
  $('preset-custom').hidden = pi >= 0;
  for (const [k, v] of Object.entries({ s: b.s, n: b.n, w: b.w, e: b.e })) { const el = $<HTMLInputElement>(`in-${k}`); if (document.activeElement !== el) el.value = String(v); }
  for (const s of Array.from(document.querySelectorAll<HTMLSelectElement>('select.y0'))) s.value = String(state.y0);
  for (const s of Array.from(document.querySelectorAll<HTMLSelectElement>('select.y1'))) s.value = String(state.y1);
}
export function initControls() {
  const pre = $('presets'), M = atlas.meta;
  const add = (label: string, fn: () => void) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.addEventListener('click', fn); pre.appendChild(b); };
  add('Whole screening area', () => setBox(atlas.aoiBox()));
  M.regions.forEach((r, i) => add(r.name, () => setBox(atlas.regionBox(i))));
  const ys = Array.from({ length: Y1 - Y0 + 1 }, (_, k) => Y0 + k);
  for (const s of Array.from(document.querySelectorAll<HTMLSelectElement>('select.y0, select.y1'))) {
    s.innerHTML = ys.map((y) => `<option>${y}</option>`).join('');
    s.addEventListener('change', () => {
      const other = s.closest('.years')!.querySelector<HTMLSelectElement>(s.classList.contains('y0') ? 'select.y1' : 'select.y0')!;
      s.classList.contains('y0') ? setYears(+s.value, +other.value) : setYears(+other.value, +s.value);
    });
  }
  $('apply-box').addEventListener('click', () => {
    const v = (k: string) => parseFloat($<HTMLInputElement>(`in-${k}`).value);
    const b = { s: v('s'), n: v('n'), w: v('w'), e: v('e') };
    if ([b.s, b.n, b.w, b.e].some((x) => !isFinite(x))) return;
    setBox(b, 'Custom box');
  });
}

// ---------------- summary sentence (both views) ----------------
export function summaryHtml() {
  const act = activeMonths(state.pts, state.y0, state.y1).filter((a) => a.median > 0);
  if (!act.length) return `<p>${esc(atlas.meta.labels.zero)}</p>`;
  const inR = state.pts.filter((p) => p.year >= state.y0 && p.year <= state.y1);
  const above = inR.filter((p) => !p.provisional && p.flag === 'above').length, below = inR.filter((p) => !p.provisional && p.flag === 'below').length;
  const prov = inR.filter(provOutside).length;
  const top = act.slice(0, 3).map((a) => `<strong>${MONTHS_LONG[a.cal - 1]}</strong> (<span class="tab">${fmt(a.median)}</span>)`).join(', ');
  return `<p>In this area the most active months are usually ${top}: typical cell-days per month, ${state.y0}–${state.y1}. ${above} confirmed months are above and ${below} below their historical reference range.${prov ? ` ${prov} provisional month${prov > 1 ? 's are' : ' is'} currently outside the range and not counted.` : ''}</p>`;
}

// ---------------- Living View: record strip ----------------
interface Strip { W: number; bars: SVGRectElement[]; max: number }
let strip: Strip | undefined;
const stripGeo = (W: number) => ({ top: 40, h: W < 600 ? 74 : 96, sw: W / SLOTS });
function buildStrip() {
  const host = $('strip'), W = Math.max(host.clientWidth, 280), g = stripGeo(W), small = W < 600;
  const base = g.top + g.h, H = base + 20 + 12 + 18;
  const parts: string[] = [];
  parts.push(`<rect id="strip-year" class="strip-year" y="${g.top - 16}" height="${g.h + 16 + 19}" width="${g.sw * 12}" x="0"/>`);
  parts.push(`<line x1="0" x2="${W}" y1="${base}" y2="${base}" stroke="${INK}" stroke-width="1"/>`);
  parts.push('<g id="strip-flags"></g>');
  parts.push(state.pts.map((p) => `<rect class="bar ${p.era.kind === 'harmonized' ? 'est' : p.provisional ? 'prov' : 'obs'}" data-i="${p.i}" x="${(slot(p) * g.sw + (g.sw > 2 ? 0.3 : 0)).toFixed(2)}" y="${g.top}" width="${Math.max(g.sw - (g.sw > 2 ? 0.6 : 0), 0.9).toFixed(2)}" height="${g.h}"/>`).join(''));
  // year labels
  const every = small ? 4 : 2;
  for (let y = Y0; y <= Y1; y++) {
    const x = (y - Y0) * 12 * g.sw;
    parts.push(`<line x1="${x}" x2="${x}" y1="${base}" y2="${base + (y % every === 0 ? 5 : 3)}" stroke="${INK3}" stroke-width="0.8"/>`);
    if (y % every === 0) parts.push(`<text class="strip-yl" data-y="${y}" x="${x + 6 * g.sw}" y="${base + 15}" text-anchor="middle" font-size="${small ? 10 : 11}" font-family="IBM Plex Mono, monospace" fill="${INK3}">${y}</text>`);
  }
  parts.push(`<text id="strip-ysel" y="${g.top - 20}" text-anchor="middle" font-size="12" font-weight="600" font-family="IBM Plex Mono, monospace" fill="${INK}"></text>`);
  // satellite band
  const by = base + 20;
  const ex = (m: string, end: boolean) => ((+m.slice(0, 4) - Y0) * 12 + +m.slice(5, 7) - 1 + (end ? 1 : 0)) * g.sw;
  parts.push(`<defs><pattern id="s-est" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="${INK}" stroke-opacity="0.4" stroke-width="1.2"/></pattern></defs>`);
  for (const e of atlas.meta.era_summary) {
    const a = ex(e.from, false), b = ex(e.to, true);
    parts.push(`<rect x="${a}" y="${by}" width="${b - a}" height="10" fill="${e.sensor === 'aqua' ? 'url(#s-est)' : e.sensor === 'snpp' ? SNPP : INK2}" stroke="${INK}" stroke-width="0.6"/>`);
  }
  const sx = ex('2012-02', false);
  parts.push(`<line x1="${sx}" x2="${sx}" y1="${g.top - 14}" y2="${by + 12}" stroke="${INK}" stroke-width="1" stroke-dasharray="2 3"/>`);
  parts.push(`<text x="${sx}" y="${by + 24}" text-anchor="middle" font-size="11" fill="${INK2}">↑ the satellite changes here, Feb 2012</text>`);
  parts.push(`<rect id="strip-hover" class="strip-hover" y="${g.top - 16}" height="${g.h + 16}" width="${Math.max(g.sw + 2, 3)}" x="0" visibility="hidden"/>`);
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="slider" tabindex="0" aria-label="Month in the record. Left and right arrow keys move by month, up and down by year." aria-valuemin="0" aria-valuemax="${state.pts.length - 1}">${parts.join('')}</svg>`;
  const svg = host.querySelector('svg')!;
  strip = { W, bars: Array.from(svg.querySelectorAll<SVGRectElement>('rect.bar')), max: 1 };
  const first = slot(state.pts[0]);
  const monthAt = (ev: PointerEvent) => { const r = svg.getBoundingClientRect(); return Math.max(0, Math.min(state.pts.length - 1, Math.floor(((ev.clientX - r.left) / r.width) * SLOTS) - first)); };
  let dragging = false;
  svg.addEventListener('pointerdown', (ev) => { dragging = true; try { svg.setPointerCapture(ev.pointerId); } catch { /* ignore */ } selectMonth(monthAt(ev)); });
  svg.addEventListener('pointermove', (ev) => {
    if (dragging) return selectMonth(monthAt(ev), true);
    if (ev.pointerType !== 'mouse') return;
    const hv = $('strip-hover') as unknown as SVGRectElement; hv.setAttribute('x', String(slot(state.pts[monthAt(ev)]) * g.sw - 1)); hv.setAttribute('visibility', 'visible');
  });
  const end = () => { dragging = false; };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  svg.addEventListener('pointerleave', () => ($('strip-hover') as unknown as SVGRectElement).setAttribute('visibility', 'hidden'));
  svg.addEventListener('keydown', (ev) => {
    const p = cur(); if (!p) return;
    const d: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -12, ArrowDown: 12, PageUp: -12, PageDown: 12, Home: -9999, End: 9999 };
    if (!(ev.key in d)) return;
    ev.preventDefault(); selectMonth(p.i + d[ev.key]);
  });
}
const sv = (p: MonthPoint) => (state.series === 'raw' ? (p.era.complete ? p.rawStitched : p.early) : shown(p));
function renderStrip() {
  const host = $('strip'); if (!host.clientWidth) return;
  if (!strip || strip.W !== Math.max(host.clientWidth, 280) || strip.bars.length !== state.pts.length) buildStrip();
  const S = strip!, g = stripGeo(S.W), p = cur()!;
  // one scale for the area, shared by both series, so that switching series shows the real difference
  const max = Math.max(...state.pts.map(shown), 1);
  state.pts.forEach((o, k) => {
    const el = S.bars[k], f = Math.min(sv(o) / max, 1);
    el.style.transform = `scaleY(${f > 0 ? Math.max(f, 1.2 / g.h) : 0})`;
    el.classList.toggle('sel', o.i === p.i);
    el.classList.toggle('raw', state.series === 'raw' && o.era.kind === 'harmonized');
  });
  const x = (p.year - Y0) * 12 * g.sw;
  ($('strip-year') as unknown as SVGRectElement).style.transform = `translateX(${x}px)`;
  const ys = $('strip-ysel') as unknown as SVGTextElement;
  ys.textContent = `${MONTHS[p.cal - 1]} ${p.year}`;
  ys.setAttribute('x', String(Math.max(30, Math.min(S.W - 30, x + 6 * g.sw))));
  // confirmed months outside their reference range: ticks above the bars (harmonized series only)
  const fl: string[] = [];
  if (state.series === 'harm') for (const o of state.pts) if (isUnusual(o)) {
    const fx = slot(o) * g.sw, w = Math.max(g.sw - 0.4, 1.2);
    fl.push(o.flag === 'above' ? `<rect x="${fx}" y="${g.top - 12}" width="${w}" height="5" fill="${INK}"/>` : `<rect x="${fx + 0.4}" y="${g.top - 6}" width="${Math.max(w - 0.8, 0.8)}" height="4" fill="${PAPER}" stroke="${INK}" stroke-width="0.8"/>`);
  }
  $('strip-flags').innerHTML = fl.join('');
  const svg = host.querySelector('svg')!;
  svg.setAttribute('aria-valuenow', String(p.i)); svg.setAttribute('aria-valuetext', `${monthLabel(p)}, ${fmt(sv(p))} cell-days, ${state.scopeName}`);
  $('strip-cap').innerHTML = `Every month, ${Y0}–${Y1}, one scale. Drag to scrub. ${state.series === 'raw' ? '<strong>As recorded:</strong> the step at Feb 2012 is the satellite.' : 'Before Feb 2012: estimated.'}`;
  $('strip-legend').innerHTML = [
    `<span class="item">${swatch(`<rect width="22" height="12" fill="${PAPER2}"/><rect width="22" height="12" fill="url(#s-est)" stroke="${INK}" stroke-width="0.6"/>`, 22, 12)} Aqua MODIS → estimated VIIRS-equivalent, Aug 2002 – Jan 2012</span>`,
    `<span class="item">${swatch(`<rect width="22" height="12" fill="${SNPP}" stroke="${INK}" stroke-width="0.6"/>`, 22, 12)} S-NPP VIIRS (reference), Feb 2012 – Jul 2026</span>`,
    `<span class="item">${swatch(`<rect width="22" height="12" fill="${INK2}" stroke="${INK}" stroke-width="0.6"/>`, 22, 12)} NOAA-20 VIIRS, from Aug 2026 (provisional)</span>`,
    state.series === 'harm' ? `<span class="item">${swatch(`<rect x="3" y="1" width="5" height="5" fill="${INK}"/><rect x="13" y="8" width="5" height="4" fill="${PAPER}" stroke="${INK}"/>`)} confirmed month above / below its historical reference range</span>` : '',
  ].join('');
  for (const b of Array.from($('series-toggle').querySelectorAll('button'))) b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.v === state.series));
}

// ---------------- Living View: the twelve months of the selected year ----------------
let yearBuilt = false;
function buildYear() {
  $('yearrow').innerHTML = MONTHS.map((m, k) => `<button type="button" class="mcol" data-cal="${k + 1}">
    <span class="mval tab"></span><span class="mplot"><span class="mref"></span><span class="mmed"></span><span class="mbar"></span></span><span class="mflag" aria-hidden="true"></span><span class="mname">${m}</span></button>`).join('');
  $('yearrow').addEventListener('click', (ev) => {
    const b = (ev.target as Element).closest<HTMLElement>('.mcol'); if (!b || b.hasAttribute('disabled')) return;
    const p = cur()!; const o = state.pts.find((q) => q.year === p.year && q.cal === +b.dataset.cal!); if (o) selectMonth(o.i);
  });
  $('yearrow').addEventListener('keydown', (ev) => {
    const p = cur(); if (!p) return;
    const d: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -12, ArrowDown: 12 };
    if (!(ev.key in d)) return;
    ev.preventDefault(); selectMonth(p.i + d[ev.key]);
    $('yearrow').querySelector<HTMLElement>(`.mcol[data-cal="${cur()!.cal}"]`)?.focus();
  });
  $('yr-prev').addEventListener('click', () => selectYear(cur()!.year - 1));
  $('yr-next').addEventListener('click', () => selectYear(cur()!.year + 1));
  $('un-prev').addEventListener('click', () => stepUnusual(-1));
  $('un-next').addEventListener('click', () => stepUnusual(1));
  for (const b of Array.from($('series-toggle').querySelectorAll<HTMLElement>('button'))) b.addEventListener('click', () => setSeries(b.dataset.v as 'harm' | 'raw'));
  yearBuilt = true;
}
function renderYear() {
  if (!yearBuilt) buildYear();
  const p = cur(); if (!p) return;
  const raw = state.series === 'raw';
  const max = Math.max(...state.pts.map((o) => Math.max(shown(o), o.ref?.p90 ?? 0)), 1) * 1.04;
  const pc = (v: number) => `${Math.min((v / max) * 100, 100).toFixed(2)}%`;
  $('yr-title').textContent = String(p.year);
  ($('yr-prev') as HTMLButtonElement).disabled = p.year <= Y0; ($('yr-next') as HTMLButtonElement).disabled = p.year >= Y1;
  for (const btn of Array.from($('yearrow').querySelectorAll<HTMLButtonElement>('.mcol'))) {
    const cal = +btn.dataset.cal!, o = state.pts.find((q) => q.year === p.year && q.cal === cal);
    const q = <T extends HTMLElement>(c: string) => btn.querySelector<T>(c)!;
    btn.classList.toggle('none', !o);
    if (!o) {
      btn.setAttribute('disabled', ''); btn.setAttribute('aria-label', `${MONTHS_LONG[cal - 1]} ${p.year}: outside the record`); btn.setAttribute('aria-pressed', 'false');
      q('.mval').textContent = ''; q('.mbar').style.height = '0'; q('.mref').style.opacity = '0'; q('.mmed').style.opacity = '0'; q('.mflag').textContent = ''; continue;
    }
    btn.removeAttribute('disabled');
    const v = sv(o), vd = verdict(o);
    btn.setAttribute('aria-pressed', String(o.i === p.i));
    btn.setAttribute('aria-label', `${monthLabel(o)}: ${fmt(v)} cell-days${raw ? ' as recorded' : `, ${vd.short}`}, ${sensorShort(o)}`);
    q('.mval').textContent = fmt(v);
    const bar = q('.mbar');
    bar.className = `mbar ${o.era.kind === 'harmonized' ? (raw ? 'est raw' : 'est') : o.provisional ? 'prov' : 'obs'}${o.era.complete ? '' : ' part'}`;
    bar.style.height = v > 0 ? `max(${pc(v)}, 2px)` : '0';
    const showRef = !raw && !!o.ref;
    q('.mref').style.opacity = showRef ? '1' : '0'; q('.mmed').style.opacity = showRef ? '1' : '0';
    if (o.ref) {
      q('.mref').style.bottom = pc(o.ref.p10); q('.mref').style.height = `max(${pc(o.ref.p90 - o.ref.p10)}, 1px)`;
      q('.mmed').style.bottom = pc(o.ref.p50);
    }
    const fl = q('.mflag');
    fl.textContent = raw ? '' : isUnusual(o) ? (o.flag === 'above' ? '▲' : '▽') : provOutside(o) ? '○' : v === 0 ? '·' : '';
    fl.title = raw ? '' : isUnusual(o) ? vd.text : provOutside(o) ? vd.text : '';
  }
  $('year-note').innerHTML = raw
    ? 'As recorded by each satellite. Reference ranges and flags are on the harmonized scale, so they are hidden here. Switch back to “Harmonized” to compare months with history.'
    : `Bars: cell-days per month. Shaded band: historical reference range (10th–90th percentile of the same month in other years); line: median. ▲ above, ▽ below (confirmed months only); ○ provisional month currently outside the range; · no detections.${p.era.kind === 'harmonized' || state.pts.some((o) => o.year === p.year && o.era.kind === 'harmonized') ? ' Hatched bars are estimated from Aqua MODIS.' : ''}${state.pts.some((o) => o.year === p.year && o.provisional) ? ' Dashed bars are provisional.' : ''}`;
  $('living-summary').innerHTML = summaryHtml();
}

// ---------------- Classic View: year × month calendar ----------------
export function renderCalendar() {
  const host = $('calendar'); if (!host.clientWidth) return;
  const W = Math.max(host.clientWidth, 300), small = W < 600;
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
      if (state.measure === 'counts') fill = v > 0 ? seq(v, max) : PAPER;
      else fill = p.ref ? div(v, p.ref.p50) : PAPER2;
      parts.push(`<rect class="cell" data-i="${p.i}" x="${x + 1}" y="${yy + 1}" width="${cw - 2}" height="${rh - 2}" fill="${fill}" stroke="${RULE}" stroke-width="0.5"/>`);
      if (v === 0 && state.measure === 'counts') parts.push(`<circle cx="${x + cw / 2}" cy="${yy + rh / 2}" r="1.6" fill="${INK3}" pointer-events="none"/>`);
      if (p.era.kind === 'harmonized') parts.push(`<rect x="${x + 1}" y="${yy + 1}" width="3" height="${rh - 2}" fill="var(--aqua)" pointer-events="none"/>`);
      if (p.provisional) parts.push(`<line x1="${x + 2}" x2="${x + cw - 2}" y1="${yy + rh - 3}" y2="${yy + rh - 3}" stroke="var(--ink)" stroke-width="2.5" stroke-dasharray="3 3" pointer-events="none"/>`);
      if (!p.era.complete) parts.push(`<rect x="${x + 1.5}" y="${yy + 1.5}" width="${cw - 3}" height="${rh - 3}" fill="none" stroke="${INK}" stroke-width="1.2" stroke-dasharray="3 2" pointer-events="none"/>`);
      if (state.measure === 'anom' && isUnusual(p)) {
        const tx = x + cw - 4, ty = yy + 3, s = Math.min(7, rh / 2.5);
        parts.push(p.flag === 'above'
          ? `<path d="M${tx - s} ${ty + s} L${tx} ${ty + s} L${tx - s / 2} ${ty} Z" fill="${INK}" stroke="${PAPER}" stroke-width="0.8" pointer-events="none"/>`
          : `<path d="M${tx - s} ${ty} L${tx} ${ty} L${tx - s / 2} ${ty + s} Z" fill="${PAPER}" stroke="${INK}" stroke-width="1.1" pointer-events="none"/>`);
      } else if (state.measure === 'anom' && provOutside(p)) {
        parts.push(`<circle cx="${x + cw - 8}" cy="${yy + rh / 2}" r="${Math.min(4, rh / 4)}" fill="${PAPER}" stroke="${INK}" stroke-width="1.2" stroke-dasharray="2 1.2" pointer-events="none"/>`);
      }
      if (p.i === state.sel) parts.push(`<rect x="${x}" y="${yy}" width="${cw}" height="${rh}" fill="none" stroke="${INK}" stroke-width="2.4" pointer-events="none"/>`);
      if (p.i === state.focus && p.i !== state.sel) parts.push(`<rect x="${x}" y="${yy}" width="${cw}" height="${rh}" fill="none" stroke="var(--focus)" stroke-width="2" pointer-events="none"/>`);
    }
  });
  const hadFocus = host.contains(document.activeElement);
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="grid" tabindex="0" aria-label="Hotspot calendar, years by months. Use arrow keys to move between months and Enter to open a month.">${parts.join('')}</svg>`;
  const svg = host.querySelector('svg')!;
  if (hadFocus) svg.focus({ preventScroll: true });
  svg.addEventListener('mousemove', (ev) => {
    const t = (ev.target as Element).closest('.cell') as SVGRectElement | null;
    if (!t) return hideTip();
    showTip(+t.dataset.i!, t);
  });
  svg.addEventListener('mouseleave', hideTip);
  svg.addEventListener('click', (ev) => {
    const t = (ev.target as Element).closest('.cell') as SVGRectElement | null;
    if (t) selectMonth(+t.dataset.i!);
  });
  svg.addEventListener('keydown', onCalKey);
  svg.addEventListener('focus', () => { if (state.focus < 0) state.focus = state.sel; });
  svg.addEventListener('blur', hideTip);
  renderLegend(max);
  renderProvenance(W, left);
  $('cal-summary').innerHTML = summaryHtml() + (state.measure === 'counts' ? ' <span class="fine">Choose “Compared with usual” to see which months they are.</span>' : '');
  $('cal-explain').textContent = state.measure === 'counts'
    ? 'Each square is one month. Brighter means hotspots were detected on more grid-cell-days (a 0.25° square on one day with at least one detection). All years are on the S-NPP VIIRS scale. Select a month to update the map and the single reading above.'
    : 'Each square compares a month with the median of the same month in other years: purple is more than usual, orange less, white typical. Select a month to update the map and the single reading above.';
  $('measure-counts').setAttribute('aria-pressed', String(state.measure === 'counts'));
  $('measure-anom').setAttribute('aria-pressed', String(state.measure === 'anom'));
}
function onCalKey(ev: KeyboardEvent) {
  const d: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -12, ArrowDown: 12 };
  const valid = state.pts.filter((p) => p.year >= state.y0 && p.year <= state.y1);
  if (!valid.length) return;
  const lo = valid[0].i, hi = valid[valid.length - 1].i;
  if (state.focus < lo || state.focus > hi) state.focus = state.sel >= lo && state.sel <= hi ? state.sel : hi;
  if (ev.key in d) { ev.preventDefault(); state.focus = Math.max(lo, Math.min(hi, state.focus + d[ev.key])); renderCalendar(); }
  else if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); selectMonth(state.focus); }
  else if (ev.key === 'Escape') { hideTip(); return; } else return;
  const svg = $('calendar').querySelector('svg') as SVGElement; svg.focus({ preventScroll: true });
  const r = svg.querySelector(`.cell[data-i="${state.focus}"]`) as SVGRectElement | null;
  if (r) showTip(state.focus, r);
}
function showTip(i: number, el: Element) {
  const p = state.pts[i], tip = $('tooltip'), sec = $('pane-classic');
  const v = shown(p), vd = verdict(p);
  const ref = p.ref ? `<br>Historical reference range: <span class="tab">${fmt(p.ref.p10)}–${fmt(p.ref.p90)}</span> · ${vd.confirmed && vd.kind !== 'within' ? `<strong style="display:inline">${vd.kind}</strong>` : esc(vd.short)}` : '';
  tip.innerHTML = `<strong>${monthLabel(p)}</strong><span class="tab">${fmt(v)}</span> cell-days<br>${kindText(p)}${p.provisional ? '<br><em>Provisional</em>' : ''}${ref}`;
  tip.hidden = false;
  const r = el.getBoundingClientRect(), s = sec.getBoundingClientRect();
  let x = r.left - s.left + r.width + 8; const y = r.top - s.top - 4;
  if (x + 300 > s.width) x = r.left - s.left - 8 - Math.min(300, tip.offsetWidth);
  tip.style.left = `${Math.max(0, x)}px`; tip.style.top = `${y}px`;
}
function hideTip() { $('tooltip').hidden = true; }
function renderLegend(max: number) {
  const items: string[] = [];
  if (state.measure === 'counts') {
    const stops = Array.from({ length: 11 }, (_, k) => `<stop offset="${k * 10}%" stop-color="${seq(max * (k / 10) ** 2, max)}"/>`).join('');
    items.push(`<span class="item">${swatch(`<defs><linearGradient id="lg">${stops}</linearGradient></defs><rect width="120" height="12" fill="url(#lg)" stroke="${RULE}"/>`, 120, 12)} <span class="tab">0 → ${fmt(max)}</span> cell-days per month</span>`);
    items.push(`<span class="item">${swatch(`<rect width="22" height="14" fill="${PAPER}" stroke="${RULE}"/><circle cx="11" cy="7" r="1.6" fill="${INK3}"/>`)} no detections (not proof of no fire)</span>`);
  } else {
    const stops = Array.from({ length: 11 }, (_, k) => `<stop offset="${k * 10}%" stop-color="${interpolatePuOr(1 - k / 10)}"/>`).join('');
    items.push(`<span class="item">${swatch(`<defs><linearGradient id="lg2">${stops}</linearGradient></defs><rect width="120" height="12" fill="url(#lg2)" stroke="${RULE}"/>`, 120, 12)} below median · typical · above median</span>`);
  }
  items.push(`<span class="item">${swatch(`<rect width="22" height="14" fill="${PAPER2}"/><rect width="3" height="14" fill="var(--aqua)"/>`)} estimated from Aqua MODIS (before Feb 2012): solid bar on the left</span>`);
  items.push(`<span class="item">${swatch(`<rect width="22" height="14" fill="${PAPER2}"/><line x1="1" x2="21" y1="11" y2="11" stroke="var(--ink)" stroke-width="2.5" stroke-dasharray="3 3"/>`)} provisional (near-real-time): dotted line along the bottom</span>`);
  if (state.measure === 'anom') { items.push(`<span class="item">${swatch(`<path d="M5 12 L15 12 L10 3 Z" fill="${INK}"/>`)} above / ${swatch(`<path d="M5 3 L15 3 L10 12 Z" fill="${PAPER}" stroke="${INK}"/>`)} below the historical reference range (confirmed months)</span>`);
  items.push(`<span class="item">${swatch(`<circle cx="11" cy="7" r="4" fill="${PAPER}" stroke="${INK}" stroke-width="1.2" stroke-dasharray="2 1.2"/>`)} provisional month currently outside the range (not counted)</span>`); }
  items.push(`<span class="item">${swatch(`<rect x="1" y="1" width="20" height="12" fill="none" stroke="${INK}" stroke-dasharray="3 2"/>`)} incomplete month</span>`);
  $('cal-legend').innerHTML = items.join('');
}
function renderProvenance(W: number, left: number) {
  const small = W < 600;
  const y0 = state.y0, y1 = state.y1 + 1, span = y1 - y0, wide = W - left - 2;
  const x = (m: string) => left + ((+m.slice(0, 4) + (+m.slice(5, 7) - 1) / 12 - y0) / span) * wide;
  const next = (m: string) => { const y = +m.slice(0, 4), k = +m.slice(5, 7); return k === 12 ? `${y + 1}-01` : `${y}-${String(k + 1).padStart(2, '0')}`; };
  const fills: Record<string, string> = { aqua: 'var(--aqua)', snpp: 'var(--viirs)', noaa20: 'color-mix(in srgb, var(--viirs) 55%, var(--paper))' };
  const names: Record<string, string> = { aqua: 'Aqua MODIS → estimated VIIRS-equivalent', snpp: 'S-NPP VIIRS (reference)', noaa20: 'NOAA-20 VIIRS (provisional)' };
  const parts: string[] = [], labels: string[] = [];
  for (const e of atlas.meta.era_summary) {
    const a = Math.max(x(e.from), left), b = Math.min(x(next(e.to)), left + wide);
    if (b <= a) continue;
    if (e.sensor === 'aqua') parts.push(`<rect x="${a}" y="0" width="${b - a}" height="12" fill="${PAPER2}"/>`);
    parts.push(`<rect x="${a}" y="0" width="${b - a}" height="12" fill="${fills[e.sensor]}"/>`);
    const sw = `<rect width="22" height="12" fill="${fills[e.sensor]}" stroke="${INK}" stroke-width="0.6"/>`;
    labels.push(`<span class="item">${swatch(sw, 22, 12)}<span>${names[e.sensor]} · ${e.from} to ${e.to}</span></span>`);
  }
  $('provenance').innerHTML = `<p class="hint" style="margin:0 0 4px ${left}px">Which satellite recorded each period</p><svg viewBox="0 0 ${W} 14" width="${W}" height="14" role="img" aria-label="Aqua MODIS from August 2002 to January 2012, S-NPP VIIRS from February 2012 to July 2026, NOAA-20 VIIRS from August 2026, provisional.">${parts.join('')}</svg><div class="legend prov-legend" style="margin-left:${small ? 0 : left}px;margin-top:4px">${labels.join('')}</div>`;
}

// ---------------- the month reading (both views) ----------------
let lastReadKey = '';
function renderReading() {
  const p = cur(); if (!p) return;
  const L = atlas.meta.labels, partial = !p.era.complete, v = shown(p), vd = verdict(p);
  const tags = [`<span class="tag">${p.era.kind === 'harmonized' ? 'estimated' : p.era.kind === 'observed' ? 'observed S-NPP' : 'NOAA-20'}</span>`];
  if (p.provisional) tags.push('<span class="tag prov">provisional</span>');
  if (partial) tags.push('<span class="tag prov">incomplete</span>');
  const rows: string[] = [];
  if (p.ref) rows.push(`<tr><th>Historical reference range<br><span class="hint">10th–90th percentile of ${MONTHS_LONG[p.cal - 1]} in ${p.ref.n} other years${p.ref.early ? `, days 1–${elapsed()} only` : ''}. Descriptive: not a prediction or a significance test.</span></th><td>${fmt(p.ref.p10)}–${fmt(p.ref.p90)}<br><span class="hint">median ${fmt(p.ref.p50)}</span></td></tr>`);
  if (p.conv) rows.push(`<tr><th>Sensor-conversion range<br><span class="hint">${esc(p.conv.label)} ${esc(atlas.meta.intervals.caveat)}</span></th><td>${fmt(p.conv.lo)}–${fmt(p.conv.hi)}</td></tr>`);
  const notes: string[] = [];
  const b = state.box, thr = atlas.meta.small_area_warning.threshold_deg;
  if (b.e - b.w < thr || b.n - b.s < thr) notes.push(atlas.meta.small_area_warning.label);
  if (p.era.kind === 'harmonized') notes.push(L.harmonized_month + ' ' + L.pre2012);
  if (p.era.kind === 'bridged') notes.push(L.bridged_month);
  if (p.provisional) notes.push(L.provisional_month);
  if (partial) notes.push(L.incomplete_month);
  if (v === 0) notes.push(L.zero);
  notes.push(L.clouds);
  $('month-text').innerHTML = `
    <div class="read-head"><h3>${esc(monthLabel(p))} · ${esc(state.scopeName)}</h3>
      <span class="read-nav"><button type="button" id="rd-prev" aria-label="Previous month" ${p.i === 0 ? 'disabled' : ''}>‹</button><button type="button" id="rd-next" aria-label="Next month" ${p.i === state.pts.length - 1 ? 'disabled' : ''}>›</button></span></div>
    <div class="big">${fmt(v)} <small>cell-days${p.conv ? ' (estimated)' : ''}</small></div>
    <div class="tags">${tags.join('')}</div>
    <p class="verdict${vd.provisional ? ' prov' : ''}">${esc(vd.text)}</p>
    <table class="ranges">${rows.join('')}</table>
    <p><button type="button" id="rd-examine" class="primary">Examine the evidence for this month</button></p>
    <details class="notes"${state.view === 'classic' ? ' open' : ''}><summary>What to keep in mind (${notes.length})</summary>${notes.map((n) => `<p class="note">${esc(n)}</p>`).join('')}</details>`;
  $('rd-prev').addEventListener('click', () => selectMonth(p.i - 1));
  $('rd-next').addEventListener('click', () => selectMonth(p.i + 1));
  $('rd-examine').addEventListener('click', () => openBench('sel'));
  renderMonthChart(p);
  const key = `${p.i}|${JSON.stringify(state.box)}`;
  if (lastReadKey && key !== lastReadKey) { const el = $('pane-reading'); el.classList.remove('changed'); void el.offsetWidth; el.classList.add('changed'); }
  lastReadKey = key;
}
export function renderMonthChart(p: MonthPoint) {
  const host = $('month-chart'), W = Math.max(host.clientWidth, 280), H = 210, m = { l: 46, r: 14, t: 10, b: 30 };
  const partial = !p.era.complete;
  const same = state.pts.filter((o) => o.cal === p.cal);
  const val = (o: MonthPoint) => (partial ? o.early : o.value);
  const years = same.map((o) => o.year), x0 = Math.min(...years), x1 = Math.max(...years);
  const ymax = Math.max(...same.map(val), p.ref?.p90 ?? 0, p.conv?.hi ?? 0, 1) * 1.08;
  const X = (y: number) => m.l + ((y - x0) / Math.max(x1 - x0, 1)) * (W - m.l - m.r);
  const Y = (v: number) => H - m.b - (v / ymax) * (H - m.t - m.b);
  const parts: string[] = [];
  for (const t of niceTicks(ymax, 4)) parts.push(`<line x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}" stroke="${RULE}" stroke-width="0.6"/><text x="${m.l - 6}" y="${Y(t) + 4}" text-anchor="end" font-size="11" font-family="IBM Plex Mono" fill="${INK3}">${fmt(t)}</text>`);
  if (p.ref) {
    parts.push(`<rect x="${m.l}" y="${Y(p.ref.p90)}" width="${W - m.l - m.r}" height="${Math.max(Y(p.ref.p10) - Y(p.ref.p90), 1)}" fill="${PAPER2}" stroke="${RULE}"/>`);
    parts.push(`<line x1="${m.l}" x2="${W - m.r}" y1="${Y(p.ref.p50)}" y2="${Y(p.ref.p50)}" stroke="${INK2}" stroke-dasharray="4 3"/>`);
  }
  if (p.conv) parts.push(`<line x1="${X(p.year)}" x2="${X(p.year)}" y1="${Y(p.conv.lo)}" y2="${Y(p.conv.hi)}" stroke="${ACCENT}" stroke-width="2"/>`);
  for (const o of same) {
    const est = o.era.kind === 'harmonized', me = o.i === p.i;
    parts.push(`<circle class="yr-dot" data-i="${o.i}" cx="${X(o.year)}" cy="${Y(val(o))}" r="${me ? 6 : 3.6}" fill="${me ? ACCENT : est ? PAPER : INK2}" stroke="${me ? INK : INK2}" stroke-width="${me ? 1.5 : 1.1}" ${o.provisional ? 'stroke-dasharray="2 1.5"' : ''}><title>${o.year}: ${fmt(val(o))} cell-days</title></circle>`);
  }
  for (const y of [x0, 2012, x1].filter((y, k, a) => a.indexOf(y) === k && y >= x0 && y <= x1)) parts.push(`<text x="${X(y)}" y="${H - 10}" text-anchor="middle" font-size="11" font-family="IBM Plex Mono" fill="${INK3}">${y}</text>`);
  const cap = `<p class="hint" style="margin:0 0 6px">${MONTHS_LONG[p.cal - 1]} in every year${partial ? `, days 1–${elapsed()} only` : ''}, cell-days. Shaded band: historical reference range (10th–90th percentile); dashed line: median. Hollow dots: estimated from Aqua MODIS; large orange dot: selected month${p.conv ? ', with its sensor-conversion range' : ''}. Click a dot to go to that year.</p>`;
  host.innerHTML = cap + `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${MONTHS_LONG[p.cal - 1]} values for every year in this area, with the selected year highlighted.">${parts.join('')}</svg>`;
  host.querySelector('svg')!.addEventListener('click', (ev) => { const t = (ev.target as Element).closest<SVGElement>('.yr-dot'); if (t) selectMonth(+t.dataset.i!); });
}

export function initViews() {
  initControls();
  $('ctx-prev').addEventListener('click', () => selectMonth(state.sel - 1));
  $('ctx-next').addEventListener('click', () => selectMonth(state.sel + 1));
  $('measure-counts').addEventListener('click', () => setMeasure('counts'));
  $('measure-anom').addEventListener('click', () => setMeasure('anom'));
  onRender(renderSelection);
  onRender(() => { if (state.view === 'living') { renderStrip(); renderYear(); } else renderCalendar(); });
  onRender(renderReading);
  onRender(renderContext);
}
