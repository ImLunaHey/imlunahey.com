import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_ENDPOINT = 'wss://jetstream2.us-east.bsky.network/subscribe';
const WINDOW_SECONDS = 60;
const MAX_RECENT = 6;

type Op = 'create' | 'update' | 'delete';

type JSEvent = {
  kind: 'commit' | 'identity' | 'account' | string;
  time_us?: number;
  commit?: { operation?: Op; collection?: string };
};

type Counts = {
  total: number;
  byCollection: Record<string, { total: number; create: number; update: number; delete: number }>;
  byKind: Record<string, number>;
  // rolling samples: [epochSec, count] for events-per-second chart
  samples: number[];
  // recent events to scroll through
  recent: Array<{ collection?: string; op?: Op; kind: string; atUs: number }>;
  // internal: flag used to batch setState within a microtask
  scheduled?: boolean;
};

const EMPTY: Counts = { total: 0, byCollection: {}, byKind: {}, samples: new Array(WINDOW_SECONDS).fill(0), recent: [] };

type Status = 'disconnected' | 'connecting' | 'connected' | 'error';

function toM(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

export default function FirehoseStatsPage() {
  const [endpoint, setEndpoint] = useState(DEFAULT_ENDPOINT);
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState<Status>('disconnected');
  const [stats, setStats] = useState<Counts>(EMPTY);
  const statsRef = useRef<Counts>(EMPTY);
  const wsRef = useRef<WebSocket | null>(null);
  const pausedRef = useRef(false);
  const startedAtRef = useRef<number>(Date.now());
  const tickTimerRef = useRef<number | null>(null);

  pausedRef.current = paused;

  useEffect(() => {
    // sampling tick: every second, roll the window. Shallow-copy all sub-maps
    // so useMemo deps detect the update.
    const id = window.setInterval(() => {
      const s = statsRef.current;
      s.samples = [...s.samples.slice(1), 0];
      setStats({
        ...s,
        byCollection: { ...s.byCollection },
        byKind: { ...s.byKind },
        samples: s.samples,
        recent: [...s.recent],
      });
    }, 1000);
    tickTimerRef.current = id;
    return () => { window.clearInterval(id); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    function connect() {
      setStatus('connecting');
      const ws = new WebSocket(endpoint);
      wsRef.current = ws;
      ws.onopen = () => { if (!cancelled) setStatus('connected'); startedAtRef.current = Date.now(); };
      ws.onerror = () => { if (!cancelled) setStatus('error'); };
      ws.onclose = () => { if (!cancelled) setStatus('disconnected'); };
      ws.onmessage = (ev) => {
        if (pausedRef.current) return;
        try {
          const e = JSON.parse(ev.data as string) as JSEvent;
          ingest(e);
        } catch { /* ignore malformed */ }
      };
    }
    connect();
    return () => {
      cancelled = true;
      wsRef.current?.close();
    };
  }, [endpoint]);

  function ingest(e: JSEvent) {
    const s = statsRef.current;
    s.total++;
    s.byKind[e.kind] = (s.byKind[e.kind] ?? 0) + 1;
    if (e.kind === 'commit' && e.commit?.collection) {
      const c = e.commit.collection;
      const op = (e.commit.operation ?? 'create') as Op;
      const row = s.byCollection[c] ?? { total: 0, create: 0, update: 0, delete: 0 };
      row.total++;
      row[op]++;
      s.byCollection[c] = row;
    }
    // bump last sample
    const samples = s.samples;
    samples[samples.length - 1]++;
    // recent (bounded)
    s.recent = [
      { collection: e.commit?.collection, op: e.commit?.operation, kind: e.kind, atUs: e.time_us ?? Date.now() * 1000 },
      ...s.recent.slice(0, MAX_RECENT - 1),
    ];
    // don't setState for every event — batch via a microtask.
    // we shallow-copy the nested containers each flush so react's referential
    // equality checks actually detect the updates (useMemo keys on them).
    if (!s.scheduled) {
      s.scheduled = true;
      queueMicrotask(() => {
        s.scheduled = false;
        setStats({
          ...s,
          byCollection: { ...s.byCollection },
          byKind: { ...s.byKind },
          samples: [...s.samples],
          recent: [...s.recent],
        });
      });
    }
  }

  function reset() {
    statsRef.current = {
      total: 0,
      byCollection: {},
      byKind: {},
      samples: new Array(WINDOW_SECONDS).fill(0),
      recent: [],
    };
    setStats(statsRef.current);
    startedAtRef.current = Date.now();
  }

  const navigate = useNavigate();
  const topCollections = useMemo(() => {
    return Object.entries(stats.byCollection)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 14);
  }, [stats.byCollection]);

  const maxCol = topCollections[0]?.[1].total ?? 1;
  const currentEps = stats.samples[stats.samples.length - 2] ?? 0; // full last second
  const avgEps = stats.total && status === 'connected'
    ? stats.total / Math.max(1, (Date.now() - startedAtRef.current) / 1000)
    : 0;
  const maxSample = Math.max(1, ...stats.samples);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-fs">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">firehose stats</span>
        </div>

        <header className="fs-hd">
          <h1>firehose stats<span className="dot">.</span></h1>
          <p className="sub">
            live aggregate of the bluesky jetstream. every second we sample how many events hit each
            lexicon collection. the entire network's writes, summarized in one page.
          </p>
        </header>

        <section className="fs-bar">
          <div className="fs-bar-l">
            <span className={`fs-light l-${status}`} />
            <input
              className="fs-endpoint"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <div className="fs-bar-r">
            <button className="fs-btn" onClick={() => setPaused((p) => !p)}>
              {paused ? '▶ resume' : '⏸ pause'}
            </button>
            <button className="fs-btn" onClick={reset}>↻ reset</button>
          </div>
        </section>

        <section className="fs-hero">
          <BigStat label="events / sec" value={Math.round(currentEps)} sub={`avg ${avgEps.toFixed(0)} since connect`} accent />
          <BigStat label="total events" value={toM(stats.total)} sub={`${status}`} />
          <BigStat label="collections" value={Object.keys(stats.byCollection).length} sub={`${Object.keys(stats.byKind).length} event kinds`} />
          <Sparkline samples={stats.samples} max={maxSample} />
        </section>

        <section className="fs-grid">
          <article className="fs-card fs-card-wide">
            <header className="fs-card-hd">
              <span>── top collections (last {WINDOW_SECONDS}s window + lifetime)</span>
              <span className="fs-card-ct">{Object.keys(stats.byCollection).length} total</span>
            </header>
            <div className="fs-col-list">
              {topCollections.length === 0 ? (
                <div className="fs-empty">waiting for events…</div>
              ) : topCollections.map(([name, row]) => {
                const pct = (row.total / maxCol) * 100;
                return (
                  <button
                    key={name}
                    type="button"
                    className="fs-colrow"
                    title={`open ${name} schema →`}
                    onClick={() => navigate({ to: `/labs/lexicon/${name}` as never })}
                  >
                    <div className="fs-col-name">{name} <span className="fs-col-arrow" aria-hidden>↗</span></div>
                    <div className="fs-col-bar">
                      <div className="fs-col-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="fs-col-num">{toM(row.total)}</div>
                    <div className="fs-col-ops">
                      {row.create ? <span className="op op-create" title="creates">+{toM(row.create)}</span> : null}
                      {row.update ? <span className="op op-update" title="updates">~{toM(row.update)}</span> : null}
                      {row.delete ? <span className="op op-delete" title="deletes">−{toM(row.delete)}</span> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </article>

          <article className="fs-card">
            <header className="fs-card-hd">
              <span>── event kinds</span>
            </header>
            <div className="fs-kinds">
              {Object.entries(stats.byKind).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <div key={k} className="fs-kind">
                  <span className="fs-kind-k">{k}</span>
                  <span className="fs-kind-v">{toM(v)}</span>
                </div>
              ))}
              {Object.keys(stats.byKind).length === 0 ? <div className="fs-empty">—</div> : null}
            </div>
          </article>

          <article className="fs-card">
            <header className="fs-card-hd">
              <span>── recent events</span>
            </header>
            <ul className="fs-recent">
              {stats.recent.length === 0 ? <li className="fs-empty">—</li> : null}
              {stats.recent.map((r, i) => {
                const clickable = !!r.collection;
                const inner = (
                  <>
                    <span className={`fs-op-badge op-${r.op ?? 'none'}`}>
                      {r.op === 'create' ? '+' : r.op === 'update' ? '~' : r.op === 'delete' ? '−' : '·'}
                    </span>
                    <span className="fs-recent-coll">{r.collection ?? r.kind}</span>
                  </>
                );
                return (
                  <li key={i} className={`fs-recent-row op-${r.op ?? 'none'} ${clickable ? 'linky' : ''}`}>
                    {clickable ? (
                      <Link to={`/labs/lexicon/${r.collection}` as never} className="fs-recent-link">{inner}</Link>
                    ) : inner}
                  </li>
                );
              })}
            </ul>
          </article>
        </section>
      </main>
    </>
  );
}

function BigStat({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className="fs-big">
      <div className="fs-big-lbl">{label}</div>
      <div className={`fs-big-val ${accent ? 'accent' : ''}`}>{value}</div>
      {sub ? <div className="fs-big-sub">{sub}</div> : null}
    </div>
  );
}

function Sparkline({ samples, max }: { samples: number[]; max: number }) {
  const n = samples.length;
  return (
    <div className="fs-big fs-big-spark">
      <div className="fs-big-lbl">events / sec · last {WINDOW_SECONDS}s</div>
      <svg className="fs-spark" viewBox={`0 0 ${n} 24`} preserveAspectRatio="none" aria-hidden>
        {samples.map((s, i) => {
          const h = (s / max) * 22 + 1;
          return (
            <rect
              key={i}
              x={i} y={24 - h}
              width={0.9} height={h}
              fill="currentColor"
            />
          );
        })}
      </svg>
      <div className="fs-big-sub">peak {max}/s</div>
    </div>
  );
}


const CSS = `
  .shell-fs { max-width: 1200px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .fs-hd { padding: 48px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .fs-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(48px, 8vw, 96px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.9;
  }
  .fs-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .fs-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 60ch; margin-top: var(--sp-3); }

  .fs-bar {
    display: flex; gap: var(--sp-3); align-items: center; justify-content: space-between;
    margin: var(--sp-4) 0;
    padding: var(--sp-2) var(--sp-3);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    flex-wrap: wrap;
  }
  .fs-bar-l { display: flex; align-items: center; gap: var(--sp-2); flex: 1; min-width: 260px; }
  .fs-bar-r { display: flex; gap: var(--sp-2); }
  .fs-light {
    width: 10px; height: 10px; border-radius: 50%;
    flex-shrink: 0;
  }
  .fs-light.l-connected { background: var(--color-accent); box-shadow: 0 0 8px var(--accent-glow); }
  .fs-light.l-connecting { background: var(--color-warn); animation: fs-pulse 1s ease-in-out infinite; }
  .fs-light.l-error { background: var(--color-alert); }
  .fs-light.l-disconnected { background: var(--color-fg-faint); }
  @keyframes fs-pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
  .fs-endpoint {
    flex: 1;
    background: transparent;
    border: 0; outline: 0;
    color: var(--color-fg);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    padding: 4px 0;
    min-width: 0;
  }
  .fs-btn {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    background: transparent;
    color: var(--color-fg-dim);
    border: 1px solid var(--color-border-bright);
    padding: 4px 10px;
    cursor: pointer;
    text-transform: lowercase;
  }
  .fs-btn:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }

  .fs-hero {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--sp-3);
    margin-bottom: var(--sp-4);
  }
  .fs-big {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: var(--sp-4);
    display: flex; flex-direction: column; gap: 6px;
    min-height: 110px;
  }
  .fs-big-lbl {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    text-transform: lowercase;
    letter-spacing: 0.04em;
  }
  .fs-big-val {
    font-family: var(--font-display);
    font-size: clamp(28px, 3vw, 40px);
    font-weight: 500;
    line-height: 1;
    color: var(--color-fg);
    font-variant-numeric: tabular-nums;
  }
  .fs-big-val.accent { color: var(--color-accent); text-shadow: 0 0 12px var(--accent-glow); }
  .fs-big-sub {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg-faint);
  }
  .fs-big-spark { color: var(--color-accent); }
  .fs-spark {
    width: 100%; height: 36px;
    display: block;
    filter: drop-shadow(0 0 4px var(--accent-glow));
  }

  .fs-grid {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    gap: var(--sp-3);
    padding-bottom: var(--sp-10);
  }
  .fs-card {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    display: flex; flex-direction: column;
    min-height: 300px;
  }
  .fs-card-wide {
    grid-column: span 1;
  }
  .fs-card-hd {
    display: flex; justify-content: space-between;
    padding: 8px var(--sp-3);
    border-bottom: 1px solid var(--color-border);
    background: linear-gradient(to bottom, #0c0c0c, #070707);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .fs-card-ct { color: var(--color-accent-dim); }

  .fs-col-list {
    padding: var(--sp-2) 0;
    flex: 1;
    max-height: 520px;
    overflow-y: auto;
  }
  .fs-colrow {
    display: grid;
    grid-template-columns: 180px 1fr 70px minmax(110px, auto);
    align-items: center;
    gap: var(--sp-2);
    padding: 4px var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    width: 100%;
    background: transparent;
    border: 0;
    border-left: 2px solid transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
    transition: background 0.1s, border-left-color 0.1s;
  }
  .fs-colrow:hover {
    background: var(--color-bg-raised);
    border-left-color: var(--color-accent);
  }
  .fs-colrow:hover .fs-col-arrow { opacity: 1; }
  .fs-colrow:hover .fs-col-name { color: var(--color-accent); }
  .fs-col-name {
    color: var(--color-fg);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    transition: color 0.1s;
  }
  .fs-col-arrow {
    color: var(--color-accent-dim);
    font-size: 10px;
    opacity: 0;
    margin-left: 4px;
    transition: opacity 0.1s;
  }
  .fs-col-bar {
    height: 10px;
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    overflow: hidden;
  }
  .fs-col-fill {
    height: 100%;
    background: linear-gradient(to right,
      color-mix(in oklch, var(--color-accent) 40%, transparent),
      var(--color-accent));
    transition: width 0.3s ease;
  }
  .fs-col-num {
    color: var(--color-accent);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .fs-col-ops {
    display: flex; gap: 4px;
    justify-content: flex-end;
  }
  .fs-col-ops .op {
    font-size: 10px;
    padding: 1px 5px;
    border: 1px solid;
  }
  .op-create { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .op-update { color: var(--color-warn); border-color: color-mix(in oklch, var(--color-warn) 40%, var(--color-border)); }
  .op-delete { color: var(--color-alert); border-color: var(--color-alert-dim); }

  .fs-kinds {
    padding: var(--sp-2);
    display: flex; flex-direction: column; gap: 2px;
    flex: 1;
  }
  .fs-kind {
    display: flex; justify-content: space-between;
    padding: 4px var(--sp-2);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }
  .fs-kind-k { color: var(--color-fg-dim); }
  .fs-kind-v { color: var(--color-accent); font-variant-numeric: tabular-nums; }

  .fs-recent {
    list-style: none;
    padding: var(--sp-2);
    display: flex; flex-direction: column; gap: 2px;
    flex: 1;
    overflow: hidden;
  }
  .fs-recent-row {
    display: grid;
    grid-template-columns: 20px 1fr;
    gap: var(--sp-2);
    align-items: center;
    padding: 3px var(--sp-2);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    animation: fs-slide 0.25s ease-out;
  }
  @keyframes fs-slide {
    from { opacity: 0; transform: translateX(-6px); }
    to { opacity: 1; transform: translateX(0); }
  }
  .fs-op-badge {
    text-align: center;
    font-weight: 600;
  }
  .fs-op-badge.op-create { color: var(--color-accent); }
  .fs-op-badge.op-update { color: var(--color-warn); }
  .fs-op-badge.op-delete { color: var(--color-alert); }
  .fs-op-badge.op-none { color: var(--color-fg-faint); }
  .fs-recent-coll {
    color: var(--color-fg-dim);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .fs-recent-link {
    display: contents;
    color: inherit;
    text-decoration: none;
  }
  .fs-recent-row.linky:hover { background: var(--color-bg-raised); }
  .fs-recent-row.linky:hover .fs-recent-coll { color: var(--color-accent); }

  .fs-empty {
    padding: var(--sp-4);
    text-align: center;
    color: var(--color-fg-faint);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }

  @media (max-width: 960px) {
    .fs-grid { grid-template-columns: 1fr; }
  }
`;
