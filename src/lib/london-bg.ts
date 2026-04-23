// Shared london map background for tfl labs that render a map. We use a
// simplified thames path + m25 ring as the recognisable landmarks, plus a
// faint grid. No raster tiles, no external fetches — all inline.

// Greater london bounding box, tight enough that central density is readable.
// Tweak if you need to show more of the M25.
export const LONDON_BBOX = {
  west:  -0.52,
  east:   0.32,
  south: 51.28,
  north: 51.72,
};

// Thames path through greater london, ~40 hand-picked points running west →
// east. Good enough at a few hundred pixels wide to be obviously the thames.
const THAMES: [number, number][] = [
  // [lat, lon]
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

// M25 approx ring — 24 points clockwise around greater london. Same
// hand-traced approach; accurate enough to frame the city.
const M25: [number, number][] = [
  [51.717, -0.385], [51.711, -0.200], [51.700, -0.040], [51.694, 0.100],
  [51.674, 0.220],  [51.620, 0.300],  [51.540, 0.300],  [51.460, 0.280],
  [51.380, 0.220],  [51.335, 0.170],  [51.305, 0.100],  [51.300, 0.010],
  [51.295, -0.080], [51.300, -0.170], [51.315, -0.250], [51.335, -0.320],
  [51.370, -0.400], [51.420, -0.470], [51.485, -0.515], [51.555, -0.520],
  [51.625, -0.500], [51.675, -0.460], [51.705, -0.420], [51.717, -0.385],
];

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

function polyline(ctx: CanvasRenderingContext2D, pts: [number, number][], W: number, H: number) {
  if (pts.length === 0) return;
  ctx.beginPath();
  const [lat0, lon0] = pts[0];
  ctx.moveTo(lonToX(lon0, W), latToY(lat0, H));
  for (let i = 1; i < pts.length; i++) {
    const [lat, lon] = pts[i];
    ctx.lineTo(lonToX(lon, W), latToY(lat, H));
  }
  ctx.stroke();
}

/**
 * Draws the london map background: black fill, faint grid, M25 ring, thames
 * river. Caller sizes the canvas; this fills the whole rect.
 */
export function drawLondonBg(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // faint grid — every 0.1° of lon and 0.05° of lat
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  for (let lon = -0.6; lon <= 0.5; lon += 0.1) {
    const x = lonToX(lon, W);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let lat = 51.2; lat <= 51.8; lat += 0.05) {
    const y = latToY(lat, H);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // M25 ring — dashed, dim
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  polyline(ctx, M25, W, H);
  ctx.setLineDash([]);

  // thames — phosphor blue-green
  ctx.strokeStyle = '#2a5a80';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  polyline(ctx, THAMES, W, H);

  // thin highlight on top of the thames to make it pop
  ctx.strokeStyle = 'rgba(100,180,220,0.6)';
  ctx.lineWidth = 1.5;
  polyline(ctx, THAMES, W, H);
}
