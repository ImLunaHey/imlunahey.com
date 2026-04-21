import { Link } from '@tanstack/react-router';
import { useMemo, type ReactNode } from 'react';
import { SITE } from '../data';

// ─── deterministic mock data generator ────────────────────────────────────
// This whole file is placeholder — real data will come from a /api/health/ingest
// endpoint writing to D1. Numbers below are seeded so the page looks stable
// between renders and we can reason about layout.

type DayRow = {
  date: string; // yyyy-mm-dd
  steps: number;
  distance_km: number;
  active_kcal: number;
  exercise_min: number;
  stand_hours: number;
  flights: number;
  hr_resting: number;
  hr_avg: number;
  hrv_ms: number;
  sleep_asleep_min: number;
  sleep_start_hh: number; // 24h float for scatter (eg 22.5 = 22:30)
  sleep_end_hh: number;
  // sleep stages — sum ≈ sleep_asleep_min (+ awake minutes on top)
  sleep_deep_min: number;
  sleep_core_min: number;
  sleep_rem_min: number;
  sleep_awake_min: number;
  weight_kg: number;
  body_fat_pct: number;
  water_ml: number;
  water_drinks: number;
  vo2_max: number;
  // hearing — apple watch, daily avg + peak in dB
  headphone_db: number;
  env_db_avg: number;
  env_db_peak: number;
  // mood — ios 17 state of mind, -3 (very unpleasant) → +3 (very pleasant). null when unlogged.
  mood: number | null;
};

const MOOD_LABELS = ['very unpleasant', 'unpleasant', 'slightly unpleasant', 'neutral', 'slightly pleasant', 'pleasant', 'very pleasant'];
const moodLabel = (m: number) => MOOD_LABELS[Math.max(0, Math.min(6, m + 3))];

type BpRow = {
  measured_at: string;
  systolic: number;
  diastolic: number;
  pulse: number;
  slot: 'morning' | 'evening';
};

type Workout = {
  kind: string;
  start_at: string;
  duration_min: number;
  distance_km: number | null;
  kcal: number;
  hr_avg: number;
  hr_max: number;
};

type NoteRow = { date: string; text: string };

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A fixed "today" so the page looks identical between runs. Real page will
// use new Date() obviously.
const MOCK_TODAY = new Date('2026-04-21T08:30:00Z');

function buildMock(): {
  days: DayRow[];
  bp: BpRow[];
  workouts: Workout[];
  notes: NoteRow[];
} {
  const rng = mulberry32(0xc0ffee);
  const days: DayRow[] = [];
  const DAY_COUNT = 370; // ~1 year + a bit for the heatmap
  const noise = (amp: number) => (rng() - 0.5) * amp * 2;

  // baseline weight drifting down slowly over the year
  let weight = 72.5;
  for (let i = DAY_COUNT - 1; i >= 0; i--) {
    const d = new Date(MOCK_TODAY);
    d.setUTCDate(d.getUTCDate() - i);
    const dow = d.getUTCDay(); // 0=sun
    const iso = d.toISOString().slice(0, 10);

    const isWeekend = dow === 0 || dow === 6;
    const stepsBase = isWeekend ? 6500 : 9000;
    const steps = Math.max(0, Math.round(stepsBase + noise(3500) - (dow === 0 ? 1200 : 0)));

    weight += noise(0.15) - 0.003; // slow drift down
    if (weight < 70) weight += 0.1;
    if (weight > 74) weight -= 0.1;

    const sleepMin = 60 * (7 + noise(1.2));
    const sleepStartRaw = 22.5 + noise(1.5);
    const sleepStart = ((sleepStartRaw % 24) + 24) % 24;
    const sleepEnd = (sleepStart + sleepMin / 60) % 24;

    const asleep = Math.max(240, Math.round(sleepMin));
    // stages: deep ≈ 15-23%, rem ≈ 18-25%, core = rest, awake 5-25m
    const deepMin = Math.round(asleep * (0.15 + rng() * 0.08));
    const remMin = Math.round(asleep * (0.18 + rng() * 0.07));
    const coreMin = Math.max(60, asleep - deepMin - remMin);
    const awakeMin = Math.round(5 + rng() * 20);

    // hearing: weekdays louder (commute), some days spike on tube
    const isCommute = !isWeekend && rng() > 0.2;
    const envBase = isCommute ? 70 : 58;
    const envAvg = Math.round(envBase + noise(6));
    const envPeak = Math.round(envAvg + (isCommute ? 16 + rng() * 12 : 6 + rng() * 8));
    const headphone = Math.round(70 + noise(12));

    // mood: mostly null (not logged), slightly positive when present
    const moodLogged = rng() > 0.55;
    const mood = moodLogged ? Math.max(-3, Math.min(3, Math.round(0.6 + noise(2.2)))) : null;

    days.push({
      date: iso,
      steps,
      distance_km: +(steps / 1350 + noise(0.5)).toFixed(2),
      active_kcal: Math.round(steps * 0.045 + noise(60)),
      exercise_min: Math.max(0, Math.round(isWeekend ? 20 + noise(30) : 28 + noise(20))),
      stand_hours: Math.min(14, Math.max(6, Math.round(11 + noise(3)))),
      flights: Math.max(0, Math.round((isWeekend ? 4 : 9) + noise(5))),
      hr_resting: Math.round(58 + noise(4)),
      hr_avg: Math.round(76 + noise(8)),
      hrv_ms: +(48 + noise(12)).toFixed(1),
      sleep_asleep_min: asleep,
      sleep_start_hh: +sleepStart.toFixed(2),
      sleep_end_hh: +sleepEnd.toFixed(2),
      sleep_deep_min: deepMin,
      sleep_core_min: coreMin,
      sleep_rem_min: remMin,
      sleep_awake_min: awakeMin,
      weight_kg: +weight.toFixed(2),
      body_fat_pct: +(22 + noise(2)).toFixed(1),
      water_ml: Math.max(600, Math.round(2100 + noise(700))),
      water_drinks: Math.round(8 + noise(4)),
      vo2_max: +(41 + i * 0.002 + noise(0.8)).toFixed(1),
      headphone_db: headphone,
      env_db_avg: envAvg,
      env_db_peak: envPeak,
      mood,
    });
  }

  // Two BP readings per day for the last 60 days, roughly normal
  const bp: BpRow[] = [];
  for (let i = 0; i < 60; i++) {
    const d = new Date(MOCK_TODAY);
    d.setUTCDate(d.getUTCDate() - i);
    const dayPoints = [
      { h: 7, m: 30, slot: 'morning' as const },
      { h: 21, m: 15, slot: 'evening' as const },
    ];
    for (const p of dayPoints) {
      const mornBias = p.slot === 'morning' ? -3 : 0;
      const sys = Math.round(118 + mornBias + (rng() - 0.5) * 14);
      const dia = Math.round(76 + mornBias + (rng() - 0.5) * 10);
      const pulse = Math.round(63 + (rng() - 0.5) * 12);
      const at = new Date(d);
      at.setUTCHours(p.h, p.m, 0, 0);
      bp.push({
        measured_at: at.toISOString(),
        systolic: sys,
        diastolic: dia,
        pulse,
        slot: p.slot,
      });
    }
  }

  // Recent workouts — heavy bias toward outdoor walks + bike rides (no gym).
  const kinds = ['walking', 'cycling', 'walking', 'cycling', 'walking', 'cycling', 'walking', 'running'];
  const workouts: Workout[] = [];
  for (let i = 0; i < 14; i++) {
    const offsetDays = Math.floor(rng() * 30);
    const d = new Date(MOCK_TODAY);
    d.setUTCDate(d.getUTCDate() - offsetDays);
    d.setUTCHours(17 + Math.floor(rng() * 4), Math.floor(rng() * 60), 0, 0);
    const kind = kinds[Math.floor(rng() * kinds.length)];
    // walking is longer, cycling covers more ground, running is shorter
    const duration =
      kind === 'walking'
        ? Math.round(45 + rng() * 60)
        : kind === 'cycling'
          ? Math.round(30 + rng() * 50)
          : Math.round(25 + rng() * 20);
    const pacePerMin = kind === 'cycling' ? 0.35 : kind === 'running' ? 0.18 : 0.09;
    workouts.push({
      kind,
      start_at: d.toISOString(),
      duration_min: duration,
      distance_km: +(duration * pacePerMin + (rng() - 0.5) * 0.8).toFixed(2),
      kcal: Math.round(duration * (kind === 'walking' ? 5 : kind === 'cycling' ? 8 : 10) + (rng() - 0.5) * 40),
      hr_avg: Math.round((kind === 'walking' ? 105 : 135) + rng() * 15),
      hr_max: Math.round((kind === 'walking' ? 130 : 165) + rng() * 15),
    });
  }
  workouts.sort((a, b) => b.start_at.localeCompare(a.start_at));

  const notes: NoteRow[] = [
    { date: iso(MOCK_TODAY, -1), text: 'flew back from berlin. 4h sleep. expect resting hr bump.' },
    { date: iso(MOCK_TODAY, -3), text: 'new coffee — two shots at 5pm. stayed up til 02.' },
    { date: iso(MOCK_TODAY, -5), text: 'long run in the park, first time past 10k this year.' },
    { date: iso(MOCK_TODAY, -8), text: 'sick day. fever 37.9. low activity, extra water, lots of sleep.' },
    { date: iso(MOCK_TODAY, -12), text: 'started noting morning bp readings. goal: 2× daily for a month.' },
  ];

  return { days, bp, workouts, notes };
}

function iso(base: Date, deltaDays: number): string {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

// ─── formatters ────────────────────────────────────────────────────────────

const fmtNum = (n: number, digits = 0) => n.toLocaleString('en-GB', { maximumFractionDigits: digits });
const fmtKm = (n: number) => `${n.toFixed(1)} km`;
const fmtKcal = (n: number) => `${fmtNum(Math.round(n))} kcal`;
const fmtMin = (n: number) => {
  const h = Math.floor(n / 60);
  const m = Math.round(n % 60);
  return `${h}:${m.toString().padStart(2, '0')}`;
};
const fmtClock = (hh: number) => {
  const h = Math.floor(hh);
  const m = Math.round((hh - h) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};
// prefer liters once we're at ≥100ml — the page only shows meaningful sips there.
const fmtWater = (ml: number) => (ml >= 100 ? `${(ml / 1000).toFixed(1)}l` : `${ml}ml`);

type BpCategory = 'normal' | 'elevated' | 'stage1' | 'stage2' | 'crisis';
const bpCategory = (sys: number, dia: number): BpCategory => {
  if (sys >= 180 || dia >= 120) return 'crisis';
  if (sys >= 140 || dia >= 90) return 'stage2';
  if (sys >= 130 || dia >= 80) return 'stage1';
  if (sys >= 120) return 'elevated';
  return 'normal';
};
const BP_LABEL: Record<BpCategory, string> = {
  normal: 'normal',
  elevated: 'elevated',
  stage1: 'stage 1',
  stage2: 'stage 2',
  crisis: 'crisis',
};

// ─── charts (inline svg) ───────────────────────────────────────────────────

function StepsHeatmap({ days }: { days: DayRow[] }) {
  // 53 weeks × 7 days, most recent at right
  const WEEKS = 53;
  const cols: (DayRow | null)[][] = Array.from({ length: WEEKS }, () => Array(7).fill(null));

  if (days.length === 0) return <div className="hm-grid" aria-label="steps heatmap" />;

  // Align days to calendar weeks so a friday on a week boundary doesn't land
  // in the same column as the monday that follows it.
  const endDate = new Date(days[days.length - 1].date + 'T00:00:00Z');
  const endSundayMs = endDate.getTime() - endDate.getUTCDay() * 86400000;
  for (const d of days) {
    const dt = new Date(d.date + 'T00:00:00Z');
    const dow = dt.getUTCDay();
    const thisSundayMs = dt.getTime() - dow * 86400000;
    const weeksAgo = Math.round((endSundayMs - thisSundayMs) / (7 * 86400000));
    const col = WEEKS - 1 - weeksAgo;
    if (col >= 0 && col < WEEKS) cols[col][dow] = d;
  }

  const q = [0, 4000, 7000, 10000, 14000];
  const level = (steps: number) => {
    if (steps >= q[4]) return 4;
    if (steps >= q[3]) return 3;
    if (steps >= q[2]) return 2;
    if (steps >= q[1]) return 1;
    return 0;
  };

  return (
    <div className="hm-grid" role="img" aria-label="steps heatmap">
      {cols.map((col, ci) => (
        <div key={ci} className="hm-wk">
          {col.map((d, ri) =>
            d ? (
              <div
                key={d.date}
                className={`hm-d l${level(d.steps)}`}
                data-tip={`${d.steps.toLocaleString()} steps · ${d.date}`}
              />
            ) : (
              <div key={`e${ci}-${ri}`} className="hm-d empty" />
            ),
          )}
        </div>
      ))}
    </div>
  );
}

function AxisChart({
  yTicks,
  xStart,
  xEnd,
  children,
}: {
  yTicks: string[]; // top-to-bottom order
  xStart: string;
  xEnd: string;
  children: ReactNode;
}) {
  return (
    <div className="axis-chart">
      <div className="axis-y" aria-hidden="true">
        {yTicks.map((t, i) => (
          <span key={i}>{t}</span>
        ))}
      </div>
      <div className="axis-plot">{children}</div>
      <div className="axis-x" aria-hidden="true">
        <span>{xStart}</span>
        <span>{xEnd}</span>
      </div>
    </div>
  );
}

function Sparkline({
  values,
  labels,
  color = 'var(--color-accent)',
  fillOpacity = 0.15,
  height = 48,
}: {
  values: number[];
  labels?: string[];
  color?: string;
  fillOpacity?: number;
  height?: number;
}) {
  if (values.length === 0) return null;
  const W = 400;
  const H = height;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => [(i / (values.length - 1)) * W, H - ((v - min) / range) * (H - 4) - 2])
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
  const firstX = 0;
  const lastX = W;
  const bottom = H;
  return (
    <div className="chart-box" style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" style={{ display: 'block' }}>
        <polygon points={`${firstX},${bottom} ${pts} ${lastX},${bottom}`} fill={color} opacity={fillOpacity} />
        <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      {labels ? (
        <div className="chart-hits">
          {labels.map((lbl, i) => (
            <div key={i} className="chart-hit" data-tip={lbl} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BpScatter({ bp }: { bp: BpRow[] }) {
  // 30 days, systolic on Y axis (90-160), morning = accent, evening = cyan
  const recent = bp.slice(0, 60);
  const W = 600;
  const H = 160;
  const minY = 90;
  const maxY = 160;
  const now = new Date(MOCK_TODAY).getTime();
  const earliest = now - 30 * 24 * 3600 * 1000;
  const points = recent
    .map((r) => {
      const ms = new Date(r.measured_at).getTime();
      const x = ((ms - earliest) / (now - earliest)) * W;
      if (x < 0 || x > W) return null;
      const y = H - ((r.systolic - minY) / (maxY - minY)) * (H - 16) - 8;
      return { r, x, y };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);
  return (
    <div className="chart-box" style={{ height: H }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" style={{ display: 'block' }}>
        {/* AHA threshold lines — category boundaries */}
        {[120, 130, 140].map((t) => {
          const y = H - ((t - minY) / (maxY - minY)) * (H - 16) - 8;
          return (
            <line
              key={t}
              x1={0}
              y1={y}
              x2={W}
              y2={y}
              stroke="var(--color-border)"
              strokeDasharray="2 4"
            />
          );
        })}
        {points.map(({ r, x, y }) => {
          const color = r.slot === 'morning' ? 'var(--color-accent)' : 'oklch(0.78 0.11 210)';
          return <circle key={r.measured_at} cx={x} cy={y} r={3} fill={color} opacity={0.85} />;
        })}
      </svg>
      <div className="chart-hits scatter">
        {points.map(({ r, x, y }) => {
          const cat = bpCategory(r.systolic, r.diastolic);
          return (
            <div
              key={r.measured_at}
              className="chart-hit dot"
              style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` }}
              data-tip={`${r.measured_at.slice(5, 16).replace('T', ' ')} · ${r.systolic}/${r.diastolic} · ${r.slot} · ${BP_LABEL[cat]}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function SleepBars({ days }: { days: DayRow[] }) {
  const recent = days.slice(-30);
  const max = Math.max(...recent.map((d) => d.sleep_asleep_min));
  return (
    <div className="sleep-bars">
      {recent.map((d) => {
        const pct = (d.sleep_asleep_min / max) * 100;
        const good = d.sleep_asleep_min >= 7 * 60;
        return (
          <div key={d.date} className="sleep-bar" data-tip={`${d.date.slice(5)} · ${fmtMin(d.sleep_asleep_min)}`}>
            <div className={'sleep-fill' + (good ? ' good' : '')} style={{ height: `${pct}%` }} />
          </div>
        );
      })}
    </div>
  );
}

function WaterRing({ current, goal }: { current: number; goal: number }) {
  const pct = Math.min(1, current / goal);
  const R = 58;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - pct);
  return (
    <svg viewBox="0 0 140 140" width="140" height="140">
      <circle cx={70} cy={70} r={R} fill="none" stroke="var(--color-border-bright)" strokeWidth={10} />
      <circle
        cx={70}
        cy={70}
        r={R}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={offset}
        transform="rotate(-90 70 70)"
        style={{ filter: 'drop-shadow(0 0 6px var(--accent-glow))' }}
      />
      <text x="70" y="66" textAnchor="middle" fontFamily="var(--font-display)" fontSize="28" fill="var(--color-fg)">
        {fmtWater(current)}
      </text>
      <text x="70" y="88" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--color-fg-faint)" letterSpacing="2">
        {Math.round(pct * 100)}% of {goal / 1000}l
      </text>
    </svg>
  );
}

function WaterBars({ days }: { days: DayRow[] }) {
  const recent = days.slice(-30);
  const max = Math.max(...recent.map((d) => d.water_ml));
  return (
    <div className="water-bars">
      {recent.map((d) => {
        const pct = (d.water_ml / max) * 100;
        const hit = d.water_ml >= 2000;
        return (
          <div key={d.date} className="water-bar" data-tip={`${d.date.slice(5)} · ${fmtWater(d.water_ml)}`}>
            <div className={'water-fill' + (hit ? ' hit' : '')} style={{ height: `${pct}%` }} />
          </div>
        );
      })}
    </div>
  );
}

function SleepScatter({ days }: { days: DayRow[] }) {
  const recent = days.slice(-30);
  const W = 600;
  const H = 120;
  const yMin = 22;
  const yMax = 27;
  // Y = clock time (22 → 03). `<12` gets +24 so 01:30 becomes 25.5, keeping it continuous for scaling.
  const points = recent.map((d, i) => {
    const x = (i / (recent.length - 1)) * W;
    const hStart = d.sleep_start_hh < 12 ? d.sleep_start_hh + 24 : d.sleep_start_hh;
    const yStart = H - ((hStart - yMin) / (yMax - yMin)) * (H - 12) - 6;
    const hEnd = d.sleep_end_hh < 4 ? d.sleep_end_hh + 24 : d.sleep_end_hh;
    const yEnd = H - ((hEnd - yMin) / (yMax - yMin)) * (H - 12) - 6;
    return { d, x, yStart, yEnd };
  });
  return (
    <div className="chart-box" style={{ height: H }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" style={{ display: 'block' }}>
        {[22, 23, 24, 25, 26].map((h, i) => {
          const y = H - ((h - yMin) / (yMax - yMin)) * (H - 12) - 6;
          return (
            <line key={i} x1={0} y1={y} x2={W} y2={y} stroke="var(--color-border)" strokeDasharray="2 4" />
          );
        })}
        {points.map((p) => (
          <g key={p.d.date}>
            <line x1={p.x} y1={p.yStart} x2={p.x} y2={p.yEnd} stroke="var(--color-accent-dim)" strokeWidth={2} />
            <circle cx={p.x} cy={p.yStart} r={2.5} fill="var(--color-accent)" />
            <circle cx={p.x} cy={p.yEnd} r={2.5} fill="oklch(0.78 0.11 210)" />
          </g>
        ))}
      </svg>
      <div className="chart-hits">
        {points.map((p) => (
          <div
            key={p.d.date}
            className="chart-hit"
            data-tip={`${p.d.date.slice(5)} · ${fmtClock(p.d.sleep_start_hh)} → ${fmtClock(p.d.sleep_end_hh)} · ${fmtMin(p.d.sleep_asleep_min)}`}
          />
        ))}
      </div>
    </div>
  );
}

function FitnessRings({ move, moveGoal, exercise, exerciseGoal, stand, standGoal }: {
  move: number; moveGoal: number;
  exercise: number; exerciseGoal: number;
  stand: number; standGoal: number;
}) {
  const CX = 70;
  const CY = 70;
  const tracks = [
    { r: 58, value: move, goal: moveGoal, color: 'oklch(0.68 0.22 25)', label: 'move', unit: 'kcal' },
    { r: 45, value: exercise, goal: exerciseGoal, color: 'var(--color-accent)', label: 'exercise', unit: 'min' },
    { r: 32, value: stand, goal: standGoal, color: 'oklch(0.78 0.11 210)', label: 'stand', unit: 'h' },
  ];
  return (
    <svg viewBox="0 0 140 140" width="140" height="140">
      {tracks.map((t) => {
        const C = 2 * Math.PI * t.r;
        const pct = Math.min(1, t.value / t.goal);
        return (
          <g key={t.label}>
            <circle
              cx={CX}
              cy={CY}
              r={t.r}
              fill="none"
              stroke={t.color}
              strokeWidth={10}
              opacity={0.18}
            />
            <circle
              cx={CX}
              cy={CY}
              r={t.r}
              fill="none"
              stroke={t.color}
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - pct)}
              transform={`rotate(-90 ${CX} ${CY})`}
              style={{ filter: `drop-shadow(0 0 4px ${t.color})` }}
            />
          </g>
        );
      })}
    </svg>
  );
}

function SleepStagesBars({ days }: { days: DayRow[] }) {
  const recent = days.slice(-30);
  const max = Math.max(...recent.map((d) => d.sleep_deep_min + d.sleep_core_min + d.sleep_rem_min + d.sleep_awake_min));
  return (
    <div className="ss-bars">
      {recent.map((d) => {
        const total = d.sleep_deep_min + d.sleep_core_min + d.sleep_rem_min + d.sleep_awake_min;
        const h = (total / max) * 100;
        const deep = (d.sleep_deep_min / total) * h;
        const core = (d.sleep_core_min / total) * h;
        const rem = (d.sleep_rem_min / total) * h;
        const awake = (d.sleep_awake_min / total) * h;
        const tip = `${d.date.slice(5)} · deep ${d.sleep_deep_min}m · core ${d.sleep_core_min}m · rem ${d.sleep_rem_min}m · awake ${d.sleep_awake_min}m`;
        return (
          <div key={d.date} className="ss-bar" data-tip={tip}>
            <div className="ss-seg ss-awake" style={{ height: `${awake}%` }} />
            <div className="ss-seg ss-rem" style={{ height: `${rem}%` }} />
            <div className="ss-seg ss-core" style={{ height: `${core}%` }} />
            <div className="ss-seg ss-deep" style={{ height: `${deep}%` }} />
          </div>
        );
      })}
    </div>
  );
}

function SleepStagesBreakdown({ day }: { day: DayRow }) {
  const total = day.sleep_deep_min + day.sleep_core_min + day.sleep_rem_min + day.sleep_awake_min;
  const rows: { key: string; label: string; min: number; cls: string }[] = [
    { key: 'deep', label: 'deep', min: day.sleep_deep_min, cls: 'ss-deep' },
    { key: 'core', label: 'core', min: day.sleep_core_min, cls: 'ss-core' },
    { key: 'rem', label: 'rem', min: day.sleep_rem_min, cls: 'ss-rem' },
    { key: 'awake', label: 'awake', min: day.sleep_awake_min, cls: 'ss-awake' },
  ];
  return (
    <div className="ss-breakdown">
      {rows.map((r) => {
        const pct = (r.min / total) * 100;
        return (
          <div key={r.key} className="ss-row">
            <span className="ss-lbl">{r.label}</span>
            <div className="ss-track">
              <div className={`ss-fill ${r.cls}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="ss-val">{fmtMin(r.min)}</span>
            <span className="ss-pct">{pct.toFixed(0)}%</span>
          </div>
        );
      })}
    </div>
  );
}

function HearingBars({ days, field, danger }: { days: DayRow[]; field: 'headphone_db' | 'env_db_avg' | 'env_db_peak'; danger: number }) {
  const recent = days.slice(-30);
  const max = Math.max(danger + 10, ...recent.map((d) => d[field]));
  return (
    <div className="db-bars" style={{ ['--db-danger' as string]: `${100 - (danger / max) * 100}%` }}>
      {recent.map((d) => {
        const v = d[field];
        const pct = (v / max) * 100;
        const over = v >= danger;
        return (
          <div key={d.date} className="db-bar" data-tip={`${d.date.slice(5)} · ${v} dB${over ? ' · over safe limit' : ''}`}>
            <div className={'db-fill' + (over ? ' over' : '')} style={{ height: `${pct}%` }} />
          </div>
        );
      })}
    </div>
  );
}

const MOOD_COLORS = [
  'oklch(0.5 0.14 260)',  // -3 very unpleasant (deep blue)
  'oklch(0.6 0.12 260)',  // -2
  'oklch(0.7 0.1 260)',   // -1
  'oklch(0.62 0.02 270)', //  0 neutral (grey)
  'oklch(0.78 0.1 145)',  // +1
  'oklch(0.82 0.15 145)', // +2
  'var(--color-accent)',  // +3 very pleasant
];
const moodColor = (m: number) => MOOD_COLORS[Math.max(0, Math.min(6, m + 3))];

function MoodGrid({ days }: { days: DayRow[] }) {
  const recent = days.slice(-30);
  return (
    <div className="mood-grid">
      {recent.map((d) => {
        if (d.mood === null) {
          return <div key={d.date} className="mood-cell empty" data-tip={`${d.date.slice(5)} · not logged`} />;
        }
        return (
          <div
            key={d.date}
            className="mood-cell"
            style={{ background: moodColor(d.mood) }}
            data-tip={`${d.date.slice(5)} · ${moodLabel(d.mood)}`}
          />
        );
      })}
    </div>
  );
}

// ─── page ──────────────────────────────────────────────────────────────────

export default function HealthPage() {
  const { days, bp, workouts, notes } = useMemo(buildMock, []);
  const today = days[days.length - 1];
  const lastBp = bp[0];
  const cat = bpCategory(lastBp.systolic, lastBp.diastolic);
  const waterGoal = 2500;

  const thirtyDays = days.slice(-30);
  const ninetyDays = days.slice(-90);

  const rhrVals = ninetyDays.map((d) => d.hr_resting);
  const hrvVals = ninetyDays.map((d) => d.hrv_ms);
  const rhrMax = Math.max(...rhrVals);
  const rhrMin = Math.min(...rhrVals);
  const hrvMax = Math.max(...hrvVals);
  const hrvMin = Math.min(...hrvVals);
  const ninetyStart = ninetyDays[0].date.slice(5); // mm-dd
  const todayMd = days[days.length - 1].date.slice(5);
  const bpStart = new Date(new Date(MOCK_TODAY).getTime() - 30 * 86400000).toISOString().slice(5, 10);

  const morning7 = bp.filter((r) => r.slot === 'morning').slice(0, 7);
  const evening7 = bp.filter((r) => r.slot === 'evening').slice(0, 7);
  const avgSys = (rows: BpRow[]) => Math.round(rows.reduce((s, r) => s + r.systolic, 0) / rows.length);
  const avgDia = (rows: BpRow[]) => Math.round(rows.reduce((s, r) => s + r.diastolic, 0) / rows.length);

  const ytd = days.filter((d) => d.date.startsWith(today.date.slice(0, 4)));
  const ytdSteps = ytd.reduce((s, d) => s + d.steps, 0);
  const ytdDistance = ytd.reduce((s, d) => s + d.distance_km, 0);

  // Apple Fitness ring goals — typical defaults, tweak per user later.
  const MOVE_GOAL = 500;
  const EX_GOAL = 30;
  const STAND_GOAL = 12;

  // outdoor workout nudge: days since last walk/bike/run
  const OUTDOOR_KINDS = new Set(['walking', 'cycling', 'running']);
  const lastOutdoor = workouts.find((w) => OUTDOOR_KINDS.has(w.kind));
  const daysSinceOutdoor = lastOutdoor
    ? Math.floor((new Date(MOCK_TODAY).getTime() - new Date(lastOutdoor.start_at).getTime()) / 86400000)
    : null;
  const sevenDayOutdoorKm = workouts
    .filter((w) => OUTDOOR_KINDS.has(w.kind))
    .filter((w) => new Date(w.start_at).getTime() > new Date(MOCK_TODAY).getTime() - 7 * 86400000)
    .reduce((s, w) => s + (w.distance_km ?? 0), 0);

  // hearing + mood latest
  const weekHdAvg = Math.round(days.slice(-7).reduce((s, d) => s + d.headphone_db, 0) / 7);
  const weekEnvAvg = Math.round(days.slice(-7).reduce((s, d) => s + d.env_db_avg, 0) / 7);
  const weekEnvPeak = Math.max(...days.slice(-7).map((d) => d.env_db_peak));
  const weekEnvPeakDay = days.slice(-7).find((d) => d.env_db_peak === weekEnvPeak);
  const moodLogged = thirtyDays.filter((d) => d.mood !== null) as (DayRow & { mood: number })[];
  const moodAvg = moodLogged.length ? moodLogged.reduce((s, d) => s + d.mood, 0) / moodLogged.length : 0;

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-h">
        <header className="page-hd">
          <div className="label">~/health</div>
          <h1>
            health<span className="dot">.</span>
          </h1>
          <p className="sub">
            a live dashboard of sleep, movement, heart, and hydration. my iphone syncs to{' '}
            <code className="inline">/api/health/ingest</code> once a day; apple watch handles most of it, an omron
            cuff handles morning + evening bp, and a smart bottle logs every sip. everything below is{' '}
            <b className="t-warn">mock data</b> while the ingest endpoint lives in a branch — real readings will land
            here once the pipeline ships.
          </p>
          <div className="meta">
            <span>
              last sync <b suppressHydrationWarning>{today.date} · 06:02</b>
            </span>
            <span>
              days tracked <b>{days.length}</b>
            </span>
            <span>
              source <b className="t-accent">apple health → d1</b>
            </span>
          </div>
        </header>

        {/* 01 · NOW */}
        <div className="section-hd">
          <h2>
            <span className="num">01 //</span>now.
          </h2>
          <span className="src">snapshot · today</span>
        </div>
        <section className="bento">
          <div className="panel c-rings">
            <div className="panel-hd">
              <span className="ttl">./rings --today</span>
              <span className="src-tag">// move · exercise · stand</span>
            </div>
            <div className="rings-wrap">
              <FitnessRings
                move={today.active_kcal}
                moveGoal={MOVE_GOAL}
                exercise={today.exercise_min}
                exerciseGoal={EX_GOAL}
                stand={today.stand_hours}
                standGoal={STAND_GOAL}
              />
              <dl className="rings-dl">
                <dt><span className="rk rk-move">●</span> move</dt>
                <dd>{today.active_kcal}<span className="dim"> / {MOVE_GOAL}</span></dd>
                <dt><span className="rk rk-ex">●</span> exercise</dt>
                <dd>{today.exercise_min}<span className="dim"> / {EX_GOAL}m</span></dd>
                <dt><span className="rk rk-stand">●</span> stand</dt>
                <dd>{today.stand_hours}<span className="dim"> / {STAND_GOAL}h</span></dd>
              </dl>
            </div>
          </div>

          <div className="panel c-steps">
            <div className="panel-hd">
              <span className="ttl">./steps --today</span>
              <span className="src-tag">// apple watch</span>
            </div>
            <div className="big-num">
              <span className="num-val">{fmtNum(today.steps)}</span>
              <span className="num-unit">steps</span>
            </div>
            <div className="stat-line">
              <span>{fmtKm(today.distance_km)}</span>
              <span>·</span>
              <span>{fmtKcal(today.active_kcal)}</span>
              <span>·</span>
              <span>{today.flights} flights</span>
            </div>
          </div>

          <div className="panel c-bp">
            <div className="panel-hd">
              <span className="ttl">./bp --latest</span>
              <span className="src-tag">// omron</span>
            </div>
            <div className="bp-big">
              <span className="bp-sys">{lastBp.systolic}</span>
              <span className="bp-sep">/</span>
              <span className="bp-dia">{lastBp.diastolic}</span>
            </div>
            <div className="stat-line">
              <span className={`bp-chip cat-${cat}`}>● {BP_LABEL[cat]}</span>
              <span>·</span>
              <span className="t-faint">{lastBp.slot}</span>
              <span>·</span>
              <span className="t-faint">{lastBp.pulse} bpm</span>
            </div>
          </div>

          <div className="panel c-hr">
            <div className="panel-hd">
              <span className="ttl">./hr --resting</span>
              <span className="src-tag">// live</span>
            </div>
            <div className="big-num">
              <span className="num-val">{today.hr_resting}</span>
              <span className="num-unit">bpm</span>
            </div>
            <div className="stat-line">
              <span>hrv {today.hrv_ms}ms</span>
              <span>·</span>
              <span>vo₂ {today.vo2_max}</span>
            </div>
          </div>

          <div className="panel c-sleep">
            <div className="panel-hd">
              <span className="ttl">./sleep --last</span>
              <span className="src-tag">// watch</span>
            </div>
            <div className="big-num">
              <span className="num-val">{fmtMin(today.sleep_asleep_min)}</span>
              <span className="num-unit">h:m</span>
            </div>
            <div className="stat-line">
              <span>{fmtClock(today.sleep_start_hh)}</span>
              <span>→</span>
              <span>{fmtClock(today.sleep_end_hh)}</span>
            </div>
          </div>

          <div className="panel c-water">
            <div className="panel-hd">
              <span className="ttl">./water --today</span>
              <span className="src-tag">// bottle ble</span>
            </div>
            <div className="ring-wrap">
              <WaterRing current={today.water_ml} goal={waterGoal} />
            </div>
            <div className="stat-line">
              <span>{today.water_drinks} drinks</span>
              <span>·</span>
              <span>goal {waterGoal / 1000}l</span>
            </div>
          </div>
        </section>

        {/* 02 · MOVEMENT */}
        <div className="section-hd">
          <h2>
            <span className="num">02 //</span>movement.
          </h2>
          <span className="src">ytd · {fmtNum(ytdSteps)} steps · {fmtNum(ytdDistance, 0)} km</span>
        </div>
        <section className="bento">
          <div className="panel c-heatmap">
            <div className="panel-hd">
              <span className="ttl">steps · year</span>
              <span className="src-tag">// each cell = one day</span>
            </div>
            <StepsHeatmap days={days} />
            <div className="legend">
              <span className="t-faint">less</span>
              <span className="hm-key l0" />
              <span className="hm-key l1" />
              <span className="hm-key l2" />
              <span className="hm-key l3" />
              <span className="hm-key l4" />
              <span className="t-faint">more</span>
            </div>
          </div>

          <div className="panel c-exercise">
            <div className="panel-hd">
              <span className="ttl">exercise min · 30 days</span>
            </div>
            <Sparkline
              values={thirtyDays.map((d) => d.exercise_min)}
              labels={thirtyDays.map((d) => `${d.date.slice(5)} · ${d.exercise_min}m`)}
              height={64}
            />
            <div className="stat-line">
              <span>
                avg <b>{fmtNum(thirtyDays.reduce((s, d) => s + d.exercise_min, 0) / thirtyDays.length, 0)}m</b>
              </span>
              <span>
                total <b>{fmtNum(thirtyDays.reduce((s, d) => s + d.exercise_min, 0))}m</b>
              </span>
            </div>
          </div>
        </section>

        {/* 03 · CARDIO */}
        <div className="section-hd">
          <h2>
            <span className="num">03 //</span>cardio.
          </h2>
          <span className="src">resting hr · hrv · vo₂ max</span>
        </div>
        <section className="bento">
          <div className="panel c-rhr">
            <div className="panel-hd">
              <span className="ttl">resting hr · 90 days</span>
              <span className="src-tag">// bpm</span>
            </div>
            <AxisChart
              yTicks={[`${Math.round(rhrMax)} bpm`, `${Math.round((rhrMax + rhrMin) / 2)}`, `${Math.round(rhrMin)}`]}
              xStart={ninetyStart}
              xEnd={todayMd}
            >
              <Sparkline
                values={rhrVals}
                labels={ninetyDays.map((d) => `${d.date.slice(5)} · ${d.hr_resting} bpm`)}
                color="var(--color-accent)"
                height={80}
              />
            </AxisChart>
            <div className="stat-line">
              <span>
                latest <b>{today.hr_resting}</b>
              </span>
              <span>
                avg <b>{Math.round(ninetyDays.reduce((s, d) => s + d.hr_resting, 0) / ninetyDays.length)}</b>
              </span>
            </div>
          </div>

          <div className="panel c-hrv">
            <div className="panel-hd">
              <span className="ttl">hrv · 90 days</span>
              <span className="src-tag">// ms</span>
            </div>
            <AxisChart
              yTicks={[`${hrvMax.toFixed(0)} ms`, `${((hrvMax + hrvMin) / 2).toFixed(0)}`, `${hrvMin.toFixed(0)}`]}
              xStart={ninetyStart}
              xEnd={todayMd}
            >
              <Sparkline
                values={hrvVals}
                labels={ninetyDays.map((d) => `${d.date.slice(5)} · ${d.hrv_ms} ms`)}
                color="oklch(0.78 0.11 210)"
                height={80}
              />
            </AxisChart>
            <div className="stat-line">
              <span>
                latest <b>{today.hrv_ms}ms</b>
              </span>
              <span>
                avg <b>{(ninetyDays.reduce((s, d) => s + d.hrv_ms, 0) / ninetyDays.length).toFixed(1)}ms</b>
              </span>
            </div>
          </div>
        </section>

        {/* 04 · BLOOD PRESSURE */}
        <div className="section-hd">
          <h2>
            <span className="num">04 //</span>blood pressure.
          </h2>
          <span className="src">omron · 2× daily</span>
        </div>
        <section className="bento">
          <div className="panel c-bp-detail">
            <div className="panel-hd">
              <span className="ttl">systolic · 30 days</span>
              <span className="src-tag">
                <span className="dot-morning">●</span> morning <span className="dot-evening">●</span> evening
              </span>
            </div>
            <AxisChart yTicks={['160 mmHg', '140', '130', '120', '90']} xStart={bpStart} xEnd={todayMd}>
              <BpScatter bp={bp} />
            </AxisChart>
          </div>
          <div className="panel c-bp-stats">
            <div className="panel-hd">
              <span className="ttl">averages · last 7 readings</span>
            </div>
            <dl className="avg-dl">
              <dt>morning</dt>
              <dd>
                <b>{avgSys(morning7)}/{avgDia(morning7)}</b>
              </dd>
              <dt>evening</dt>
              <dd>
                <b>{avgSys(evening7)}/{avgDia(evening7)}</b>
              </dd>
              <dt>recent readings</dt>
              <dd className="recent-list">
                {bp.slice(0, 5).map((r) => {
                  const c = bpCategory(r.systolic, r.diastolic);
                  return (
                    <div key={r.measured_at} className="recent-row">
                      <span className="t-faint">{r.measured_at.slice(5, 16).replace('T', ' ')}</span>
                      <span>
                        {r.systolic}/{r.diastolic}
                      </span>
                      <span className={`bp-chip cat-${c}`}>{BP_LABEL[c]}</span>
                    </div>
                  );
                })}
              </dd>
            </dl>
          </div>
        </section>

        {/* 05 · SLEEP */}
        <div className="section-hd">
          <h2>
            <span className="num">05 //</span>sleep.
          </h2>
          <span className="src">watch · 30 days</span>
        </div>
        <section className="bento">
          <div className="panel c-sleep-stages">
            <div className="panel-hd">
              <span className="ttl">stages · 30 days</span>
              <span className="src-tag">
                <span className="ss-key ss-awake" /> awake{' '}
                <span className="ss-key ss-rem" /> rem{' '}
                <span className="ss-key ss-core" /> core{' '}
                <span className="ss-key ss-deep" /> deep
              </span>
            </div>
            <SleepStagesBars days={days} />
          </div>
          <div className="panel c-sleep-last">
            <div className="panel-hd">
              <span className="ttl">last night · breakdown</span>
              <span className="src-tag">// {fmtMin(today.sleep_asleep_min)} asleep</span>
            </div>
            <SleepStagesBreakdown day={today} />
          </div>
          <div className="panel c-sleep-bars">
            <div className="panel-hd">
              <span className="ttl">duration · 30 days</span>
              <span className="src-tag">// ≥ 7h marked bright</span>
            </div>
            <SleepBars days={days} />
          </div>
          <div className="panel c-sleep-scatter">
            <div className="panel-hd">
              <span className="ttl">bedtime → wake · 30 days</span>
              <span className="src-tag">
                <span className="dot-morning">●</span> asleep <span className="dot-evening">●</span> awake
              </span>
            </div>
            <AxisChart yTicks={['03:00', '00:00', '22:00']} xStart={bpStart} xEnd={todayMd}>
              <SleepScatter days={days} />
            </AxisChart>
          </div>
        </section>

        {/* 06 · HYDRATION */}
        <div className="section-hd">
          <h2>
            <span className="num">06 //</span>hydration.
          </h2>
          <span className="src">bottle · 30 days</span>
        </div>
        <section className="bento">
          <div className="panel c-water-bars">
            <div className="panel-hd">
              <span className="ttl">water · 30 days</span>
              <span className="src-tag">// goal {waterGoal / 1000}l</span>
            </div>
            <WaterBars days={days} />
          </div>
        </section>

        {/* 07 · BODY */}
        <div className="section-hd">
          <h2>
            <span className="num">07 //</span>body.
          </h2>
          <span className="src">weight · body fat</span>
        </div>
        <section className="bento">
          <div className="panel c-weight">
            <div className="panel-hd">
              <span className="ttl">weight · 90 days</span>
            </div>
            <Sparkline
              values={ninetyDays.map((d) => d.weight_kg)}
              labels={ninetyDays.map((d) => `${d.date.slice(5)} · ${d.weight_kg} kg`)}
              color="oklch(0.82 0.13 85)"
              height={80}
            />
            <div className="stat-line">
              <span>
                latest <b>{today.weight_kg} kg</b>
              </span>
              <span>
                30d delta <b className="t-faint">{(today.weight_kg - days[days.length - 31].weight_kg).toFixed(1)} kg</b>
              </span>
            </div>
          </div>
        </section>

        {/* 08 · WORKOUTS */}
        <div className="section-hd">
          <h2>
            <span className="num">08 //</span>workouts.
          </h2>
          <span className="src">walks · bike rides · the occasional run</span>
        </div>
        <section className="bento" style={{ marginBottom: 'var(--sp-3)' }}>
          <div className="panel c-nudge">
            <div className="panel-hd">
              <span className="ttl">./outdoor --streak</span>
              <span className="src-tag">// no gym, just legs + wheels</span>
            </div>
            <div className="nudge-row">
              <div>
                <div className="big-num">
                  <span className="num-val">{daysSinceOutdoor ?? '—'}</span>
                  <span className="num-unit">
                    {daysSinceOutdoor === 0 ? 'today' : daysSinceOutdoor === 1 ? 'day since' : 'days since'}
                  </span>
                </div>
                <div className="stat-line">
                  <span>
                    7d distance <b>{sevenDayOutdoorKm.toFixed(1)} km</b>
                  </span>
                </div>
              </div>
              <div className="nudge-msg">
                {daysSinceOutdoor !== null && daysSinceOutdoor <= 1
                  ? 'keep it rolling → a walk or ride today locks in the streak.'
                  : 'pick a direction, 30 minutes, no gear required. move makes mood.'}
              </div>
            </div>
          </div>
        </section>
        <section>
          <table className="wk-table">
            <thead>
              <tr>
                <th>when</th>
                <th>kind</th>
                <th>duration</th>
                <th>distance</th>
                <th>kcal</th>
                <th>avg hr</th>
                <th>max hr</th>
              </tr>
            </thead>
            <tbody>
              {workouts.map((w) => (
                <tr key={w.start_at}>
                  <td className="dim">{w.start_at.slice(5, 16).replace('T', ' ')}</td>
                  <td>
                    <span className="t-accent">{w.kind}</span>
                  </td>
                  <td>{w.duration_min}m</td>
                  <td className="dim">{w.distance_km != null ? `${w.distance_km.toFixed(1)} km` : '—'}</td>
                  <td className="dim">{w.kcal}</td>
                  <td className="dim">{w.hr_avg}</td>
                  <td className="dim">{w.hr_max}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* 09 · HEARING */}
        <div className="section-hd">
          <h2>
            <span className="num">09 //</span>hearing.
          </h2>
          <span className="src">watch mic · headphones · london trains</span>
        </div>
        <section className="bento">
          <div className="panel c-hear-env">
            <div className="panel-hd">
              <span className="ttl">environmental · 30 days</span>
              <span className="src-tag">// danger line at 80 dB</span>
            </div>
            <HearingBars days={days} field="env_db_peak" danger={80} />
            <div className="stat-line">
              <span>7d avg <b>{weekEnvAvg} dB</b></span>
              <span>7d peak <b className="t-warn">{weekEnvPeak} dB</b></span>
              {weekEnvPeakDay ? (
                <span className="t-faint">· {weekEnvPeakDay.date.slice(5)}</span>
              ) : null}
            </div>
          </div>
          <div className="panel c-hear-hp">
            <div className="panel-hd">
              <span className="ttl">headphones · 30 days</span>
              <span className="src-tag">// airpods avg dBA</span>
            </div>
            <HearingBars days={days} field="headphone_db" danger={80} />
            <div className="stat-line">
              <span>7d avg <b>{weekHdAvg} dB</b></span>
              <span className="t-faint">safe &lt; 80 · damage at 85 over 8h</span>
            </div>
          </div>
        </section>

        {/* 10 · MOOD */}
        <div className="section-hd">
          <h2>
            <span className="num">10 //</span>mood.
          </h2>
          <span className="src">ios state of mind · logged when remembered</span>
        </div>
        <section className="bento">
          <div className="panel c-mood">
            <div className="panel-hd">
              <span className="ttl">30 days · daily pulse</span>
              <span className="src-tag">
                unpleasant <span className="mood-scale">
                  <span style={{ background: MOOD_COLORS[0] }} />
                  <span style={{ background: MOOD_COLORS[2] }} />
                  <span style={{ background: MOOD_COLORS[3] }} />
                  <span style={{ background: MOOD_COLORS[4] }} />
                  <span style={{ background: MOOD_COLORS[6] }} />
                </span> pleasant
              </span>
            </div>
            <MoodGrid days={days} />
            <div className="stat-line">
              <span>logged <b>{moodLogged.length}/{thirtyDays.length} days</b></span>
              <span>avg <b>{moodLabel(Math.round(moodAvg))}</b></span>
            </div>
          </div>
        </section>

        {/* 11 · NOTES */}
        <div className="section-hd">
          <h2>
            <span className="num">11 //</span>context.
          </h2>
          <span className="src">notes that make the numbers make sense</span>
        </div>
        <section className="bento">
          <div className="panel c-notes">
            <div className="panel-hd">
              <span className="ttl">./notes --recent</span>
            </div>
            <ul className="notes-list">
              {notes.map((n) => (
                <li key={n.date} className="note-row">
                  <span className="note-date">{n.date}</span>
                  <span className="note-text">{n.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <footer className="health-footer">
          <span>
            src: <span className="t-accent">apple health → shortcuts → /api/health/ingest → d1 → this page</span>
          </span>
          <span>
            ←{' '}
            <Link to="/" className="t-accent">
              home
            </Link>
          </span>
        </footer>
        <div className="sig">
          <span className="t-faint">personal site · {SITE.name}</span>
        </div>
      </main>
    </>
  );
}

const CSS = `
  .shell-h { max-width: 1280px; margin: 0 auto; padding: 0 var(--sp-6); }

  .page-hd { padding: 64px 0 var(--sp-6); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); margin-bottom: 8px; }
  .page-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500; letter-spacing: -0.03em;
    color: var(--color-fg); line-height: 0.9;
  }
  .page-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 70ch; margin-top: var(--sp-3); line-height: 1.55; }
  .page-hd .sub .inline {
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    padding: 1px 6px;
    font-size: 12px;
    color: var(--color-accent);
    font-family: var(--font-mono);
  }
  .page-hd .sub b.t-warn { color: var(--color-warn); font-weight: 400; }
  .page-hd .meta {
    display: flex; gap: var(--sp-6); flex-wrap: wrap;
    margin-top: var(--sp-5);
    font-family: var(--font-mono);
    font-size: var(--fs-xs); color: var(--color-fg-faint);
  }
  .page-hd .meta b { color: var(--color-fg); font-weight: 400; }
  .page-hd .meta b.t-accent { color: var(--color-accent); }

  .section-hd {
    display: flex; align-items: baseline; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-4);
  }
  .section-hd h2 {
    font-family: var(--font-display); font-size: 28px; font-weight: 500;
    color: var(--color-fg); letter-spacing: -0.02em;
  }
  .section-hd h2 .num { color: var(--color-accent); font-family: var(--font-mono); font-size: 13px; margin-right: 14px; letter-spacing: 0.08em; }
  .section-hd .src { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }

  .bento {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    grid-auto-rows: minmax(110px, auto);
    gap: var(--sp-3);
  }
  .panel {
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    padding: var(--sp-4);
    display: flex; flex-direction: column; gap: var(--sp-3);
    min-width: 0;
  }
  .panel-hd {
    display: flex; justify-content: space-between; align-items: center; gap: var(--sp-3);
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: uppercase;
    letter-spacing: 0.14em;
    padding-bottom: 6px;
    border-bottom: 1px dashed var(--color-border);
  }
  .panel-hd .ttl { color: var(--color-accent); }
  .panel-hd .src-tag { color: var(--color-fg-faint); }

  .c-rings { grid-column: span 4; grid-row: span 2; }
  .c-steps { grid-column: span 4; }
  .c-bp    { grid-column: span 4; }
  .c-hr    { grid-column: span 4; }
  .c-sleep { grid-column: span 4; }
  .c-water { grid-column: span 4; }

  .c-heatmap  { grid-column: span 8; }
  .c-exercise { grid-column: span 4; }

  .c-rhr { grid-column: span 6; }
  .c-hrv { grid-column: span 6; }

  .c-bp-detail { grid-column: span 8; }
  .c-bp-stats  { grid-column: span 4; }

  .c-sleep-stages  { grid-column: span 8; }
  .c-sleep-last    { grid-column: span 4; }
  .c-sleep-bars    { grid-column: span 5; }
  .c-sleep-scatter { grid-column: span 7; }

  .c-water-bars { grid-column: span 12; }
  .c-weight     { grid-column: span 6; }
  .c-nudge      { grid-column: span 12; }

  .c-hear-env { grid-column: span 7; }
  .c-hear-hp  { grid-column: span 5; }
  .c-mood     { grid-column: span 12; }
  .c-notes    { grid-column: span 12; }

  @media (max-width: 980px) {
    .bento { grid-template-columns: repeat(6, 1fr); }
    .bento > * { grid-column: span 6 !important; grid-row: auto !important; }
  }

  .big-num {
    display: flex; align-items: baseline; gap: 6px;
  }
  .big-num .num-val {
    font-family: var(--font-display);
    font-size: 44px;
    line-height: 1;
    color: var(--color-fg);
  }
  .big-num .num-unit {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    letter-spacing: 0.08em;
  }
  .stat-line {
    display: flex; gap: 8px; flex-wrap: wrap; align-items: baseline;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .stat-line b { color: var(--color-fg); font-weight: 400; }
  .stat-line .t-faint { color: var(--color-fg-ghost); }

  /* bp styling */
  .bp-big { display: flex; align-items: baseline; gap: 4px; }
  .bp-sys {
    font-family: var(--font-display);
    font-size: 56px;
    color: var(--color-fg);
    line-height: 1;
  }
  .bp-dia {
    font-family: var(--font-display);
    font-size: 36px;
    color: var(--color-fg-dim);
    line-height: 1;
  }
  .bp-sep { font-family: var(--font-display); font-size: 36px; color: var(--color-accent); line-height: 1; }
  .bp-chip {
    font-family: var(--font-mono);
    font-size: 10px;
    padding: 2px 8px;
    border: 1px solid var(--color-border-bright);
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }
  .bp-chip.cat-normal   { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .bp-chip.cat-elevated { color: oklch(0.82 0.13 85); border-color: oklch(0.5 0.1 85); }
  .bp-chip.cat-stage1   { color: oklch(0.78 0.16 45); border-color: oklch(0.5 0.13 45); }
  .bp-chip.cat-stage2   { color: var(--color-alert); border-color: color-mix(in oklch, var(--color-alert) 40%, var(--color-border)); }
  .bp-chip.cat-crisis   { color: var(--color-alert); border-color: var(--color-alert); animation: pulse 1s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

  .dot-morning { color: var(--color-accent); }
  .dot-evening { color: oklch(0.78 0.11 210); }

  /* averages dl */
  .avg-dl { display: grid; grid-template-columns: auto 1fr; gap: 8px var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-xs); }
  .avg-dl dt { color: var(--color-fg-faint); text-transform: lowercase; letter-spacing: 0.06em; }
  .avg-dl dd { color: var(--color-fg); margin: 0; }
  .avg-dl dd b { color: var(--color-accent); font-weight: 400; font-size: var(--fs-md); }
  .recent-list { display: flex; flex-direction: column; gap: 4px; }
  .recent-row { display: grid; grid-template-columns: 90px 60px 1fr; gap: 8px; align-items: baseline; }
  .recent-row .t-faint { color: var(--color-fg-faint); }

  /* water */
  .ring-wrap { display: flex; justify-content: center; align-items: center; padding: 4px 0; }

  .water-bars {
    display: grid;
    grid-template-columns: repeat(30, 1fr);
    gap: 2px;
    height: 80px;
    align-items: end;
  }
  .water-bar { height: 100%; display: flex; align-items: end; }
  .water-fill {
    width: 100%;
    background: var(--color-border-bright);
    transition: height 0.2s ease;
  }
  .water-fill.hit {
    background: oklch(0.78 0.11 210);
    box-shadow: 0 0 4px oklch(0.78 0.11 210 / 0.5);
  }

  .sleep-bars {
    display: grid;
    grid-template-columns: repeat(30, 1fr);
    gap: 2px;
    height: 80px;
    align-items: end;
  }
  .sleep-bar { height: 100%; display: flex; align-items: end; }
  .sleep-fill {
    width: 100%;
    background: var(--color-border-bright);
    transition: height 0.2s ease;
  }
  .sleep-fill.good {
    background: var(--color-accent);
    box-shadow: 0 0 4px var(--accent-glow);
  }

  /* make sure tooltips can escape every chart wrapper — the global .panel
     rule in App.css sets overflow:hidden, so we need higher specificity here. */
  .shell-h .panel,
  .shell-h .bento,
  .shell-h .axis-chart,
  .shell-h .axis-plot,
  .shell-h .chart-box,
  .shell-h .chart-hits,
  .shell-h .hm-grid,
  .shell-h .sleep-bars,
  .shell-h .water-bars { overflow: visible; }

  /* shared tooltip — any [data-tip] inside the shell */
  .shell-h [data-tip] { position: relative; }
  .shell-h [data-tip]::after {
    content: attr(data-tip);
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg);
    padding: 4px 8px;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.08s ease;
    z-index: 1000;
  }
  .shell-h [data-tip]:hover::after { opacity: 1; }

  /* chart hit-zone overlay — sits above an SVG for interactive tooltips */
  .chart-box { position: relative; }
  .chart-hits {
    position: absolute;
    inset: 0;
    display: flex;
    pointer-events: none;
  }
  .chart-hit {
    flex: 1;
    height: 100%;
    pointer-events: auto;
  }
  .chart-hits.scatter { display: block; }
  .chart-hits.scatter .chart-hit.dot {
    position: absolute;
    width: 14px;
    height: 14px;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    flex: none;
  }

  /* heatmap */
  .panel.c-heatmap { overflow: visible; }
  .hm-grid {
    display: grid;
    grid-template-columns: repeat(53, 1fr);
    gap: 2px;
    overflow: visible;
  }
  .hm-wk { display: flex; flex-direction: column; gap: 2px; }
  .hm-d {
    width: 100%;
    aspect-ratio: 1;
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
  }
  .hm-d.empty { visibility: hidden; }
  .hm-d.l1 { background: color-mix(in oklch, var(--color-accent) 28%, var(--color-bg)); border-color: color-mix(in oklch, var(--color-accent) 30%, var(--color-bg)); }
  .hm-d.l2 { background: color-mix(in oklch, var(--color-accent) 55%, var(--color-bg)); border-color: color-mix(in oklch, var(--color-accent) 55%, var(--color-bg)); }
  .hm-d.l3 { background: color-mix(in oklch, var(--color-accent) 80%, var(--color-bg)); border-color: color-mix(in oklch, var(--color-accent) 80%, var(--color-bg)); }
  .hm-d.l4 { background: var(--color-accent); border-color: var(--color-accent); box-shadow: 0 0 4px var(--accent-glow); }

  .legend { display: flex; gap: 3px; align-items: center; margin-top: 8px; font-family: var(--font-mono); font-size: 10px; color: var(--color-fg-faint); }
  .hm-key {
    display: inline-block;
    width: 10px; height: 10px;
  }
  .hm-key.l0 { background: var(--color-bg-raised); border: 1px solid var(--color-border); }
  .hm-key.l1 { background: color-mix(in oklch, var(--color-accent) 25%, var(--color-bg)); }
  .hm-key.l2 { background: color-mix(in oklch, var(--color-accent) 50%, var(--color-bg)); }
  .hm-key.l3 { background: color-mix(in oklch, var(--color-accent) 75%, var(--color-bg)); }
  .hm-key.l4 { background: var(--color-accent); }

  /* fitness rings */
  .rings-wrap {
    display: flex; align-items: center; gap: var(--sp-4);
  }
  .rings-dl {
    display: grid; grid-template-columns: auto 1fr; gap: 6px var(--sp-3);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    margin: 0;
  }
  .rings-dl dt { color: var(--color-fg-faint); display: flex; align-items: center; gap: 6px; }
  .rings-dl dd { color: var(--color-fg); margin: 0; font-size: var(--fs-sm); }
  .rings-dl dd .dim { color: var(--color-fg-faint); font-size: var(--fs-xs); }
  .rk { font-size: 10px; }
  .rk-move  { color: oklch(0.68 0.22 25); }
  .rk-ex    { color: var(--color-accent); }
  .rk-stand { color: oklch(0.78 0.11 210); }

  /* sleep stages */
  .ss-bars {
    display: grid; grid-template-columns: repeat(30, 1fr); gap: 2px;
    height: 100px; align-items: end;
  }
  .ss-bar { height: 100%; display: flex; flex-direction: column; justify-content: flex-end; }
  .ss-seg { width: 100%; }
  .ss-key { display: inline-block; width: 10px; height: 10px; margin-right: 2px; vertical-align: middle; }
  .ss-deep  { background: var(--color-accent); box-shadow: 0 0 2px var(--accent-glow); }
  .ss-core  { background: color-mix(in oklch, var(--color-accent) 60%, var(--color-bg)); }
  .ss-rem   { background: oklch(0.72 0.15 320); }
  .ss-awake { background: oklch(0.82 0.13 85); opacity: 0.6; }

  .ss-breakdown {
    display: flex; flex-direction: column; gap: 8px;
    font-family: var(--font-mono); font-size: var(--fs-xs);
  }
  .ss-row {
    display: grid;
    grid-template-columns: 48px 1fr 56px 32px;
    gap: 8px; align-items: center;
  }
  .ss-lbl { color: var(--color-fg-faint); text-transform: lowercase; letter-spacing: 0.06em; }
  .ss-track { height: 8px; background: var(--color-border); position: relative; overflow: hidden; }
  .ss-fill { height: 100%; transition: width 0.2s ease; }
  .ss-val { color: var(--color-fg); }
  .ss-pct { color: var(--color-fg-faint); text-align: right; }

  /* hearing */
  .db-bars {
    display: grid; grid-template-columns: repeat(30, 1fr); gap: 2px;
    height: 100px; align-items: end;
    position: relative;
  }
  .db-bars::before {
    content: '';
    position: absolute; left: 0; right: 0;
    top: var(--db-danger);
    border-top: 1px dashed var(--color-alert);
    opacity: 0.4;
    pointer-events: none;
  }
  .db-bar { height: 100%; display: flex; align-items: end; }
  .db-fill {
    width: 100%; background: var(--color-border-bright);
  }
  .db-fill.over { background: var(--color-alert); box-shadow: 0 0 3px color-mix(in oklch, var(--color-alert) 60%, transparent); }

  /* mood */
  .mood-grid {
    display: grid; grid-template-columns: repeat(30, 1fr); gap: 3px;
    height: 32px;
  }
  .mood-cell { height: 100%; aspect-ratio: 1; border: 1px solid var(--color-border); }
  .mood-cell.empty { background: var(--color-bg-raised); border-style: dashed; }
  .mood-scale {
    display: inline-flex; gap: 2px; margin: 0 6px; vertical-align: middle;
  }
  .mood-scale span { width: 10px; height: 10px; display: inline-block; }

  /* nudge */
  .nudge-row {
    display: grid; grid-template-columns: auto 1fr; gap: var(--sp-6);
    align-items: center;
  }
  .nudge-msg {
    font-family: var(--font-mono); font-size: var(--fs-sm);
    color: var(--color-fg-dim);
    line-height: 1.5;
    border-left: 2px solid var(--color-accent-dim);
    padding-left: var(--sp-3);
  }

  /* shared axis chart wrapper */
  .axis-chart {
    display: grid;
    grid-template-columns: 48px 1fr;
    gap: 4px;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg-faint);
  }
  .axis-y {
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 2px 6px 2px 0;
    text-align: right;
    letter-spacing: 0.04em;
  }
  .axis-plot {
    grid-column: 2;
    min-width: 0;
    border-left: 1px solid var(--color-border);
    padding-left: 2px;
  }
  .axis-x {
    grid-column: 2;
    display: flex; justify-content: space-between;
    margin-top: 4px;
    padding-top: 4px;
    border-top: 1px dashed var(--color-border);
    letter-spacing: 0.06em;
  }

  /* workouts table */
  .wk-table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    margin-top: 0;
  }
  .wk-table th {
    text-align: left;
    padding: 8px 12px;
    font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: uppercase;
    letter-spacing: 0.14em;
    border-bottom: 1px solid var(--color-border-bright);
    font-weight: 400;
  }
  .wk-table td {
    padding: 8px 12px;
    border-bottom: 1px dashed var(--color-border);
    color: var(--color-fg);
  }
  .wk-table td.dim { color: var(--color-fg-faint); }
  .wk-table .t-accent { color: var(--color-accent); }

  /* notes */
  .notes-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .note-row {
    display: grid;
    grid-template-columns: 100px 1fr;
    gap: var(--sp-3);
    padding: 6px 0;
    border-bottom: 1px dashed var(--color-border);
    font-size: var(--fs-sm);
  }
  .note-row:last-child { border-bottom: 0; }
  .note-date { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .note-text { color: var(--color-fg-dim); line-height: 1.55; }

  .health-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-4);
    margin-top: var(--sp-10);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .sig { text-align: center; padding-bottom: var(--sp-10); font-family: var(--font-mono); font-size: 10px; }
  .sig .t-faint { color: var(--color-fg-ghost); }
`;
