import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { CodeBlock } from '../../components/CodeBlock';

type PlcService = { type: string; endpoint: string };

type PlcOperation = {
  type?: string; // 'plc_operation' | 'plc_tombstone' | 'create' (legacy)
  sig?: string;
  prev: string | null;
  alsoKnownAs?: string[];
  rotationKeys?: string[];
  verificationMethods?: Record<string, string>;
  services?: Record<string, PlcService>;
  handle?: string; // legacy 'create' operation field
  service?: string; // legacy 'create' operation field
  signingKey?: string; // legacy
  recoveryKey?: string; // legacy
};

async function resolveIdentifier(raw: string): Promise<string> {
  const val = raw.trim().replace(/^@/, '');
  if (!val) throw new Error('enter a handle or did');
  if (val.startsWith('did:')) return val;
  const res = await fetch(
    `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(val)}`,
  );
  if (!res.ok) throw new Error(`could not resolve handle (${res.status})`);
  const data = (await res.json()) as { did: string };
  return data.did;
}

async function fetchPlcLog(did: string): Promise<PlcOperation[]> {
  if (!did.startsWith('did:plc:')) {
    throw new Error(`plc.directory only tracks did:plc: identifiers — ${did} uses a different method`);
  }
  const res = await fetch(`https://plc.directory/${did}/log`);
  if (!res.ok) throw new Error(`plc.directory returned ${res.status}`);
  return (await res.json()) as PlcOperation[];
}

// Normalise legacy 'create' ops so they look like the modern shape for diffing.
function normalise(op: PlcOperation): PlcOperation {
  if (op.type === 'create') {
    return {
      ...op,
      alsoKnownAs: op.handle ? [`at://${op.handle}`] : [],
      rotationKeys: [op.signingKey, op.recoveryKey].filter((k): k is string => !!k),
      services: op.service
        ? { atproto_pds: { type: 'AtprotoPersonalDataServer', endpoint: op.service } }
        : {},
    };
  }
  return op;
}

type Change = { kind: 'add' | 'remove' | 'change'; label: string; from?: string; to?: string };

function diffOps(prev: PlcOperation | null, next: PlcOperation): Change[] {
  const changes: Change[] = [];
  if (next.type === 'plc_tombstone') {
    changes.push({ kind: 'change', label: 'tombstoned', to: 'did retired' });
    return changes;
  }
  const prevN = prev ? normalise(prev) : null;
  const nextN = normalise(next);

  // alsoKnownAs (handle)
  const prevAka = prevN?.alsoKnownAs ?? [];
  const nextAka = nextN.alsoKnownAs ?? [];
  if (prevAka.join('|') !== nextAka.join('|')) {
    const pHandle = prevAka[0]?.replace(/^at:\/\//, '') ?? '';
    const nHandle = nextAka[0]?.replace(/^at:\/\//, '') ?? '';
    if (!prev) changes.push({ kind: 'add', label: 'handle', to: nHandle });
    else if (pHandle !== nHandle) changes.push({ kind: 'change', label: 'handle', from: pHandle, to: nHandle });
  }

  // pds endpoint
  const prevPds = prevN?.services?.atproto_pds?.endpoint ?? '';
  const nextPds = nextN.services?.atproto_pds?.endpoint ?? '';
  if (prevPds !== nextPds) {
    if (!prev) changes.push({ kind: 'add', label: 'pds', to: nextPds });
    else changes.push({ kind: 'change', label: 'pds', from: prevPds, to: nextPds });
  }

  // rotation keys
  const prevKeys = new Set(prevN?.rotationKeys ?? []);
  const nextKeys = new Set(nextN.rotationKeys ?? []);
  for (const k of nextKeys) {
    if (!prevKeys.has(k)) changes.push({ kind: 'add', label: 'rotation key', to: shortKey(k) });
  }
  for (const k of prevKeys) {
    if (!nextKeys.has(k)) changes.push({ kind: 'remove', label: 'rotation key', from: shortKey(k) });
  }

  // signing key (atproto verificationMethod)
  const prevSign = prevN?.verificationMethods?.atproto ?? '';
  const nextSign = nextN.verificationMethods?.atproto ?? '';
  if (prevSign !== nextSign) {
    if (!prev) changes.push({ kind: 'add', label: 'signing key', to: shortKey(nextSign) });
    else changes.push({ kind: 'change', label: 'signing key', from: shortKey(prevSign), to: shortKey(nextSign) });
  }

  // other services (rare but possible — labeler, feed generator, etc)
  const prevSvc = prevN?.services ?? {};
  const nextSvc = nextN.services ?? {};
  for (const key of Object.keys(nextSvc)) {
    if (key === 'atproto_pds') continue;
    if (!prevSvc[key]) {
      changes.push({ kind: 'add', label: `service "${key}"`, to: nextSvc[key].endpoint });
    } else if (prevSvc[key].endpoint !== nextSvc[key].endpoint) {
      changes.push({
        kind: 'change',
        label: `service "${key}"`,
        from: prevSvc[key].endpoint,
        to: nextSvc[key].endpoint,
      });
    }
  }
  for (const key of Object.keys(prevSvc)) {
    if (key === 'atproto_pds') continue;
    if (!nextSvc[key]) changes.push({ kind: 'remove', label: `service "${key}"`, from: prevSvc[key].endpoint });
  }

  if (changes.length === 0) changes.push({ kind: 'change', label: 'no visible changes', to: '(signature-only)' });
  return changes;
}

function shortKey(k: string): string {
  if (!k) return '';
  // did:key:zQ3shV… → did:key:zQ3shV…abc (short)
  return k.length > 32 ? `${k.slice(0, 18)}…${k.slice(-6)}` : k;
}

function opSummary(op: PlcOperation, prev: PlcOperation | null): { label: string; variant: 'genesis' | 'normal' | 'tombstone' } {
  if (op.type === 'plc_tombstone') return { label: 'tombstone', variant: 'tombstone' };
  if (prev === null) return { label: 'genesis', variant: 'genesis' };
  const changes = diffOps(prev, op);
  if (changes.length === 1) return { label: changes[0].label, variant: 'normal' };
  const labels = changes.map((c) => c.label);
  const unique = [...new Set(labels)];
  return { label: unique.join(' · '), variant: 'normal' };
}

export default function PlcLogPage() {
  const rawParams = useParams({ strict: false }) as { _splat?: string };
  const identifier = (rawParams._splat ?? '').replace(/^@/, '') || null;
  const navigate = useNavigate();
  const [input, setInput] = useState(identifier ?? '');
  const [expanded, setExpanded] = useState<number | null>(null);

  const didQuery = useQuery({
    queryKey: ['plc-log', 'did', identifier],
    queryFn: () => resolveIdentifier(identifier!),
    enabled: !!identifier,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const logQuery = useQuery({
    queryKey: ['plc-log', 'log', didQuery.data],
    queryFn: () => fetchPlcLog(didQuery.data!),
    enabled: !!didQuery.data,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const val = input.trim().replace(/^@/, '');
    if (!val) return;
    navigate({ to: `/labs/plc-log/${val}` as never });
  };

  const error = didQuery.error ?? logQuery.error;

  const entries = logQuery.data ?? [];
  // operations come oldest-first from plc.directory.
  const currentOp = entries.length > 0 ? entries[entries.length - 1] : null;
  const currentHandle = currentOp
    ? normalise(currentOp).alsoKnownAs?.[0]?.replace(/^at:\/\//, '')
    : null;
  const currentPds = currentOp ? normalise(currentOp).services?.atproto_pds?.endpoint : null;

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-plc">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          {identifier ? (
            <>
              <Link to="/labs/plc-log">plc-log</Link>
              <span className="sep">/</span>
              <span className="last">{identifier}</span>
            </>
          ) : (
            <span className="last">plc-log</span>
          )}
        </div>

        <header className="plc-hd">
          <h1>
            plc log<span className="dot">.</span>
          </h1>
          <p className="sub">
            every <code className="inline">did:plc:</code> identifier has its operation history stored on{' '}
            <a href="https://plc.directory" target="_blank" rel="noopener noreferrer" className="glow-link">
              plc.directory
            </a>
            . resolve a handle or paste a did to see every handle change, pds migration, rotation key update, and
            (if any) tombstone — with a diff between each consecutive op.
          </p>
          <form onSubmit={onSubmit} className="plc-form">
            <input
              className="inp"
              type="text"
              placeholder="handle or did:plc:… (e.g. imlunahey.com)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" className="go" disabled={!input.trim()}>
              trace →
            </button>
          </form>
          {identifier && didQuery.data ? (
            <div className="plc-meta">
              <span>
                did <b>{didQuery.data}</b>
              </span>
              {currentHandle ? (
                <span>
                  current handle <b className="t-accent">{currentHandle}</b>
                </span>
              ) : null}
              {currentPds ? (
                <span>
                  pds <b>{currentPds.replace(/^https:\/\//, '')}</b>
                </span>
              ) : null}
              <span>
                ops <b>{entries.length}</b>
              </span>
            </div>
          ) : null}
        </header>

        {didQuery.isFetching || logQuery.isFetching ? <LoadingPanel label="walking the plc log…" /> : null}

        {error ? <ErrorPanel msg={error instanceof Error ? error.message : String(error)} /> : null}

        {!identifier ? (
          <section className="empty">
            <div className="empty-glyph">▯</div>
            <div className="empty-ttl">enter a handle or did to start</div>
            <div className="empty-sub">try imlunahey.com or did:plc:k6acu4chiwkixvdedcmdgmal</div>
          </section>
        ) : entries.length > 0 ? (
          <Timeline entries={entries} expanded={expanded} onToggle={setExpanded} />
        ) : null}

        <footer className="plc-footer">
          <span>
            src: <span className="t-accent">plc.directory/&lt;did&gt;/log · public.api resolve-handle</span>
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

function Timeline({
  entries,
  expanded,
  onToggle,
}: {
  entries: PlcOperation[];
  expanded: number | null;
  onToggle: (i: number | null) => void;
}) {
  return (
    <section className="timeline">
      {entries.map((op, i) => {
        const prev = i > 0 ? entries[i - 1] : null;
        const summary = opSummary(op, prev);
        const changes = op.type === 'plc_tombstone' ? [] : diffOps(prev, op);
        const isOpen = expanded === i;
        return (
          <article key={i} className={'tl-entry tl-' + summary.variant + (isOpen ? ' open' : '')}>
            <div className="tl-rail">
              <div className="tl-dot" />
              {i < entries.length - 1 ? <div className="tl-line" /> : null}
            </div>
            <div className="tl-body">
              <button type="button" className="tl-hd" onClick={() => onToggle(isOpen ? null : i)}>
                <span className="tl-lbl">
                  <span className="tl-caret">{isOpen ? '▾' : '▸'}</span>
                  <span className="tl-kind">
                    {summary.variant === 'genesis' ? 'genesis' : summary.variant === 'tombstone' ? 'tombstone' : `op ${i + 1}`}
                  </span>
                  <span className="tl-summary">{summary.label}</span>
                </span>
              </button>
              {changes.length > 0 ? (
                <ul className="tl-changes">
                  {changes.map((c, idx) => (
                    <li key={idx} className={'tl-change tl-change-' + c.kind}>
                      <span className="tl-change-op">
                        {c.kind === 'add' ? '+' : c.kind === 'remove' ? '−' : '~'}
                      </span>
                      <span className="tl-change-label">{c.label}</span>
                      {c.from && c.to ? (
                        <span className="tl-change-vals">
                          <span className="tl-from">{c.from}</span>
                          <span className="tl-arr">→</span>
                          <span className="tl-to">{c.to}</span>
                        </span>
                      ) : c.to ? (
                        <span className="tl-change-vals">
                          <span className="tl-to">{c.to}</span>
                        </span>
                      ) : c.from ? (
                        <span className="tl-change-vals">
                          <span className="tl-from">{c.from}</span>
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              {op.prev ? (
                <div className="tl-meta">
                  <span>
                    prev <code className="tl-cid">{op.prev}</code>
                  </span>
                </div>
              ) : null}
              {isOpen ? (
                <div className="tl-raw">
                  <CodeBlock code={JSON.stringify(op, null, 2)} filename={`op-${i + 1}.json`} />
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <section className="prog">
      <div className="prog-line">
        <span>{label}</span>
      </div>
      <div className="prog-bar">
        <div className="prog-bar-indeterminate" />
      </div>
    </section>
  );
}

function ErrorPanel({ msg }: { msg: string }) {
  return (
    <section className="err">
      <div className="err-hd">// error</div>
      <div className="err-body">{msg}</div>
    </section>
  );
}

const CSS = `
  .shell-plc { max-width: 900px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .plc-hd { padding-bottom: var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .plc-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(44px, 7vw, 84px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.95;
  }
  .plc-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .plc-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 68ch; margin-top: var(--sp-3); line-height: 1.55; }
  .plc-hd .sub .inline {
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    padding: 1px 6px;
    font-size: 12px;
    color: var(--color-accent);
    font-family: var(--font-mono);
  }

  .plc-form { display: flex; gap: 6px; margin-top: var(--sp-5); flex-wrap: wrap; }
  .inp {
    flex: 1; min-width: 220px;
    padding: 10px 14px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    color: var(--color-fg);
    font: inherit;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }
  .inp:focus { outline: none; border-color: var(--color-accent-dim); }
  .inp::placeholder { color: var(--color-fg-ghost); }
  .go {
    padding: 10px 18px;
    border: 1px solid var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 8%, var(--color-bg-panel));
    color: var(--color-accent);
    font: inherit;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    cursor: pointer;
    text-transform: lowercase;
    letter-spacing: 0.06em;
  }
  .go:hover:not(:disabled) { background: color-mix(in oklch, var(--color-accent) 16%, var(--color-bg-panel)); }
  .go:disabled { opacity: 0.4; cursor: not-allowed; }

  .plc-meta {
    display: flex; gap: var(--sp-5); flex-wrap: wrap;
    margin-top: var(--sp-4);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .plc-meta b { color: var(--color-fg); font-weight: 400; word-break: break-all; }

  /* timeline */
  .timeline { margin-top: var(--sp-6); }
  .tl-entry {
    display: grid;
    grid-template-columns: 20px 1fr;
    gap: var(--sp-3);
    padding-bottom: var(--sp-5);
  }
  .tl-entry:last-child { padding-bottom: 0; }

  .tl-rail { position: relative; }
  .tl-dot {
    position: absolute; top: 6px; left: 3px;
    width: 14px; height: 14px;
    border-radius: 50%;
    background: var(--color-bg-panel);
    border: 2px solid var(--color-accent);
    box-shadow: 0 0 8px var(--accent-glow);
    z-index: 2;
  }
  .tl-line {
    position: absolute;
    top: 24px; bottom: -20px; left: 9px;
    width: 2px;
    background: var(--color-border-bright);
    z-index: 1;
  }
  .tl-entry.tl-genesis .tl-dot { background: var(--color-accent); }
  .tl-entry.tl-tombstone .tl-dot { border-color: var(--color-alert); background: var(--color-alert); box-shadow: 0 0 8px color-mix(in oklch, var(--color-alert) 60%, transparent); }
  .tl-entry.tl-nullified .tl-dot { border-color: var(--color-fg-ghost); background: var(--color-bg); box-shadow: none; }
  .tl-entry.nullified .tl-body { opacity: 0.5; }

  .tl-body {
    min-width: 0;
    padding-bottom: 4px;
  }
  .tl-hd {
    display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-3);
    width: 100%;
    background: transparent;
    border: 0;
    padding: 4px 0;
    color: inherit;
    font: inherit;
    font-family: var(--font-mono);
    cursor: pointer;
    text-align: left;
  }
  .tl-hd:hover .tl-summary { color: var(--color-accent); }
  .tl-lbl { display: flex; align-items: baseline; gap: var(--sp-2); min-width: 0; flex: 1; }
  .tl-caret { color: var(--color-accent); }
  .tl-kind {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--color-fg-faint);
    padding: 1px 6px;
    border: 1px solid var(--color-border-bright);
  }
  .tl-entry.tl-genesis .tl-kind { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .tl-entry.tl-tombstone .tl-kind { color: var(--color-alert); border-color: color-mix(in oklch, var(--color-alert) 40%, var(--color-border)); }
  .tl-entry.tl-nullified .tl-kind { color: var(--color-fg-faint); }
  .tl-summary { color: var(--color-fg); font-size: var(--fs-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tl-date { font-size: var(--fs-xs); color: var(--color-fg-faint); flex-shrink: 0; white-space: nowrap; }

  .tl-changes {
    list-style: none;
    margin: 0;
    padding: var(--sp-2) 0 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .tl-change {
    display: grid;
    grid-template-columns: 14px auto 1fr;
    gap: var(--sp-2);
    align-items: baseline;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-dim);
  }
  .tl-change-op {
    font-weight: 400;
    text-align: center;
  }
  .tl-change-add .tl-change-op { color: var(--color-accent); }
  .tl-change-remove .tl-change-op { color: var(--color-alert); }
  .tl-change-change .tl-change-op { color: oklch(0.82 0.13 85); }
  .tl-change-label {
    color: var(--color-fg-faint);
    text-transform: lowercase;
  }
  .tl-change-vals { display: inline-flex; gap: 6px; align-items: baseline; flex-wrap: wrap; min-width: 0; }
  .tl-from {
    color: var(--color-fg-dim);
    text-decoration: line-through;
    text-decoration-color: var(--color-fg-faint);
    word-break: break-all;
  }
  .tl-arr { color: var(--color-fg-faint); }
  .tl-to { color: var(--color-fg); word-break: break-all; }
  .tl-change-add .tl-to { color: var(--color-accent); }

  .tl-meta {
    margin-top: var(--sp-2);
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg-faint);
  }
  .tl-cid {
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    padding: 1px 6px;
    color: var(--color-fg-dim);
    font-size: 10px;
  }

  .tl-raw { margin-top: var(--sp-3); }

  /* progress / error / empty */
  .prog {
    margin-top: var(--sp-6);
    padding: var(--sp-4) var(--sp-5);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .prog-line { margin-bottom: var(--sp-2); }
  .prog-bar { height: 4px; background: var(--color-border); overflow: hidden; }
  .prog-bar-indeterminate {
    height: 100%; width: 30%;
    background: var(--color-accent);
    box-shadow: 0 0 6px var(--accent-glow);
    animation: prog-slide 1.2s ease-in-out infinite;
  }
  @keyframes prog-slide {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(400%); }
  }

  .err {
    margin-top: var(--sp-6);
    border: 1px solid color-mix(in oklch, var(--color-alert) 40%, var(--color-border));
    background: color-mix(in oklch, var(--color-alert) 5%, var(--color-bg-panel));
    font-family: var(--font-mono);
  }
  .err-hd {
    padding: 6px 12px;
    border-bottom: 1px solid color-mix(in oklch, var(--color-alert) 30%, var(--color-border));
    font-size: 10px;
    color: var(--color-alert);
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }
  .err-body { padding: var(--sp-4) var(--sp-5); font-size: var(--fs-sm); color: var(--color-fg); line-height: 1.55; word-break: break-word; }

  .empty {
    margin-top: var(--sp-8);
    padding: var(--sp-10) var(--sp-6);
    border: 1px dashed var(--color-border-bright);
    text-align: center;
    font-family: var(--font-mono);
  }
  .empty-glyph { font-size: 40px; color: var(--color-accent-dim); margin-bottom: var(--sp-3); line-height: 1; }
  .empty-ttl { font-size: var(--fs-sm); color: var(--color-fg); margin-bottom: 4px; }
  .empty-sub { font-size: var(--fs-xs); color: var(--color-fg-faint); word-break: break-all; }

  .plc-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-8);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
`;
