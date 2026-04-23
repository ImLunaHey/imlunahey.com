import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { listCerts, type Cert } from '../../server/certs';

function relative(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  const abs = Math.abs(d);
  const future = d < 0;
  let unit = 's', val = abs;
  if (abs > 60 * 60 * 24 * 365) { unit = 'y'; val = abs / (60 * 60 * 24 * 365); }
  else if (abs > 60 * 60 * 24 * 30) { unit = 'mo'; val = abs / (60 * 60 * 24 * 30); }
  else if (abs > 60 * 60 * 24) { unit = 'd'; val = abs / (60 * 60 * 24); }
  else if (abs > 60 * 60) { unit = 'h'; val = abs / (60 * 60); }
  else if (abs > 60) { unit = 'm'; val = abs / 60; }
  return future ? `in ${val.toFixed(0)}${unit}` : `${val.toFixed(0)}${unit} ago`;
}

export default function CertsPage() {
  const [input, setInput] = useState('imlunahey.com');
  const [submitted, setSubmitted] = useState<string | null>('imlunahey.com');

  const { data, isFetching, error } = useQuery({
    queryKey: ['crt-sh', submitted],
    queryFn: () => listCerts({ data: { domain: submitted! } }),
    enabled: !!submitted,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const errMsg = error instanceof Error ? error.message : null;

  const summary = useMemo(() => {
    if (!data) return null;
    const active = data.filter((c) => !c.expired);
    const issuers = new Map<string, number>();
    const names = new Set<string>();
    for (const c of data) {
      issuers.set(c.issuerName, (issuers.get(c.issuerName) ?? 0) + 1);
      for (const n of c.nameValue) names.add(n);
    }
    return {
      total: data.length,
      active: active.length,
      issuers: Array.from(issuers.entries()).sort((a, b) => b[1] - a[1]),
      names: names.size,
    };
  }, [data]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = input.trim();
    if (v) setSubmitted(v);
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-cr">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">certs</span>
        </div>

        <header className="cr-hd">
          <h1>certs<span className="dot">.</span></h1>
          <p className="sub">
            every tls certificate ever issued for a domain — pulled from{' '}
            <a href="https://crt.sh" target="_blank" rel="noopener noreferrer" className="t-accent">crt.sh</a>{' '}
            certificate transparency logs. shows issuer, subject names, validity window, and expiry.
          </p>
        </header>

        <form className="cr-input-row" onSubmit={onSubmit}>
          <input
            className="cr-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="example.com"
            spellCheck={false}
            autoComplete="off"
          />
          <button className="cr-btn" type="submit" disabled={!input.trim() || isFetching}>
            {isFetching ? 'searching…' : 'search ct logs'}
          </button>
        </form>

        {errMsg ? (
          <div className="cr-err">✗ {errMsg}</div>
        ) : data ? (
          <>
            <section className="cr-summary">
              <div className="cr-stat">
                <span>certificates</span>
                <b>{summary?.total}</b>
              </div>
              <div className="cr-stat">
                <span>currently valid</span>
                <b className="t-accent">{summary?.active}</b>
              </div>
              <div className="cr-stat">
                <span>unique names</span>
                <b>{summary?.names}</b>
              </div>
              <div className="cr-stat wide">
                <span>top issuers</span>
                <b className="mono-s">
                  {summary?.issuers.slice(0, 3).map(([n, c]) => `${n} (${c})`).join(' · ') || '—'}
                </b>
              </div>
            </section>

            <section className="cr-list">
              {data.map((c) => <CertRow key={c.id} c={c} />)}
              {data.length === 0 ? <div className="cr-empty">no certificates found in ct logs</div> : null}
            </section>
          </>
        ) : null}
      </main>
    </>
  );
}

function CertRow({ c }: { c: Cert }) {
  const expired = c.expired;
  const expiresSoon = !expired && (new Date(c.notAfter).getTime() - Date.now()) < 30 * 86_400_000;
  const wild = c.nameValue.some((n) => n.startsWith('*.'));
  return (
    <article className={`cr-row ${expired ? 'expired' : expiresSoon ? 'soon' : 'ok'}`}>
      <div className="cr-row-top">
        <span className="cr-issuer">{c.issuerName}</span>
        <span className={`cr-status ${expired ? 'expired' : expiresSoon ? 'soon' : 'ok'}`}>
          {expired ? `expired ${relative(c.notAfter)}` : `expires ${relative(c.notAfter)}`}
        </span>
        {wild ? <span className="cr-wild">wildcard</span> : null}
      </div>
      <div className="cr-row-cn">{c.commonName}</div>
      <div className="cr-names">
        {c.nameValue.slice(0, 8).map((n) => <span key={n} className="cr-name">{n}</span>)}
        {c.nameValue.length > 8 ? <span className="cr-name more">+{c.nameValue.length - 8} more</span> : null}
      </div>
      <div className="cr-dates">
        <span>issued <b>{c.notBefore.slice(0, 10)}</b></span>
        <span>valid until <b>{c.notAfter.slice(0, 10)}</b></span>
        <span>{c.ageDays}d old</span>
        <a
          href={`https://crt.sh/?id=${c.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="cr-ext"
        >crt.sh ↗</a>
      </div>
    </article>
  );
}

const CSS = `
  .shell-cr { max-width: 1080px; margin: 0 auto; padding: 0 var(--sp-6); }
  .crumbs { padding-top: var(--sp-6); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .crumbs a { color: var(--color-fg-faint); text-decoration: none; }
  .crumbs a:hover { color: var(--color-accent); }
  .crumbs .sep { margin: 0 6px; }
  .crumbs .last { color: var(--color-accent); }

  .cr-hd { padding: 48px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .cr-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .cr-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .cr-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 62ch; margin-top: var(--sp-3); }
  .cr-hd a { text-decoration: underline; }
  .t-accent { color: var(--color-accent); }

  .cr-input-row { display: flex; margin: var(--sp-5) 0 var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .cr-input { flex: 1; background: transparent; border: 0; outline: 0; color: var(--color-fg); padding: var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-md); }
  .cr-btn { background: var(--color-accent); color: #000; border: 0; padding: 0 var(--sp-5); font-family: var(--font-mono); font-size: var(--fs-sm); cursor: pointer; text-transform: lowercase; }
  .cr-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .cr-err { padding: var(--sp-3); color: var(--color-alert); border: 1px solid var(--color-alert-dim); font-family: var(--font-mono); font-size: var(--fs-sm); }

  .cr-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: var(--sp-2);
    margin-bottom: var(--sp-4);
  }
  .cr-stat {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: var(--sp-3);
    display: flex; flex-direction: column; gap: 4px;
    font-family: var(--font-mono);
  }
  .cr-stat.wide { grid-column: span 2; }
  .cr-stat span { font-size: var(--fs-xs); color: var(--color-fg-faint); text-transform: lowercase; }
  .cr-stat b { font-family: var(--font-display); font-size: var(--fs-2xl); font-weight: 500; color: var(--color-fg); line-height: 1; }
  .cr-stat b.mono-s { font-family: var(--font-mono); font-size: var(--fs-sm); font-weight: 400; line-height: 1.3; }

  .cr-list { display: flex; flex-direction: column; gap: 6px; padding-bottom: var(--sp-10); }

  .cr-row {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: var(--sp-3);
    display: flex; flex-direction: column; gap: 6px;
    border-left-width: 3px;
  }
  .cr-row.ok { border-left-color: var(--color-accent); }
  .cr-row.soon { border-left-color: var(--color-warn); }
  .cr-row.expired { border-left-color: var(--color-alert); opacity: 0.75; }

  .cr-row-top {
    display: flex; align-items: baseline; gap: var(--sp-3); flex-wrap: wrap;
    font-family: var(--font-mono); font-size: var(--fs-xs);
  }
  .cr-issuer { color: var(--color-accent); }
  .cr-status {
    margin-left: auto;
    padding: 1px 6px;
    border: 1px solid;
    font-size: 10px;
    text-transform: lowercase;
  }
  .cr-status.ok { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .cr-status.soon { color: var(--color-warn); border-color: color-mix(in oklch, var(--color-warn) 40%, var(--color-border)); }
  .cr-status.expired { color: var(--color-alert); border-color: var(--color-alert-dim); }
  .cr-wild {
    color: #ff9944;
    border: 1px solid color-mix(in srgb, #ff9944 40%, var(--color-border));
    padding: 1px 6px;
    font-size: 10px;
    text-transform: lowercase;
  }

  .cr-row-cn {
    font-family: var(--font-mono);
    font-size: var(--fs-md);
    color: var(--color-fg);
    word-break: break-all;
  }

  .cr-names {
    display: flex; gap: 4px; flex-wrap: wrap;
  }
  .cr-name {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg-dim);
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    padding: 1px 6px;
    word-break: break-all;
  }
  .cr-name.more { color: var(--color-fg-faint); font-style: italic; }

  .cr-dates {
    display: flex; gap: var(--sp-3); flex-wrap: wrap;
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    margin-top: 2px;
  }
  .cr-dates b { color: var(--color-fg-dim); font-weight: 400; }
  .cr-ext {
    margin-left: auto;
    color: var(--color-fg-faint);
    text-decoration: none;
  }
  .cr-ext:hover { color: var(--color-accent); }

  .cr-empty {
    padding: var(--sp-6);
    text-align: center;
    color: var(--color-fg-faint);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    border: 1px dashed var(--color-border);
  }
`;
