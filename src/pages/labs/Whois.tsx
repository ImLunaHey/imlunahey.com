import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { whoisLookup, type WhoisResult } from '../../server/whois';

const SUGGESTIONS = ['imlunahey.com', 'bsky.social', 'github.com', 'cloudflare.com', 'wikipedia.org'];

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return iso.slice(0, 10);
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  return Math.round((then - Date.now()) / (1000 * 60 * 60 * 24));
}

function ageFrom(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  const ms = Date.now() - then;
  const years = ms / (1000 * 60 * 60 * 24 * 365.25);
  if (years >= 1) return `${years.toFixed(1)}y`;
  const days = ms / (1000 * 60 * 60 * 24);
  return `${Math.round(days)}d`;
}

export default function WhoisPage() {
  const search = useSearch({ strict: false }) as { domain?: string };
  const navigate = useNavigate();
  const initial = search.domain ?? 'imlunahey.com';
  const [input, setInput] = useState(initial);
  const submitted = search.domain ?? 'imlunahey.com';

  useEffect(() => {
    if (search.domain) setInput(search.domain);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.domain]);

  const submit = (v: string) => {
    const t = v.trim();
    if (t) navigate({ to: '/labs/whois', search: { domain: t } });
  };

  const { data, isFetching, error } = useQuery({
    queryKey: ['whois', submitted],
    queryFn: () => whoisLookup({ data: { domain: submitted! } }),
    enabled: !!submitted,
    retry: false,
    staleTime: 1000 * 60 * 30,
  });

  const errMsg = error instanceof Error ? error.message : null;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submit(input);
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-wh">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">whois</span>
        </div>

        <header className="wh-hd">
          <h1>whois<span className="dot">.</span></h1>
          <p className="sub">
            modern rdap-based domain lookup. resolves the tld's registry via iana bootstrap, then
            follows redirects to the registrar's authoritative record. cached 30min server-side.
          </p>
        </header>

        <form className="wh-input-row" onSubmit={onSubmit}>
          <div className="wh-prompt">
            <span className="wh-prompt-mark">$</span>
            <span className="wh-prompt-cmd">whois</span>
          </div>
          <input
            className="wh-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="example.com"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <button className="wh-btn" type="submit" disabled={!input.trim() || isFetching}>
            {isFetching ? 'looking up…' : 'lookup'}
          </button>
        </form>

        <div className="wh-suggest">
          <span className="wh-suggest-lbl">try</span>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              className="wh-suggest-chip"
              onClick={() => submit(s)}
            >{s}</button>
          ))}
        </div>

        {errMsg ? (
          <div className="wh-err">✗ {errMsg}</div>
        ) : data ? (
          <Result data={data} />
        ) : isFetching ? (
          <ResultSkel />
        ) : null}
      </main>
    </>
  );
}

function Result({ data }: { data: WhoisResult }) {
  const expDays = useMemo(() => daysUntil(data.expires), [data.expires]);
  const age = useMemo(() => ageFrom(data.registered), [data.registered]);
  const expSoon = expDays != null && expDays < 60;
  const expired = expDays != null && expDays < 0;

  return (
    <div className="wh-result">
      <section className="wh-stats">
        <StatBlock label="registrar" value={data.registrar ?? '—'} big />
        <StatBlock
          label="registered"
          value={fmtDate(data.registered)}
          sub={age ? `${age} ago` : undefined}
        />
        <StatBlock
          label="expires"
          value={fmtDate(data.expires)}
          sub={
            expDays != null
              ? expired
                ? `${Math.abs(expDays)}d ago`
                : `in ${expDays}d`
              : undefined
          }
          accent={expSoon ? 'warn' : expired ? 'alert' : 'ok'}
        />
        <StatBlock label="last changed" value={fmtDate(data.updated)} />
      </section>

      <section className="wh-grid">
        <Card title="nameservers" count={data.nameservers.length}>
          {data.nameservers.length === 0 ? (
            <div className="wh-empty">—</div>
          ) : (
            <ul className="wh-ns">
              {data.nameservers.map((ns) => (
                <li key={ns}><span className="wh-mark">›</span> {ns}</li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="status flags" count={data.status.length}>
          {data.status.length === 0 ? (
            <div className="wh-empty">—</div>
          ) : (
            <div className="wh-flags">
              {data.status.map((s) => (
                <span key={s} className={`wh-flag ${/prohibited|locked/i.test(s) ? 'locked' : /pending/i.test(s) ? 'pending' : ''}`}>
                  {s.toLowerCase()}
                </span>
              ))}
            </div>
          )}
        </Card>

        <Card title="registrar detail">
          <div className="wh-kv">
            <div><span>name</span><b>{data.registrar ?? '—'}</b></div>
            <div><span>iana id</span><b>{data.registrarIanaId ?? '—'}</b></div>
            <div><span>abuse email</span><b>{data.registrarEmail ?? '—'}</b></div>
            <div><span>registrant country</span><b>{data.registrantCountry ?? '—'}</b></div>
          </div>
        </Card>

        <Card title="security">
          <div className="wh-kv">
            <div>
              <span>dnssec</span>
              <b className={data.dnssec ? 't-accent' : undefined}>
                {data.dnssec == null ? '—' : data.dnssec ? '✓ signed' : '✗ unsigned'}
              </b>
            </div>
            <div>
              <span>registrar lock</span>
              <b className={data.status.some((s) => /transferprohibited|client.*lock/i.test(s)) ? 't-accent' : undefined}>
                {data.status.some((s) => /transferprohibited|client.*lock/i.test(s)) ? '✓ locked' : 'no'}
              </b>
            </div>
          </div>
        </Card>
      </section>

      <details className="wh-raw">
        <summary>raw rdap response</summary>
        <div className="wh-src">src: <span className="t-accent">{data.source}</span></div>
        <pre>{(() => { try { return JSON.stringify(JSON.parse(data.rawJson), null, 2); } catch { return data.rawJson; } })()}</pre>
      </details>
    </div>
  );
}

function ResultSkel() {
  return (
    <div className="wh-result">
      <section className="wh-stats">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="wh-stat">
            <div className="skel" style={{ width: 80, height: 10, marginBottom: 10 }} />
            <div className="skel" style={{ width: '70%', height: 20 }} />
          </div>
        ))}
      </section>
    </div>
  );
}

function StatBlock({
  label, value, sub, big, accent,
}: { label: string; value: string; sub?: string; big?: boolean; accent?: 'ok' | 'warn' | 'alert' }) {
  return (
    <div className={`wh-stat ${accent ? `a-${accent}` : ''}`}>
      <div className="wh-stat-lbl">{label}</div>
      <div className={`wh-stat-val ${big ? 'big' : ''}`}>{value}</div>
      {sub ? <div className="wh-stat-sub">{sub}</div> : null}
    </div>
  );
}

function Card({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <article className="wh-card">
      <header className="wh-card-hd">
        <span>── {title}</span>
        {count !== undefined ? <span className="wh-card-ct">{count}</span> : null}
      </header>
      <div className="wh-card-body">{children}</div>
    </article>
  );
}

const CSS = `
  .shell-wh { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .wh-hd { padding: 48px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .wh-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.9;
  }
  .wh-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .wh-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 58ch; margin-top: var(--sp-3); }

  .wh-input-row {
    display: flex;
    gap: 0;
    margin-top: var(--sp-6);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .wh-prompt {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 0 var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--color-fg-faint);
    border-right: 1px solid var(--color-border);
    background: var(--color-bg-raised);
  }
  .wh-prompt-mark { color: var(--color-accent); text-shadow: 0 0 6px var(--accent-glow); }
  .wh-prompt-cmd { color: var(--color-fg-dim); }
  .wh-input {
    flex: 1;
    background: transparent;
    color: var(--color-fg);
    border: 0;
    outline: 0;
    padding: var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-md);
  }
  .wh-input::placeholder { color: var(--color-fg-faint); }
  .wh-btn {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    background: var(--color-accent);
    color: #000;
    border: 0;
    padding: 0 var(--sp-5);
    cursor: pointer;
    text-transform: lowercase;
  }
  .wh-btn:hover { filter: brightness(1.1); }
  .wh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .wh-suggest {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    margin: var(--sp-3) 0 var(--sp-5);
    font-family: var(--font-mono); font-size: var(--fs-xs);
  }
  .wh-suggest-lbl { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.1em; }
  .wh-suggest-chip {
    background: transparent; color: var(--color-fg-dim);
    border: 1px solid var(--color-border); padding: 2px 8px;
    cursor: pointer; font-family: inherit; font-size: inherit;
  }
  .wh-suggest-chip:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }

  .wh-err {
    padding: var(--sp-3);
    border: 1px solid var(--color-alert-dim);
    background: color-mix(in srgb, var(--color-alert) 5%, transparent);
    color: var(--color-alert);
    font-family: var(--font-mono); font-size: var(--fs-sm);
  }

  .wh-result { padding-bottom: var(--sp-10); }

  .wh-stats {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr;
    gap: var(--sp-3);
    margin-bottom: var(--sp-5);
  }
  .wh-stat {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: var(--sp-3) var(--sp-4);
  }
  .wh-stat.a-warn { border-color: color-mix(in oklch, var(--color-warn) 40%, var(--color-border)); }
  .wh-stat.a-alert { border-color: var(--color-alert-dim); }
  .wh-stat-lbl {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    text-transform: lowercase;
    margin-bottom: 6px;
    letter-spacing: 0.05em;
  }
  .wh-stat-val {
    font-family: var(--font-mono);
    font-size: var(--fs-md);
    color: var(--color-fg);
    word-break: break-word;
  }
  .wh-stat-val.big {
    font-family: var(--font-display);
    font-size: clamp(18px, 2vw, 24px);
    font-weight: 500;
    color: var(--color-accent);
    letter-spacing: -0.01em;
  }
  .wh-stat.a-warn .wh-stat-val { color: var(--color-warn); }
  .wh-stat.a-alert .wh-stat-val { color: var(--color-alert); }
  .wh-stat-sub {
    margin-top: 4px;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: lowercase;
  }

  .wh-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: var(--sp-4);
  }
  .wh-card {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
  }
  .wh-card-hd {
    display: flex; justify-content: space-between; align-items: center;
    padding: 10px var(--sp-3);
    border-bottom: 1px solid var(--color-border);
    background: linear-gradient(to bottom, #0c0c0c, #070707);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .wh-card-ct { color: var(--color-accent-dim); }
  .wh-card-body { padding: var(--sp-3); }

  .wh-ns {
    list-style: none;
    display: flex; flex-direction: column; gap: 4px;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--color-fg);
  }
  .wh-ns .wh-mark { color: var(--color-accent-dim); margin-right: 6px; }

  .wh-flags {
    display: flex; gap: 6px; flex-wrap: wrap;
  }
  .wh-flag {
    font-family: var(--font-mono);
    font-size: 10px;
    padding: 2px 6px;
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg-dim);
    text-transform: lowercase;
  }
  .wh-flag.locked {
    color: var(--color-accent);
    border-color: var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 6%, transparent);
  }
  .wh-flag.pending {
    color: var(--color-warn);
    border-color: color-mix(in oklch, var(--color-warn) 40%, var(--color-border-bright));
  }

  .wh-kv {
    display: flex; flex-direction: column; gap: 6px;
    font-family: var(--font-mono); font-size: var(--fs-sm);
  }
  .wh-kv > div { display: flex; justify-content: space-between; gap: var(--sp-3); }
  .wh-kv span { color: var(--color-fg-faint); }
  .wh-kv b { color: var(--color-fg); font-weight: 400; text-align: right; word-break: break-word; }

  .wh-empty {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--color-fg-faint);
    text-align: center;
    padding: var(--sp-3);
  }

  .wh-raw {
    margin-top: var(--sp-5);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .wh-raw summary { cursor: pointer; user-select: none; }
  .wh-src { padding: var(--sp-2) 0; color: var(--color-fg-faint); }
  .wh-raw pre {
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
    .wh-stats { grid-template-columns: 1fr 1fr; }
    .wh-stats .wh-stat:first-child { grid-column: 1 / -1; }
  }
`;
