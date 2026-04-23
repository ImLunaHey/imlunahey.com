import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

// ─── seeded rng + sample generators ──────────────────────────────────────

function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(rng: () => number, mean = 0, std = 1): number {
  // Box-Muller
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + std * z;
}

function round2(x: number): number { return Math.round(x * 100) / 100; }

type Preset = { label: string; note: string; gen: () => number[] };
const PRESETS: Preset[] = [
  {
    label: 'iq scores',
    note: 'normal(100, 15) · n=80',
    gen: () => { const r = mulberry32(1); return Array.from({ length: 80 }, () => round2(normal(r, 100, 15))); },
  },
  {
    label: 'salaries',
    note: 'right-skewed · log-normal · n=80',
    gen: () => {
      const r = mulberry32(2);
      return Array.from({ length: 80 }, () => Math.round(Math.exp(normal(r, 10.7, 0.6))));
    },
  },
  {
    label: 'bimodal',
    note: 'two normals mixed · n=80',
    gen: () => {
      const r = mulberry32(3);
      return Array.from({ length: 80 }, () => round2(r() < 0.55 ? normal(r, 60, 4) : normal(r, 78, 5)));
    },
  },
  {
    label: 'uniform',
    note: 'uniform(0, 100) · n=60',
    gen: () => { const r = mulberry32(4); return Array.from({ length: 60 }, () => round2(r() * 100)); },
  },
  {
    label: 'heavy tails',
    note: 'laplace · n=100',
    gen: () => {
      const r = mulberry32(5);
      return Array.from({ length: 100 }, () => {
        const u = r() - 0.5;
        return round2(-Math.sign(u) * Math.log(1 - 2 * Math.abs(u)) * 12 + 50);
      });
    },
  },
  {
    label: 'with outliers',
    note: 'normal(50, 8) + 3 extreme · n=63',
    gen: () => {
      const r = mulberry32(6);
      const base = Array.from({ length: 60 }, () => round2(normal(r, 50, 8)));
      return [...base, 9, 105, 130];
    },
  },
];

const DEFAULT_SAMPLE = PRESETS[0].gen().join(', ');

// ─── stats ───────────────────────────────────────────────────────────────

function parseNumbers(text: string): number[] {
  return text
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map(Number)
    .filter((n) => Number.isFinite(n));
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (1 - (pos - lo)) + sorted[hi] * (pos - lo);
}

type Stats = {
  n: number;
  sorted: number[];
  min: number; max: number;
  mean: number; median: number; mode: number | null;
  variance: number; std: number;
  skew: number; kurt: number;
  q1: number; q3: number; iqr: number;
  p5: number; p95: number; p99: number;
  normalityP: number;
};

function computeStats(data: number[]): Stats | null {
  const n = data.length;
  if (n === 0) return null;
  const sorted = [...data].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[n - 1];
  const mean = data.reduce((s, x) => s + x, 0) / n;
  const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  const m3 = data.reduce((s, x) => s + (x - mean) ** 3, 0) / n;
  const m4 = data.reduce((s, x) => s + (x - mean) ** 4, 0) / n;
  const skew = std > 0 ? m3 / std ** 3 : 0;
  const kurt = std > 0 ? m4 / std ** 4 - 3 : 0;
  const q1 = quantile(sorted, 0.25);
  const median = quantile(sorted, 0.5);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  // mode: most frequent value (only if any dup)
  const counts = new Map<number, number>();
  for (const x of data) counts.set(x, (counts.get(x) ?? 0) + 1);
  let mode: number | null = null;
  let best = 1;
  for (const [v, c] of counts) if (c > best) { best = c; mode = v; }
  // D'Agostino-ish normality approx via K² on skewness + kurtosis
  const seSkew = Math.sqrt(6 / n);
  const seKurt = Math.sqrt(24 / n);
  const zSkew = skew / seSkew;
  const zKurt = kurt / seKurt;
  const K2 = zSkew * zSkew + zKurt * zKurt;
  const normalityP = n >= 8 ? Math.exp(-K2 / 2) : 1; // chi²(2) survival; too small n is meaningless

  return {
    n, sorted, min, max, mean, median, mode,
    variance, std, skew, kurt,
    q1, q3, iqr,
    p5: quantile(sorted, 0.05), p95: quantile(sorted, 0.95), p99: quantile(sorted, 0.99),
    normalityP,
  };
}

type Bin = { lo: number; hi: number; count: number; pct: number };

function histogram(sorted: number[], override?: number): Bin[] {
  const n = sorted.length;
  if (n === 0) return [];
  const min = sorted[0];
  const max = sorted[n - 1];
  if (min === max) return [{ lo: min, hi: max, count: n, pct: 1 }];
  let bins = override;
  if (!bins) {
    const q1 = quantile(sorted, 0.25);
    const q3 = quantile(sorted, 0.75);
    const iqr = q3 - q1;
    const h = iqr > 0 ? 2 * iqr * Math.pow(n, -1 / 3) : (max - min) / Math.ceil(Math.sqrt(n));
    bins = Math.max(5, Math.min(50, Math.ceil((max - min) / h)));
  }
  const width = (max - min) / bins;
  const counts = new Array(bins).fill(0);
  for (const x of sorted) {
    let idx = Math.floor((x - min) / width);
    if (idx >= bins) idx = bins - 1;
    counts[idx]++;
  }
  return counts.map((count, i) => ({
    lo: min + i * width, hi: min + (i + 1) * width, count, pct: count / n,
  }));
}

function kde(sorted: number[], xMin: number, xMax: number, points = 200): Array<{ x: number; y: number }> {
  const n = sorted.length;
  if (n < 2 || xMin === xMax) return [];
  const mean = sorted.reduce((s, x) => s + x, 0) / n;
  const std = Math.sqrt(sorted.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const spread = iqr > 0 ? Math.min(std, iqr / 1.34) : std;
  const h = spread > 0 ? 1.06 * spread * Math.pow(n, -1 / 5) : (xMax - xMin) / 20;
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < points; i++) {
    const x = xMin + (xMax - xMin) * (i / (points - 1));
    let y = 0;
    for (const xi of sorted) {
      const u = (x - xi) / h;
      y += Math.exp(-0.5 * u * u);
    }
    y /= n * h * Math.sqrt(2 * Math.PI);
    out.push({ x, y });
  }
  return out;
}

type Outliers = { iqr: Array<{ x: number; extreme: boolean }>; z: Array<{ x: number; z: number }> };

function detectOutliers(sorted: number[], s: Stats): Outliers {
  const lowFence = s.q1 - 1.5 * s.iqr;
  const highFence = s.q3 + 1.5 * s.iqr;
  const extremeLow = s.q1 - 3 * s.iqr;
  const extremeHigh = s.q3 + 3 * s.iqr;
  const iqr: Outliers['iqr'] = [];
  const z: Outliers['z'] = [];
  for (const x of sorted) {
    if (x < lowFence || x > highFence) iqr.push({ x, extreme: x < extremeLow || x > extremeHigh });
    if (s.std > 0) {
      const zz = (x - s.mean) / s.std;
      if (Math.abs(zz) > 3) z.push({ x, z: zz });
    }
  }
  return { iqr, z };
}

// Beasley-Springer-Moro inverse normal CDF
function probit(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-39.696830, 220.946099, -275.928510, 138.357752, -30.664798, 2.506628];
  const b = [-54.476099, 161.585837, -155.698980, 66.801312, -13.280681];
  const c = [-0.007784894, -0.322396458, -2.400758277, -2.549732539, 4.374664141, 2.938163983];
  const d = [0.007784695, 0.322467129, 2.445134137, 3.754408661];
  const pLow = 0.02425, pHigh = 1 - pLow;
  let q: number, r: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= pHigh) {
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

function qqPoints(sorted: number[]): Array<{ theoretical: number; observed: number }> {
  const n = sorted.length;
  return sorted.map((x, i) => ({ theoretical: probit((i + 0.5) / n), observed: x }));
}

function fmt(x: number, digits = 3): string {
  if (!Number.isFinite(x)) return '—';
  if (Math.abs(x) >= 1e6 || (Math.abs(x) > 0 && Math.abs(x) < 0.001)) return x.toExponential(2);
  return x.toLocaleString(undefined, { maximumFractionDigits: digits });
}

// ─── verdicts ────────────────────────────────────────────────────────────

function skewLabel(s: number): string {
  const a = Math.abs(s);
  if (a < 0.5) return 'symmetric';
  if (a < 1) return s > 0 ? 'mildly right-skewed' : 'mildly left-skewed';
  return s > 0 ? 'strongly right-skewed' : 'strongly left-skewed';
}

function kurtLabel(k: number): string {
  if (k < -0.5) return 'light tails (platykurtic)';
  if (k < 0.5) return 'mesokurtic';
  if (k < 3) return 'heavy tails (leptokurtic)';
  return 'very heavy tails';
}

function normalityLabel(p: number): { text: string; kind: 'ok' | 'maybe' | 'no' } {
  if (p > 0.1) return { text: 'consistent with normal', kind: 'ok' };
  if (p > 0.01) return { text: 'marginally non-normal', kind: 'maybe' };
  return { text: 'unlikely normal', kind: 'no' };
}

// ─── page ────────────────────────────────────────────────────────────────

export default function DistPage() {
  const [input, setInput] = useState(DEFAULT_SAMPLE);
  const [binOverride, setBinOverride] = useState<number | null>(null);
  const [logY, setLogY] = useState(false);

  const data = useMemo(() => parseNumbers(input), [input]);
  const stats = useMemo(() => computeStats(data), [data]);
  const bins = useMemo(() => stats ? histogram(stats.sorted, binOverride ?? undefined) : [], [stats, binOverride]);
  const density = useMemo(() => stats ? kde(stats.sorted, bins[0]?.lo ?? 0, bins[bins.length - 1]?.hi ?? 1) : [], [stats, bins]);
  const qq = useMemo(() => stats ? qqPoints(stats.sorted) : [], [stats]);
  const outs = useMemo(() => stats ? detectOutliers(stats.sorted, stats) : { iqr: [], z: [] }, [stats]);

  const loadPreset = (p: Preset) => setInput(p.gen().join(', '));
  const clear = () => setInput('');

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-dt">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">distribution</span>
        </div>

        <header className="dt-hd">
          <h1>distribution<span className="dot">.</span></h1>
          <p className="sub">
            paste a column of numbers — see the shape. histogram + kernel density, summary stats,
            q-q vs normal, outlier detection (iqr + z-score), and a soft "is this normal-ish?"
            verdict. all client-side.
          </p>
        </header>

        <textarea
          className="dt-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={4}
          spellCheck={false}
          autoComplete="off"
          placeholder={'paste numbers · newline / comma / tab / space separated\n12.3\n14.5\n...'}
        />

        <div className="dt-toolbar">
          <div className="dt-presets">
            <span className="dt-lbl">presets</span>
            {PRESETS.map((p) => (
              <button key={p.label} className="dt-chip" onClick={() => loadPreset(p)} title={p.note}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="dt-controls">
            <label className="dt-check">
              <input type="checkbox" checked={logY} onChange={(e) => setLogY(e.target.checked)} />
              log-scale y
            </label>
            <label className="dt-bins">
              bins
              <input
                type="number" min={3} max={80}
                value={binOverride ?? ''}
                onChange={(e) => setBinOverride(e.target.value ? Math.max(3, Math.min(80, Number(e.target.value))) : null)}
                placeholder="auto"
                className="dt-bin-input"
              />
            </label>
            <button className="dt-btn" onClick={clear}>clear</button>
          </div>
        </div>

        {!stats ? (
          <div className="dt-empty">paste some numbers to see the distribution.</div>
        ) : (
          <>
            <section className="dt-stats">
              <Stat k="count" v={fmt(stats.n, 0)} />
              <Stat k="mean" v={fmt(stats.mean)} accent />
              <Stat k="median" v={fmt(stats.median)} />
              <Stat k="std dev" v={fmt(stats.std)} />
              <Stat k="min" v={fmt(stats.min)} />
              <Stat k="max" v={fmt(stats.max)} />
              <Stat k="skewness" v={fmt(stats.skew)} sub={skewLabel(stats.skew)} />
              <Stat k="excess kurtosis" v={fmt(stats.kurt)} sub={kurtLabel(stats.kurt)} />
            </section>

            <Chart title={`histogram + kde · ${bins.length} bins`}>
              <HistChart bins={bins} density={density} stats={stats} logY={logY} />
            </Chart>

            <section className="dt-pair">
              <Chart title="q-q plot vs normal">
                <QQChart points={qq} />
              </Chart>
              <Chart title="box plot">
                <BoxPlot stats={stats} />
              </Chart>
            </section>

            <section className="dt-pair">
              <Chart title="quantiles">
                <ul className="dt-quant">
                  <QuantRow k="min" v={stats.min} />
                  <QuantRow k="5%" v={stats.p5} />
                  <QuantRow k="q1 · 25%" v={stats.q1} />
                  <QuantRow k="median · 50%" v={stats.median} />
                  <QuantRow k="q3 · 75%" v={stats.q3} />
                  <QuantRow k="95%" v={stats.p95} />
                  <QuantRow k="99%" v={stats.p99} />
                  <QuantRow k="max" v={stats.max} />
                  <QuantRow k="iqr" v={stats.iqr} />
                </ul>
              </Chart>
              <Chart title="normality hint">
                <NormalityPanel stats={stats} />
              </Chart>
            </section>

            <Chart title={`outliers · ${outs.iqr.length} by iqr · ${outs.z.length} by |z|>3`}>
              <OutlierList outs={outs} />
            </Chart>
          </>
        )}
      </main>
    </>
  );
}

// ─── sub-components ──────────────────────────────────────────────────────

function Stat({ k, v, sub, accent }: { k: string; v: string; sub?: string; accent?: boolean }) {
  return (
    <div className="dt-stat">
      <div className="dt-stat-k">{k}</div>
      <div className={`dt-stat-v ${accent ? 'accent' : ''}`}>{v}</div>
      {sub ? <div className="dt-stat-sub">{sub}</div> : null}
    </div>
  );
}

function Chart({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="dt-chart">
      <header className="dt-chart-hd">── {title}</header>
      <div className="dt-chart-body">{children}</div>
    </article>
  );
}

function QuantRow({ k, v }: { k: string; v: number }) {
  return (
    <li className="dt-q-row">
      <span>{k}</span>
      <b>{fmt(v)}</b>
    </li>
  );
}

function HistChart({ bins, density, stats, logY }: { bins: Bin[]; density: Array<{ x: number; y: number }>; stats: Stats; logY: boolean }) {
  const W = 720, H = 240, padL = 32, padR = 16, padT = 10, padB = 24;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  if (bins.length === 0) return null;

  const xMin = bins[0].lo;
  const xMax = bins[bins.length - 1].hi;
  const xOf = (x: number) => padL + ((x - xMin) / (xMax - xMin)) * innerW;

  // Scale histogram as density (so kde overlay is comparable)
  const binWidth = bins[0].hi - bins[0].lo;
  const histDensity = bins.map((b) => (b.count / stats.n) / binWidth);
  const maxHistDensity = Math.max(...histDensity, 1e-9);
  const maxKde = density.length ? Math.max(...density.map((d) => d.y)) : 0;
  const yMax = Math.max(maxHistDensity, maxKde) * 1.08;

  const yOf = (y: number) => {
    if (logY) {
      const yv = Math.max(y, 1e-9);
      const ymx = Math.max(yMax, 1e-9);
      return padT + innerH - (Math.log(yv + 1) / Math.log(ymx + 1)) * innerH;
    }
    return padT + innerH - (y / yMax) * innerH;
  };

  const densityPath = density.length > 0
    ? 'M ' + density.map((d) => `${xOf(d.x).toFixed(1)} ${yOf(d.y).toFixed(1)}`).join(' L ')
    : '';

  return (
    <svg className="dt-svg" viewBox={`0 0 ${W} ${H}`}>
      {/* axis */}
      <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="var(--color-border-bright)" strokeWidth="1" />
      {/* bars */}
      {bins.map((b, i) => {
        const d = histDensity[i];
        const y0 = yOf(d);
        const y1 = yOf(0);
        return (
          <g key={i}>
            <rect
              x={xOf(b.lo) + 1}
              y={y0}
              width={Math.max(0, xOf(b.hi) - xOf(b.lo) - 2)}
              height={Math.max(0, y1 - y0)}
              fill="var(--color-accent-dim)"
              opacity={0.5}
            />
            <title>{`[${fmt(b.lo, 2)}, ${fmt(b.hi, 2)}) · ${b.count}`}</title>
          </g>
        );
      })}
      {/* kde curve */}
      {densityPath ? (
        <path d={densityPath} fill="none" stroke="var(--color-accent)" strokeWidth="2" style={{ filter: 'drop-shadow(0 0 4px var(--accent-glow))' }} />
      ) : null}
      {/* mean + median markers */}
      <line x1={xOf(stats.mean)} y1={padT} x2={xOf(stats.mean)} y2={H - padB}
        stroke="#7cd3f7" strokeDasharray="4 3" strokeWidth="1" />
      <text x={xOf(stats.mean) + 4} y={padT + 12} fill="#7cd3f7" fontSize="10" fontFamily="var(--font-mono)">μ {fmt(stats.mean)}</text>
      <line x1={xOf(stats.median)} y1={padT} x2={xOf(stats.median)} y2={H - padB}
        stroke="#bf8cff" strokeDasharray="2 3" strokeWidth="1" />
      <text x={xOf(stats.median) + 4} y={padT + 26} fill="#bf8cff" fontSize="10" fontFamily="var(--font-mono)">med</text>
      {/* axis labels */}
      <text x={padL} y={H - 6} fill="var(--color-fg-faint)" fontSize="10" fontFamily="var(--font-mono)">{fmt(xMin, 2)}</text>
      <text x={W - padR} y={H - 6} textAnchor="end" fill="var(--color-fg-faint)" fontSize="10" fontFamily="var(--font-mono)">{fmt(xMax, 2)}</text>
    </svg>
  );
}

function QQChart({ points }: { points: Array<{ theoretical: number; observed: number }> }) {
  const W = 320, H = 240, pad = 24;
  if (points.length < 2) return <div className="dt-empty-inline">need more data</div>;
  const innerW = W - 2 * pad;
  const innerH = H - 2 * pad;
  const tMin = points[0].theoretical, tMax = points[points.length - 1].theoretical;
  const oMin = Math.min(...points.map((p) => p.observed));
  const oMax = Math.max(...points.map((p) => p.observed));
  const xOf = (t: number) => pad + ((t - tMin) / (tMax - tMin || 1)) * innerW;
  const yOf = (o: number) => pad + innerH - ((o - oMin) / (oMax - oMin || 1)) * innerH;
  // reference line: through (tMin, q1) and (tMax, q3) slope matched to normal
  const p25 = points[Math.floor(points.length * 0.25)];
  const p75 = points[Math.floor(points.length * 0.75)];
  const slope = (p75.observed - p25.observed) / (p75.theoretical - p25.theoretical || 1);
  const intercept = p25.observed - slope * p25.theoretical;
  const lineY1 = slope * tMin + intercept;
  const lineY2 = slope * tMax + intercept;
  return (
    <svg className="dt-svg" viewBox={`0 0 ${W} ${H}`}>
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--color-border-bright)" />
      <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="var(--color-border-bright)" />
      <line x1={xOf(tMin)} y1={yOf(lineY1)} x2={xOf(tMax)} y2={yOf(lineY2)}
        stroke="var(--color-warn)" strokeWidth="1" strokeDasharray="3 2" opacity="0.7" />
      {points.map((p, i) => (
        <circle key={i} cx={xOf(p.theoretical)} cy={yOf(p.observed)} r="2" fill="var(--color-accent)" />
      ))}
      <text x={pad} y={H - 4} fill="var(--color-fg-faint)" fontSize="10" fontFamily="var(--font-mono)">theoretical</text>
      <text x={W - pad} y={pad - 4} textAnchor="end" fill="var(--color-fg-faint)" fontSize="10" fontFamily="var(--font-mono)">observed</text>
    </svg>
  );
}

function BoxPlot({ stats }: { stats: Stats }) {
  const W = 320, H = 240, pad = 24;
  const innerH = H - 2 * pad;
  const whiskerLow = Math.max(stats.min, stats.q1 - 1.5 * stats.iqr);
  const whiskerHigh = Math.min(stats.max, stats.q3 + 1.5 * stats.iqr);
  const yMin = Math.min(stats.min, whiskerLow);
  const yMax = Math.max(stats.max, whiskerHigh);
  const yOf = (v: number) => pad + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;
  const cx = W / 2;
  const boxW = 70;
  return (
    <svg className="dt-svg" viewBox={`0 0 ${W} ${H}`}>
      {/* scale labels */}
      <text x={pad} y={pad + 4} fill="var(--color-fg-faint)" fontSize="10" fontFamily="var(--font-mono)">{fmt(yMax, 2)}</text>
      <text x={pad} y={H - pad + 4} fill="var(--color-fg-faint)" fontSize="10" fontFamily="var(--font-mono)">{fmt(yMin, 2)}</text>
      {/* whiskers */}
      <line x1={cx} y1={yOf(whiskerLow)} x2={cx} y2={yOf(stats.q1)} stroke="var(--color-fg-dim)" />
      <line x1={cx} y1={yOf(stats.q3)} x2={cx} y2={yOf(whiskerHigh)} stroke="var(--color-fg-dim)" />
      <line x1={cx - 20} y1={yOf(whiskerLow)} x2={cx + 20} y2={yOf(whiskerLow)} stroke="var(--color-fg-dim)" />
      <line x1={cx - 20} y1={yOf(whiskerHigh)} x2={cx + 20} y2={yOf(whiskerHigh)} stroke="var(--color-fg-dim)" />
      {/* box */}
      <rect x={cx - boxW / 2} y={yOf(stats.q3)} width={boxW} height={yOf(stats.q1) - yOf(stats.q3)}
        fill="color-mix(in oklch, var(--color-accent) 15%, transparent)" stroke="var(--color-accent-dim)" />
      {/* median line */}
      <line x1={cx - boxW / 2} y1={yOf(stats.median)} x2={cx + boxW / 2} y2={yOf(stats.median)}
        stroke="var(--color-accent)" strokeWidth="2" />
      {/* mean point */}
      <circle cx={cx} cy={yOf(stats.mean)} r="3" fill="#7cd3f7" />
      {/* outlier dots */}
      {stats.sorted.filter((x) => x < whiskerLow || x > whiskerHigh).map((x, i) => (
        <circle key={i} cx={cx} cy={yOf(x)} r="2.5" fill="var(--color-alert)" opacity="0.8" />
      ))}
      {/* labels */}
      <text x={cx + boxW / 2 + 6} y={yOf(stats.q3) + 4} fill="var(--color-fg-faint)" fontSize="10" fontFamily="var(--font-mono)">q3 {fmt(stats.q3, 1)}</text>
      <text x={cx + boxW / 2 + 6} y={yOf(stats.median) + 4} fill="var(--color-accent)" fontSize="10" fontFamily="var(--font-mono)">med {fmt(stats.median, 1)}</text>
      <text x={cx + boxW / 2 + 6} y={yOf(stats.q1) + 4} fill="var(--color-fg-faint)" fontSize="10" fontFamily="var(--font-mono)">q1 {fmt(stats.q1, 1)}</text>
    </svg>
  );
}

function NormalityPanel({ stats }: { stats: Stats }) {
  const lbl = normalityLabel(stats.normalityP);
  return (
    <div className={`dt-norm v-${lbl.kind}`}>
      <div className="dt-norm-verdict">{lbl.text}</div>
      <div className="dt-norm-p">p ≈ <b>{stats.normalityP.toFixed(3)}</b></div>
      <ul className="dt-norm-list">
        <li><span>skewness</span> <b>{fmt(stats.skew, 3)}</b> · <span className="t-faint">{skewLabel(stats.skew)}</span></li>
        <li><span>excess kurtosis</span> <b>{fmt(stats.kurt, 3)}</b> · <span className="t-faint">{kurtLabel(stats.kurt)}</span></li>
      </ul>
      <p className="dt-norm-note">
        approximate d'agostino K² test on skewness + kurtosis. for strict inference use a real
        shapiro-wilk — and treat any "normality test" with healthy scepticism (small samples hide
        non-normality, big samples flag trivial deviations).
      </p>
    </div>
  );
}

function OutlierList({ outs }: { outs: Outliers }) {
  const total = outs.iqr.length + outs.z.length;
  if (total === 0) return <div className="dt-empty-inline">no outliers detected</div>;
  const seen = new Map<number, { iqr?: boolean; extreme?: boolean; z?: number }>();
  for (const o of outs.iqr) seen.set(o.x, { ...(seen.get(o.x) ?? {}), iqr: true, extreme: o.extreme });
  for (const o of outs.z) seen.set(o.x, { ...(seen.get(o.x) ?? {}), z: o.z });
  return (
    <div className="dt-out-list">
      {[...seen.entries()].sort(([a], [b]) => a - b).map(([x, flags]) => (
        <div key={x} className={`dt-out ${flags.extreme ? 'extreme' : ''}`}>
          <span className="dt-out-v">{fmt(x, 3)}</span>
          {flags.iqr ? <span className={`dt-tag ${flags.extreme ? 'extreme' : ''}`}>iqr{flags.extreme ? ' · extreme' : ''}</span> : null}
          {flags.z !== undefined ? <span className="dt-tag">z={flags.z.toFixed(2)}</span> : null}
        </div>
      ))}
    </div>
  );
}

// ─── css ─────────────────────────────────────────────────────────────────

const CSS = `
  .shell-dt { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }
  .crumbs { padding-top: var(--sp-6); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .crumbs a { color: var(--color-fg-faint); text-decoration: none; }
  .crumbs a:hover { color: var(--color-accent); }
  .crumbs .sep { margin: 0 6px; }
  .crumbs .last { color: var(--color-accent); }

  .dt-hd { padding: 48px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .dt-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .dt-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .dt-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 62ch; margin-top: var(--sp-3); }

  .dt-input {
    width: 100%;
    margin: var(--sp-5) 0 var(--sp-2);
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    color: var(--color-fg);
    padding: var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    line-height: 1.5;
    resize: vertical;
    outline: 0;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .dt-input:focus { border-color: var(--color-accent-dim); }

  .dt-toolbar {
    display: flex; justify-content: space-between; gap: var(--sp-3);
    flex-wrap: wrap; align-items: center;
    margin-bottom: var(--sp-4);
  }
  .dt-presets, .dt-controls { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .dt-lbl { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; margin-right: 2px; }
  .dt-chip {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    background: transparent; color: var(--color-fg-dim);
    border: 1px solid var(--color-border); padding: 3px 9px;
    cursor: pointer; text-transform: lowercase;
  }
  .dt-chip:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .dt-check { display: inline-flex; align-items: center; gap: 4px; font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-dim); cursor: pointer; }
  .dt-check input { accent-color: var(--color-accent); }
  .dt-bins { display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); text-transform: lowercase; }
  .dt-bin-input {
    width: 52px;
    background: var(--color-bg-raised);
    color: var(--color-fg);
    border: 1px solid var(--color-border);
    padding: 2px 6px;
    font-family: var(--font-mono); font-size: var(--fs-xs);
    outline: 0;
  }
  .dt-btn {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    background: transparent; color: var(--color-fg-dim);
    border: 1px solid var(--color-border-bright); padding: 3px 9px;
    cursor: pointer; text-transform: lowercase;
  }
  .dt-btn:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }

  .dt-empty, .dt-empty-inline {
    padding: var(--sp-6);
    text-align: center;
    color: var(--color-fg-faint);
    font-family: var(--font-mono); font-size: var(--fs-sm);
    border: 1px dashed var(--color-border);
  }
  .dt-empty-inline { border: 0; padding: var(--sp-4); }

  .dt-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: var(--sp-2);
    margin-bottom: var(--sp-4);
  }
  .dt-stat { background: var(--color-bg-panel); border: 1px solid var(--color-border); padding: var(--sp-3); display: flex; flex-direction: column; gap: 2px; font-family: var(--font-mono); }
  .dt-stat-k { font-size: var(--fs-xs); color: var(--color-fg-faint); text-transform: lowercase; }
  .dt-stat-v { font-family: var(--font-display); font-size: clamp(22px, 2.4vw, 28px); font-weight: 500; color: var(--color-fg); line-height: 1.1; font-variant-numeric: tabular-nums; }
  .dt-stat-v.accent { color: var(--color-accent); text-shadow: 0 0 10px var(--accent-glow); }
  .dt-stat-sub { font-size: 10px; color: var(--color-fg-faint); margin-top: 2px; }

  .dt-chart { background: var(--color-bg-panel); border: 1px solid var(--color-border); margin-bottom: var(--sp-3); }
  .dt-chart-hd { padding: 8px var(--sp-3); border-bottom: 1px solid var(--color-border); background: linear-gradient(to bottom, #0c0c0c, #070707); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .dt-chart-body { padding: var(--sp-3); }

  .dt-svg { width: 100%; height: auto; display: block; }

  .dt-pair { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); margin-bottom: var(--sp-3); }

  .dt-quant { list-style: none; display: flex; flex-direction: column; gap: 2px; font-family: var(--font-mono); font-size: var(--fs-sm); }
  .dt-q-row {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: 4px 0;
    border-bottom: 1px dashed var(--color-border);
  }
  .dt-q-row:last-child { border-bottom: 0; }
  .dt-q-row span { color: var(--color-fg-faint); text-transform: lowercase; }
  .dt-q-row b { color: var(--color-fg); font-weight: 400; font-variant-numeric: tabular-nums; }

  .dt-norm { display: flex; flex-direction: column; gap: 6px; font-family: var(--font-mono); }
  .dt-norm-verdict { font-family: var(--font-display); font-size: var(--fs-xl); font-weight: 500; }
  .dt-norm.v-ok .dt-norm-verdict { color: var(--color-accent); }
  .dt-norm.v-maybe .dt-norm-verdict { color: var(--color-warn); }
  .dt-norm.v-no .dt-norm-verdict { color: var(--color-alert); }
  .dt-norm-p { font-size: var(--fs-sm); color: var(--color-fg-dim); }
  .dt-norm-p b { color: var(--color-fg); font-weight: 400; }
  .dt-norm-list { list-style: none; display: flex; flex-direction: column; gap: 2px; font-size: var(--fs-sm); }
  .dt-norm-list li { display: flex; gap: 6px; align-items: baseline; flex-wrap: wrap; }
  .dt-norm-list span { color: var(--color-fg-faint); }
  .dt-norm-list b { color: var(--color-fg); font-weight: 400; }
  .dt-norm-list .t-faint { color: var(--color-fg-faint); }
  .dt-norm-note { margin-top: var(--sp-2); font-size: 11px; color: var(--color-fg-faint); line-height: 1.5; }

  .dt-out-list { display: flex; flex-wrap: wrap; gap: 4px; }
  .dt-out {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 3px 8px;
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    font-family: var(--font-mono); font-size: var(--fs-xs);
  }
  .dt-out.extreme { border-color: var(--color-alert-dim); background: color-mix(in srgb, var(--color-alert) 6%, var(--color-bg-raised)); }
  .dt-out-v { color: var(--color-fg); font-variant-numeric: tabular-nums; }
  .dt-tag { color: var(--color-fg-faint); font-size: 10px; }
  .dt-tag.extreme { color: var(--color-alert); }

  @media (max-width: 720px) {
    .dt-pair { grid-template-columns: 1fr; }
  }
`;
