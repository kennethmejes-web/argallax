// Build a small land outline for the map from Natural Earth 1:10m (via world-atlas, public domain data).
import { readFileSync, writeFileSync } from 'node:fs';
import { feature } from 'topojson-client';
const topo = JSON.parse(readFileSync(new URL('../node_modules/world-atlas/land-10m.json', import.meta.url)));
const land = feature(topo, topo.objects.land);
const box = [113.5, 2.0, 130.0, 23.5];
const keep = [];
const round = (c) => [Math.round(c[0] * 100) / 100, Math.round(c[1] * 100) / 100];
function clip(ring) {
  const edges = [[(p) => p[0] >= box[0], (a, b) => ix(a, b, 0, box[0])], [(p) => p[0] <= box[2], (a, b) => ix(a, b, 0, box[2])],
                 [(p) => p[1] >= box[1], (a, b) => ix(a, b, 1, box[1])], [(p) => p[1] <= box[3], (a, b) => ix(a, b, 1, box[3])]];
  let out = ring;
  for (const [inside, cut] of edges) {
    const inp = out; out = [];
    for (let i = 0; i < inp.length; i++) {
      const cur = inp[i], prev = inp[(i + inp.length - 1) % inp.length];
      if (inside(cur)) { if (!inside(prev)) out.push(cut(prev, cur)); out.push(cur); }
      else if (inside(prev)) out.push(cut(prev, cur));
    }
    if (!out.length) return [];
  }
  out.push(out[0]);
  return out;
}
function ix(a, b, k, v) { const t = (v - a[k]) / (b[k] - a[k]); return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]; }
const simplify = (r) => { const out = []; for (const c of r.map(round)) { const l = out[out.length - 1]; if (!l || l[0] !== c[0] || l[1] !== c[1]) out.push(c); } return out; };
for (const f of land.features) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const p of polys) {
    const ring = p[0];
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [x, y] of ring) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    if (x1 >= box[0] && x0 <= box[2] && y1 >= box[1] && y0 <= box[3] && (x1 - x0) + (y1 - y0) > 0.04) {
      const rings = p.map((r) => simplify(clip(r.slice(0, -1)))).filter((r) => r.length >= 4);
      if (rings.length) keep.push(rings);
    }
  }
}
writeFileSync(new URL('../public/land.json', import.meta.url),
  JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: keep } }] }));
console.log('polygons', keep.length);
