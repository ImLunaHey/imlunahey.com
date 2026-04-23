// Shared equirectangular world background for the iss + lightning labs.
// Ships actual coastlines from natural earth 110m (public domain, ~135 KB
// of GeoJSON — edge-gzips to ~40 KB). The file lives at /data/world-land.geojson.
//
// Draw is synchronous: if the land data hasn't loaded yet, only the grid
// renders. Callers fire `ensureWorldLand()` at mount to kick off the load
// and re-invoke `drawWorldBg` when it resolves. That pattern lets the first
// paint be instant (just grid) and upgrade to full coastlines a frame later.

type Ring = [number, number][]; // [lon, lat]
type Polygon = Ring[];          // outer ring + any holes

let LAND: Polygon[] | null = null;
let loadPromise: Promise<void> | null = null;

export function ensureWorldLand(): Promise<void> {
  if (LAND) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const res = await fetch('/data/world-land.geojson');
      if (!res.ok) return;
      const j = (await res.json()) as {
        features: Array<{
          geometry: {
            type: 'Polygon' | 'MultiPolygon';
            coordinates: number[][][] | number[][][][];
          };
        }>;
      };
      const out: Polygon[] = [];
      for (const f of j.features) {
        if (f.geometry.type === 'Polygon') {
          out.push(f.geometry.coordinates as Polygon);
        } else if (f.geometry.type === 'MultiPolygon') {
          for (const p of f.geometry.coordinates as number[][][][]) out.push(p as Polygon);
        }
      }
      LAND = out;
    } catch {
      // leave LAND null — callers degrade to grid-only gracefully.
    }
  })();
  return loadPromise;
}

/**
 * Draws the shared phosphor-on-black world background into the given canvas
 * context. The caller should size the canvas beforehand; this fn fills the
 * whole rect. If `ensureWorldLand()` hasn't completed yet, land polygons are
 * skipped and only the grid is rendered.
 */
export function drawWorldBg(ctx: CanvasRenderingContext2D, W: number, H: number) {
  // black base
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // land polygons — if loaded. Fill with a muted phosphor green + thin stroke
  // for the coastline itself.
  if (LAND) {
    ctx.fillStyle = '#132218';
    ctx.strokeStyle = '#1f3a2a';
    ctx.lineWidth = 1;
    for (const polygon of LAND) {
      // first ring is the outer boundary, rest are holes. We just fill using
      // evenodd so holes subtract cleanly.
      const path = new Path2D();
      for (const ring of polygon) {
        if (ring.length === 0) continue;
        const [lon0, lat0] = ring[0];
        path.moveTo(((lon0 + 180) / 360) * W, ((90 - lat0) / 180) * H);
        for (let i = 1; i < ring.length; i++) {
          const [lon, lat] = ring[i];
          path.lineTo(((lon + 180) / 360) * W, ((90 - lat) / 180) * H);
        }
        path.closePath();
      }
      ctx.fill(path, 'evenodd');
      ctx.stroke(path);
    }
  }

  // grid — dim lines every 30°, brighter on equator + prime meridian. Drawn
  // last so land polygons don't cover the grid where they overlap.
  ctx.lineWidth = 1;
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = ((90 - lat) / 180) * H;
    ctx.strokeStyle = lat === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.035)';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  for (let lon = -150; lon <= 150; lon += 30) {
    const x = ((lon + 180) / 360) * W;
    ctx.strokeStyle = lon === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.035)';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
}

/** Convert lat/lon to canvas pixel coords using equirectangular projection. */
export function latLonToXY(lat: number, lon: number, W: number, H: number): [number, number] {
  return [((lon + 180) / 360) * W, ((90 - lat) / 180) * H];
}
