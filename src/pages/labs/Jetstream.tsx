import { Link } from '@tanstack/react-router';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef, useState } from 'react';
import { CodeBlock } from '../../components/CodeBlock';

const DEFAULT_ENDPOINT = 'wss://jetstream2.us-east.bsky.network/subscribe';
const MAX_ROWS = 200;
const FLUSH_INTERVAL_MS = 250;

type Event = {
  id: number;
  did: string;
  time_us: number;
  kind: 'commit' | 'identity' | 'account' | string;
  commit?: {
    rev?: string;
    operation?: 'create' | 'update' | 'delete';
    collection?: string;
    rkey?: string;
    record?: unknown;
    cid?: string;
  };
  identity?: unknown;
  account?: unknown;
};

type Status = 'disconnected' | 'connecting' | 'connected' | 'error';

type FilterSpec = {
  includes: string[]; // may contain wildcards
  excludes: string[]; // may contain wildcards
};

function parseFilter(input: string): FilterSpec {
  const includes: string[] = [];
  const excludes: string[] = [];
  for (const raw of input.split(',')) {
    const t = raw.trim();
    if (!t) continue;
    if (t.startsWith('-')) excludes.push(t.slice(1));
    else includes.push(t);
  }
  return { includes, excludes };
}

function toRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp('^' + escaped + '$');
}

function buildMatcher(spec: FilterSpec): (nsid: string | undefined) => boolean {
  const inc = spec.includes.map(toRegex);
  const exc = spec.excludes.map(toRegex);
  return (nsid) => {
    if (!nsid) return inc.length === 0; // non-commit events: only when no include filter
    if (exc.some((r) => r.test(nsid))) return false;
    if (inc.length === 0) return true;
    return inc.some((r) => r.test(nsid));
  };
}

/** Server-side wantedCollections only supports exact positives — skip the optimisation when filter has wildcards or excludes. */
function serverSideCollections(spec: FilterSpec): string[] {
  if (spec.excludes.length > 0) return [];
  if (spec.includes.some((p) => p.includes('*'))) return [];
  return spec.includes;
}

function buildUrl(endpoint: string, collections: string[]): string {
  const url = new URL(endpoint);
  for (const n of collections) url.searchParams.append('wantedCollections', n);
  return url.toString();
}

function truncateDid(did: string): string {
  // did:plc:xxxxxxxxxxxx → did:plc:xxxxxx…
  if (did.length <= 24) return did;
  return `${did.slice(0, 16)}…${did.slice(-6)}`;
}

function fmtTime(time_us: number): string {
  const ms = Math.floor(time_us / 1000);
  const d = new Date(ms);
  return d
    .toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    + '.' + String(ms % 1000).padStart(3, '0');
}

export default function JetstreamPage() {
  const [nsidInput, setNsidInput] = useState('');
  const [appliedSpec, setAppliedSpec] = useState<FilterSpec>({ includes: [], excludes: [] });
  const [status, setStatus] = useState<Status>('disconnected');
  const [paused, setPaused] = useState(false);
  const [rows, setRows] = useState<Event[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [droppedCount, setDroppedCount] = useState(0);
  const [rate, setRate] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const bufferRef = useRef<Event[]>([]);
  const idRef = useRef(0);
  const countWindowRef = useRef<number[]>([]);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const matcherRef = useRef<(nsid: string | undefined) => boolean>(() => true);

  const connect = (spec: FilterSpec) => {
    const url = buildUrl(DEFAULT_ENDPOINT, serverSideCollections(spec));
    setStatus('connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => setStatus('connected');
    ws.onclose = () => {
      if (wsRef.current === ws) {
        setStatus('disconnected');
        wsRef.current = null;
      }
    };
    ws.onerror = () => {
      setStatus('error');
    };
    ws.onmessage = (ev) => {
      if (pausedRef.current) return;
      try {
        const parsed = JSON.parse(ev.data) as Omit<Event, 'id'>;
        // client-side filter: always applied so wildcard + negative patterns work
        const collection = parsed.commit?.collection;
        const passes = parsed.kind === 'commit' ? matcherRef.current(collection) : matcherRef.current(undefined);
        if (!passes) {
          setDroppedCount((d) => d + 1);
          return;
        }
        const event: Event = { ...parsed, id: ++idRef.current };
        bufferRef.current.push(event);
        countWindowRef.current.push(Date.now());
      } catch {
        /* ignore malformed frames */
      }
    };
  };

  const disconnect = () => {
    wsRef.current?.close();
    wsRef.current = null;
    setStatus('disconnected');
  };

  // flush buffer → rows on a timer so we don't re-render 200 times/sec
  useEffect(() => {
    const tick = setInterval(() => {
      if (bufferRef.current.length > 0) {
        const next = bufferRef.current;
        bufferRef.current = [];
        setTotalCount((c) => c + next.length);
        setRows((prev) => {
          const merged = [...next.reverse(), ...prev];
          return merged.length > MAX_ROWS ? merged.slice(0, MAX_ROWS) : merged;
        });
      }
      // rate: events in last 1s
      const now = Date.now();
      countWindowRef.current = countWindowRef.current.filter((t) => now - t < 1000);
      setRate(countWindowRef.current.length);
    }, FLUSH_INTERVAL_MS);
    return () => clearInterval(tick);
  }, []);

  // cleanup on unmount
  useEffect(
    () => () => {
      wsRef.current?.close();
      wsRef.current = null;
    },
    [],
  );

  const apply = () => {
    const spec = parseFilter(nsidInput);
    matcherRef.current = buildMatcher(spec);
    setAppliedSpec(spec);
    wsRef.current?.close();
    setRows([]);
    setTotalCount(0);
    setDroppedCount(0);
    bufferRef.current = [];
    connect(spec);
  };

  const clear = () => {
    setRows([]);
    setTotalCount(0);
    setDroppedCount(0);
    bufferRef.current = [];
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-js">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">jetstream</span>
        </div>

        <header className="js-hd">
          <h1>
            jetstream<span className="dot">.</span>
          </h1>
          <p className="sub">
            live event stream from atproto's firehose via bluesky's{' '}
            <code className="inline">jetstream</code> ws bridge. every commit, identity update, and account event that
            hits a pds surfaces here with sub-second latency. filter by collection nsid to slim it down.
          </p>
          <div className="controls">
            <label className="lbl">
              <span>filter · include, exclude with leading <b>-</b>, wildcards with <b>*</b></span>
              <input
                className="inp"
                type="text"
                placeholder="e.g. -app.bsky.*  or  com.whtwnd.*, app.bsky.feed.post"
                value={nsidInput}
                onChange={(e) => setNsidInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && apply()}
                spellCheck={false}
                autoComplete="off"
              />
            </label>
            <div className="btns">
              {status === 'connected' || status === 'connecting' ? (
                <button type="button" className="btn" onClick={disconnect}>
                  disconnect
                </button>
              ) : (
                <button type="button" className="btn primary" onClick={apply}>
                  connect →
                </button>
              )}
              <button type="button" className="btn" onClick={() => setPaused((p) => !p)} disabled={status !== 'connected'}>
                {paused ? 'resume' : 'pause'}
              </button>
              <button type="button" className="btn" onClick={clear}>
                clear
              </button>
              {status === 'connected' ? (
                <button type="button" className="btn" onClick={apply}>
                  reapply filter
                </button>
              ) : null}
            </div>
          </div>
          <div className="stats">
            <span className={`dot-st dot-${status}`} />
            <span className="t-mono">{status}</span>
            <span className="sep-dot">·</span>
            <span>
              <b>{rate}</b> /s
            </span>
            <span className="sep-dot">·</span>
            <span>
              <b>{totalCount.toLocaleString()}</b> shown
            </span>
            {droppedCount > 0 ? (
              <>
                <span className="sep-dot">·</span>
                <span>
                  <b>{droppedCount.toLocaleString()}</b> dropped
                </span>
              </>
            ) : null}
            <span className="sep-dot">·</span>
            <span>
              buffer <b>{rows.length}</b> / {MAX_ROWS}
            </span>
            {appliedSpec.includes.length > 0 || appliedSpec.excludes.length > 0 ? (
              <>
                <span className="sep-dot">·</span>
                <span className="t-faint">
                  filter:{' '}
                  {appliedSpec.includes.map((p) => (
                    <b key={'inc-' + p} className="t-accent" style={{ marginRight: 4 }}>
                      {p}
                    </b>
                  ))}
                  {appliedSpec.excludes.map((p) => (
                    <b key={'exc-' + p} className="t-alert" style={{ marginRight: 4 }}>
                      -{p}
                    </b>
                  ))}
                </span>
              </>
            ) : null}
            {paused ? (
              <>
                <span className="sep-dot">·</span>
                <span className="t-warn">paused</span>
              </>
            ) : null}
          </div>
        </header>

        {rows.length === 0 ? (
          <section className="log">
            <div className="empty">
              <div className="empty-glyph">◌</div>
              <div className="empty-ttl">
                {status === 'connected' ? 'waiting for events…' : 'hit connect to start streaming'}
              </div>
              <div className="empty-sub">
                endpoint · <span className="t-accent">{DEFAULT_ENDPOINT}</span>
              </div>
            </div>
          </section>
        ) : (
          <VirtualisedLog
            rows={rows}
            expanded={expanded}
            onToggle={(id) => setExpanded((cur) => (cur === id ? null : id))}
          />
        )}

        <footer className="js-footer">
          <span>
            src: <span className="t-accent">jetstream2.us-east.bsky.network · public ws</span>
          </span>
          <span>
            ←{' '}
            <Link to="/labs" className="t-accent">
              all labs
            </Link>
          </span>
        </footer>
      </main>
    </>
  );
}

function VirtualisedLog({
  rows,
  expanded,
  onToggle,
}: {
  rows: Event[];
  expanded: number | null;
  onToggle: (id: number) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virt = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (expanded === rows[i]?.id ? 440 : 30),
    overscan: 12,
  });

  return (
    <section className="log" ref={parentRef}>
      <div className="log-inner" style={{ height: `${virt.getTotalSize()}px` }}>
        {virt.getVirtualItems().map((v) => {
          const ev = rows[v.index];
          return (
            <div
              key={v.key}
              data-index={v.index}
              ref={virt.measureElement}
              className="log-row-slot"
              style={{ transform: `translateY(${v.start}px)` }}
            >
              <EventRow ev={ev} expanded={expanded === ev.id} onToggle={() => onToggle(ev.id)} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EventRow({ ev, expanded, onToggle }: { ev: Event; expanded: boolean; onToggle: () => void }) {
  const op = ev.commit?.operation;
  const collection = ev.commit?.collection;
  const rkey = ev.commit?.rkey;
  return (
    <article className={'row row-' + ev.kind + (op ? ' op-' + op : '')}>
      <button type="button" className="row-hd" onClick={onToggle}>
        <span className="row-caret">{expanded ? '▾' : '▸'}</span>
        <span className="row-time">{fmtTime(ev.time_us)}</span>
        <span className="row-kind">{ev.kind}</span>
        {op ? <span className={'row-op op-' + op}>{op}</span> : null}
        <span className="row-col">{collection ?? (ev.kind === 'commit' ? '(?)' : '—')}</span>
        <span className="row-rkey">{rkey ?? ''}</span>
        <span className="row-did t-faint">{truncateDid(ev.did)}</span>
      </button>
      {expanded ? (
        <div className="row-body">
          <CodeBlock code={JSON.stringify(ev, null, 2)} bare />
        </div>
      ) : null}
    </article>
  );
}

const CSS = `
  .shell-js { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }

  .crumbs {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    padding-top: var(--sp-6);
    margin-bottom: var(--sp-4);
  }
  .crumbs a { color: var(--color-fg-faint); text-decoration: none; }
  .crumbs a:hover { color: var(--color-accent); }
  .crumbs .sep { margin: 0 6px; color: var(--color-border-bright); }
  .crumbs .last { color: var(--color-accent); }

  .js-hd { padding-bottom: var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .js-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(44px, 7vw, 84px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.95;
  }
  .js-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .js-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 68ch; margin-top: var(--sp-3); line-height: 1.55; }
  .js-hd .sub .inline {
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    padding: 1px 6px;
    font-size: 12px;
    color: var(--color-accent);
    font-family: var(--font-mono);
  }

  .controls {
    display: flex; gap: var(--sp-3); align-items: flex-end;
    margin-top: var(--sp-5);
    flex-wrap: wrap;
  }
  .controls .lbl {
    display: flex; flex-direction: column; gap: 4px;
    flex: 1; min-width: 240px;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    text-transform: lowercase;
    letter-spacing: 0.06em;
  }
  .inp {
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    padding: 8px 12px;
    font: inherit;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--color-fg);
  }
  .inp:focus { outline: none; border-color: var(--color-accent-dim); }
  .inp::placeholder { color: var(--color-fg-ghost); }

  .btns { display: flex; gap: 4px; flex-wrap: wrap; }
  .btn {
    border: 1px solid var(--color-border-bright);
    background: var(--color-bg-panel);
    color: var(--color-fg-dim);
    font: inherit;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    padding: 8px 14px;
    cursor: pointer;
    text-transform: lowercase;
    letter-spacing: 0.06em;
  }
  .btn:hover:not(:disabled) { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn.primary {
    border-color: var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 8%, var(--color-bg-panel));
    color: var(--color-accent);
  }
  .btn.primary:hover { background: color-mix(in oklch, var(--color-accent) 16%, var(--color-bg-panel)); }

  .stats {
    display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
    margin-top: var(--sp-4);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .stats b { color: var(--color-fg); font-weight: 400; }
  .stats .t-accent { color: var(--color-accent); font-weight: 400; }
  .stats .t-alert { color: var(--color-alert); font-weight: 400; }
  .stats .t-warn { color: var(--color-warn); }
  .stats .sep-dot { color: var(--color-border-bright); }
  .dot-st {
    width: 8px; height: 8px;
    border-radius: 50%;
    display: inline-block;
  }
  .dot-st.dot-disconnected { background: var(--color-fg-ghost); }
  .dot-st.dot-connecting { background: var(--color-warn); animation: pulse 1s ease-in-out infinite; }
  .dot-st.dot-connected { background: var(--color-accent); box-shadow: 0 0 6px var(--accent-glow); animation: pulse 2s ease-in-out infinite; }
  .dot-st.dot-error { background: var(--color-alert); }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

  /* event log */
  .log {
    position: relative;
    margin-top: var(--sp-4);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    font-family: var(--font-mono);
    font-size: 11px;
    height: calc(100dvh - 400px);
    min-height: 400px;
    overflow-y: auto;
    contain: strict;
  }
  .log-inner { position: relative; width: 100%; }
  .log-row-slot { position: absolute; top: 0; left: 0; right: 0; }
  .empty {
    padding: var(--sp-10) var(--sp-6);
    text-align: center;
  }
  .empty-glyph { font-size: 40px; color: var(--color-accent-dim); margin-bottom: var(--sp-3); line-height: 1; }
  .empty-ttl { font-size: var(--fs-sm); color: var(--color-fg); margin-bottom: 4px; }
  .empty-sub { font-size: var(--fs-xs); color: var(--color-fg-faint); word-break: break-all; }

  .row { border-bottom: 1px dashed var(--color-border); }
  .row:last-child { border-bottom: 0; }
  .row-hd {
    display: grid;
    grid-template-columns: 14px 90px 60px 60px minmax(0, 1fr) 120px 180px;
    gap: 10px;
    align-items: center;
    width: 100%;
    padding: 4px 10px;
    border: 0;
    background: transparent;
    color: var(--color-fg-dim);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .row-hd:hover { background: var(--color-bg-raised); }
  .row-caret { color: var(--color-accent); width: 12px; }
  .row-time { color: var(--color-fg-faint); }
  .row-kind {
    color: var(--color-fg-faint);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 9px;
    padding: 1px 4px;
    border: 1px solid var(--color-border);
    text-align: center;
  }
  .row.row-commit .row-kind   { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .row.row-identity .row-kind { color: oklch(0.78 0.11 210); border-color: oklch(0.4 0.1 210); }
  .row.row-account .row-kind  { color: oklch(0.82 0.13 85); border-color: oklch(0.5 0.1 85); }

  .row-op {
    color: var(--color-fg-faint);
    font-size: 10px;
    text-transform: lowercase;
  }
  .row-op.op-create { color: var(--color-accent); }
  .row-op.op-update { color: oklch(0.82 0.13 85); }
  .row-op.op-delete { color: var(--color-alert); }

  .row-col {
    color: var(--color-fg);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .row-rkey {
    color: var(--color-fg-faint);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .row-did {
    text-align: right;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }

  .row-body {
    padding: 0 10px 10px 34px;
  }
  .row-body .cb {
    border-left-color: var(--color-accent-dim);
  }

  @media (max-width: 720px) {
    .row-hd {
      grid-template-columns: 14px 70px 50px minmax(0, 1fr) 80px;
      gap: 6px;
      font-size: 10px;
    }
    .row-op, .row-did { display: none; }
  }

  .js-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-5);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
`;
