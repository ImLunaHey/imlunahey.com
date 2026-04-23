import { useQuery } from '@tanstack/react-query';
import { Link, useSearch } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

type PlcOp = {
  type?: 'plc_operation' | 'plc_tombstone' | 'create';
  prev?: string | null;
  sig?: string;
  rotationKeys?: string[];
  verificationMethods?: Record<string, string>;
  alsoKnownAs?: string[];
  services?: Record<string, { type: string; endpoint: string }>;
  handle?: string; // legacy 'create' format
  recoveryKey?: string; // legacy
  signingKey?: string; // legacy
  service?: string; // legacy
};

type PlcEntry = {
  did: string;
  operation: PlcOp;
  cid: string;
  nullified: boolean;
  createdAt: string;
};

async function resolveToDid(input: string): Promise<string> {
  const trimmed = input.trim();
  if (trimmed.startsWith('did:')) return trimmed;
  const handle = trimmed.replace(/^@/, '').replace(/^https?:\/\//, '').replace(/^www\./, '');
  const res = await fetch(
    `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
  );
  if (!res.ok) throw new Error('handle not found');
  const j = (await res.json()) as { did?: string };
  if (!j.did) throw new Error('no did');
  return j.did;
}

async function fetchPlcLog(did: string): Promise<PlcEntry[]> {
  if (!did.startsWith('did:plc:')) throw new Error('only did:plc supports log lookup');
  const res = await fetch(`https://plc.directory/${did}/log/audit`);
  if (res.status === 404) throw new Error('did not found on plc');
  if (!res.ok) throw new Error(`plc ${res.status}`);
  const j = (await res.json()) as PlcEntry[];
  return j;
}

type Delta = {
  kind: 'handle' | 'pds' | 'keys' | 'signing' | 'service' | 'create' | 'tombstone' | 'rekey';
  label: string;
  value: string;
};

function handleFromAka(aka?: string[]): string | null {
  if (!aka || aka.length === 0) return null;
  for (const a of aka) {
    if (a.startsWith('at://')) return a.slice(5);
    return a;
  }
  return aka[0] ?? null;
}

function pdsFromServices(s?: PlcOp['services'], legacy?: string): string | null {
  if (s?.atproto_pds?.endpoint) return s.atproto_pds.endpoint;
  if (legacy) return legacy;
  const first = Object.values(s ?? {})[0];
  return first?.endpoint ?? null;
}

function diffOps(cur: PlcOp, prev: PlcOp | null): Delta[] {
  const deltas: Delta[] = [];
  if (cur.type === 'plc_tombstone') {
    deltas.push({ kind: 'tombstone', label: 'deactivated', value: 'tombstoned' });
    return deltas;
  }

  const prevHandle = prev ? handleFromAka(prev.alsoKnownAs) ?? prev.handle ?? null : null;
  const curHandle = handleFromAka(cur.alsoKnownAs) ?? cur.handle ?? null;
  if (curHandle && curHandle !== prevHandle) {
    deltas.push({ kind: 'handle', label: prev ? 'handle changed' : 'handle set', value: `${prevHandle ? prevHandle + ' → ' : ''}${curHandle}` });
  }

  const prevPds = prev ? pdsFromServices(prev.services, prev.service) : null;
  const curPds = pdsFromServices(cur.services, cur.service);
  if (curPds && curPds !== prevPds) {
    deltas.push({ kind: 'pds', label: prev ? 'pds migrated' : 'pds set', value: `${prevPds ? prevPds + ' → ' : ''}${curPds}` });
  }

  const prevKeys = prev?.rotationKeys ?? (prev?.recoveryKey ? [prev.recoveryKey] : []);
  const curKeys = cur.rotationKeys ?? (cur.recoveryKey ? [cur.recoveryKey] : []);
  if (prev && curKeys.join('|') !== prevKeys.join('|')) {
    deltas.push({ kind: 'keys', label: 'rotation keys changed', value: `${prevKeys.length} → ${curKeys.length} keys` });
  }

  const prevSign = prev?.verificationMethods?.atproto ?? prev?.signingKey ?? null;
  const curSign = cur.verificationMethods?.atproto ?? cur.signingKey ?? null;
  if (prev && curSign && curSign !== prevSign) {
    deltas.push({ kind: 'signing', label: 'signing key rotated', value: abbrev(curSign) });
  }

  if (!prev) {
    deltas.unshift({ kind: 'create', label: 'did created', value: 'first operation' });
  } else if (deltas.length === 0) {
    deltas.push({ kind: 'rekey', label: 'operation recorded', value: 'no user-visible change' });
  }
  return deltas;
}

function abbrev(s: string, n = 14): string {
  if (s.length <= n + 4) return s;
  return `${s.slice(0, n)}…${s.slice(-4)}`;
}

function relative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const d = Math.floor((now - then) / 1000);
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  if (d < 86400 * 30) return `${Math.floor(d / 86400)}d ago`;
  if (d < 86400 * 365) return `${Math.floor(d / (86400 * 30))}mo ago`;
  return `${(d / (86400 * 365)).toFixed(1)}y ago`;
}

export default function DidLogPage() {
  const search = useSearch({ strict: false }) as { actor?: string };
  const initial = search.actor?.trim() || 'imlunahey.com';
  const [input, setInput] = useState(initial);
  const [submitted, setSubmitted] = useState<string | null>(initial);

  useEffect(() => {
    if (search.actor && search.actor !== submitted) {
      setInput(search.actor);
      setSubmitted(search.actor);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.actor]);

  const { data: did, isPending: resolving, error: resolveErr } = useQuery({
    queryKey: ['did-log-resolve', submitted],
    queryFn: () => resolveToDid(submitted!),
    enabled: !!submitted,
    staleTime: 1000 * 60 * 10,
    retry: false,
  });

  const { data: log, isPending: loadingLog, error: logErr } = useQuery({
    queryKey: ['did-log', did],
    queryFn: () => fetchPlcLog(did!),
    enabled: !!did,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const entries = useMemo(() => {
    if (!log) return [] as Array<{ entry: PlcEntry; deltas: Delta[] }>;
    const sorted = [...log].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const out: Array<{ entry: PlcEntry; deltas: Delta[] }> = [];
    let prev: PlcOp | null = null;
    for (const e of sorted) {
      out.push({ entry: e, deltas: diffOps(e.operation, prev) });
      prev = e.operation;
    }
    return out.reverse();
  }, [log]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = input.trim();
    if (v) setSubmitted(v);
  };

  const err = resolveErr instanceof Error ? resolveErr.message : logErr instanceof Error ? logErr.message : null;

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-dl">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">did log</span>
        </div>

        <header className="dl-hd">
          <h1>did log<span className="dot">.</span></h1>
          <p className="sub">
            the complete history of an atproto identity — handle changes, pds migrations, key rotations,
            all signed and timestamped. source: <code>plc.directory/{'{did}'}/log/audit</code>.
          </p>
        </header>

        <form className="dl-input-row" onSubmit={onSubmit}>
          <div className="dl-prompt">
            <span className="mark">$</span>
            <span>did-log</span>
          </div>
          <input
            className="dl-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="handle or did:plc:…"
            autoComplete="off"
            spellCheck={false}
          />
          <button className="dl-btn" type="submit" disabled={!input.trim()}>fetch</button>
        </form>

        {did ? (
          <div className="dl-did-line">
            <span className="dl-lbl">did</span>
            <code>{did}</code>
            <a className="dl-ext" href={`https://plc.directory/${did}`} target="_blank" rel="noopener noreferrer">view on plc ↗</a>
          </div>
        ) : null}

        {err ? (
          <div className="dl-err">✗ {err}</div>
        ) : resolving || loadingLog ? (
          <div className="dl-loading">resolving…</div>
        ) : entries.length > 0 ? (
          <section className="dl-timeline">
            <div className="dl-summary">
              <div><span>operations</span><b>{entries.length}</b></div>
              <div><span>first seen</span><b>{entries[entries.length - 1]?.entry.createdAt.slice(0, 10)}</b></div>
              <div><span>age</span><b>{entries[entries.length - 1] ? relative(entries[entries.length - 1].entry.createdAt) : '—'}</b></div>
              <div><span>latest</span><b>{entries[0]?.entry.createdAt.slice(0, 10)}</b></div>
            </div>
            <ol className="dl-tl">
              {entries.map((e, i) => (
                <TimelineEntry key={e.entry.cid} entry={e.entry} deltas={e.deltas} isLatest={i === 0} />
              ))}
            </ol>
          </section>
        ) : null}
      </main>
    </>
  );
}

function TimelineEntry({ entry, deltas, isLatest }: { entry: PlcEntry; deltas: Delta[]; isLatest: boolean }) {
  return (
    <li className={`dl-entry ${entry.nullified ? 'nullified' : ''} ${isLatest ? 'latest' : ''}`}>
      <div className="dl-node" aria-hidden />
      <div className="dl-entry-card">
        <header className="dl-entry-hd">
          <time className="dl-time">{entry.createdAt.slice(0, 10)} <span className="dl-time-t">{entry.createdAt.slice(11, 19)}z</span></time>
          <span className="dl-time-rel">{relative(entry.createdAt)}</span>
          {entry.nullified ? <span className="dl-null">nullified</span> : null}
          {isLatest ? <span className="dl-cur">current</span> : null}
        </header>
        <ul className="dl-deltas">
          {deltas.map((d, i) => (
            <li key={i} className={`dl-delta dl-d-${d.kind}`}>
              <span className="dl-delta-kind">{d.label}</span>
              <span className="dl-delta-val">{d.value}</span>
            </li>
          ))}
        </ul>
        <div className="dl-cid" title="operation cid">{entry.cid}</div>
      </div>
    </li>
  );
}

const CSS = `
  .shell-dl { max-width: 980px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .dl-hd { padding: 48px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .dl-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(48px, 8vw, 96px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.9;
  }
  .dl-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .dl-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 60ch; margin-top: var(--sp-3); }
  .dl-hd code { font-family: var(--font-mono); color: var(--color-accent); }

  .dl-input-row {
    display: flex;
    margin-top: var(--sp-5);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .dl-prompt {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 0 var(--sp-3);
    font-family: var(--font-mono); font-size: var(--fs-sm);
    color: var(--color-fg-faint);
    background: var(--color-bg-raised);
    border-right: 1px solid var(--color-border);
  }
  .dl-prompt .mark { color: var(--color-accent); text-shadow: 0 0 6px var(--accent-glow); }
  .dl-input {
    flex: 1;
    background: transparent;
    border: 0;
    outline: 0;
    color: var(--color-fg);
    font-family: var(--font-mono);
    font-size: var(--fs-md);
    padding: var(--sp-3);
  }
  .dl-btn {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    background: var(--color-accent);
    color: #000;
    border: 0;
    padding: 0 var(--sp-5);
    cursor: pointer;
    text-transform: lowercase;
  }
  .dl-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .dl-did-line {
    display: flex; align-items: center; gap: var(--sp-2);
    margin: var(--sp-3) 0;
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-dim);
    flex-wrap: wrap;
  }
  .dl-did-line .dl-lbl { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .dl-did-line code { color: var(--color-accent); }
  .dl-ext { color: var(--color-fg-faint); text-decoration: none; margin-left: auto; }
  .dl-ext:hover { color: var(--color-accent); }

  .dl-err {
    padding: var(--sp-3);
    border: 1px solid var(--color-alert-dim);
    background: color-mix(in srgb, var(--color-alert) 5%, transparent);
    color: var(--color-alert);
    font-family: var(--font-mono); font-size: var(--fs-sm);
  }
  .dl-loading {
    padding: var(--sp-5);
    text-align: center;
    font-family: var(--font-mono);
    color: var(--color-fg-faint);
  }

  .dl-timeline { padding: var(--sp-4) 0 var(--sp-10); }

  .dl-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: var(--sp-2);
    margin-bottom: var(--sp-5);
  }
  .dl-summary > div {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: var(--sp-2) var(--sp-3);
    font-family: var(--font-mono); font-size: var(--fs-sm);
    display: flex; flex-direction: column; gap: 2px;
  }
  .dl-summary > div span { color: var(--color-fg-faint); font-size: var(--fs-xs); text-transform: lowercase; }
  .dl-summary > div b { color: var(--color-fg); font-weight: 400; }

  .dl-tl {
    list-style: none;
    position: relative;
    padding-left: 32px;
  }
  .dl-tl::before {
    content: '';
    position: absolute;
    left: 10px; top: 0; bottom: 0;
    width: 2px;
    background: linear-gradient(to bottom,
      color-mix(in oklch, var(--color-accent) 60%, transparent),
      var(--color-border));
  }

  .dl-entry { position: relative; padding-bottom: var(--sp-5); }
  .dl-node {
    position: absolute;
    left: -27px; top: 14px;
    width: 10px; height: 10px;
    border-radius: 50%;
    background: var(--color-bg-panel);
    border: 2px solid var(--color-border-bright);
  }
  .dl-entry.latest .dl-node {
    background: var(--color-accent);
    border-color: var(--color-accent);
    box-shadow: 0 0 10px var(--accent-glow);
  }
  .dl-entry.nullified .dl-node {
    background: var(--color-alert);
    border-color: var(--color-alert-dim);
    opacity: 0.5;
  }
  .dl-entry.nullified .dl-entry-card {
    opacity: 0.55;
    text-decoration: line-through;
  }

  .dl-entry-card {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: var(--sp-3);
  }
  .dl-entry.latest .dl-entry-card {
    border-color: var(--color-accent-dim);
  }
  .dl-entry-hd {
    display: flex; align-items: baseline; gap: var(--sp-2);
    margin-bottom: var(--sp-2);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    flex-wrap: wrap;
  }
  .dl-time { color: var(--color-fg); }
  .dl-time-t { color: var(--color-fg-faint); }
  .dl-time-rel { color: var(--color-fg-faint); }
  .dl-null {
    color: var(--color-alert);
    border: 1px solid var(--color-alert-dim);
    padding: 1px 6px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .dl-cur {
    color: var(--color-accent);
    border: 1px solid var(--color-accent-dim);
    padding: 1px 6px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-left: auto;
  }

  .dl-deltas {
    list-style: none;
    display: flex; flex-direction: column; gap: 3px;
  }
  .dl-delta {
    display: flex; gap: var(--sp-2); align-items: baseline;
    font-family: var(--font-mono); font-size: var(--fs-sm);
    padding: 3px 0;
  }
  .dl-delta-kind {
    color: var(--color-fg-faint);
    min-width: 160px;
    text-transform: lowercase;
    font-size: var(--fs-xs);
  }
  .dl-delta-val {
    color: var(--color-fg);
    word-break: break-word;
    flex: 1;
  }
  .dl-d-handle .dl-delta-kind { color: var(--color-accent); }
  .dl-d-pds .dl-delta-kind { color: #7cd3f7; }
  .dl-d-keys .dl-delta-kind { color: var(--color-warn); }
  .dl-d-signing .dl-delta-kind { color: var(--color-warn); }
  .dl-d-create .dl-delta-kind { color: var(--color-accent); }
  .dl-d-tombstone .dl-delta-kind { color: var(--color-alert); }
  .dl-d-rekey .dl-delta-kind { color: var(--color-fg-ghost); }

  .dl-cid {
    margin-top: var(--sp-2);
    font-family: var(--font-mono); font-size: 10px;
    color: var(--color-fg-ghost);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }

  @media (max-width: 600px) {
    .dl-delta { flex-direction: column; gap: 2px; }
    .dl-delta-kind { min-width: 0; }
  }
`;
