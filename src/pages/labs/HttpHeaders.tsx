import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { inspectUrl, type InspectResult } from '../../server/http-inspect';

const SECURITY_HEADERS = new Set([
  'content-security-policy', 'strict-transport-security', 'x-frame-options',
  'x-content-type-options', 'referrer-policy', 'permissions-policy',
  'cross-origin-opener-policy', 'cross-origin-embedder-policy', 'cross-origin-resource-policy',
  'x-xss-protection',
]);

const CACHE_HEADERS = new Set([
  'cache-control', 'etag', 'expires', 'last-modified', 'age', 'vary',
  'pragma', 'cdn-cache-control',
]);

const CORS_HEADERS = new Set([
  'access-control-allow-origin', 'access-control-allow-methods',
  'access-control-allow-headers', 'access-control-allow-credentials',
  'access-control-expose-headers', 'access-control-max-age', 'timing-allow-origin',
]);

type Group = 'security' | 'cache' | 'cors' | 'server' | 'other';

function groupOf(key: string): Group {
  const k = key.toLowerCase();
  if (SECURITY_HEADERS.has(k)) return 'security';
  if (CACHE_HEADERS.has(k)) return 'cache';
  if (CORS_HEADERS.has(k)) return 'cors';
  if (k === 'server' || k === 'x-powered-by' || k === 'x-served-by' || k.startsWith('cf-')) return 'server';
  return 'other';
}

export default function HttpHeadersPage() {
  const [input, setInput] = useState('https://imlunahey.com');
  const [method, setMethod] = useState<'GET' | 'HEAD'>('HEAD');
  const [submitted, setSubmitted] = useState<{ url: string; method: 'GET' | 'HEAD' } | null>({ url: 'https://imlunahey.com', method: 'HEAD' });

  const { data, isFetching, error } = useQuery({
    queryKey: ['http-inspect', submitted?.url, submitted?.method],
    queryFn: () => inspectUrl({ data: { url: submitted!.url, method: submitted!.method } }),
    enabled: !!submitted,
    retry: false,
    staleTime: 1000 * 60,
  });

  const errMsg = error instanceof Error ? error.message : null;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = input.trim();
    if (v) setSubmitted({ url: v, method });
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-hh">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">http headers</span>
        </div>

        <header className="hh-hd">
          <h1>http headers<span className="dot">.</span></h1>
          <p className="sub">
            fetch any url server-side — see every response header, redirect chain, response time,
            and the final body preview. grouped by security / cache / cors for quick scanning.
          </p>
        </header>

        <form className="hh-input-row" onSubmit={onSubmit}>
          <input
            className="hh-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://example.com"
            spellCheck={false}
            autoComplete="off"
          />
          <select
            className="hh-method"
            value={method}
            onChange={(e) => setMethod(e.target.value as 'GET' | 'HEAD')}
          >
            <option value="HEAD">HEAD</option>
            <option value="GET">GET</option>
          </select>
          <button className="hh-btn" type="submit" disabled={!input.trim() || isFetching}>
            {isFetching ? 'fetching…' : 'inspect'}
          </button>
        </form>

        {errMsg ? (
          <div className="hh-err">✗ {errMsg}</div>
        ) : data ? (
          <Result data={data} />
        ) : null}
      </main>
    </>
  );
}

function Result({ data }: { data: InspectResult }) {
  const { final, hops } = data;
  const ok = final.status >= 200 && final.status < 400;
  const fast = final.ms < 300;

  const grouped: Record<Group, Array<[string, string]>> = {
    security: [], cache: [], cors: [], server: [], other: [],
  };
  for (const [k, v] of final.headers) grouped[groupOf(k)].push([k, v]);

  return (
    <>
      <section className="hh-verdict">
        <div className={`hh-badge v-${ok ? 'ok' : 'err'}`}>
          <span className={`hh-light l-${ok ? 'ok' : 'err'}`} />
          <span>{final.status} {final.statusText}</span>
        </div>
        <div className="hh-meta">
          <span className={`hh-ms ${fast ? 'fast' : ''}`}>{final.ms}ms</span>
          <span className="t-faint">·</span>
          <span>{final.headers.length} headers</span>
          {data.contentType ? <><span className="t-faint">·</span><span>{data.contentType}</span></> : null}
          {data.bodyBytes ? <><span className="t-faint">·</span><span>{data.bodyBytes} body bytes</span></> : null}
        </div>
      </section>

      {hops.length > 1 ? (
        <section className="hh-chain">
          <header className="hh-chain-hd">── redirect chain</header>
          <ol className="hh-hops">
            {hops.map((h, i) => (
              <li key={i} className="hh-hop">
                <span className="hh-hop-num">{i + 1}</span>
                <span className={`hh-hop-status ${h.status >= 300 && h.status < 400 ? 'redir' : h.status >= 400 ? 'err' : 'ok'}`}>
                  {h.status}
                </span>
                <code className="hh-hop-url">{h.url}</code>
                <span className="hh-hop-ms">{h.ms}ms</span>
                {h.redirectTo ? <span className="hh-hop-arrow">→</span> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="hh-groups">
        {(['security', 'cors', 'cache', 'server', 'other'] as Group[]).map((g) => {
          const rows = grouped[g];
          if (rows.length === 0) return null;
          return (
            <article key={g} className={`hh-group g-${g}`}>
              <header className="hh-group-hd">
                <span>── {g}</span>
                <span className="hh-group-ct">{rows.length}</span>
              </header>
              <div className="hh-rows">
                {rows.map(([k, v]) => (
                  <div key={k} className="hh-row">
                    <span className="hh-row-k">{k}</span>
                    <code className="hh-row-v">{v}</code>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </section>

      {data.bodyPreview ? (
        <details className="hh-body">
          <summary>body preview · {data.bodyBytes} bytes</summary>
          <pre>{data.bodyPreview}{data.bodyPreview.length >= 2000 ? '\n… truncated' : ''}</pre>
        </details>
      ) : null}
    </>
  );
}

const CSS = `
  .shell-hh { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }
  .crumbs { padding-top: var(--sp-6); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .crumbs a { color: var(--color-fg-faint); text-decoration: none; }
  .crumbs a:hover { color: var(--color-accent); }
  .crumbs .sep { margin: 0 6px; }
  .crumbs .last { color: var(--color-accent); }

  .hh-hd { padding: 48px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .hh-hd h1 { font-family: var(--font-display); font-size: clamp(48px, 8vw, 96px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .hh-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .hh-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 62ch; margin-top: var(--sp-3); }

  .hh-input-row { display: flex; margin-top: var(--sp-5); border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .hh-input {
    flex: 1; background: transparent; border: 0; outline: 0;
    color: var(--color-fg); padding: var(--sp-3);
    font-family: var(--font-mono); font-size: var(--fs-sm);
  }
  .hh-method {
    background: var(--color-bg-raised); border: 0; border-left: 1px solid var(--color-border);
    padding: 0 var(--sp-3); color: var(--color-accent);
    font-family: var(--font-mono); font-size: var(--fs-sm); outline: 0; cursor: pointer;
  }
  .hh-btn {
    background: var(--color-accent); color: #000; border: 0;
    padding: 0 var(--sp-5); font-family: var(--font-mono); font-size: var(--fs-sm);
    cursor: pointer; text-transform: lowercase;
  }
  .hh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .hh-err { padding: var(--sp-3); margin-top: var(--sp-3); color: var(--color-alert); border: 1px solid var(--color-alert-dim); font-family: var(--font-mono); font-size: var(--fs-sm); }

  .hh-verdict { display: flex; align-items: center; gap: var(--sp-3); margin: var(--sp-4) 0; flex-wrap: wrap; }
  .hh-badge {
    display: inline-flex; align-items: center; gap: 8px;
    padding: var(--sp-2) var(--sp-4);
    border: 1px solid;
    font-family: var(--font-display); font-size: var(--fs-xl); font-weight: 500;
    text-transform: lowercase;
  }
  .hh-badge.v-ok { color: var(--color-accent); border-color: var(--color-accent-dim); background: color-mix(in oklch, var(--color-accent) 6%, transparent); }
  .hh-badge.v-err { color: var(--color-alert); border-color: var(--color-alert-dim); }
  .hh-light { width: 10px; height: 10px; border-radius: 50%; }
  .hh-light.l-ok { background: var(--color-accent); box-shadow: 0 0 8px var(--accent-glow); }
  .hh-light.l-err { background: var(--color-alert); }
  .hh-meta {
    display: flex; align-items: center; gap: 8px;
    font-family: var(--font-mono); font-size: var(--fs-sm);
    color: var(--color-fg-dim);
    flex-wrap: wrap;
  }
  .hh-ms { color: var(--color-warn); font-variant-numeric: tabular-nums; }
  .hh-ms.fast { color: var(--color-accent); }
  .t-faint { color: var(--color-fg-ghost); }

  .hh-chain {
    margin-bottom: var(--sp-4);
    padding: var(--sp-3);
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
  }
  .hh-chain-hd { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); margin-bottom: var(--sp-2); }
  .hh-hops { list-style: none; display: flex; flex-direction: column; gap: 4px; }
  .hh-hop {
    display: grid;
    grid-template-columns: 24px 50px 1fr 60px 16px;
    gap: var(--sp-2);
    align-items: center;
    padding: 4px 6px;
    font-family: var(--font-mono); font-size: var(--fs-xs);
  }
  .hh-hop-num { color: var(--color-fg-faint); text-align: right; }
  .hh-hop-status.ok { color: var(--color-accent); border: 1px solid var(--color-accent-dim); padding: 0 4px; text-align: center; }
  .hh-hop-status.redir { color: var(--color-warn); border: 1px solid color-mix(in oklch, var(--color-warn) 40%, var(--color-border)); padding: 0 4px; text-align: center; }
  .hh-hop-status.err { color: var(--color-alert); border: 1px solid var(--color-alert-dim); padding: 0 4px; text-align: center; }
  .hh-hop-url { color: var(--color-fg); word-break: break-all; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hh-hop-ms { color: var(--color-fg-faint); text-align: right; font-variant-numeric: tabular-nums; }
  .hh-hop-arrow { color: var(--color-accent); }

  .hh-groups { display: flex; flex-direction: column; gap: var(--sp-3); margin-bottom: var(--sp-4); }
  .hh-group {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    border-left-width: 3px;
  }
  .hh-group.g-security { border-left-color: var(--color-accent); }
  .hh-group.g-cors { border-left-color: #7cd3f7; }
  .hh-group.g-cache { border-left-color: var(--color-warn); }
  .hh-group.g-server { border-left-color: var(--color-fg-dim); }
  .hh-group.g-other { border-left-color: var(--color-fg-ghost); }
  .hh-group-hd {
    display: flex; justify-content: space-between;
    padding: 6px var(--sp-3);
    border-bottom: 1px solid var(--color-border);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    background: linear-gradient(to bottom, #0c0c0c, #070707);
  }
  .hh-group-ct { color: var(--color-accent-dim); }

  .hh-rows { display: flex; flex-direction: column; }
  .hh-row {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: var(--sp-3);
    padding: 4px var(--sp-3);
    border-bottom: 1px dashed var(--color-border);
    font-family: var(--font-mono); font-size: var(--fs-xs);
  }
  .hh-row:last-child { border-bottom: 0; }
  .hh-row:hover { background: var(--color-bg-raised); }
  .hh-row-k { color: var(--color-fg-faint); word-break: break-word; }
  .hh-row-v { color: var(--color-fg); word-break: break-all; }

  .hh-body { margin-bottom: var(--sp-10); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .hh-body summary { cursor: pointer; user-select: none; }
  .hh-body pre {
    margin-top: var(--sp-2);
    padding: var(--sp-3);
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    color: var(--color-fg-dim);
    white-space: pre-wrap;
    word-break: break-word;
    overflow: auto;
    max-height: 400px;
  }

  @media (max-width: 700px) {
    .hh-row { grid-template-columns: 1fr; gap: 2px; }
  }
`;
