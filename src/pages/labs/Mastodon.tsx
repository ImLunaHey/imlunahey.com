import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Mastodon public firehose via Server-Sent Events.
 *
 * Every Mastodon instance exposes /api/v1/streaming/public as SSE with
 * no auth — two flavours:
 *   federated · every public post the instance sees (best reach on
 *               big instances like mastodon.social)
 *   local     · posts from the instance's own users only
 *
 * CORS varies per instance; mastodon.social + fosstodon.org work fine
 * from browsers. Some small instances strip the allow-origin header on
 * streaming endpoints even though their rest api is open.
 *
 * Sister lab to /labs/jetstream on the atproto side.
 */

const DEFAULT_INSTANCE = 'mastodon.social';
const MAX_ROWS = 200;
const FLUSH_INTERVAL_MS = 250;
const RATE_WINDOW_MS = 5000;

type Status = {
  id: string;
  uri: string;
  url: string | null;
  created_at: string;
  content: string;
  language: string | null;
  spoiler_text: string;
  sensitive: boolean;
  media_attachments: Array<{ id: string; type: string; url: string; preview_url: string | null }>;
  tags: Array<{ name: string }>;
  account: {
    acct: string; // local — "alice", remote — "alice@other.social"
    username: string;
    display_name: string;
    avatar: string;
    url: string;
  };
  replies_count: number;
  reblogs_count: number;
  favourites_count: number;
};

type ConnState = 'disconnected' | 'connecting' | 'connected' | 'error';
type Scope = 'federated' | 'local';

function stripHtml(s: string): string {
  return s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>\s*<p>/gi, '\n\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function instanceOfUrl(url: string | null): string {
  if (!url) return '';
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

function instanceOfAcct(acct: string, self: string): string {
  return acct.includes('@') ? acct.split('@')[1] : self;
}

export default function MastodonPage() {
  const [instanceInput, setInstanceInput] = useState(DEFAULT_INSTANCE);
  const [instance, setInstance] = useState(DEFAULT_INSTANCE);
  const [scope, setScope] = useState<Scope>('federated');
  const [conn, setConn] = useState<ConnState>('disconnected');
  const [paused, setPaused] = useState(false);
  const [err, setErr] = useState('');

  const [rows, setRows] = useState<Status[]>([]);
  const [total, setTotal] = useState(0);
  const [rate, setRate] = useState(0);
  const [topTags, setTopTags] = useState<Array<[string, number]>>([]);
  const [topInst, setTopInst] = useState<Array<[string, number]>>([]);

  const [langFilter, setLangFilter] = useState<string>(''); // 'en', 'ja', or ''
  const [tagFilter, setTagFilter] = useState<string>('');
  const [hasMediaOnly, setHasMediaOnly] = useState(false);

  const esRef = useRef<EventSource | null>(null);
  const bufferRef = useRef<Status[]>([]);
  const tagCountsRef = useRef<Map<string, number>>(new Map());
  const instCountsRef = useRef<Map<string, number>>(new Map());
  const tsWindowRef = useRef<number[]>([]);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const connect = () => {
    close();
    setErr('');
    setConn('connecting');
    // Go through our SSE proxy — most instances don't set CORS headers on
    // /streaming, so the browser can't subscribe directly.
    const url = `/api/mastodon-stream?instance=${encodeURIComponent(instance)}&scope=${scope}`;
    const es = new EventSource(url);
    esRef.current = es;
    es.onopen = () => setConn('connected');
    es.onerror = () => {
      setConn('error');
      setErr(`stream closed — the instance may not expose /api/v1/streaming, try another (mastodon.social, fosstodon.org, mas.to, mstdn.jp).`);
      es.close();
      if (esRef.current === es) esRef.current = null;
    };
    es.addEventListener('update', (ev) => {
      if (pausedRef.current) return;
      try {
        const status: Status = JSON.parse((ev as MessageEvent).data);
        if (langFilter && status.language !== langFilter) return;
        if (hasMediaOnly && status.media_attachments.length === 0) return;
        if (tagFilter && !status.tags.some((t) => t.name.toLowerCase() === tagFilter.toLowerCase())) return;
        bufferRef.current.push(status);
        setTotal((t) => t + 1);
        tsWindowRef.current.push(Date.now());
        for (const tag of status.tags) {
          const lc = tag.name.toLowerCase();
          tagCountsRef.current.set(lc, (tagCountsRef.current.get(lc) ?? 0) + 1);
        }
        const inst = instanceOfUrl(status.url) || instanceOfAcct(status.account.acct, instance);
        if (inst) instCountsRef.current.set(inst, (instCountsRef.current.get(inst) ?? 0) + 1);
      } catch {
        /* ignore parse errors */
      }
    });
  };

  const close = () => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setConn('disconnected');
  };

  // flush buffer into rows, trimming to MAX_ROWS
  useEffect(() => {
    const id = setInterval(() => {
      if (bufferRef.current.length === 0) return;
      const batch = bufferRef.current;
      bufferRef.current = [];
      setRows((prev) => {
        const next = [...batch.reverse(), ...prev];
        return next.length > MAX_ROWS ? next.slice(0, MAX_ROWS) : next;
      });
      // recompute rate from the rolling timestamp window
      const now = Date.now();
      tsWindowRef.current = tsWindowRef.current.filter((t) => now - t <= RATE_WINDOW_MS);
      setRate(tsWindowRef.current.length / (RATE_WINDOW_MS / 1000));
      // top-N tags + instances (from running counts)
      const topT = [...tagCountsRef.current.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
      setTopTags(topT);
      const topI = [...instCountsRef.current.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
      setTopInst(topI);
    }, FLUSH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => () => close(), []);

  const clear = () => {
    setRows([]);
    setTotal(0);
    setRate(0);
    tagCountsRef.current.clear();
    instCountsRef.current.clear();
    tsWindowRef.current = [];
    setTopTags([]);
    setTopInst([]);
  };

  const connectNow = () => {
    const next = instanceInput.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    setInstance(next || DEFAULT_INSTANCE);
    clear();
    // set instance synchronously — effect below runs connect
    setTimeout(connect, 0);
  };

  // re-connect when scope or instance changes via button (not on every keystroke)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-mst">
        <header className="page-hd">
          <div className="label">~/labs/mastodon</div>
          <h1>mastodon<span className="dot">.</span></h1>
          <p className="sub">
            live public firehose of any mastodon instance via server-sent events. the activitypub sibling to{' '}
            <Link to="/labs/jetstream" className="t-accent">jetstream</Link>. each instance only sees what federates to it,
            so the biggest one (mastodon.social) has the widest reach.
          </p>
        </header>

        <section className="controls">
          <div className="ctl-row">
            <label className="field">
              <span className="field-label">instance</span>
              <input
                value={instanceInput}
                onChange={(e) => setInstanceInput(e.target.value)}
                placeholder="mastodon.social"
                autoComplete="off"
              />
            </label>
            <div className="tabs">
              <button type="button" className={'tab' + (scope === 'federated' ? ' active' : '')} onClick={() => setScope('federated')}>federated</button>
              <button type="button" className={'tab' + (scope === 'local' ? ' active' : '')} onClick={() => setScope('local')}>local</button>
            </div>
            {conn === 'connected' ? (
              <button type="button" className="primary" onClick={close}>disconnect</button>
            ) : (
              <button type="button" className="primary" onClick={connectNow}>{conn === 'connecting' ? 'connecting…' : 'connect →'}</button>
            )}
            <button type="button" onClick={() => setPaused((p) => !p)} disabled={conn !== 'connected'}>
              {paused ? '▶ resume' : '⏸ pause'}
            </button>
            <button type="button" onClick={clear}>clear</button>
          </div>
          <div className="ctl-row">
            <label className="field-inline">
              <input type="checkbox" checked={hasMediaOnly} onChange={(e) => setHasMediaOnly(e.target.checked)} />
              <span>media only</span>
            </label>
            <label className="field-inline">
              <span>lang</span>
              <input value={langFilter} onChange={(e) => setLangFilter(e.target.value)} placeholder="en, ja, …" style={{ width: 100 }} />
            </label>
            <label className="field-inline">
              <span>tag</span>
              <input value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} placeholder="art · foss · …" style={{ width: 140 }} />
            </label>
          </div>
        </section>

        {err ? <div className="err">{err}</div> : null}

        <section className="stats">
          <div className="stat"><span className="k">state</span><b className={conn === 'connected' ? 't-accent' : 't-faint'}>{conn}</b></div>
          <div className="stat"><span className="k">received</span><b>{total.toLocaleString()}</b></div>
          <div className="stat"><span className="k">posts / sec</span><b>{rate.toFixed(1)}</b></div>
          <div className="stat"><span className="k">showing</span><b>{rows.length}/{MAX_ROWS}</b></div>
        </section>

        <section className="top-panels">
          <div className="top-panel">
            <div className="top-hd">top instances</div>
            <ul>
              {topInst.length === 0 ? <li className="t-faint">—</li> :
                topInst.map(([host, n]) => <li key={host}><span className="host">{host}</span><span className="n">{n.toLocaleString()}</span></li>)}
            </ul>
          </div>
          <div className="top-panel">
            <div className="top-hd">top tags</div>
            <ul>
              {topTags.length === 0 ? <li className="t-faint">—</li> :
                topTags.map(([tag, n]) => <li key={tag}><span className="host">#{tag}</span><span className="n">{n.toLocaleString()}</span></li>)}
            </ul>
          </div>
        </section>

        <section className="feed">
          {rows.length === 0 && conn === 'disconnected' ? (
            <div className="empty">
              paste an instance and hit connect. small instances may fail (cors restrictions on streaming);
              <b> mastodon.social</b>, <b>fosstodon.org</b>, <b>mstdn.jp</b>, <b>mas.to</b> work reliably.
            </div>
          ) : null}
          {rows.map((s) => <StatusCard key={s.id} status={s} selfInstance={instance} />)}
        </section>

        <footer className="labs-footer">
          <span>source · <span className="t-accent">{instance}/api/v1/streaming</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

function StatusCard({ status, selfInstance }: { status: Status; selfInstance: string }) {
  const text = useMemo(() => stripHtml(status.content), [status.content]);
  const inst = instanceOfUrl(status.url) || instanceOfAcct(status.account.acct, selfInstance);
  const when = new Date(status.created_at).toLocaleTimeString('en-GB', { hour12: false });
  return (
    <article className="post">
      <a href={status.account.url} target="_blank" rel="noopener noreferrer" className="post-av">
        {status.account.avatar ? <img src={status.account.avatar} alt="" loading="lazy" /> : null}
      </a>
      <div className="post-body">
        <div className="post-hd">
          <a href={status.account.url} target="_blank" rel="noopener noreferrer" className="post-name">{status.account.display_name || status.account.username}</a>
          <span className="post-acct">@{status.account.acct.includes('@') ? status.account.acct : `${status.account.acct}@${selfInstance}`}</span>
          <span className="post-inst">{inst}</span>
          {status.language ? <span className="post-lang">{status.language}</span> : null}
          <a href={status.url ?? undefined} target="_blank" rel="noopener noreferrer" className="post-when">{when}</a>
        </div>
        {status.spoiler_text ? <div className="post-spoiler">⚠ {status.spoiler_text}</div> : null}
        {text ? <div className="post-text">{text}</div> : null}
        {status.media_attachments.length > 0 ? (
          <div className="post-media">
            {status.media_attachments.slice(0, 4).map((m) => (
              m.type === 'image' && m.preview_url ? (
                <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" className="pm-img">
                  <img src={m.preview_url} alt="" loading="lazy" />
                </a>
              ) : (
                <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" className="pm-other">{m.type}</a>
              )
            ))}
          </div>
        ) : null}
        {status.tags.length > 0 ? (
          <div className="post-tags">
            {status.tags.slice(0, 6).map((t) => <span key={t.name} className="post-tag">#{t.name}</span>)}
          </div>
        ) : null}
      </div>
    </article>
  );
}

const CSS = `
  .shell-mst { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 64ch; margin-top: var(--sp-3); line-height: 1.55; }

  .controls { margin-top: var(--sp-5); border: 1px solid var(--color-border); background: var(--color-bg-panel); padding: var(--sp-3) var(--sp-4); }
  .ctl-row { display: flex; flex-wrap: wrap; gap: var(--sp-2); align-items: end; }
  .ctl-row + .ctl-row { margin-top: var(--sp-3); }
  .field { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 200px; }
  .field-label { font-family: var(--font-mono); font-size: 10px; color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .field-inline { display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-dim); }
  .controls input[type=text], .controls input:not([type]) { background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-fg); font-family: var(--font-mono); font-size: var(--fs-sm); padding: 8px var(--sp-3); outline: 0; }
  .controls input:focus { border-color: var(--color-accent-dim); }
  .tabs { display: flex; border: 1px solid var(--color-border); background: var(--color-bg); }
  .tab { background: transparent; border: 0; color: var(--color-fg-dim); font-family: var(--font-mono); font-size: var(--fs-xs); padding: 0 var(--sp-3); cursor: pointer; border-right: 1px solid var(--color-border); height: 36px; }
  .tab:last-child { border-right: 0; }
  .tab.active { background: var(--color-accent); color: var(--color-bg); }
  .controls button { background: transparent; border: 1px solid var(--color-border); color: var(--color-fg-dim); padding: 0 var(--sp-3); height: 36px; font-family: var(--font-mono); font-size: var(--fs-xs); cursor: pointer; }
  .controls button.primary { background: var(--color-accent); color: var(--color-bg); border: 0; font-weight: 500; }
  .controls button[disabled] { opacity: 0.35; cursor: not-allowed; }
  .controls button:not([disabled]):not(.primary):hover { border-color: var(--color-accent-dim); color: var(--color-accent); }

  .err { margin-top: var(--sp-4); padding: var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); border: 1px solid var(--color-alert); color: var(--color-alert); line-height: 1.55; }

  .stats { margin-top: var(--sp-4); display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .stat { display: flex; flex-direction: column; font-family: var(--font-mono); font-size: var(--fs-xs); }
  .stat .k { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .stat b { font-weight: 400; font-size: var(--fs-md); color: var(--color-fg); font-variant-numeric: tabular-nums; }

  .top-panels { margin-top: var(--sp-3); display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); }
  @media (max-width: 720px) { .top-panels { grid-template-columns: 1fr; } }
  .top-panel { border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .top-hd { padding: 6px var(--sp-3); font-family: var(--font-mono); font-size: 10px; color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 1px solid var(--color-border); }
  .top-panel ul { list-style: none; display: flex; flex-direction: column; }
  .top-panel li { display: flex; justify-content: space-between; padding: 4px var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); border-bottom: 1px dashed var(--color-border); }
  .top-panel li:last-child { border-bottom: 0; }
  .host { color: var(--color-fg-dim); }
  .n { color: var(--color-accent); font-variant-numeric: tabular-nums; }

  .feed { margin-top: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-2); }
  .empty { padding: var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-xs); border: 1px dashed var(--color-border); color: var(--color-fg-faint); text-align: center; line-height: 1.7; }
  .empty b { color: var(--color-accent); }

  .post { display: grid; grid-template-columns: 40px 1fr; gap: var(--sp-3); padding: var(--sp-3); border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .post-av img { width: 40px; height: 40px; border-radius: 6px; display: block; background: var(--color-bg-raised); }
  .post-hd { display: flex; flex-wrap: wrap; gap: var(--sp-2); align-items: baseline; font-family: var(--font-mono); font-size: var(--fs-xs); }
  .post-name { color: var(--color-fg); font-weight: 500; text-decoration: none; }
  .post-name:hover { color: var(--color-accent); }
  .post-acct { color: var(--color-fg-dim); }
  .post-inst { color: var(--color-fg-faint); border: 1px solid var(--color-border); padding: 1px 6px; font-size: 10px; }
  .post-lang { color: var(--color-accent); border: 1px solid var(--color-accent-dim); padding: 1px 6px; font-size: 10px; }
  .post-when { color: var(--color-fg-faint); margin-left: auto; text-decoration: none; }
  .post-when:hover { color: var(--color-accent); }
  .post-spoiler { color: var(--color-warn); font-family: var(--font-mono); font-size: var(--fs-xs); margin-top: 6px; }
  .post-text { margin-top: 6px; color: var(--color-fg); font-size: var(--fs-sm); line-height: 1.55; white-space: pre-wrap; word-break: break-word; }
  .post-media { margin-top: 6px; display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 6px; }
  .pm-img img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border: 1px solid var(--color-border); background: var(--color-bg-raised); display: block; }
  .pm-other { display: flex; align-items: center; justify-content: center; aspect-ratio: 4 / 3; border: 1px dashed var(--color-border); color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); text-decoration: none; }
  .post-tags { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px; }
  .post-tag { color: var(--color-accent-dim); font-family: var(--font-mono); font-size: 10px; }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-8); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); flex-wrap: wrap; gap: var(--sp-3); }
`;
