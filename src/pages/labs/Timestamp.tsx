import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

type Parsed = { date: Date; source: string } | { error: string };

function parseInput(raw: string): Parsed {
  const s = raw.trim();
  if (!s) return { error: 'empty' };

  // unix seconds or ms (bare number)
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    // heuristic: >= 10_000_000_000 means milliseconds (after year 2286 in seconds)
    const ms = Math.abs(n) >= 10_000_000_000 ? n : n * 1000;
    const d = new Date(ms);
    if (isNaN(d.getTime())) return { error: 'invalid numeric timestamp' };
    return { date: d, source: Math.abs(n) >= 10_000_000_000 ? 'unix ms' : 'unix seconds' };
  }

  // iso-like or anything Date can parse
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return { date: d, source: 'parsed string' };
  }

  return { error: 'could not parse' };
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0');
}

function fmtIso(d: Date): string { return d.toISOString(); }
function fmtIsoLocal(d: Date): string {
  const tz = -d.getTimezoneOffset();
  const sign = tz >= 0 ? '+' : '-';
  const abs = Math.abs(tz);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}
function fmtRfc2822(d: Date): string { return d.toUTCString(); }
function fmtRelative(d: Date, now = Date.now()): string {
  const delta = d.getTime() - now;
  const abs = Math.abs(delta);
  const past = delta < 0;
  const units: [number, string][] = [
    [1000, 'second'],
    [60_000, 'minute'],
    [3_600_000, 'hour'],
    [86_400_000, 'day'],
    [86_400_000 * 30, 'month'],
    [86_400_000 * 365, 'year'],
  ];
  let unit = 'second', value = abs / 1000;
  for (let i = 0; i < units.length; i++) {
    if (abs < units[i][0] * 60 || i === units.length - 1) {
      value = abs / units[i][0];
      unit = units[i][1];
      break;
    }
  }
  const v = Math.round(value);
  return past ? `${v} ${unit}${v === 1 ? '' : 's'} ago` : `in ${v} ${unit}${v === 1 ? '' : 's'}`;
}

function timezonesNearby(): string[] {
  // a handful of widely-useful zones
  return ['UTC', 'America/Los_Angeles', 'America/New_York', 'Europe/London', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney'];
}

function fmtInZone(d: Date, tz: string): string {
  try {
    return d.toLocaleString('en-GB', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).replace(',', '');
  } catch {
    return '—';
  }
}

type Row = { label: string; value: string; copyable?: boolean };

export default function TimestampPage() {
  const [input, setInput] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const effective = input.trim() || String(now);
  const parsed = useMemo(() => parseInput(effective), [effective]);
  const isLive = input.trim() === '';
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const rows: Row[] = useMemo(() => {
    if ('error' in parsed) return [];
    const d = parsed.date;
    const ms = d.getTime();
    const s = Math.floor(ms / 1000);
    return [
      { label: 'unix seconds', value: String(s), copyable: true },
      { label: 'unix milliseconds', value: String(ms), copyable: true },
      { label: 'iso 8601 (utc)', value: fmtIso(d), copyable: true },
      { label: `iso 8601 (${localTz})`, value: fmtIsoLocal(d), copyable: true },
      { label: 'rfc 2822', value: fmtRfc2822(d), copyable: true },
      { label: 'relative', value: fmtRelative(d, now) },
      { label: 'day of week', value: d.toLocaleDateString('en-GB', { weekday: 'long' }) },
      { label: 'iso week', value: isoWeek(d) },
      { label: 'day of year', value: String(dayOfYear(d)) },
    ];
  }, [parsed, now, localTz]);

  const copy = (v: string) => { try { navigator.clipboard.writeText(v); } catch { /* noop */ } };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-ts">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">timestamp</span>
        </div>

        <header className="ts-hd">
          <h1>timestamp<span className="dot">.</span></h1>
          <p className="sub">
            paste any timestamp — unix seconds, unix ms, iso 8601, rfc 2822, or something{' '}
            <code>new Date()</code> can parse. auto-detects the input format and renders every useful
            format plus a rolling set of common timezones. empty input = live clock.
          </p>
        </header>

        <form className="ts-input-row" onSubmit={(e) => e.preventDefault()}>
          <span className="ts-prompt">
            <span className="mark">ts</span>
            <span className="t-faint">&gt;</span>
          </span>
          <input
            className="ts-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`empty = live now · ${now}`}
            autoComplete="off"
            spellCheck={false}
          />
          {input ? <button className="ts-clear" onClick={() => setInput('')}>×</button> : null}
        </form>

        {'error' in parsed ? (
          <div className="ts-err">✗ {parsed.error}</div>
        ) : (
          <>
            <section className="ts-hero">
              <div className="ts-hero-l">
                <div className="ts-hero-lbl">
                  {isLive ? <><span className="ts-live-dot" /> live now</> : <>parsed as <b>{parsed.source}</b></>}
                </div>
                <div className="ts-hero-big">{parsed.date.toLocaleString('en-GB', { hour12: false })}</div>
                <div className="ts-hero-sub">{fmtRelative(parsed.date, now)}</div>
              </div>
            </section>

            <section className="ts-grid">
              {rows.map((r) => (
                <div key={r.label} className="ts-row">
                  <div className="ts-row-k">{r.label}</div>
                  <div className="ts-row-v">{r.value}</div>
                  {r.copyable ? <button className="ts-copy" onClick={() => copy(r.value)}>copy</button> : <span />}
                </div>
              ))}
            </section>

            <section className="ts-tz">
              <div className="ts-tz-hd">── timezones</div>
              <div className="ts-tz-grid">
                {timezonesNearby().map((tz) => (
                  <div key={tz} className={`ts-tz-cell ${tz === localTz ? 'you' : ''}`}>
                    <div className="ts-tz-name">{tz.replace(/_/g, ' ')}</div>
                    <div className="ts-tz-val">{fmtInZone(parsed.date, tz)}</div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}

function dayOfYear(d: Date): number {
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 0));
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000);
}

function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const CSS = `
  .shell-ts { max-width: 1000px; margin: 0 auto; padding: 0 var(--sp-6); }

  .crumbs {
    padding-top: var(--sp-6);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .crumbs a { color: var(--color-fg-faint); text-decoration: none; }
  .crumbs a:hover { color: var(--color-accent); }
  .crumbs .sep { margin: 0 6px; }
  .crumbs .last { color: var(--color-accent); }

  .ts-hd { padding: 48px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .ts-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.9;
  }
  .ts-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .ts-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 58ch; margin-top: var(--sp-3); }
  .ts-hd code { font-family: var(--font-mono); color: var(--color-accent); }

  .ts-input-row {
    display: flex;
    margin-top: var(--sp-5);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .ts-prompt {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 0 var(--sp-3);
    font-family: var(--font-mono); font-size: var(--fs-sm);
    background: var(--color-bg-raised);
    border-right: 1px solid var(--color-border);
  }
  .ts-prompt .mark { color: var(--color-accent); text-shadow: 0 0 6px var(--accent-glow); }
  .ts-input {
    flex: 1;
    background: transparent;
    border: 0; outline: 0;
    color: var(--color-fg);
    padding: var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-md);
  }
  .ts-clear {
    background: transparent;
    border: 0;
    color: var(--color-fg-faint);
    cursor: pointer;
    padding: 0 var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-md);
  }
  .ts-clear:hover { color: var(--color-accent); }

  .ts-err {
    padding: var(--sp-3);
    margin-top: var(--sp-3);
    border: 1px solid var(--color-alert-dim);
    color: var(--color-alert);
    font-family: var(--font-mono); font-size: var(--fs-sm);
  }

  .ts-hero {
    margin: var(--sp-4) 0;
    padding: var(--sp-5);
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
  }
  .ts-hero-lbl {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    text-transform: lowercase;
    letter-spacing: 0.05em;
    display: inline-flex; align-items: center; gap: 8px;
    margin-bottom: 6px;
  }
  .ts-hero-lbl b { color: var(--color-fg); font-weight: 500; }
  .ts-live-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--color-accent);
    box-shadow: 0 0 8px var(--accent-glow);
    animation: ts-pulse 1.2s ease-in-out infinite;
  }
  @keyframes ts-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
  .ts-hero-big {
    font-family: var(--font-display);
    font-size: clamp(28px, 4vw, 48px);
    font-weight: 500;
    line-height: 1;
    color: var(--color-accent);
    text-shadow: 0 0 12px var(--accent-glow);
    font-variant-numeric: tabular-nums;
  }
  .ts-hero-sub {
    margin-top: 6px;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--color-fg-dim);
  }

  .ts-grid {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: var(--sp-5);
  }
  .ts-row {
    display: grid;
    grid-template-columns: 200px 1fr 56px;
    gap: var(--sp-3);
    align-items: center;
    padding: 6px var(--sp-3);
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }
  .ts-row-k { color: var(--color-fg-faint); text-transform: lowercase; }
  .ts-row-v { color: var(--color-fg); word-break: break-word; overflow: hidden; text-overflow: ellipsis; }
  .ts-copy {
    background: transparent;
    color: var(--color-fg-faint);
    border: 1px solid var(--color-border-bright);
    padding: 2px 8px;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    cursor: pointer;
    text-transform: lowercase;
  }
  .ts-copy:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }

  .ts-tz { padding-bottom: var(--sp-10); }
  .ts-tz-hd {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    margin-bottom: var(--sp-3);
  }
  .ts-tz-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--sp-2);
  }
  .ts-tz-cell {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: var(--sp-2) var(--sp-3);
    font-family: var(--font-mono);
  }
  .ts-tz-cell.you {
    border-color: var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 5%, var(--color-bg-panel));
  }
  .ts-tz-name {
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    text-transform: lowercase;
  }
  .ts-tz-val {
    font-size: var(--fs-sm);
    color: var(--color-fg);
    margin-top: 2px;
    font-variant-numeric: tabular-nums;
  }
  .ts-tz-cell.you .ts-tz-val { color: var(--color-accent); }

  @media (max-width: 600px) {
    .ts-row { grid-template-columns: 120px 1fr 48px; }
  }
`;
