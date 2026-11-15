// ARGALLAX map: shading that follows the selected period, area box, box drawing. WebGL (MapLibre) with an SVG fallback.
// AI-assisted code. Licensed under Apache-2.0.
import * as maplibregl from 'maplibre-gl';
import { Box, MONTHS_LONG, fmt } from './data';
import { $, atlas, cssVar, cur, esc, onRender, reducedMotion, seq, setBox, state, swatch, RULE } from './core';

/** Map colours for the current view's theme, resolved from the stylesheet. */
const T = () => ({ sea: cssVar('--map-sea'), land: cssVar('--map-land'), coast: cssVar('--map-coast'), ink: cssVar('--ink'), ink2: cssVar('--ink-2'), paper: cssVar('--paper'), accent: cssVar('--accent') });
/** Everything outside the selected box, as one polygon with a hole: dims the map beyond the selection. */
function outsideGeo(b: Box) { return { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [[[60, -40], [180, -40], [180, 60], [60, 60], [60, -40]], [[b.w, b.s], [b.w, b.n], [b.e, b.n], [b.e, b.s], [b.w, b.s]]] } }; }

type LL = { lng: number; lat: number };
let map: maplibregl.Map | undefined;
let svgMap: { draw: () => void } | undefined;
let glReady = false;
const scale = { month: 1, year: 1, avg: 1 };
let avgVals: Float32Array = new Float32Array();
let shade: { vals: Float32Array; max: number; key: string } = { vals: new Float32Array(), max: 1, key: "" };

function boxGeo(b: Box) { return { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [[[b.w, b.s], [b.e, b.s], [b.e, b.n], [b.w, b.n], [b.w, b.s]]] } }; }
const mkBox = (a: LL, b: LL): Box => ({ w: Math.min(a.lng, b.lng), e: Math.max(a.lng, b.lng), s: Math.min(a.lat, b.lat), n: Math.max(a.lat, b.lat) });

/** Fixed colour scales per map mode, so that maps of different periods can be compared. */
function prepareScales() {
  const C = atlas.cells, n = C.cells.length, nM = C.months.length;
  let mMax = 1, yMax = 1;
  let yearAcc = new Float32Array(n), yr = '';
  const flush = () => { for (const v of yearAcc) if (v > yMax) yMax = v; };
  for (let mi = 0; mi < nM; mi++) {
    if (C.months[mi].slice(0, 4) !== yr) { flush(); yearAcc = new Float32Array(n); yr = C.months[mi].slice(0, 4); }
    const one = new Float32Array(n); atlas.addCellMonth(mi, one);
    for (let c = 0; c < n; c++) { if (one[c] > mMax) mMax = one[c]; yearAcc[c] += one[c]; }
  }
  flush();
  // average yearly S-NPP daytime cell-days per cell, 2013–2025 (full archive years)
  const R = C.rows; avgVals = new Float32Array(n);
  for (let k = 0; k < R.s.length; k++) if (R.s[k] === 1 && R.d[k] === 0) { const m = C.months[R.m[k]]; if (m >= '2013-01' && m <= '2025-12') avgVals[R.c[k]] += R.v[k] / 13; }
  scale.month = mMax; scale.year = yMax; scale.avg = Math.max(...avgVals, 1);
}

function computeShade() {
  const p = cur(); if (!p) return;
  const key = state.mapPeriod === 'avg' ? 'avg' : state.mapPeriod === 'year' ? 'y' + p.year : 'm' + p.i;
  if (key === shade.key) return false;
  let vals: Float32Array;
  if (state.mapPeriod === 'avg') vals = avgVals;
  else {
    vals = new Float32Array(atlas.cells.cells.length);
    if (state.mapPeriod === 'month') atlas.addCellMonth(p.i, vals);
    else for (const o of state.pts) if (o.year === p.year) atlas.addCellMonth(o.i, vals);
  }
  shade = { vals, max: scale[state.mapPeriod], key };
  return true;
}
function cellsFC() {
  const feats = [];
  for (let i = 0; i < shade.vals.length; i++) if (shade.vals[i] > 0) feats.push({ type: 'Feature' as const, properties: { v: shade.vals[i] }, geometry: boxGeo(atlas.cellBox(i)).geometry });
  return { type: 'FeatureCollection' as const, features: feats };
}
function colourExpr(): any {
  const stops: any[] = []; for (let k = 0; k <= 6; k++) { const v = shade.max * (k / 6) ** 2; stops.push(v, seq(v, shade.max)); }
  return ['interpolate', ['linear'], ['get', 'v'], ...stops];
}

function renderCaption() {
  const p = cur(); if (!p) return;
  const sat = (s: string) => atlas.meta.sensors.find((x) => x.key === s)!.name.replace(/ \(.*/, '');
  let what = '', note = '';
  if (state.mapPeriod === 'avg') what = 'average yearly cell-days recorded by S-NPP VIIRS, 2013–2025';
  else if (state.mapPeriod === 'month') {
    what = `cell-days recorded by ${sat(p.era.sensor)} in ${MONTHS_LONG[p.cal - 1]} ${p.year}${p.era.complete ? '' : `, days 1–${atlas.meta.current_month.elapsed_days}`}`;
    if (p.era.sensor === 'aqua') note = 'Before Feb 2012 the map uses unconverted Aqua detections; totals use estimated VIIRS-equivalent values.';
    if (p.provisional) note = 'Provisional near-real-time data.';
  } else {
    const ms = state.pts.filter((o) => o.year === p.year), sens = [...new Set(ms.map((o) => sat(o.era.sensor)))];
    what = `cell-days recorded in ${p.year}${ms.length < 12 ? ` (${MONTHS_LONG[ms[0].cal - 1]}–${MONTHS_LONG[ms[ms.length - 1].cal - 1]})` : ''} by ${sens.join(', then ')}`;
    if (ms.some((o) => o.era.sensor === 'aqua')) note = 'Before Feb 2012 the map uses unconverted Aqua detections; totals use estimated VIIRS-equivalent values.';
    else if (ms.some((o) => o.provisional)) note = 'Includes provisional near-real-time months.';
  }
  const any = shade.vals.some((v) => v > 0);
  const stops = Array.from({ length: 11 }, (_, k) => `<stop offset="${k * 10}%" stop-color="${seq(shade.max * (k / 10) ** 2, shade.max)}"/>`).join('');
  $('map-caption').innerHTML = `<span class="ramp">${swatch(`<defs><linearGradient id="mlg">${stops}</linearGradient></defs><rect width="84" height="10" fill="url(#mlg)" stroke="${RULE}"/>`, 84, 10)} <span class="tab">0 → ${fmt(shade.max)}</span> per 0.25° cell</span>
    <span><strong>Map shading:</strong> ${esc(what)}. ${esc(note)} ${$('map').dataset.renderer === 'svg' ? 'Simplified map (no WebGL; no zoom).' : ''} Land: Natural Earth · Detections: NASA FIRMS.${any ? '' : ' No detections recorded in this period; that is not proof of no fire.'}</span>`;
  for (const b of Array.from($('map-period').querySelectorAll('button'))) b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.v === state.mapPeriod));
}

function hasWebGL2() { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } }

// ---------------- box drawing (shared by both map types) ----------------
interface DrawTarget { el: HTMLElement; toLL: (ev: PointerEvent) => LL; draft: (b: Box | null, corner: LL | null) => void; mode: (on: boolean) => void }
let drawing = false;
function attachDraw(t: DrawTarget) {
  const btn = $('draw-btn'), hint = $('draw-hint'), host = $('map');
  let down: { ll: LL; x: number; y: number } | null = null, pending: LL | null = null;
  const idle = host.dataset.renderer === 'svg'
    ? 'Simplified map: the full screening area, without zoom. One finger scrolls the page; use Draw a box to select an area.'
    : 'To move the map on a touch screen, use two fingers. One finger scrolls the page.';
  const set = (on: boolean) => {
    drawing = on; down = null; pending = null;
    btn.setAttribute('aria-pressed', String(on)); btn.textContent = on ? 'Cancel drawing' : 'Draw a box';
    host.classList.toggle('drawing', on); document.body.classList.toggle('drawing', on);
    hint.textContent = on ? 'Drag a box on the map, or tap two opposite corners. Esc cancels. Boxes snap to the 0.25° grid.' : idle;
    t.draft(null, null); t.mode(on);
  };
  hint.textContent = idle;
  btn.addEventListener('click', () => set(!drawing));
  window.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && drawing) set(false); });
  const far = (ev: PointerEvent) => !!down && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 8;
  const finish = (b: Box) => { set(false); setBox(b, 'Custom box'); };
  t.el.addEventListener('pointerdown', (ev) => {
    if (!drawing || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
    down = { ll: t.toLL(ev), x: ev.clientX, y: ev.clientY };
    try { t.el.setPointerCapture(ev.pointerId); } catch { /* ignore */ }
    ev.preventDefault();
  });
  t.el.addEventListener('pointermove', (ev) => {
    if (!drawing) return;
    if (down && far(ev)) t.draft(mkBox(down.ll, t.toLL(ev)), null);
    else if (pending && !down) t.draft(mkBox(pending, t.toLL(ev)), pending);
  });
  t.el.addEventListener('pointerup', (ev) => {
    if (!drawing || !down) return;
    const ll = t.toLL(ev), dragged = far(ev), start = down.ll; down = null;
    if (dragged) return finish(mkBox(start, ll));
    if (pending) return finish(mkBox(pending, ll));
    pending = ll; t.draft(null, pending);
    hint.textContent = 'First corner set. Now tap the opposite corner. Esc or “Cancel drawing” stops.';
  });
  t.el.addEventListener('pointercancel', () => { down = null; });
}

// ---------------- SVG fallback ----------------
/** Fallback map without WebGL: same layers drawn as SVG, no zoom; box drawing still works. */
function initSvgMap(reason: string) {
  $('map-reset').onclick = () => setBox(atlas.aoiBox());
  const host = $('map'), aoi = atlas.aoiBox();
  host.classList.add('svgmap'); host.dataset.renderer='svg';
  host.setAttribute('role', 'img');
  host.setAttribute('aria-label', 'Simplified map of the screening area with hotspot shading and the selected box.');
  let land: any = null;
  fetch('./land.json').then((r) => r.json()).then((d) => { land = d; draw(); }).catch(() => {});
  const view = { w: aoi.w - 0.3, e: aoi.e + 0.3, s: aoi.s - 0.3, n: aoi.n + 0.3 };
  const kx = Math.cos(((view.s + view.n) / 2) * Math.PI / 180);
  let P = (lon: number, lat: number): [number, number] => [lon, lat];
  let inv = (x: number, y: number) => ({ lng: x, lat: y });
  let draft: Box | null = null, corner: LL | null = null;
  const rect = (b: Box) => { const [x0, y0] = P(b.w, b.n), [x1, y1] = P(b.e, b.s); return `x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${Math.max(x1 - x0, 0).toFixed(1)}" height="${Math.max(y1 - y0, 0).toFixed(1)}"`; };
  function draw() {
    const W = host.clientWidth || 600, H = host.clientHeight || 470, pad = 24, bottom = 64;
    const vw = (view.e - view.w) * kx, vh = view.n - view.s;
    const sc = Math.min((W - 2 * pad) / vw, (H - pad - bottom) / vh);
    const ox = (W - vw * sc) / 2, oy = pad + (H - pad - bottom - vh * sc) / 2;
    P = (lon, lat) => [ox + (lon - view.w) * kx * sc, oy + (view.n - lat) * sc];
    inv = (x, y) => ({ lng: view.w + (x - ox) / (kx * sc), lat: view.n - (y - oy) / sc });
    const t = T();
    const parts: string[] = [`<rect width="${W}" height="${H}" fill="${t.sea}"/>`];
    const landPath = land ? land.features[0].geometry.coordinates.map((poly: number[][][]) => poly.map((ring) => 'M' + ring.map(([x, y]) => P(x, y).map((v) => v.toFixed(1)).join(' ')).join('L') + 'Z').join('')).join('') : '';
    if (land) parts.push(`<path d="${landPath}" fill="${t.land}" stroke="none"/>`);
    for (let i = 0; i < shade.vals.length; i++) if (shade.vals[i] > 0) parts.push(`<rect ${rect(atlas.cellBox(i))} fill="${seq(shade.vals[i], shade.max)}" fill-opacity="0.85"/>`);
    if (land) parts.push(`<path d="${landPath}" fill="none" stroke="${t.coast}" stroke-width="0.8"/>`);
    { const [x0, y0] = P(state.box.w, state.box.n), [x1, y1] = P(state.box.e, state.box.s);
      parts.push(`<path fill-rule="evenodd" d="M0 0H${W}V${H}H0Z M${x0} ${y0}H${x1}V${y1}H${x0}Z" fill="#050607" fill-opacity="0.66"/>`); }
    parts.push(`<rect ${rect(aoi)} fill="none" stroke="${t.ink2}" stroke-dasharray="4 3"/>`);
    parts.push(`<rect ${rect(state.box)} fill="none" stroke="${t.accent}" stroke-width="2.2"/>`);
    if (draft) parts.push(`<rect ${rect(draft)} fill="none" stroke="${t.ink}" stroke-width="1.5" stroke-dasharray="4 4"/>`);
    if (corner) { const [cx, cy] = P(corner.lng, corner.lat); parts.push(`<circle cx="${cx}" cy="${cy}" r="5" fill="${t.paper}" stroke="${t.ink}" stroke-width="2"/>`); }
    host.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block">${parts.join('')}</svg>`;
    longitudeAxis((lo) => P(lo, view.s)[0], W);

  }
  attachDraw({
    el: host,
    toLL: (ev) => { const r = host.getBoundingClientRect(); return inv(ev.clientX - r.left, ev.clientY - r.top); },
    draft: (b, c) => { draft = b; corner = c; draw(); },
    mode: () => draw(),
  });
  window.addEventListener('resize', () => draw());
  svgMap = { draw };
  draw();
}

// ---------------- WebGL map ----------------
function initWebGLMap() {
  maplibregl.setWorkerUrl(new URL('./maplibre-gl-worker.mjs', document.baseURI).href);
  const aoi = atlas.aoiBox(), t = T();
  $('map').dataset.renderer='webgl';
  const m = new maplibregl.Map({
    container: 'map', attributionControl: false, dragRotate: false, pitchWithRotate: false,
    cooperativeGestures: true,   // phones: one finger scrolls the page, two fingers move the map
    style: {
      version: 8,
      sources: {
        land: { type: 'geojson', data: './land.json', attribution: 'Land outline: Natural Earth' },
        cells: { type: 'geojson', data: cellsFC(), attribution: 'Hotspots: NASA FIRMS' },
        aoi: { type: 'geojson', data: boxGeo(aoi) },
        sel: { type: 'geojson', data: boxGeo(state.box) },
        out: { type: 'geojson', data: outsideGeo(state.box) },
        draft: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': t.sea } },
        { id: 'land', type: 'fill', source: 'land', paint: { 'fill-color': t.land } },
        { id: 'cells', type: 'fill', source: 'cells', paint: { 'fill-color': colourExpr(), 'fill-opacity': 0.85, 'fill-opacity-transition': { duration: 380 }, 'fill-color-transition': { duration: 0 } } },
        { id: 'coast', type: 'line', source: 'land', paint: { 'line-color': t.coast, 'line-width': 0.8 } },
        { id: 'out', type: 'fill', source: 'out', paint: { 'fill-color': '#050607', 'fill-opacity': 0.66 } },
        { id: 'aoi', type: 'line', source: 'aoi', paint: { 'line-color': t.ink2, 'line-width': 1, 'line-dasharray': [3, 2] } },
        { id: 'sel-line', type: 'line', source: 'sel', paint: { 'line-color': t.accent, 'line-width': 2.2 } },
        { id: 'draft', type: 'line', source: 'draft', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'line-color': t.ink, 'line-width': 1.5, 'line-dasharray': [2, 2] } },
        { id: 'corner', type: 'circle', source: 'draft', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 5, 'circle-color': t.paper, 'circle-stroke-color': t.ink, 'circle-stroke-width': 2 } },
      ],
    },
    bounds: [[aoi.w - 0.9, aoi.s - 0.8], [aoi.e + 0.9, aoi.n + 0.8]],
  });
  map = m;
  const fitAoi = (duration = 0) => m.fitBounds([[aoi.w - 0.3, aoi.s - 0.3], [aoi.e + 0.3, aoi.n + 0.3]], { padding: { top: 28, bottom: 64, left: 28, right: 28 }, duration });
  m.on('load', () => { glReady = true; fitAoi(); shade.key = ''; lastTheme = ''; updateMap(); });
  // If the interactive map cannot finish loading (for example its worker file is missing), fall back to the static map.
  const fallBack = () => { if (glReady || map !== m) return; try { m.remove(); } catch { /* already gone */ } map = undefined; $('map').innerHTML = ''; delete $('map').dataset.renderer; initSvgMap('the interactive map did not load'); shade.key = ''; updateMap(); };
  m.on('error', (e) => { if (/worker/i.test(String((e as unknown as { error?: { message?: string } }).error?.message ?? ''))) fallBack(); });
  setTimeout(fallBack, 10000);
  m.on('move', () => longitudeAxis(lo => m.project([lo, aoi.s]).x, $('map').clientWidth));
  m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  $('map-reset').onclick = () => { setBox(atlas.aoiBox()); fitAoi(reducedMotion() ? 0 : 400); };
  const canvas = m.getCanvasContainer();
  attachDraw({
    el: canvas,
    toLL: (ev) => { const r = canvas.getBoundingClientRect(); return m.unproject([ev.clientX - r.left, ev.clientY - r.top]); },
    draft: (b, c) => {
      const feats: any[] = [];
      if (b) feats.push(boxGeo(b));
      if (c) feats.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [c.lng, c.lat] } });
      (m.getSource('draft') as maplibregl.GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: feats });
    },
    mode: (on) => {
      if (on) { m.dragPan.disable(); m.doubleClickZoom.disable(); m.cooperativeGestures.disable(); }
      else { m.dragPan.enable(); m.doubleClickZoom.enable(); m.cooperativeGestures.enable(); }
    },
  });
}

let lastBoxKey = '', lastTheme = '';
function retheme() {
  if (!map || !glReady) return;
  const t = T();
  map.setPaintProperty('bg', 'background-color', t.sea); map.setPaintProperty('land', 'fill-color', t.land); map.setPaintProperty('coast', 'line-color', t.coast);
  map.setPaintProperty('aoi', 'line-color', t.ink2); map.setPaintProperty('sel-line', 'line-color', t.accent);
  map.setPaintProperty('draft', 'line-color', t.ink); map.setPaintProperty('corner', 'circle-color', t.paper); map.setPaintProperty('corner', 'circle-stroke-color', t.ink);
}
function updateMap() {
  let changed = computeShade();
  if (state.view !== lastTheme) { lastTheme = state.view; changed = true; retheme(); lastBoxKey = ''; }
  renderCaption();
  const boxKey = JSON.stringify(state.box);
  if (svgMap) { if (changed || boxKey !== lastBoxKey) { svgMap.draw(); if (changed && !reducedMotion()) { const s = $('map').querySelector('svg'); s?.classList.add('fresh'); } } lastBoxKey = boxKey; return; }
  if (!map || !glReady) return;
  if (boxKey !== lastBoxKey) { (map.getSource('sel') as maplibregl.GeoJSONSource | undefined)?.setData(boxGeo(state.box)); (map.getSource('out') as maplibregl.GeoJSONSource | undefined)?.setData(outsideGeo(state.box)); lastBoxKey = boxKey; }
  if (changed) {
    (map.getSource('cells') as maplibregl.GeoJSONSource | undefined)?.setData(cellsFC());
    map.setPaintProperty('cells', 'fill-color', colourExpr());
    if (!reducedMotion()) { map.setPaintProperty('cells', 'fill-opacity', 0.15); const mm = map; requestAnimationFrame(() => requestAnimationFrame(() => mm.setPaintProperty('cells', 'fill-opacity', 0.85))); }
  }
}

export function initMap() {
  prepareScales();
  computeShade();
  if (!hasWebGL2()) initSvgMap('this browser has no WebGL2, so zoom is unavailable');
  else {
    try { initWebGLMap(); } catch (e) { map = undefined; $('map').innerHTML = ''; initSvgMap('the interactive map could not start'); }
  }
  onRender(updateMap);
  // The map pane changes width when the view changes.
  let w = '';
  onRender(() => { const nw = `${$('map').clientWidth}x${$('map').clientHeight}`; if (nw !== w) { w = nw; map?.resize(); if(map && glReady){ const a=atlas.aoiBox(); map.fitBounds([[a.w-0.3,a.s-0.3],[a.e+0.3,a.n+0.3]],{padding:{top:28,bottom:64,left:28,right:28},duration:0}); } svgMap?.draw(); } });
}

/** Longitude labels live outside the map canvas, with their own safe gutter. */
function longitudeAxis(project: (lon:number)=>number, width:number) {
  const host=$('map-coordinates'); if(!host)return;
  host.innerHTML=`<svg viewBox="0 0 ${width} 24" width="${width}" height="24" aria-label="Longitude coordinates">${[118,122,126].map(lo=>{
    const x=project(lo);return x>=24&&x<=width-24?`<text x="${x}" y="17" text-anchor="middle" font-size="13" fill="var(--ink-2)">${lo}°E</text>`:'';
  }).join('')}</svg>`;
}
