import { useQuery } from '@tanstack/react-query';
import { Link, useSearch } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

type ProbeResult = {
  ok: boolean;
  status: number;
  ms: number;
  body?: unknown;
  error?: string;
};

async function probe(url: string): Promise<ProbeResult> {
  const t0 = performance.now();
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    const ms = Math.round(performance.now() - t0);
    let body: unknown;
    try { body = await res.json(); } catch { /* not json */ }
    return { ok: res.ok, status: res.status, ms, body };
  } catch (err) {
    const ms = Math.round(performance.now() - t0);
    return { ok: false, status: 0, ms, error: err instanceof Error ? err.message : 'fetch failed' };
  }
}

type DescribeServer = {
  did?: string;
  availableUserDomains?: string[];
  inviteCodeRequired?: boolean;
  phoneVerificationRequired?: boolean;
  links?: { privacyPolicy?: string; termsOfService?: string };
  contact?: { email?: string };
};

type ServerVersion = { version?: string };

type HealthPayload = { describe: ProbeResult; version: ProbeResult; listRepos: ProbeResult };

function normalizePds(input: string): string {
  let u = input.trim();
  if (!u) return '';
  if (!/^https?:\/\//.test(u)) u = 'https://' + u;
  u = u.replace(/\/$/, '');
  return u;
}

async function runHealth(pds: string): Promise<HealthPayload> {
  const describe = probe(`${pds}/xrpc/com.atproto.server.describeServer`);
  const version = probe(`${pds}/xrpc/_health`);
  const listRepos = probe(`${pds}/xrpc/com.atproto.sync.listRepos?limit=1`);
  const [d, v, l] = await Promise.all([describe, version, listRepos]);
  return { describe: d, version: v, listRepos: l };
}

function healthVerdict(h: HealthPayload | undefined): { label: string; kind: 'ok' | 'warn' | 'down' } {
  if (!h) return { label: 'checking…', kind: 'warn' };
  const okCount = [h.describe, h.version, h.listRepos].filter((r) => r.ok).length;
  if (okCount === 3) return { label: 'ok', kind: 'ok' };
  if (okCount === 0) return { label: 'down', kind: 'down' };
  return { label: 'degraded', kind: 'warn' };
}

// Community PDSes that also host user handles under the same domain.
// Safe starting points — all publicly probe-able.
const SUGGESTIONS = [
  'https://bsky.social',
  'https://blacksky.app',
  'https://deer.social',
  'https://gndr.social',
  'https://boobee.blue',
];

export default function PdsHealthPage() {
  const search = useSearch({ strict: false }) as { url?: string };
  const initial = search.url ? normalizePds(search.url) : 'https://bsky.social';
  const [input, setInput] = useState(initial);
  const [submitted, setSubmitted] = useState<string | null>(initial);

  useEffect(() => {
    if (search.url) {
      const n = normalizePds(search.url);
      if (n !== submitted) {
        setInput(n);
        setSubmitted(n);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.url]);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['pds-health', submitted],
    queryFn: () => runHealth(submitted!),
    enabled: !!submitted,
    staleTime: 1000 * 60 * 2,
    retry: false,
  });

  const verdict = useMemo(() => healthVerdict(data), [data]);
  const describe = data?.describe.body as DescribeServer | undefined;
  const healthBody = data?.version.body as ServerVersion | undefined;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = normalizePds(input);
    if (v) setSubmitted(v);
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-ph">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">pds health</span>
        </div>

        <header className="ph-hd">
          <h1>pds health<span className="dot">.</span></h1>
          <p className="sub">
            probe any atproto personal data server — describe, version, listrepos — measure response time,
            surface the operator's metadata. useful for deciding whether to host your account there.
          </p>
        </header>

        <form className="ph-input-row" onSubmit={onSubmit}>
          <input
            className="ph-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://bsky.social"
            spellCheck={false}
            autoComplete="off"
          />
          <button className="ph-btn" type="submit" disabled={isFetching}>
            {isFetching ? 'probing…' : 'probe'}
          </button>
        </form>

        <div className="ph-suggest">
          <span className="ph-suggest-lbl">try</span>
          {SUGGESTIONS.map((s) => (
            <button key={s} className="ph-chip" onClick={() => { setInput(s); setSubmitted(s); }}>
              {s.replace(/^https?:\/\//, '')}
            </button>
          ))}
        </div>

        {!submitted ? null : (
          <div className="ph-result">
            <header className="ph-verdict">
              <div className={`ph-badge v-${verdict.kind}`}>
                <span className={`ph-light l-${verdict.kind}`} />
                <span>{verdict.label}</span>
              </div>
              <code className="ph-host">{submitted}</code>
              <button className="ph-refresh" onClick={() => refetch()} disabled={isFetching}>↻ refresh</button>
            </header>

            <section className="ph-probes">
              <ProbeCard name="describeServer" path="/xrpc/com.atproto.server.describeServer" result={data?.describe} />
              <ProbeCard name="health" path="/xrpc/_health" result={data?.version} />
              <ProbeCard name="listRepos" path="/xrpc/com.atproto.sync.listRepos" result={data?.listRepos} />
            </section>

            {describe || healthBody ? (
              <section className="ph-detail">
                <div className="ph-detail-hd">── server metadata</div>
                <div className="ph-kv">
                  {healthBody?.version ? <Row k="version" v={healthBody.version} /> : null}
                  {describe?.did ? <Row k="service did" v={describe.did} mono /> : null}
                  {describe?.availableUserDomains ? (
                    <Row
                      k="user domains"
                      v={describe.availableUserDomains.length ? describe.availableUserDomains.join(', ') : '—'}
                    />
                  ) : null}
                  {describe?.inviteCodeRequired !== undefined ? (
                    <Row k="invite required" v={describe.inviteCodeRequired ? 'yes' : 'no'} />
                  ) : null}
                  {describe?.phoneVerificationRequired !== undefined ? (
                    <Row k="phone required" v={describe.phoneVerificationRequired ? 'yes' : 'no'} />
                  ) : null}
                  {describe?.contact?.email ? <Row k="contact" v={describe.contact.email} /> : null}
                  {describe?.links?.privacyPolicy ? (
                    <Row k="privacy"  v={<a href={describe.links.privacyPolicy} target="_blank" rel="noopener noreferrer">{describe.links.privacyPolicy}</a>} />
                  ) : null}
                  {describe?.links?.termsOfService ? (
                    <Row k="terms" v={<a href={describe.links.termsOfService} target="_blank" rel="noopener noreferrer">{describe.links.termsOfService}</a>} />
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </main>
    </>
  );
}

function Row({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="ph-row">
      <div className="ph-row-k">{k}</div>
      <div className={`ph-row-v ${mono ? 'mono' : ''}`}>{v}</div>
    </div>
  );
}

function ProbeCard({ name, path, result }: { name: string; path: string; result?: ProbeResult }) {
  const ok = result?.ok;
  const fast = (result?.ms ?? 9999) < 300;
  const medium = (result?.ms ?? 9999) < 900;
  return (
    <article className={`ph-probe ${ok === true ? 'ok' : ok === false ? 'fail' : ''}`}>
      <header className="ph-probe-hd">
        <span className={`ph-light l-${ok === true ? 'ok' : ok === false ? 'down' : 'warn'}`} />
        <span className="ph-probe-name">{name}</span>
        <span className={`ph-probe-status ${ok ? 's-ok' : 's-fail'}`}>
          {result ? (result.status > 0 ? result.status : 'err') : '…'}
        </span>
      </header>
      <div className="ph-probe-path">{path}</div>
      <div className="ph-probe-metrics">
        <span className={`ph-ms ${fast ? 'fast' : medium ? 'med' : 'slow'}`}>
          {result ? `${result.ms}ms` : '…'}
        </span>
        {result?.error ? <span className="ph-err-msg">{result.error}</span> : null}
      </div>
    </article>
  );
}

const CSS = `
  .shell-ph { max-width: 1080px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .ph-hd { padding: 48px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .ph-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(48px, 8vw, 96px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.9;
  }
  .ph-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .ph-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 58ch; margin-top: var(--sp-3); }

  .ph-input-row {
    display: flex;
    margin-top: var(--sp-5);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .ph-input {
    flex: 1;
    background: transparent;
    border: 0;
    outline: 0;
    color: var(--color-fg);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    padding: var(--sp-3);
  }
  .ph-btn {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    background: var(--color-accent);
    color: #000;
    border: 0;
    padding: 0 var(--sp-5);
    cursor: pointer;
    text-transform: lowercase;
  }
  .ph-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .ph-suggest {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    margin: var(--sp-3) 0 var(--sp-5);
    font-family: var(--font-mono); font-size: var(--fs-xs);
  }
  .ph-suggest-lbl { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .ph-chip {
    background: transparent; color: var(--color-fg-dim);
    border: 1px solid var(--color-border); padding: 2px 8px;
    cursor: pointer; font-family: inherit; font-size: inherit;
  }
  .ph-chip:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }

  .ph-verdict {
    display: flex; align-items: center; gap: var(--sp-3);
    margin-bottom: var(--sp-4);
    flex-wrap: wrap;
  }
  .ph-badge {
    display: inline-flex; align-items: center; gap: 8px;
    padding: var(--sp-2) var(--sp-4);
    border: 1px solid;
    font-family: var(--font-display);
    font-size: var(--fs-xl);
    font-weight: 500;
    text-transform: lowercase;
  }
  .ph-badge.v-ok { color: var(--color-accent); border-color: var(--color-accent-dim); background: color-mix(in oklch, var(--color-accent) 6%, transparent); }
  .ph-badge.v-warn { color: var(--color-warn); border-color: color-mix(in oklch, var(--color-warn) 40%, var(--color-border)); background: color-mix(in oklch, var(--color-warn) 6%, transparent); }
  .ph-badge.v-down { color: var(--color-alert); border-color: var(--color-alert-dim); background: color-mix(in srgb, var(--color-alert) 6%, transparent); }

  .ph-light {
    width: 10px; height: 10px; border-radius: 50%;
    display: inline-block;
  }
  .ph-light.l-ok { background: var(--color-accent); box-shadow: 0 0 8px var(--accent-glow); }
  .ph-light.l-warn { background: var(--color-warn); animation: ph-pulse 1.4s ease-in-out infinite; }
  .ph-light.l-down { background: var(--color-alert); }
  @keyframes ph-pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
  }

  .ph-host {
    color: var(--color-fg-dim);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    flex: 1;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .ph-refresh {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    background: transparent;
    color: var(--color-fg-dim);
    border: 1px solid var(--color-border-bright);
    padding: 4px 10px;
    cursor: pointer;
    text-transform: lowercase;
  }
  .ph-refresh:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }

  .ph-probes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: var(--sp-3);
    margin-bottom: var(--sp-4);
  }
  .ph-probe {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: var(--sp-3);
    font-family: var(--font-mono);
  }
  .ph-probe.ok { border-color: var(--color-accent-dim); }
  .ph-probe.fail { border-color: var(--color-alert-dim); }
  .ph-probe-hd {
    display: flex; align-items: center; gap: 8px;
    margin-bottom: 4px;
  }
  .ph-probe-name {
    font-size: var(--fs-sm);
    color: var(--color-fg);
    flex: 1;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .ph-probe-status {
    font-size: var(--fs-xs);
    padding: 1px 6px;
    border: 1px solid currentColor;
  }
  .ph-probe-status.s-ok { color: var(--color-accent); }
  .ph-probe-status.s-fail { color: var(--color-alert); }

  .ph-probe-path {
    font-size: 10px;
    color: var(--color-fg-faint);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    margin-bottom: var(--sp-2);
  }
  .ph-probe-metrics {
    display: flex; justify-content: space-between;
    font-size: var(--fs-xs);
  }
  .ph-ms {
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .ph-ms.fast { color: var(--color-accent); }
  .ph-ms.med { color: var(--color-warn); }
  .ph-ms.slow { color: var(--color-alert); }
  .ph-err-msg {
    color: var(--color-alert);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    max-width: 150px;
  }

  .ph-detail {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: var(--sp-4);
    margin-bottom: var(--sp-10);
  }
  .ph-detail-hd {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    margin-bottom: var(--sp-3);
  }
  .ph-kv {
    display: flex; flex-direction: column; gap: 4px;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }
  .ph-row {
    display: grid;
    grid-template-columns: 160px 1fr;
    gap: var(--sp-3);
    padding: 4px 0;
    border-bottom: 1px dashed var(--color-border);
  }
  .ph-row:last-child { border-bottom: 0; }
  .ph-row-k { color: var(--color-fg-faint); text-transform: lowercase; }
  .ph-row-v { color: var(--color-fg); word-break: break-word; }
  .ph-row-v.mono { font-size: var(--fs-xs); }
  .ph-row-v a { color: var(--color-accent); text-decoration: none; }
  .ph-row-v a:hover { text-decoration: underline; }

  @media (max-width: 600px) {
    .ph-row { grid-template-columns: 1fr; gap: 2px; }
  }
`;
