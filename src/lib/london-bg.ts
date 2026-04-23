// Shared london map background for tfl labs. Real geographic data:
// - 33 borough polygons (public/data/london-boroughs.geojson, ~80 KB)
// - OSM motorways + trunk roads (public/data/london-roads.json, ~250 KB gz)
//
// Performance notes:
// - Every feature is baked into a Path2D + world-bbox once on first load,
//   then reused every frame. Without this, a redraw re-parsed ~13 k road
//   polylines each time and was visibly laggy on pan/zoom.
// - Each draw culls any feature whose bbox doesn't intersect the visible
//   world rect, so at higher zoom we touch a fraction of the data.
// - Thames + borough labels are still rebuilt per frame since there are
//   few of them.
//
// Draw is synchronous: if data hasn't loaded yet, only the thames + grid
// render. Callers `ensureLondonBoroughs()` + `ensureLondonRoads()` at
// mount and redraw once promises resolve.

import type { Viewport } from './canvas-viewport';

type Ring = [number, number][];
type Polygon = Ring[];
type Bbox = [number, number, number, number]; // [minX, minY, maxX, maxY] in world (canvas-buffer) coords

type Borough = {
  name: string;
  path: Path2D;
  bbox: Bbox;
  centroidLat: number;
  centroidLon: number;
};

type Way = { path: Path2D; bbox: Bbox };

type RoadLayers = { m: Way[]; t: Way[] };

// Shared world canvas size. All Path2D coords are baked against this size,
// and the viewport transform is applied at draw time. Keeping this constant
// lets us share one bake across callers.
const BAKE_W = 1200;
const BAKE_H = 700;

let BOROUGHS: Borough[] | null = null;
let ROADS: RoadLayers | null = null;
let boroughsPromise: Promise<void> | null = null;
let roadsPromise: Promise<void> | null = null;

// Offscreen canvas with every static map layer pre-rasterised. Built once
// after both data promises resolve. Drawing the map then costs one GPU
// drawImage call per frame instead of ~13 k ctx.stroke() calls.
//
// We render the offscreen at 2× the nominal world size so that when a user
// zooms past 1× the bitmap doesn't get too pixelated. 2 × 1200 × 700 × 4 B
// ≈ 13 MB of graphics memory — acceptable on desktop; mobile will pay a
// slight one-off cost but it's still well under a video frame's worth.
const OFFSCREEN_SCALE = 2;
let offscreenMap: HTMLCanvasElement | null = null;

// Greater london bbox used for lat/lon → buffer projection.
export const LONDON_BBOX = {
  west:  -0.52,
  east:   0.32,
  south: 51.28,
  north: 51.72,
};

export function lonToX(lon: number, W: number): number {
  return ((lon - LONDON_BBOX.west) / (LONDON_BBOX.east - LONDON_BBOX.west)) * W;
}

export function latToY(lat: number, H: number): number {
  return ((LONDON_BBOX.north - lat) / (LONDON_BBOX.north - LONDON_BBOX.south)) * H;
}

export function latLonToXY(lat: number, lon: number, W: number, H: number): [number, number] {
  return [lonToX(lon, W), latToY(lat, H)];
}

export function inBbox(lat: number, lon: number): boolean {
  return (
    lat >= LONDON_BBOX.south && lat <= LONDON_BBOX.north &&
    lon >= LONDON_BBOX.west && lon <= LONDON_BBOX.east
  );
}

function bboxIntersect(a: Bbox, b: Bbox): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

function worldViewportRect(vp: Viewport, W: number, H: number): Bbox {
  return [
    (0 - vp.tx) / vp.scale,
    (0 - vp.ty) / vp.scale,
    (W - vp.tx) / vp.scale,
    (H - vp.ty) / vp.scale,
  ];
}

// Threshold above which we abandon the cached bitmap (which starts looking
// blurry) and re-stroke vectors with per-way culling for crisp rendering.
// Tuned to roughly match the OFFSCREEN_SCALE so sampling stays close to 1:1
// at the cross-over.
const VECTOR_ZOOM_THRESHOLD = 2.5;

// ─── borough baking ───────────────────────────────────────────────────────

function polygonCentroid(poly: Polygon): [number, number] {
  const ring = poly[0] ?? [];
  if (ring.length === 0) return [0, 0];
  let sx = 0, sy = 0;
  for (const [lon, lat] of ring) { sx += lon; sy += lat; }
  return [sx / ring.length, sy / ring.length];
}

function bakeBorough(
  name: string,
  polys: Polygon[],
): Borough {
  const path = new Path2D();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const poly of polys) {
    for (const ring of poly) {
      if (ring.length === 0) continue;
      const [lon0, lat0] = ring[0];
      const x0 = lonToX(lon0, BAKE_W), y0 = latToY(lat0, BAKE_H);
      path.moveTo(x0, y0);
      if (x0 < minX) minX = x0; if (x0 > maxX) maxX = x0;
      if (y0 < minY) minY = y0; if (y0 > maxY) maxY = y0;
      for (let i = 1; i < ring.length; i++) {
        const [lon, lat] = ring[i];
        const x = lonToX(lon, BAKE_W), y = latToY(lat, BAKE_H);
        path.lineTo(x, y);
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
      path.closePath();
    }
  }
  const biggest = polys.reduce<Polygon>(
    (a, b) => ((b[0]?.length ?? 0) > (a[0]?.length ?? 0) ? b : a),
    polys[0] ?? [[]],
  );
  const [cLon, cLat] = polygonCentroid(biggest);
  return { name, path, bbox: [minX, minY, maxX, maxY], centroidLat: cLat, centroidLon: cLon };
}

export function ensureLondonBoroughs(): Promise<void> {
  if (BOROUGHS) return Promise.resolve();
  if (boroughsPromise) return boroughsPromise;
  boroughsPromise = (async () => {
    try {
      const r = await fetch('/data/london-boroughs.geojson');
      if (!r.ok) return;
      const j = (await r.json()) as {
        features: Array<{
          properties: { name?: string };
          geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] };
        }>;
      };
      const out: Borough[] = [];
      for (const f of j.features) {
        const polys: Polygon[] = [];
        if (f.geometry.type === 'Polygon') polys.push(f.geometry.coordinates as Polygon);
        else if (f.geometry.type === 'MultiPolygon') {
          for (const p of f.geometry.coordinates as number[][][][]) polys.push(p as Polygon);
        }
        out.push(bakeBorough(f.properties.name ?? 'Unknown', polys));
      }
      BOROUGHS = out;
    } catch { /* keep null */ }
  })();
  return boroughsPromise;
}

// ─── road baking ──────────────────────────────────────────────────────────

function bakeWay(flat: number[]): Way {
  const path = new Path2D();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const x0 = lonToX(flat[0], BAKE_W), y0 = latToY(flat[1], BAKE_H);
  path.moveTo(x0, y0);
  minX = maxX = x0; minY = maxY = y0;
  for (let i = 2; i < flat.length; i += 2) {
    const x = lonToX(flat[i], BAKE_W), y = latToY(flat[i + 1], BAKE_H);
    path.lineTo(x, y);
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return { path, bbox: [minX, minY, maxX, maxY] };
}

export function ensureLondonRoads(): Promise<void> {
  if (ROADS) return Promise.resolve();
  if (roadsPromise) return roadsPromise;
  roadsPromise = (async () => {
    try {
      const r = await fetch('/data/london-roads.json');
      if (!r.ok) return;
      const raw = (await r.json()) as { m: number[][]; t: number[][] };
      ROADS = {
        m: raw.m.map(bakeWay),
        t: raw.t.map(bakeWay),
      };
    } catch { /* keep null */ }
  })();
  return roadsPromise;
}

// ─── thames (hand-traced, kept for density contrast with the real roads) ──

const THAMES: [number, number][] = [
  [51.398, -0.475], [51.415, -0.42], [51.430, -0.40], [51.449, -0.345],
  [51.470, -0.320], [51.462, -0.295], [51.465, -0.270], [51.481, -0.250],
  [51.486, -0.228], [51.485, -0.210], [51.484, -0.190], [51.478, -0.175],
  [51.479, -0.160], [51.484, -0.145], [51.487, -0.128], [51.493, -0.122],
  [51.501, -0.124], [51.507, -0.118], [51.508, -0.108], [51.507, -0.097],
  [51.506, -0.088], [51.505, -0.076], [51.504, -0.065], [51.502, -0.055],
  [51.499, -0.045], [51.501, -0.032], [51.506, -0.022], [51.506, -0.010],
  [51.499, 0.002],  [51.490, 0.015],  [51.490, 0.030],  [51.497, 0.040],
  [51.507, 0.050],  [51.511, 0.065],  [51.503, 0.080],  [51.497, 0.105],
  [51.491, 0.125],  [51.483, 0.150],  [51.476, 0.175],  [51.471, 0.210],
];

let thamesPath: Path2D | null = null;
function thames(): Path2D {
  if (thamesPath) return thamesPath;
  const p = new Path2D();
  const [lat0, lon0] = THAMES[0];
  p.moveTo(lonToX(lon0, BAKE_W), latToY(lat0, BAKE_H));
  for (let i = 1; i < THAMES.length; i++) {
    const [lat, lon] = THAMES[i];
    p.lineTo(lonToX(lon, BAKE_W), latToY(lat, BAKE_H));
  }
  thamesPath = p;
  return p;
}

/**
 * Lazily build (and cache) the offscreen bitmap containing every static
 * layer. Returns null if either data source hasn't loaded yet.
 */
function buildOffscreen(): HTMLCanvasElement | null {
  if (offscreenMap) return offscreenMap;
  if (!BOROUGHS || !ROADS) return null;

  const c = document.createElement('canvas');
  const W = BAKE_W * OFFSCREEN_SCALE;
  const H = BAKE_H * OFFSCREEN_SCALE;
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return null;

  // scale up so the baked Path2Ds (in BAKE_W × BAKE_H coords) fill the
  // higher-res offscreen.
  ctx.scale(OFFSCREEN_SCALE, OFFSCREEN_SCALE);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, BAKE_W, BAKE_H);

  // boroughs — fill + outline
  ctx.fillStyle = '#0d1e14';
  ctx.strokeStyle = '#2a5040';
  ctx.lineWidth = 1;
  for (const b of BOROUGHS) {
    ctx.fill(b.path, 'evenodd');
    ctx.stroke(b.path);
  }

  // roads — trunk first so motorway paints on top
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.strokeStyle = 'rgba(200,220,210,0.55)';
  ctx.lineWidth = 1;
  for (const w of ROADS.t) ctx.stroke(w.path);

  ctx.strokeStyle = 'rgba(245,225,160,0.92)';
  ctx.lineWidth = 1.7;
  for (const w of ROADS.m) ctx.stroke(w.path);

  // thames body
  ctx.strokeStyle = '#2c5d85';
  ctx.lineWidth = 8;
  ctx.stroke(thames());
  ctx.strokeStyle = 'rgba(110,190,230,0.75)';
  ctx.lineWidth = 2.5;
  ctx.stroke(thames());

  offscreenMap = c;
  return c;
}

/**
 * Re-strokes every visible map layer as vectors. Slower than the bitmap
 * blit but produces pixel-crisp lines at any zoom level. Uses per-way
 * bbox culling so at high zoom we touch only a fraction of the data.
 */
function drawVectorBg(
  ctx: CanvasRenderingContext2D,
  _W: number, _H: number,
  vp: Viewport,
) {
  const vprect = worldViewportRect(vp, BAKE_W, BAKE_H);

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, BAKE_W, BAKE_H);

  if (BOROUGHS) {
    ctx.fillStyle = '#0d1e14';
    ctx.strokeStyle = '#2a5040';
    ctx.lineWidth = 1 / vp.scale;
    for (const b of BOROUGHS) {
      if (!bboxIntersect(b.bbox, vprect)) continue;
      ctx.fill(b.path, 'evenodd');
      ctx.stroke(b.path);
    }
  }

  if (ROADS) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(200,220,210,0.55)';
    ctx.lineWidth = 1 / vp.scale;
    for (const w of ROADS.t) {
      if (!bboxIntersect(w.bbox, vprect)) continue;
      ctx.stroke(w.path);
    }
    ctx.strokeStyle = 'rgba(245,225,160,0.92)';
    ctx.lineWidth = 1.7 / vp.scale;
    for (const w of ROADS.m) {
      if (!bboxIntersect(w.bbox, vprect)) continue;
      ctx.stroke(w.path);
    }
  }

  ctx.strokeStyle = '#2c5d85';
  ctx.lineWidth = 8 / vp.scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(thames());
  ctx.strokeStyle = 'rgba(110,190,230,0.75)';
  ctx.lineWidth = 2.5 / vp.scale;
  ctx.stroke(thames());
}

/**
 * Draws the london map background. At low zoom we blit a pre-baked bitmap
 * (one GPU draw call — fast). At high zoom we fall back to re-stroking
 * vectors (a bit slower but pixel-crisp — no blurry upscaling).
 *
 * If the underlying data hasn't loaded yet, fill black and let the caller's
 * dots render on their own; a later repaint will fill in the map.
 */
export function drawLondonBg(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  vp: Viewport,
) {
  if (vp.scale > VECTOR_ZOOM_THRESHOLD && BOROUGHS && ROADS) {
    drawVectorBg(ctx, W, H, vp);
    return;
  }
  const off = buildOffscreen();
  if (off) {
    ctx.drawImage(off, 0, 0, W, H);
  } else {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
  }
}

/**
 * Re-strokes the thames on top of whatever's been plotted since the bg.
 * Used by cycles / roads so dense dot layers don't paint over the river.
 */
export function drawThamesOverlay(ctx: CanvasRenderingContext2D, _W: number, _H: number, vp?: Viewport) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(110,190,230,0.85)';
  ctx.lineWidth = 2 / (vp?.scale ?? 1);
  ctx.stroke(thames());
  ctx.restore();
}

/**
 * Draws borough name labels at their centroids. Call this at identity
 * transform — we project the centroids through the supplied viewport so
 * labels stay crisp at any zoom. Skips labels whose projected centre
 * falls outside the canvas.
 */
export function drawBoroughLabels(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  vp: Viewport,
) {
  if (!BOROUGHS) return;
  ctx.save();
  ctx.font = '11px ui-monospace, "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const b of BOROUGHS) {
    const [wx, wy] = latLonToXY(b.centroidLat, b.centroidLon, BAKE_W, BAKE_H);
    const sx = wx * vp.scale + vp.tx;
    const sy = wy * vp.scale + vp.ty;
    if (sx < -40 || sx > W + 40 || sy < -20 || sy > H + 20) continue;

    const label = b.name.toUpperCase();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(label, sx, sy);
    ctx.fillStyle = 'rgba(220,240,230,0.85)';
    ctx.fillText(label, sx, sy);
  }
  ctx.restore();
}
