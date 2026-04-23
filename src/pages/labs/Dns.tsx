import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

const RECORD_TYPES = [
  { id: 'A', code: 1 },
  { id: 'AAAA', code: 28 },
  { id: 'TXT', code: 16 },
  { id: 'MX', code: 15 },
  { id: 'CNAME', code: 5 },
  { id: 'NS', code: 2 },
  { id: 'SOA', code: 6 },
  { id: 'SRV', code: 33 },
  { id: 'CAA', code: 257 },
  { id: 'ANY', code: 255 },
];

const TYPE_LABEL = Object.fromEntries(RECORD_TYPES.map((t) => [t.code, t.id]));

type DohAnswer = { name: string; type: number; TTL: number; data: string };
type DohResponse = {
  Status: number;
  TC?: boolean;
  Answer?: DohAnswer[];
  Authority?: DohAnswer[];
  Question?: { name: string; type: number }[];
  Comment?: string[] | string;
};

const DOH_URL = 'https://mozilla.cloudflare-dns.com/dns-query';

async function lookup(name: string, type: string): Promise<DohResponse> {
  const u = new URL(DOH_URL);
  u.searchParams.append('name', name);
  u.searchParams.append('type', type);
  const res = await fetch(u, { headers: { accept: 'application/dns-json' } });
  if (!res.ok) throw new Error(`doh ${res.status}`);
  return (await res.json()) as DohResponse;
}

function statusMeaning(code: number): string {
  switch (code) {
    case 0: return 'NOERROR';
    case 1: return 'FORMERR';
    case 2: return 'SERVFAIL';
    case 3: return 'NXDOMAIN';
    case 4: return 'NOTIMP';
    case 5: return 'REFUSED';
    default: return `code ${code}`;
  }
}

const SUGGESTIONS: Array<{ name: string; type: string; label: string }> = [
  { name: 'imlunahey.com', type: 'A', label: 'my site · A' },
  { name: '_atproto.imlunahey.com', type: 'TXT', label: 'handle binding · TXT' },
  { name: 'bsky.app', type: 'A', label: 'bsky · A' },
  { name: 'google.com', type: 'MX', label: 'gmail · MX' },
  { name: 'cloudflare.com', type: 'NS', label: 'cloudflare · NS' },
  { name: 'github.com', type: 'CAA', label: 'github · CAA' },
];

function trimTxt(s: string): string {
  // DoH returns TXT strings with surrounding quotes and escaped inner quotes
  return s.replace(/^"|"$/g, '').replace(/\\"/g, '"');
}

function humanTtl(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

export default function DnsPage() {
  const search = useSearch({ strict: false }) as { name?: string; type?: string };
  const navigate = useNavigate();
  const [name, setName] = useState(search.name ?? 'imlunahey.com');
  const [type, setType] = useState(search.type ?? 'A');
  const submitted = { name: search.name ?? 'imlunahey.com', type: search.type ?? 'A' };

  useEffect(() => {
    if (search.name) setName(search.name);
    if (search.type) setType(search.type);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.name, search.type]);

  const submit = (n: string, t: string) => {
    const trimmed = n.trim();
    if (trimmed) navigate({ to: '/labs/dns', search: { name: trimmed, type: t } });
  };

  const { data, isFetching, error } = useQuery({
    queryKey: ['dns', submitted.name, submitted.type],
    queryFn: () => lookup(submitted.name, submitted.type),
    enabled: !!submitted.name,
    staleTime: 1000 * 60 * 2,
    retry: false,
  });

  const errMsg = error instanceof Error ? error.message : null;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submit(name, type);
  };

  const answers = data?.Answer ?? [];
  const authorities = data?.Authority ?? [];

  const status = data?.Status ?? -1;
  const statusOk = status === 0;
  const statusText = status === -1 ? 'no query' : statusMeaning(status);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-dns">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">dns</span>
        </div>

        <header className="dns-hd">
          <h1>dns<span className="dot">.</span></h1>
          <p className="sub">
            live dns lookup via mozilla's dns-over-https resolver. supports the usual record types
            plus atproto's <code>_atproto.handle.example.com</code> pattern — the mechanism bluesky
            uses to bind a domain to a did.
          </p>
        </header>

        <form className="dns-input-row" onSubmit={onSubmit}>
          <input
            className="dns-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="example.com"
            autoComplete="off"
            spellCheck={false}
          />
          <select
            className="dns-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {RECORD_TYPES.map((t) => <option key={t.id} value={t.id}>{t.id}</option>)}
          </select>
          <button className="dns-btn" type="submit" disabled={!name.trim() || isFetching}>
            {isFetching ? 'querying…' : 'dig'}
          </button>
        </form>

        <div className="dns-suggest">
          <span className="dns-suggest-lbl">try</span>
          {SUGGESTIONS.map((s) => (
            <button
              key={`${s.name}-${s.type}`}
              className="dns-chip"
              onClick={() => submit(s.name, s.type)}
            >{s.label}</button>
          ))}
        </div>

        {errMsg ? (
          <div className="dns-err">✗ {errMsg}</div>
        ) : submitted ? (
          <>
            <section className="dns-verdict">
              <div className={`dns-badge v-${statusOk ? 'ok' : 'err'}`}>
                <span className={`dns-light l-${statusOk ? 'ok' : 'err'}`} />
                <span>{statusText}</span>
              </div>
              <div className="dns-query">
                <code>{submitted.name}</code>
                <span className="t-faint">·</span>
                <code>{submitted.type}</code>
                <span className="t-faint">·</span>
                <span>{answers.length} answer{answers.length === 1 ? '' : 's'}</span>
                {data?.TC ? <span className="dns-trunc" title="truncated response">TC</span> : null}
              </div>
            </section>

            <section className="dns-section">
              <div className="dns-section-hd">── answer section ({answers.length})</div>
              {answers.length === 0 ? (
                <div className="dns-empty">no records returned</div>
              ) : (
                <div className="dns-records">
                  {answers.map((a, i) => <Record key={i} rec={a} />)}
                </div>
              )}
            </section>

            {authorities.length > 0 ? (
              <section className="dns-section">
                <div className="dns-section-hd">── authority section ({authorities.length})</div>
                <div className="dns-records">
                  {authorities.map((a, i) => <Record key={i} rec={a} />)}
                </div>
              </section>
            ) : null}

            {data?.Comment ? (
              <div className="dns-comment">
                <span className="t-faint">comment:</span>{' '}
                {Array.isArray(data.Comment) ? data.Comment.join(' ') : data.Comment}
              </div>
            ) : null}

            <details className="dns-raw">
              <summary>raw dns-json response</summary>
              <pre>{JSON.stringify(data, null, 2)}</pre>
            </details>
          </>
        ) : null}
      </main>
    </>
  );
}

function Record({ rec }: { rec: DohAnswer }) {
  const typeLabel = TYPE_LABEL[rec.type] ?? `TYPE${rec.type}`;
  const data = useMemo(() => {
    if (rec.type === 16) return trimTxt(rec.data); // TXT
    return rec.data;
  }, [rec]);
  return (
    <article className="dns-rec">
      <div className="dns-rec-meta">
        <span className="dns-rec-type">{typeLabel}</span>
        <span className="dns-rec-ttl" title={`${rec.TTL}s`}>{humanTtl(rec.TTL)}</span>
      </div>
      <div className="dns-rec-name" title={rec.name}>{rec.name}</div>
      <div className="dns-rec-data">{data}</div>
    </article>
  );
}

const CSS = `
  .shell-dns { max-width: 1080px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .dns-hd { padding: 48px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .dns-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.9;
  }
  .dns-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .dns-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 62ch; margin-top: var(--sp-3); }
  .dns-hd code { font-family: var(--font-mono); color: var(--color-accent); }

  .dns-input-row {
    display: flex;
    margin-top: var(--sp-5);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .dns-input {
    flex: 1;
    background: transparent;
    border: 0; outline: 0;
    color: var(--color-fg);
    padding: var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-md);
  }
  .dns-type {
    background: var(--color-bg-raised);
    color: var(--color-accent);
    border: 0;
    border-left: 1px solid var(--color-border);
    padding: 0 var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    outline: 0;
    cursor: pointer;
  }
  .dns-btn {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    background: var(--color-accent);
    color: #000;
    border: 0;
    padding: 0 var(--sp-5);
    cursor: pointer;
    text-transform: lowercase;
  }
  .dns-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .dns-suggest {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    margin: var(--sp-3) 0 var(--sp-5);
    font-family: var(--font-mono); font-size: var(--fs-xs);
  }
  .dns-suggest-lbl { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .dns-chip {
    background: transparent; color: var(--color-fg-dim);
    border: 1px solid var(--color-border); padding: 2px 8px;
    cursor: pointer; font-family: inherit; font-size: inherit;
  }
  .dns-chip:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }

  .dns-err {
    padding: var(--sp-3);
    border: 1px solid var(--color-alert-dim);
    color: var(--color-alert);
    font-family: var(--font-mono); font-size: var(--fs-sm);
  }

  .dns-verdict {
    display: flex; align-items: center; gap: var(--sp-3);
    margin-bottom: var(--sp-4);
    flex-wrap: wrap;
  }
  .dns-badge {
    display: inline-flex; align-items: center; gap: 8px;
    padding: var(--sp-2) var(--sp-4);
    border: 1px solid;
    font-family: var(--font-display);
    font-size: var(--fs-xl);
    font-weight: 500;
    text-transform: lowercase;
  }
  .dns-badge.v-ok { color: var(--color-accent); border-color: var(--color-accent-dim); background: color-mix(in oklch, var(--color-accent) 6%, transparent); }
  .dns-badge.v-err { color: var(--color-alert); border-color: var(--color-alert-dim); }
  .dns-light { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .dns-light.l-ok { background: var(--color-accent); box-shadow: 0 0 8px var(--accent-glow); }
  .dns-light.l-err { background: var(--color-alert); }
  .dns-query {
    display: flex; align-items: center; gap: 8px;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--color-fg-dim);
    flex-wrap: wrap;
  }
  .dns-query code { color: var(--color-fg); background: var(--color-bg-raised); padding: 2px 6px; border: 1px solid var(--color-border); }
  .dns-trunc {
    color: var(--color-warn);
    border: 1px solid color-mix(in oklch, var(--color-warn) 40%, var(--color-border));
    padding: 0 5px;
    font-size: 10px;
  }

  .dns-section {
    margin-bottom: var(--sp-4);
  }
  .dns-section-hd {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    margin-bottom: var(--sp-2);
  }
  .dns-empty {
    padding: var(--sp-4);
    text-align: center;
    color: var(--color-fg-faint);
    border: 1px dashed var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }

  .dns-records { display: flex; flex-direction: column; gap: 2px; }
  .dns-rec {
    display: grid;
    grid-template-columns: 100px 1fr 2fr;
    gap: var(--sp-3);
    align-items: baseline;
    padding: 6px var(--sp-3);
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }
  .dns-rec-meta {
    display: flex; align-items: center; gap: var(--sp-2);
    min-width: 0;
  }
  .dns-rec-type {
    color: var(--color-accent);
    border: 1px solid var(--color-accent-dim);
    padding: 1px 6px;
    font-size: var(--fs-xs);
    background: color-mix(in oklch, var(--color-accent) 8%, transparent);
  }
  .dns-rec-ttl {
    color: var(--color-fg-faint);
    font-size: var(--fs-xs);
  }
  .dns-rec-name {
    color: var(--color-fg-dim);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .dns-rec-data {
    color: var(--color-fg);
    word-break: break-all;
  }

  .dns-comment {
    padding: var(--sp-3);
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-dim);
    margin-top: var(--sp-3);
  }

  .dns-raw {
    margin: var(--sp-4) 0 var(--sp-10);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .dns-raw summary { cursor: pointer; user-select: none; }
  .dns-raw pre {
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
    .dns-rec { grid-template-columns: 1fr; gap: 4px; }
  }
`;
