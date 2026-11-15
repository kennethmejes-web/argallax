// The switch: the 2002–2026 yearly record as the page's main instrument.
// As recorded, the line takes each satellite's colour and jumps where the record changes satellite;
// Aqua's own line continues underneath. On one scale, the Aqua-era years rise to estimated VIIRS-equivalent.
// Numbers come from annual() in data.ts, the same series the rest of the app uses.
// AI-assisted code. Licensed under Apache-2.0.
import { annual, fmt } from './data';
import { $, cur, esc, niceTicks, reducedMotion, selectYear, state } from './core';

type Row = { year: number; harmonized: number; raw: number; aqua: number };
let shownT = -1, anim = 0, lastKey = '';

/** t = 0 shows the record as recorded; t = 1 shows it on one scale. */
export function renderSwitch(host: HTMLElement, multiple: string | null) {
  const a: Row[] = annual(state.pts);
  if (a.length < 4) { host.innerHTML = '<p class="sw-empty">Not enough full years in this area to draw the yearly record.</p>'; lastKey = ''; return; }
  const W = Math.max(host.clientWidth, 300), small = W < 640;
  const H = small ? 340 : 420;
  const m = { l: small ? 44 : 64, r: small ? 14 : 28, t: small ? 34 : 44, b: 36 };
  const target = state.series === 'harm' ? 1 : 0;
  const key = `${W}|${JSON.stringify(state.box)}|${multiple ?? ''}`;
  if (key !== lastKey) { build(host, a, W, H, m, small, multiple); lastKey = key; shownT = -1; }
  mark(host, a, W, H, m);
  if (shownT < 0 || reducedMotion()) { draw(host, a, W, H, m, target); shownT = target; return; }
  if (shownT === target) return;
  cancelAnimationFrame(anim);
  const from = shownT, t0 = performance.now(), dur = 900;
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / dur), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    shownT = from + (target - from) * e; draw(host, a, W, H, m, shownT);
    if (k < 1) anim = requestAnimationFrame(step); else shownT = target;
  };
  anim = requestAnimationFrame(step);
}

function scales(a: Row[], W: number, H: number, m: { l: number; r: number; t: number; b: number }) {
  const ymax = Math.max(...a.map((d) => Math.max(d.harmonized, d.raw, d.aqua)), 1) * 1.1;
  const x0 = a[0].year, x1 = a[a.length - 1].year;
  return { ymax, x0, x1, X: (y: number) => m.l + ((y - x0) / (x1 - x0)) * (W - m.l - m.r), Y: (v: number) => H - m.b - (v / ymax) * (H - m.t - m.b) };
}

function build(host: HTMLElement, a: Row[], W: number, H: number, m: { l: number; r: number; t: number; b: number }, small: boolean, multiple: string | null) {
  const { ymax, x0, x1, X, Y } = scales(a, W, H, m);
  const p: string[] = [];
  const sw = X(2011.5);
  p.push(`<rect class="sw-era aqua" x="${m.l}" y="${m.t}" width="${sw - m.l}" height="${H - m.t - m.b}"/>`);
  p.push(`<text class="sw-era-label aqua" x="${m.l + 10}" y="${m.t - 12}">Aqua MODIS</text>`);
  p.push(`<text class="sw-era-label viirs" x="${sw + 10}" y="${m.t - 12}">VIIRS, from 2012</text>`);
  if (x1 > 2021) p.push(`<rect class="sw-late" x="${X(2021.5)}" y="${m.t}" width="${X(x1) - X(2021.5)}" height="${H - m.t - m.b}"/>`);
  for (const t of niceTicks(ymax, small ? 3 : 4)) p.push(`<line class="sw-grid" x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}"/><text class="sw-tick" x="${m.l - 10}" y="${Y(t) + 4}" text-anchor="end">${fmt(t)}</text>`);
  const tk: number[] = []; for (const y of [x0, 2005, 2010, 2015, 2020, x1]) if (y >= x0 && y <= x1 && tk.every((t) => Math.abs(X(t) - X(y)) > 40)) tk.push(y);
  for (const y of tk) p.push(`<text class="sw-tick" x="${X(y)}" y="${H - 12}" text-anchor="middle">${y}</text>`);
  p.push(`<line class="sw-switch" x1="${sw}" x2="${sw}" y1="${m.t}" y2="${H - m.b}"/>`);
  // Aqua alone, continuing past 2012: the evidence line.
  const pre = a.filter((d) => d.year <= 2011), post = a.filter((d) => d.year >= 2012);
  const lateIdx = a.findIndex((d) => d.year >= 2022);
  const aq = (rows: Row[]) => rows.map((d, i) => `${i ? 'L' : 'M'}${X(d.year).toFixed(1)} ${Y(d.aqua).toFixed(1)}`).join(' ');
  const aqEarly = lateIdx > 0 ? a.slice(0, lateIdx) : a, aqLate = lateIdx > 0 ? a.slice(lateIdx - 1) : [];
  p.push(`<g class="sw-aqua-alone"><path d="${aq(aqEarly)}"/>${aqLate.length ? `<path class="late" d="${aq(aqLate)}"/>` : ''}</g>`);
  p.push(`<path class="sw-bridge" d=""/><path class="sw-pre" d=""/><path class="sw-post" d="${post.map((d, i) => `${i ? 'L' : 'M'}${X(d.year).toFixed(1)} ${Y(d.raw).toFixed(1)}`).join(' ')}"/>`);
  p.push(`<g class="sw-dots pre">${pre.map(() => '<circle r="3"/>').join('')}</g>`);
  p.push(`<g class="sw-dots post">${post.map((d) => `<circle r="3" cx="${X(d.year)}" cy="${Y(d.raw)}"/>`).join('')}</g>`);
  if (multiple) {
    // The multiple compares two period averages (2003–2011 vs 2013–2021); draw those averages so the bracket matches what it measures.
    const e = a.filter((d) => d.year >= 2003 && d.year <= 2011), l = a.filter((d) => d.year >= 2013 && d.year <= 2021);
    if (e.length && l.length) {
      const yLow = Y(e.reduce((s, d) => s + d.raw, 0) / e.length), yHigh = Y(l.reduce((s, d) => s + d.raw, 0) / l.length);
      const bx = X(2012);
      p.push(`<g class="sw-jump"><line class="avg" x1="${X(2003)}" x2="${X(2011)}" y1="${yLow}" y2="${yLow}"/><line class="avg" x1="${X(2013)}" x2="${X(2021)}" y1="${yHigh}" y2="${yHigh}"/><path d="M${X(2011)} ${yLow}H${bx}V${yHigh}H${X(2013)}"/><text class="big" x="${bx + 10}" y="${(yLow + yHigh) / 2 + (small ? 8 : 12)}">${esc(multiple)}</text><text class="sub" x="${bx + 12}" y="${(yLow + yHigh) / 2 + (small ? 26 : 34)}">period averages</text>${small ? '' : `<text class="sub" x="${X(2003)}" y="${yLow + 20}">2003–2011 average</text>`}${small ? '' : `<text class="sub" x="${X(2021) + 8}" y="${yHigh + 4}">2013–2021 average</text>`}</g>`);
    }
  }
  if (!small) {
    const lab = a.find((d) => d.year === 2018) ?? a[Math.floor(a.length * .7)];
    p.push(`<text class="sw-end aqua" x="${X(lab.year)}" y="${Y(lab.aqua) - 14}" text-anchor="middle">Aqua MODIS alone</text>`);
  }
  p.push(`<text class="sw-est" x="${(m.l + sw) / 2}" y="${m.t + 22}" text-anchor="middle">estimated VIIRS-equivalent</text>`);
  p.push(`<g class="sw-sel"><line y1="${m.t}" y2="${H - m.b}"/><circle r="6"/></g>`);
  p.push(`<g class="sw-hits">${a.map((d) => `<rect data-year="${d.year}" x="${X(d.year) - (X(x1) - X(x0)) / (x1 - x0) / 2}" y="${m.t}" width="${(X(x1) - X(x0)) / (x1 - x0)}" height="${H - m.t - m.b}"><title>${d.year}: as recorded ${fmt(d.raw)} · Aqua alone ${fmt(d.aqua)} · on one scale ${fmt(d.harmonized)} cell-days</title></rect>`).join('')}</g>`);
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" tabindex="0" role="img" aria-label="Yearly hotspot totals for ${esc(state.scopeName)}, ${x0} to ${x1}. Select a year; arrow keys move between months.">${p.join('')}</svg>`;
  host.querySelector('.sw-hits')!.addEventListener('click', (ev) => { const y = (ev.target as Element).getAttribute('data-year'); if (y) selectYear(+y); });
}

function draw(host: HTMLElement, a: Row[], W: number, H: number, m: { l: number; r: number; t: number; b: number }, t: number) {
  const { X, Y } = scales(a, W, H, m);
  const pre = a.filter((d) => d.year <= 2011), post = a.filter((d) => d.year >= 2012);
  const v = (d: Row) => d.aqua + (d.harmonized - d.aqua) * t;
  const svg = host.querySelector('svg'); if (!svg) return;
  svg.querySelector('.sw-pre')!.setAttribute('d', pre.map((d, i) => `${i ? 'L' : 'M'}${X(d.year).toFixed(1)} ${Y(v(d)).toFixed(1)}`).join(' '));
  const lp = pre[pre.length - 1], fp = post[0];
  svg.querySelector('.sw-bridge')!.setAttribute('d', lp && fp ? `M${X(lp.year)} ${Y(v(lp))}L${X(fp.year)} ${Y(fp.raw)}` : '');
  pre.forEach((d, i) => { const c = svg.querySelectorAll('.sw-dots.pre circle')[i]; c.setAttribute('cx', String(X(d.year))); c.setAttribute('cy', String(Y(v(d)))); });
  svg.style.setProperty('--t', t.toFixed(3));
  host.classList.toggle('is-scale', t > 0.5);
}

function mark(host: HTMLElement, a: Row[], W: number, H: number, m: { l: number; r: number; t: number; b: number }) {
  const { X, Y } = scales(a, W, H, m), y = cur()!.year, d = a.find((r) => r.year === y);
  const g = host.querySelector<SVGGElement>('.sw-sel'); if (!g) return;
  if (!d) { g.style.display = 'none'; return; }
  g.style.display = '';
  const val = y <= 2011 ? (state.series === 'harm' ? d.harmonized : d.aqua) : d.raw;
  g.querySelector('line')!.setAttribute('x1', String(X(y))); g.querySelector('line')!.setAttribute('x2', String(X(y)));
  const c = g.querySelector('circle')!; c.setAttribute('cx', String(X(y))); c.setAttribute('cy', String(Y(val)));
}

export function switchKeys(host: HTMLElement, move: (d: number) => void) {
  host.addEventListener('keydown', (ev) => { const d: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -12, ArrowDown: 12 }; if (!(ev.key in d)) return; ev.preventDefault(); move(d[ev.key]); });
}
export const switchHost = () => $('switch');
