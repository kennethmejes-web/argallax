// ARGALLAX evidence layers: the 2012 example (Discover), the workbench (Examine), downloads (Preserve), credits.
// All statements here are fixed, pre-written text within analysis/SCIENCE_REVIEW.md §6; numbers come from the data files.
// AI-assisted code. Licensed under Apache-2.0.
import { MONTHS_LONG, annual, fmt } from './data';
import {
  $, atlas, closeBench, csvFlag, cur, esc, kindText, monthLabel, niceTicks, onRender, openBench, setIntro, shown, state, verdict, BenchTab, REPO,
  ACCENT, INK, INK2, INK3, RULE,
} from './core';

// ---------------- yearly record: joined raw, Aqua alone, harmonized ----------------
function switchStats() {
  const a = annual(state.pts);
  const mean = (k: 'harmonized' | 'raw' | 'aqua', y0: number, y1: number) => { const v = a.filter((d) => d.year >= y0 && d.year <= y1); return v.length ? v.reduce((t, d) => t + d[k], 0) / v.length : NaN; };
  return {
    a, r: mean('raw', 2013, 2021) / mean('raw', 2003, 2011), aq: mean('aqua', 2013, 2021) / mean('aqua', 2003, 2011),
    h: mean('harmonized', 2013, 2021) / mean('harmonized', 2003, 2011), aquaEarly: mean('aqua', 2003, 2011),
  };
}
const fx = (x: number) => (isFinite(x) ? x.toFixed(1) + '×' : 'n/a');
type Case = 'artifact' | 'toolittle' | 'rose' | 'nojump';
function switchCase(s: ReturnType<typeof switchStats>): Case { return s.aquaEarly < 20 || !isFinite(s.aquaEarly) ? 'toolittle' : s.r >= 2 && s.aq <= 1.5 ? 'artifact' : s.aq > 1.5 ? 'rose' : 'nojump'; }
export function switchFinding(overview = false) {
  const s = switchStats(), c = switchCase(s);
  // Reuse the existing cases; overview wording omits all unapproved multiples.
  let txt = overview
    ? state.scope === 'whole_area'
      ? `In this area, the simply joined record changes ${fx(s.r)} from 2003–2011 to 2013–2021 (yearly averages). `
      : 'Comparing yearly averages from 2003–2011 with 2013–2021 in this area. '
    : `In this area, the simply joined record changes ${fx(s.r)} from 2003–2011 to 2013–2021 (yearly averages). Aqua MODIS alone, the same instrument across both periods, changes ${fx(s.aq)}. `;
  if (c === 'toolittle') txt += 'Aqua detected too little here to judge.';
  else if (c === 'artifact') txt += overview
    ? 'Aqua MODIS alone, the same instrument across both periods, does not show that jump. So the jump in the joined record is a sensor artifact. This says nothing about whether actual burning changed.'
    : 'So the jump in the joined record is a sensor artifact. (The harmonized record, ' + fx(s.h) + ', follows Aqua by construction; it is a consistency check, not separate evidence.) This says nothing about whether actual burning changed.';
  else if (c === 'rose') txt += 'Detections rose on the older satellite too, so the change is not only a sensor artifact. Detections are not fire counts.';
  else txt += 'The satellite switch does not create a large jump here.';
  return txt;
}
/** Yearly totals chart. `show` picks the lines; lines fade and draw in when their class changes. */
export function annualChart(host: HTMLElement, show: { raw: boolean; aqua: boolean; harm: boolean }, tall = false) {
  const W = Math.max(host.clientWidth, 280); if (!host.clientWidth) return;
  const small = W < 560, H = small ? 230 : tall ? 270 : 300;
  const m = { l: 52, r: small ? 12 : 190, t: 18, b: 30 };
  const a = annual(state.pts);
  if (a.length < 4) { host.innerHTML = '<p class="hint">Not enough full years in this area to draw the yearly record.</p>'; return; }
  const ymax = Math.max(...a.map((d) => Math.max(d.harmonized, d.raw, d.aqua)), 1) * 1.08;
  const xs = a.map((d) => d.year), x0 = Math.min(...xs), x1 = Math.max(...xs);
  const X = (y: number) => m.l + ((y - x0) / (x1 - x0)) * (W - m.l - m.r), Y = (v: number) => H - m.b - (v / ymax) * (H - m.t - m.b);
  const line = (k: 'harmonized' | 'raw' | 'aqua') => a.map((d, i) => `${i ? 'L' : 'M'}${X(d.year).toFixed(1)} ${Y(d[k]).toFixed(1)}`).join(' ');
  const key = `${W}|${H}|${JSON.stringify(state.box)}`;
  if (host.dataset.key !== key) {
    const parts: string[] = [];
    for (const t of niceTicks(ymax, 4)) parts.push(`<line x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}" stroke="${RULE}" stroke-width="0.6"/><text x="${m.l - 6}" y="${Y(t) + 4}" text-anchor="end" font-size="11" font-family="IBM Plex Mono" fill="${INK3}">${fmt(t)}</text>`);
    parts.push(`<line x1="${X(2011.5)}" x2="${X(2011.5)}" y1="${m.t}" y2="${H - m.b}" stroke="${INK}" stroke-dasharray="2 3"/><text x="${X(2011.5) + 5}" y="${m.t + 8}" font-size="11" fill="${INK2}">VIIRS starts (2012)</text>`);
    parts.push(`<path class="ln ln-raw" pathLength="1" d="${line('raw')}" fill="none" stroke="#8f8a7e" stroke-width="2.2"/>`);
    parts.push(`<path class="ln ln-aqua" d="${line('aqua')}" fill="none" stroke="${INK}" stroke-width="1.6" stroke-dasharray="5 3"/>`);
    parts.push(`<path class="ln ln-harm" pathLength="1" d="${line('harmonized')}" fill="none" stroke="${ACCENT}" stroke-width="2.4"/>`);
    parts.push(`<g class="ln ln-harm">${a.map((d) => `<circle cx="${X(d.year)}" cy="${Y(d.harmonized)}" r="2.6" fill="${ACCENT}"><title>${d.year}: harmonized ${fmt(d.harmonized)}, joined raw ${fmt(d.raw)}, Aqua alone ${fmt(d.aqua)}</title></circle>`).join('')}</g>`);
    const tk: number[] = []; for (const y of [x0, 2005, 2010, 2015, 2020, x1]) if (y >= x0 && y <= x1 && tk.every((t) => Math.abs(X(t) - X(y)) > 44)) tk.push(y);
    for (const y of tk) parts.push(`<text x="${X(y)}" y="${H - 10}" text-anchor="middle" font-size="11" font-family="IBM Plex Mono" fill="${INK3}">${y}</text>`);
    const last = a[a.length - 1];
    if (!small) {
      const lab = [{ k: 'harmonized' as const, c: 'ln-harm', t: 'ARGALLAX harmonized', col: ACCENT }, { k: 'raw' as const, c: 'ln-raw', t: 'Satellites simply joined', col: INK2 }, { k: 'aqua' as const, c: 'ln-aqua', t: 'Aqua MODIS alone', col: INK }];
      const ys = lab.map((l) => ({ ...l, y: Y(last[l.k]) })).sort((p, q) => p.y - q.y);
      for (let i = 1; i < ys.length; i++) if (ys[i].y - ys[i - 1].y < 15) ys[i].y = ys[i - 1].y + 15;
      for (const l of ys) parts.push(`<text class="ln ${l.c}" x="${W - m.r + 8}" y="${l.y + 4}" font-size="12" fill="${l.col}">${l.t}</text>`);
    }
    const legend = small ? `<div class="legend"><span class="item ln-leg ln-raw">━ satellites simply joined (grey)</span><span class="item ln-leg ln-aqua">╍ Aqua MODIS alone</span><span class="item ln-leg ln-harm" style="color:${ACCENT}">━ ARGALLAX harmonized</span></div>` : '';
    host.innerHTML = `<p class="hint" style="margin:0 0 4px">Yearly totals, hotspot cell-days, ${esc(state.scopeName)}, full years only</p><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Yearly totals for this area: satellites simply joined jump in 2012; Aqua alone and the harmonized record do not.">${parts.join('')}</svg>${legend}`;
    host.dataset.key = key;
    void host.offsetWidth; // let the lines start hidden, so they draw in
  }
  host.classList.toggle('show-raw', show.raw); host.classList.toggle('show-aqua', show.aqua); host.classList.toggle('show-harm', show.harm);
}

// ---------------- Discover: the 2012 example in four steps ----------------
function introSteps() {
  const s = switchStats(), c = switchCase(s), where = state.scope === 'whole_area' ? 'the screening area' : state.scopeName;
  const two = c === 'artifact'
    ? `Aqua MODIS, the same instrument across both periods, changes ${fx(s.aq)}. If detections had really risen ${fx(s.r)}, the older satellite would have recorded more too. It did not, so the jump is a sensor artifact.`
    : c === 'toolittle' ? 'Aqua MODIS detected too little in this area to judge. Choose a larger area to follow the example.'
      : c === 'rose' ? `Aqua MODIS alone changes ${fx(s.aq)} here. Detections rose on the older satellite too, so the change in this area is not only a sensor artifact. Detections are not fire counts.`
        : `Aqua MODIS alone changes ${fx(s.aq)}. The satellite switch does not create a large jump in this area.`;
  return [
    { h: 'Join two satellites and the record jumps.', t: `Yearly hotspot detections in ${where}, counted as grid-cell-days. Aqua MODIS recorded the years to 2011; the newer S-NPP VIIRS recorded them from 2012. Simply joined, the record changes ${fx(s.r)} between 2003–2011 and 2013–2021.`, show: { raw: true, aqua: false, harm: false } },
    { h: 'The older satellite kept flying. It saw no such rise.', t: two, show: { raw: true, aqua: true, harm: false } },
    { h: 'One scale for the whole record.', t: `ARGALLAX converts the Aqua years to estimated VIIRS-equivalent values, using eight ratios fitted on 2012–2017. On 18 months not used for fitting or method selection, this cut the difference from S-NPP in regional monthly totals from 85% to 16% of the total. That the jump disappears here is by construction: a consistency check, not separate evidence.`, show: { raw: true, aqua: true, harm: true } },
    { h: 'What this does not tell you.', t: 'The satellite changed. Whether actual burning changed, this record cannot say. Hotspot detections are not fire counts or burned area, and values before 2012 assume the 2012–2017 relation between the satellites held from 2002, which cannot be tested.', show: { raw: true, aqua: true, harm: true } },
  ];
}
function renderDiscover() {
  if (state.view !== 'living') return;
  if (state.intro === 0) return;
  const steps = introSteps(), k = state.intro - 1, s = steps[k];
  $('intro-step').textContent = `The 2012 example · ${state.intro} of 4`;
  $('intro-h').textContent = s.h; $('intro-t').textContent = s.t;
  ($('intro-back') as HTMLButtonElement).disabled = k === 0;
  $('intro-next').textContent = k === 3 ? 'See the whole record' : 'Next';
  $('intro-dots').innerHTML = steps.map((_, i) => `<span class="${i === k ? 'on' : ''}"></span>`).join('');
  annualChart($('intro-chart'), s.show, true);
}
function goExplore() {
  setIntro(0);
  $('ridge').querySelector<SVGElement>('svg')?.focus({ preventScroll: true });
}

// ---------------- Examine: the workbench ----------------
const TABS: [BenchTab, string][] = [['sel', 'This month'], ['record', 'Satellite record'], ['method', 'Method and validation'], ['limits', 'Limits'], ['sources', 'Sources']];
const pct = (x: number) => `${Math.round(x * 100)}%`;
export function benchSelection() {
  const p = cur()!, M = atlas.meta, L = M.labels, vd = verdict(p), v = shown(p);
  const rows: [string, string][] = [];
  const sat = M.sensors.find((s) => s.key === p.era.sensor)!.name;
  rows.push(['Area', `${esc(state.scopeName)}<br><span class="hint">${state.box.s.toFixed(2)}–${state.box.n.toFixed(2)}°N, ${state.box.w.toFixed(2)}–${state.box.e.toFixed(2)}°E</span>`]);
  rows.push(['Recording satellite', `${esc(sat)}<br><span class="hint">${p.era.status === 'archive' ? 'Science-quality archive' : 'Near-real-time, provisional'} · ${p.era.complete ? 'complete month' : `days 1–${M.current_month.elapsed_days} only`}</span>`]);
  rows.push(['Value in the record', `<span class="tab">${fmt(v)}</span> cell-days<br><span class="hint">${esc(kindText(p))}</span>`]);
  if (p.era.kind === 'harmonized') {
    const bands = new Set<number>(); state.mask.forEach((x, i) => { if (x) bands.add(atlas.cells.cells[i][2]); });
    const sea = atlas.season(p.month);
    const used = [...bands].sort().map((r) => `${M.regions[r].name} ${M.harmonization.ratios[`${M.regions[r].name}|${sea}`].toFixed(2)}`).join(' · ');
    rows.push(['As recorded by Aqua MODIS', `<span class="tab">${fmt(p.aquaRaw)}</span> cell-days`]);
    rows.push(['Conversion applied', `<span class="hint">Ratios for ${sea === 'dry' ? 'February–May' : 'June–January'}, by latitude band: ${esc(used || 'none')}. Fitted on 2012–2017.</span>`]);
    if (p.conv) rows.push(['Sensor-conversion range', `<span class="tab">${fmt(p.conv.lo)}–${fmt(p.conv.hi)}</span><br><span class="hint">${esc(p.conv.label)} ${esc(M.intervals.caveat)}</span>`]);
  } else if (p.era.kind === 'observed' && p.era.complete) {
    const scaled = atlas.aquaScaled(p.i, state.mask);
    rows.push(['As recorded by Aqua MODIS, same month', `<span class="tab">${fmt(p.aquaRaw)}</span> cell-days`]);
    rows.push(['Aqua converted the same way', `<span class="tab">${fmt(scaled)}</span> cell-days, against <span class="tab">${fmt(v)}</span> recorded by S-NPP<br><span class="hint">One month in one area, shown for transparency. It is not a validation. The tested result is for regional monthly totals in Jan 2020 – Jun 2021.${p.month >= '2021-07' ? ' ' + esc(L.drift) : ''}</span>`]);
  }
  if (p.ref) rows.push(['Historical reference range', `<span class="tab">${fmt(p.ref.p10)}–${fmt(p.ref.p90)}</span>, median <span class="tab">${fmt(p.ref.p50)}</span><br><span class="hint">10th–90th percentile of ${MONTHS_LONG[p.cal - 1]} in ${p.ref.n} other years (complete science-quality months only${p.ref.early ? `; days 1–${M.current_month.elapsed_days}` : ''}). Descriptive: not a prediction or a significance test.</span>`]);
  rows.push(['Reading', esc(vd.text) + (vd.provisional ? '<br><span class="hint">Provisional months are never shown or counted as confirmed months above or below the range.</span>' : '')]);
  const notes = [L.what_it_measures + ' ' + L.agreement_scope];
  if (p.era.kind === 'harmonized') notes.push(L.pre2012);
  if (p.era.kind === 'bridged') notes.push(L.bridged_month);
  if (p.provisional) notes.push(L.provisional_month);
  if (!p.era.complete) notes.push(L.incomplete_month);
  if (v === 0) notes.push(L.zero);
  if (state.scope === 'other_box') notes.push('The improvement is for regional and whole-area totals. No minimum area size is validated, so a custom box carries more uncertainty than the ranges show.');
  notes.push(L.clouds);
  return `<h3>${esc(monthLabel(p))} · ${esc(state.scopeName)}</h3>
    <table class="evidence">${rows.map(([k, val]) => `<tr><th>${k}</th><td>${val}</td></tr>`).join('')}</table>
    <h4>Qualifications that apply to this month</h4><ul>${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
    <div class="record"><button type="button" id="rec-copy">Copy this evidence record</button> <button type="button" id="rec-save">Save as text</button> <span class="hint" id="rec-status" aria-live="polite"></span></div>`;
}
function benchRecord() {
  const M = atlas.meta;
  const names: Record<string, string> = { aqua: 'Aqua MODIS (C6.1, 1 km), converted to estimated VIIRS-equivalent', snpp: 'S-NPP VIIRS (375 m), the reference scale', noaa20: 'NOAA-20 VIIRS (375 m), continuing the S-NPP scale; provisional near-real-time data' };
  return `<h3>Which satellite recorded what, and what the switch does</h3>
    <table class="evidence">${M.era_summary.map((e) => `<tr><th><span class="tab">${e.from} – ${e.to}</span></th><td>${esc(names[e.sensor])}</td></tr>`).join('')}</table>
    <p class="hint">Satellites are never added together: one satellite per period. Dates are read from the data. ${esc(M.current_month.rule)}</p>
    <div id="switch-chart" class="chart"></div>
    <p id="switch-text" class="finding"></p>
    <p class="hint">${esc(M.labels.bridged_month)}</p>`;
}
export function benchMethod() {
  const M = atlas.meta, V = M.validation, ft = V.final_test, L = M.labels;
  const ratio = (r: string, s: string) => M.harmonization.ratios[`${r}|${s}`].toFixed(2);
  return `<h3>What was tested</h3>
    <div class="stat"><span class="n">${pct(ft.regional_error_raw)} → ${pct(ft.regional_error_harmonized)}</span><span>Difference from S-NPP VIIRS in regional monthly totals, raw Aqua vs ARGALLAX, on 18 months not used for fitting or method selection (Jan 2020 – Jun 2021).</span>
    <span class="n">${pct(1 - ft.whole_area_ratio_raw)} → ${pct(1 - ft.whole_area_ratio_harmonized)}</span><span>How far the whole-area total fell short of S-NPP: raw Aqua vs ARGALLAX, same months.</span>
    <span class="n">+${pct(V.bridge.whole_area_ratio_noaa20_over_snpp - 1)}</span><span>NOAA-20 against S-NPP, whole-area totals 2022 – Jul 2026 (1–7% by year): within the preregistered 5% tolerance.</span></div>
    <h3>How</h3>
    <p>Aqua MODIS counts are scaled to the S-NPP VIIRS scale with eight ratios (four latitude bands × two seasons) fitted on 2012–2017. The test design, periods, scoring and success rule were written down before any model was fitted. ${esc(L.selection_amendment)} ${esc(L.not_better_than_one_ratio)}</p>
    <table class="evidence ratios"><tr><th>Latitude band</th><th>February–May</th><th>June–January</th></tr>${M.regions.map((r) => `<tr><td>${esc(r.name)}</td><td class="tab">${ratio(r.name, 'dry')}</td><td class="tab">${ratio(r.name, 'rest')}</td></tr>`).join('')}</table>
    <p class="hint">S-NPP cell-days per Aqua cell-day in the fit period. These belong to this grid, unit and area; they are not a general MODIS-to-VIIRS factor.</p>
    <p>Periods: fitted on 2012–2017, method chosen on 2018–2019, tested once on January 2020 – June 2021.</p>
    <p>Sensor-conversion ranges (Aqua years only). Whole area: ${esc(M.intervals.whole_area.label)} Regions: ${esc(M.intervals.region.label)} Other boxes: approximate, not validated at that size. The historical reference range used for “unusual” months is descriptive and separate from these.</p>`;
}
export function benchLimits() {
  const M = atlas.meta, L = M.labels;
  return `<h3>Where you should not trust this record</h3><ul>
    <li>${esc(L.what_it_measures)} ${esc(L.agreement_scope)}</li>
    <li>${esc(L.selection_amendment)}</li>
    <li>${esc(L.not_better_than_one_ratio)}</li>
    <li>The improvement is for regional and whole-area totals. For single 0.25° cells the scaled record was no closer to S-NPP than raw Aqua. No minimum area size is validated.</li>
    <li>${esc(L.pre2012)}</li>
    <li>Whole-area ranges are nominal 80%: 13 of 18 test months fell inside. Regional ranges covered 67% of test months.</li>
    <li>${esc(L.bridged_month)}</li>
    <li>${esc(L.drift)}</li>
    <li>${esc(L.provisional_month)} Provisional months are never shown or counted as confirmed months above or below the historical reference range.</li>
    <li>${esc(L.clouds)}</li>
    <li>${esc(L.zero)}</li>
    <li>${esc(M.regions_note)} ${esc(M.aoi_notice)}</li>
    <li>This record cannot say whether burning rose, fell or stayed the same, and nothing in it was validated against fires, burned area or ground truth.</li>
  </ul>`;
}
export function benchSources() {
  const M = atlas.meta;
  return `<h3>Source documentation</h3>
    <ul>
      <li><a href="${REPO}/blob/main/docs/METHOD.md">Method and limitations</a>, in plain language</li>
      <li><a href="${REPO}/blob/main/analysis/PREREGISTRATION.md">Preregistration</a>, with its four amendments</li>
      <li><a href="${REPO}/blob/main/analysis/RESULTS_SUMMARY.md">Results summary</a></li>
      <li><a href="${REPO}/blob/main/analysis/SCIENCE_REVIEW.md">Independent science review</a>, including the list of claims that may be made</li>
      <li><a href="${REPO}/blob/main/docs/DECISIONS.md">Decision record</a></li>
      <li><a href="${REPO}">Code and data pipeline</a></li>
    </ul>
    <p>${esc(M.credits.data)} Unit: ${esc(M.unit)}.</p>
    <p><a href="#download-section">Download the values and detections for this area</a>.</p>`;
}
let benchKey = '';
function renderBench() {
  const sec = $('workbench'); sec.classList.toggle('open', state.benchOpen);
  $('bench-toggle').textContent = 'Close ✕';
  $('bench-shade').hidden = !(state.benchOpen && state.view === 'living');
  $('bench-toggle').setAttribute('aria-expanded', String(state.benchOpen));
  $('bench-tabs').innerHTML = TABS.map(([k, t]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${state.bench === k}" aria-controls="bench-${k}">${t}</button>`).join('');
  const p = cur(); if (!p) return;
  const key = `${p.i}|${JSON.stringify(state.box)}`;
  if (key !== benchKey) {
    $('bench-sel').innerHTML = benchSelection();
    $('rec-copy').addEventListener('click', copyRecord); $('rec-save').addEventListener('click', () => download(`argallax_evidence_${boxTag()}_${p.month}.txt`, evidenceRecord(), 'text/plain'));
    benchKey = key;
  }
  for (const [k] of TABS) $(`bench-${k}`).classList.toggle('active', state.bench === k);
  // the yearly chart is only measured when visible
  const classic = state.view === 'classic';
  if (classic || (state.benchOpen && state.bench === 'record')) { annualChart($('switch-chart'), { raw: true, aqua: true, harm: true }); $('switch-text').textContent = switchFinding(); }
}

// ---------------- Preserve: downloads and the evidence record ----------------
export function download(name: string, text: string, type = 'text/csv') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const boxTag = () => `${state.box.s}-${state.box.n}N_${state.box.w}-${state.box.e}E`;
function headerLines() {
  const b = state.box, M = atlas.meta;
  return [`# ARGALLAX export. ${M.aoi_notice}`, `# Area: ${state.scopeName}, ${b.s}-${b.n} N, ${b.w}-${b.e} E (snapped to 0.25 deg grid; cells counted by centre)`,
    `# Unit: ${M.unit}. Detections are not fire counts or burned area. Source: NASA FIRMS. ${M.credits.ai}`];
}
export function downloadCalendar() {
  const rows = state.pts.filter((p) => p.year >= state.y0 && p.year <= state.y1);
  const lines = [...headerLines(), '# value: main series on the S-NPP VIIRS scale. reference range: 10th-90th percentile of the same month in other years (descriptive). conversion range: Aqua-era sensor-conversion range.',
    '# flag: above/below/within the reference range. Provisional months are marked above_provisional, below_provisional or within_provisional and are not confirmed.',
    'month,satellite,kind,status,complete,value_cell_days,aqua_raw_cell_days,conversion_range_low,conversion_range_high,reference_p10,reference_median,reference_p90,reference_years,reference_days_1_to_n,flag'];
  for (const p of rows) {
    lines.push([p.month, atlas.meta.sensors.find((s) => s.key === p.era.sensor)!.name, p.era.kind, p.era.status, p.era.complete, shown(p).toFixed(2), p.aquaRaw,
      p.conv ? p.conv.lo.toFixed(2) : '', p.conv ? p.conv.hi.toFixed(2) : '', p.ref ? p.ref.p10.toFixed(2) : '', p.ref ? p.ref.p50.toFixed(2) : '', p.ref ? p.ref.p90.toFixed(2) : '',
      p.ref ? p.ref.n : '', p.ref?.early ? atlas.meta.current_month.elapsed_days : '', csvFlag(p)].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','));
  }
  download(`argallax_calendar_${boxTag()}_${state.y0}-${state.y1}.csv`, lines.join('\n') + '\n');
  $('dl-status').textContent = `Saved calendar values for ${rows.length} months.`;
}
function hotYears() { return atlas.meta.files.hotspots_by_year.filter((y) => +y >= state.y0 && +y <= state.y1); }
export function renderDownloads() {
  const bytes = hotYears().reduce((t, y) => t + (atlas.meta.files.hotspots_bytes?.[y] ?? 0), 0);
  $('dl-hot-hint').textContent = `Individual detections from all three satellites inside your box, ${state.y0}–${state.y1}, each row labeled by satellite and status. Fetches about ${(bytes / 1e6).toFixed(0)} MB before filtering.`;
  $('dl-area').innerHTML = `Both files will cover <strong>${esc(state.scopeName)}</strong>, <strong>${state.y0}–${state.y1}</strong>. To change the area, use the Area control above the map.`;
}
export async function downloadHotspots() {
  const years = hotYears(), b = { ...state.box }, st = $('dl-status');
  const tag = boxTag(), from = state.y0, to = state.y1;
  const out: string[] = [...headerLines()];
  let header = '', n = 0;
  for (const [k, y] of years.entries()) {
    st.textContent = `Fetching ${y} (${k + 1} of ${years.length})…`;
    const response = await fetch(`./data/hotspots/${y}.csv`);
    if (!response.ok) throw new Error(`Could not fetch hotspot data for ${y} (${response.status}).`);
    const text = await response.text();
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
  download(`argallax_hotspots_${tag}_${from}-${to}.csv`, out.join('\n') + '\n');
  st.textContent = `Downloaded ${n.toLocaleString('en-US')} detections.`;
}
/** Plain-text evidence record for the selected area and month: actual values plus fixed, pre-written statements. */
export function evidenceRecord() {
  const p = cur()!, M = atlas.meta, L = M.labels, b = state.box, vd = verdict(p);
  const lines = [
    'ARGALLAX evidence record',
    M.aoi_notice,
    '',
    `Area: ${state.scopeName} (${b.s.toFixed(2)}–${b.n.toFixed(2)}°N, ${b.w.toFixed(2)}–${b.e.toFixed(2)}°E, snapped to the 0.25° grid)`,
    `Period: ${monthLabel(p)}`,
    `Observation: ${fmt(shown(p))} daytime grid-cell-days. ${kindText(p)}.`,
    `Satellite: ${M.sensors.find((s) => s.key === p.era.sensor)!.name}; ${p.era.status === 'archive' ? 'science-quality archive' : 'near-real-time, provisional'}.`,
  ];
  if (p.era.kind === 'harmonized') lines.push(`As recorded by Aqua MODIS: ${fmt(p.aquaRaw)} cell-days.`);
  if (p.conv) lines.push(`Sensor-conversion range: ${fmt(p.conv.lo)}–${fmt(p.conv.hi)}. ${p.conv.label} ${M.intervals.caveat}`);
  if (p.ref) lines.push(`Historical reference range: ${fmt(p.ref.p10)}–${fmt(p.ref.p90)} (median ${fmt(p.ref.p50)}); 10th–90th percentile of ${MONTHS_LONG[p.cal - 1]} in ${p.ref.n} other years. Descriptive: not a prediction or a significance test.`);
  lines.push(`Reading: ${vd.text}${vd.confirmed ? '.' : ''}`, '', 'Qualifications:');
  const q = [L.what_it_measures, L.agreement_scope];
  if (p.era.kind === 'harmonized') q.push(L.pre2012);
  if (p.era.kind === 'bridged') q.push(L.bridged_month);
  if (p.provisional) q.push(L.provisional_month);
  if (!p.era.complete) q.push(L.incomplete_month);
  if (shown(p) === 0) q.push(L.zero);
  if (state.scope === 'other_box') q.push('No minimum area size is validated; ranges for a custom box are approximate.');
  q.push(L.clouds, L.selection_amendment, L.not_better_than_one_ratio, 'This record cannot say whether burning rose, fell or stayed the same.');
  for (const s of q) lines.push(`- ${s}`);
  lines.push('', `Unit: ${M.unit}.`, `Data: ${M.credits.data} ${M.credits.citation_url}`, `Method and limitations: ${REPO}/blob/main/docs/METHOD.md`, M.credits.ai);
  return lines.join('\n') + '\n';
}
export async function copyRecord() {
  const st = $('rec-status');
  try { await navigator.clipboard.writeText(evidenceRecord()); st.textContent = 'Copied.'; } catch { st.textContent = 'Could not copy here. Use “Save as text”.'; }
}

export function initScience() {
  const M = atlas.meta;
  $('intro-back').addEventListener('click', () => setIntro(state.intro - 1));
  $('intro-next').addEventListener('click', () => (state.intro >= 4 ? goExplore() : setIntro(state.intro + 1)));
  $('intro-skip').addEventListener('click', goExplore);
  $('intro-replay').addEventListener('click', () => { setIntro(1); $('intro-next').focus({ preventScroll: true }); });
  $('bench-shade').addEventListener('click', closeBench);
  window.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && state.benchOpen && state.view === 'living') closeBench(); });
  $('bench-toggle').addEventListener('click', () => (state.benchOpen ? closeBench() : openBench(undefined, false)));
  $('bench-tabs').addEventListener('click', (ev) => { const b = (ev.target as Element).closest<HTMLElement>('[data-tab]'); if (b) { openBench(b.dataset.tab as BenchTab, false); $('bench-tabs').querySelector<HTMLElement>(`[data-tab="${b.dataset.tab}"]`)?.focus(); } });
  $('bench-record').innerHTML = benchRecord(); $('bench-method').innerHTML = benchMethod(); $('bench-limits').innerHTML = benchLimits(); $('bench-sources').innerHTML = benchSources();
  $('dl-calendar').addEventListener('click', downloadCalendar);
  $('dl-hotspots').addEventListener('click', () => downloadHotspots().catch((e) => ($('dl-status').textContent = 'Download failed: ' + e)));
  $('footer').innerHTML = `
    <p><strong>Data.</strong> ${esc(M.credits.data)} We acknowledge the use of data from NASA's Fire Information for Resource Management System (FIRMS) (<a href="${M.credits.citation_url}">${M.credits.citation_url}</a>), part of NASA's Earth Science Data and Information System (ESDIS). Land outline: Natural Earth (public domain), via world-atlas (ISC).</p>
    <p><strong>Software.</strong> MapLibre GL JS (BSD-3-Clause), d3-scale-chromatic (ISC), topojson-client (ISC), Vite (MIT). Type: IBM Plex Sans and Mono, and Fraunces (all SIL Open Font License 1.1).</p>
    <p><strong>AI disclosure.</strong> ARGALLAX was created by Kenneth Mejes for Project Sidequest, a solo entry in NASA Space Apps Challenge 2026. Development was AI-assisted, with the project direction, scientific decisions, and final accountability held by the creator. AI tools used: Claude and Claude Code (Anthropic); ChatGPT and Codex (OpenAI).</p>
    <p>Code licence: Apache-2.0. Not affiliated with or endorsed by NASA.</p>`;
  onRender(renderDiscover); onRender(renderBench); onRender(renderDownloads);
}
