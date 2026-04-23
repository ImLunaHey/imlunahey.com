// Shared TfL unified-api client + palette. Every endpoint here is accessible
// from the browser without an app_key (CORS is open, rate limits are generous
// for non-commercial use). Base URL: https://api.tfl.gov.uk

export const TFL_BASE = 'https://api.tfl.gov.uk';

// Official line colours (as on the tube map) — primary + text-on.
// Sourced from tfl's open-data style guide; keep values in sync with the
// palette our labs use in /design-system if we ever formalise it.
export const LINE_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  'bakerloo':        { bg: '#b36305', fg: '#fff', label: 'Bakerloo' },
  'central':         { bg: '#e32017', fg: '#fff', label: 'Central' },
  'circle':          { bg: '#ffd300', fg: '#000', label: 'Circle' },
  'district':        { bg: '#00782a', fg: '#fff', label: 'District' },
  'dlr':             { bg: '#00a4a7', fg: '#fff', label: 'DLR' },
  'elizabeth':       { bg: '#6950a1', fg: '#fff', label: 'Elizabeth' },
  'elizabeth-line':  { bg: '#6950a1', fg: '#fff', label: 'Elizabeth' }, // mode-name fallback
  'hammersmith-city':{ bg: '#f3a9bb', fg: '#000', label: 'Hammersmith & City' },
  'jubilee':         { bg: '#a0a5a9', fg: '#000', label: 'Jubilee' },
  'metropolitan':    { bg: '#9b0056', fg: '#fff', label: 'Metropolitan' },
  'northern':        { bg: '#000000', fg: '#fff', label: 'Northern' },
  'piccadilly':      { bg: '#003688', fg: '#fff', label: 'Piccadilly' },
  'victoria':        { bg: '#0098d4', fg: '#fff', label: 'Victoria' },
  'waterloo-city':   { bg: '#95cdba', fg: '#000', label: 'Waterloo & City' },
  'liberty':         { bg: '#5d6061', fg: '#fff', label: 'Liberty' },
  'lioness':         { bg: '#ffa12c', fg: '#000', label: 'Lioness' },
  'mildmay':         { bg: '#0071fd', fg: '#fff', label: 'Mildmay' },
  'suffragette':     { bg: '#18a95d', fg: '#fff', label: 'Suffragette' },
  'weaver':          { bg: '#9b0058', fg: '#fff', label: 'Weaver' },
  'windrush':        { bg: '#dc241f', fg: '#fff', label: 'Windrush' },
  'tram':            { bg: '#66cc00', fg: '#000', label: 'Tram' },
  'cable-car':       { bg: '#ef7b10', fg: '#fff', label: 'IFS Cloud' },
  'london-overground': { bg: '#ee7c0e', fg: '#fff', label: 'Overground' },
};

export function lineColor(lineId: string): { bg: string; fg: string; label: string } {
  return LINE_COLORS[lineId] ?? { bg: '#9a9a9a', fg: '#000', label: lineId };
}

// Status severity numbers TfL returns. 10 = Good Service, lower = worse.
export function severityColor(sev: number): string {
  if (sev === 10) return '#6aeaa0'; // good service
  if (sev >= 8) return '#ffd166';   // minor delays / part closures
  if (sev >= 5) return '#ff9f6a';   // severe
  return '#ff5a5a';                  // closed / suspended
}

// ─── types ────────────────────────────────────────────────────────────────

export type LineStatus = {
  id: string;                      // line id, e.g. 'victoria'
  name: string;
  modeName: string;
  lineStatuses: Array<{
    statusSeverity: number;
    statusSeverityDescription: string;
    reason?: string;
  }>;
};

export type BikePoint = {
  id: string;
  commonName: string;
  lat: number;
  lon: number;
  bikes: number;
  emptyDocks: number;
  totalDocks: number;
  // raw standard bikes vs. e-bikes if the dock supports them
  standardBikes?: number;
  ebikes?: number;
};

export type Arrival = {
  id: string;
  lineId: string;
  lineName: string;
  platformName: string;
  towards: string;
  destinationName: string;
  timeToStation: number; // seconds
  expectedArrival: string;
  currentLocation: string;
  vehicleId?: string;
};

export type StopPointSummary = {
  id: string; // naptan id
  name: string;
  modes: string[];
};

export type AirQualityBand = {
  forecastType: string; // 'Current' | 'Forecast'
  forecastBand: string; // 'Low' | 'Moderate' | 'High' | 'Very High'
  forecastSummary: string;
  fromDate: string;
  toDate: string;
  nO2Band?: string;
  o3Band?: string;
  pM10Band?: string;
  pM25Band?: string;
  sO2Band?: string;
  publishedDate?: string;
};

export type RoadDisruption = {
  id: string;
  severity: string;
  category: string;
  subCategory?: string;
  comments?: string;
  location: string;
  corridorIds?: string[];
  point?: string; // 'lat,lon'
  currentUpdate?: string;
  startDateTime?: string;
  endDateTime?: string;
  status?: string;
};

// ─── clients ──────────────────────────────────────────────────────────────

export type LineStopPoint = {
  naptanId: string;
  commonName: string;
  lat: number;
  lon: number;
};

export async function fetchLineStopPoints(lineId: string): Promise<LineStopPoint[]> {
  const r = await fetch(`${TFL_BASE}/Line/${encodeURIComponent(lineId)}/StopPoints`);
  if (!r.ok) throw new Error(`line stoppoints ${r.status}`);
  const raw = (await r.json()) as Array<{
    stationNaptan?: string;
    naptanId: string;
    commonName: string;
    lat: number;
    lon: number;
  }>;
  // de-dupe by stationNaptan — some lines report multiple platforms for the same station
  const seen = new Set<string>();
  const out: LineStopPoint[] = [];
  for (const s of raw) {
    const id = s.stationNaptan ?? s.naptanId;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ naptanId: id, commonName: s.commonName.replace(/ (Underground|Rail|DLR) Station$/i, ''), lat: s.lat, lon: s.lon });
  }
  return out;
}

export async function fetchLineStatuses(
  modes: string[] = ['tube', 'dlr', 'elizabeth-line', 'overground', 'tram', 'cable-car'],
): Promise<LineStatus[]> {
  const url = `${TFL_BASE}/Line/Mode/${modes.join(',')}/Status`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`tfl status ${r.status}`);
  return r.json();
}

function readAdditional(props: Array<{ key: string; value: string }>, key: string): string | undefined {
  return props.find((p) => p.key === key)?.value;
}

export async function fetchBikePoints(): Promise<BikePoint[]> {
  const r = await fetch(`${TFL_BASE}/BikePoint`);
  if (!r.ok) throw new Error(`bikepoints ${r.status}`);
  const raw = (await r.json()) as Array<{
    id: string;
    commonName: string;
    lat: number;
    lon: number;
    additionalProperties: Array<{ key: string; value: string }>;
  }>;
  return raw.map((p) => {
    const bikes = Number(readAdditional(p.additionalProperties, 'NbBikes') ?? 0);
    const emptyDocks = Number(readAdditional(p.additionalProperties, 'NbEmptyDocks') ?? 0);
    const totalDocks = Number(readAdditional(p.additionalProperties, 'NbDocks') ?? 0);
    const standardBikes = Number(readAdditional(p.additionalProperties, 'NbStandardBikes') ?? 0);
    const ebikes = Number(readAdditional(p.additionalProperties, 'NbEBikes') ?? 0);
    return {
      id: p.id,
      commonName: p.commonName,
      lat: p.lat,
      lon: p.lon,
      bikes,
      emptyDocks,
      totalDocks,
      standardBikes,
      ebikes,
    };
  });
}

export async function fetchArrivals(naptanId: string): Promise<Arrival[]> {
  const r = await fetch(`${TFL_BASE}/StopPoint/${encodeURIComponent(naptanId)}/Arrivals`);
  if (!r.ok) throw new Error(`arrivals ${r.status}`);
  const raw = (await r.json()) as Arrival[];
  return raw.sort((a, b) => a.timeToStation - b.timeToStation);
}

export async function searchStopPoints(q: string): Promise<StopPointSummary[]> {
  if (q.trim().length < 2) return [];
  const url = `${TFL_BASE}/StopPoint/Search/${encodeURIComponent(q)}?modes=tube,dlr,elizabeth-line,overground,tram,bus`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const j = (await r.json()) as { matches: Array<{ id: string; name: string; modes: string[] }> };
  return j.matches.map((m) => ({ id: m.id, name: m.name, modes: m.modes }));
}

export async function fetchAirQuality(): Promise<AirQualityBand[]> {
  const r = await fetch(`${TFL_BASE}/AirQuality`);
  if (!r.ok) throw new Error(`airquality ${r.status}`);
  const j = (await r.json()) as { currentForecast?: AirQualityBand[] };
  return j.currentForecast ?? [];
}

export async function fetchRoadDisruptions(): Promise<RoadDisruption[]> {
  const r = await fetch(`${TFL_BASE}/Road/all/Disruption?stripContent=true`);
  if (!r.ok) throw new Error(`roads ${r.status}`);
  return r.json();
}
