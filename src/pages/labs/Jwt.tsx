import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { CodeBlock } from '../../components/CodeBlock';

// sample: a harmless, expired JWT so the page has something to show on first visit.
const SAMPLE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6Ikx1bmEgSGV5IiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyNDEwMjJ9.' +
  'KHGJj2WzBZSJ2CR5wBbKRTqR5p7w3vglbxbpTjtybno';

type ClaimMeta = { key: string; label: string; render: (v: unknown, now: number) => React.ReactNode };

function base64UrlDecode(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? b64 : b64 + '='.repeat(4 - (b64.length % 4));
  const bin = atob(pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function base64UrlDecodeBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? b64 : b64 + '='.repeat(4 - (b64.length % 4));
  const bin = atob(pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

type DecodeResult =
  | {
      header: Record<string, unknown>;
      payload: Record<string, unknown>;
      signature: string; // base64url
      signatureBytes: Uint8Array;
      parts: [string, string, string];
    }
  | { error: string; stage: 'split' | 'header' | 'payload' };

function decodeJwt(token: string): DecodeResult {
  const trimmed = token.trim().replace(/^bearer\s+/i, '');
  const parts = trimmed.split('.');
  if (parts.length !== 3) return { error: `expected 3 dot-separated parts, got ${parts.length}`, stage: 'split' };
  let header: unknown;
  try {
    header = JSON.parse(base64UrlDecode(parts[0]));
  } catch (err) {
    return { error: `header json: ${err instanceof Error ? err.message : String(err)}`, stage: 'header' };
  }
  let payload: unknown;
  try {
    payload = JSON.parse(base64UrlDecode(parts[1]));
  } catch (err) {
    return { error: `payload json: ${err instanceof Error ? err.message : String(err)}`, stage: 'payload' };
  }
  if (typeof header !== 'object' || header === null || Array.isArray(header)) {
    return { error: 'header is not a json object', stage: 'header' };
  }
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return { error: 'payload is not a json object', stage: 'payload' };
  }
  let sigBytes: Uint8Array;
  try {
    sigBytes = base64UrlDecodeBytes(parts[2]);
  } catch {
    sigBytes = new Uint8Array(0);
  }
  return {
    header: header as Record<string, unknown>,
    payload: payload as Record<string, unknown>,
    signature: parts[2],
    signatureBytes: sigBytes,
    parts: [parts[0], parts[1], parts[2]],
  };
}

function fmtUnix(n: number, now: number): React.ReactNode {
  const d = new Date(n * 1000);
  const diff = (n * 1000 - now) / 1000;
  const absDiff = Math.abs(diff);
  const unit =
    absDiff < 60 ? `${Math.round(absDiff)}s` :
    absDiff < 3600 ? `${Math.round(absDiff / 60)}m` :
    absDiff < 86400 ? `${Math.round(absDiff / 3600)}h` :
    `${Math.round(absDiff / 86400)}d`;
  const rel = diff > 0 ? `in ${unit}` : `${unit} ago`;
  return (
    <>
      <span className="t-mono">{d.toISOString().replace('T', ' ').replace('.000Z', 'z')}</span>
      <span className="t-faint" style={{ marginLeft: 8 }}>
        {rel}
      </span>
    </>
  );
}

const CLAIMS: ClaimMeta[] = [
  { key: 'iss', label: 'issuer', render: (v) => String(v) },
  { key: 'sub', label: 'subject', render: (v) => String(v) },
  { key: 'aud', label: 'audience', render: (v) => Array.isArray(v) ? v.join(', ') : String(v) },
  { key: 'iat', label: 'issued at', render: (v, now) => (typeof v === 'number' ? fmtUnix(v, now) : String(v)) },
  { key: 'nbf', label: 'not before', render: (v, now) => (typeof v === 'number' ? fmtUnix(v, now) : String(v)) },
  { key: 'exp', label: 'expires', render: (v, now) => (typeof v === 'number' ? fmtUnix(v, now) : String(v)) },
  { key: 'jti', label: 'jwt id', render: (v) => String(v) },
];

function statusOf(payload: Record<string, unknown>, now: number): { label: string; variant: 'valid' | 'expired' | 'future' | 'unknown' } {
  const exp = typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  const nbf = typeof payload.nbf === 'number' ? payload.nbf * 1000 : null;
  if (exp != null && now >= exp) return { label: 'expired', variant: 'expired' };
  if (nbf != null && now < nbf) return { label: 'not yet valid', variant: 'future' };
  if (exp != null) return { label: 'active', variant: 'valid' };
  return { label: 'no expiry', variant: 'unknown' };
}

export default function JwtPage() {
  const [input, setInput] = useState(SAMPLE);
  const [now, setNow] = useState(() => Date.now());

  // tick every second so the "in 3m" countdown stays honest
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const trimmed = input.trim();
  const result = trimmed ? decodeJwt(trimmed) : null;

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-jwt">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">jwt</span>
        </div>

        <header className="jwt-hd">
          <h1>
            jwt<span className="dot">.</span>
          </h1>
          <p className="sub">
            paste any json web token to decode its <b>header</b>, <b>payload</b>, and <b>signature</b>. standard
            claims get surfaced at the top with an expiry countdown. nothing is sent anywhere — decoding runs entirely
            in your browser.
          </p>
          <div className="warn">
            <b>note:</b> this only <i>decodes</i>, it doesn't verify the signature. anyone with the token can read
            everything shown below — treat the payload as public once it's in transit.
          </div>
        </header>

        <section className="token-pane">
          <div className="pane-hd">
            <span>// token</span>
            <button type="button" className="mini-btn" onClick={() => setInput('')} disabled={!input}>
              clear
            </button>
          </div>
          <TokenInput value={input} onChange={setInput} />
        </section>

        {!result ? null : 'error' in result ? (
          <section className="err">
            <div className="err-hd">// {result.stage === 'split' ? 'format error' : `${result.stage} error`}</div>
            <div className="err-body">{result.error}</div>
          </section>
        ) : (
          <>
            <Summary payload={result.payload} now={now} />
            <section className="two-col">
              <CodeBlock
                code={JSON.stringify(result.header, null, 2)}
                filename="header.json"
                language="json"
              />
              <CodeBlock
                code={JSON.stringify(result.payload, null, 2)}
                filename="payload.json"
                language="json"
              />
            </section>
            <Signature sig={result.signature} bytes={result.signatureBytes} alg={result.header.alg} />
          </>
        )}

        <footer className="jwt-footer">
          <span>
            src: <span className="t-accent">rfc 7519 · base64url · json.parse</span>
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

function TokenInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // colourise the three parts so users can see them visually separated
  const parts = value.split('.');
  const colourised = parts.map((p, i) => {
    const cls = i === 0 ? 'tk-header' : i === 1 ? 'tk-payload' : 'tk-sig';
    return (
      <span key={i} className={cls}>
        {p}
        {i < parts.length - 1 ? <span className="tk-dot">.</span> : null}
      </span>
    );
  });

  return (
    <div className="token-stack">
      <textarea
        className="token-inp"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIi…"
      />
      {value.trim() ? <div className="token-preview">{colourised}</div> : null}
    </div>
  );
}

function Summary({ payload, now }: { payload: Record<string, unknown>; now: number }) {
  const status = statusOf(payload, now);
  const hits = CLAIMS.filter((c) => c.key in payload);

  return (
    <section className="summary">
      <div className="summary-hd">
        <span className="summary-ttl">// claims</span>
        <span className={'status status-' + status.variant}>● {status.label}</span>
      </div>
      {hits.length === 0 ? (
        <div className="t-faint">no standard claims in this payload.</div>
      ) : (
        <dl className="claim-dl">
          {hits.map((c) => (
            <div key={c.key} className="claim-row">
              <dt>
                <span className="claim-key">{c.key}</span>
                <span className="claim-label">{c.label}</span>
              </dt>
              <dd>{c.render(payload[c.key], now)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function Signature({ sig, bytes, alg }: { sig: string; bytes: Uint8Array; alg: unknown }) {
  const [copied, setCopied] = useState<string | null>(null);
  const hex = toHex(bytes);
  const algStr = typeof alg === 'string' ? alg : 'unknown';

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      /* ignore */
    }
  };

  return (
    <section className="sig">
      <div className="sig-hd">
        <span>// signature</span>
        <span className="t-faint">
          alg <b className="t-accent">{algStr}</b> · <b>{bytes.length}</b> bytes
        </span>
      </div>
      <div className="sig-rows">
        <div className="sig-row">
          <div className="sig-label">base64url</div>
          <code className="sig-val">{sig || '(empty)'}</code>
          <button type="button" className={'mini-btn' + (copied === 'b64' ? ' flash' : '')} onClick={() => copy(sig, 'b64')}>
            {copied === 'b64' ? 'copied' : 'copy'}
          </button>
        </div>
        <div className="sig-row">
          <div className="sig-label">hex</div>
          <code className="sig-val">{hex || '(empty)'}</code>
          <button type="button" className={'mini-btn' + (copied === 'hex' ? ' flash' : '')} onClick={() => copy(hex, 'hex')}>
            {copied === 'hex' ? 'copied' : 'copy'}
          </button>
        </div>
      </div>
      <div className="sig-note t-faint">
        signature is not verified — that would require the issuer's public key or shared secret. use this for reading
        tokens, not trusting them.
      </div>
    </section>
  );
}

const CSS = `
  .shell-jwt { max-width: 1000px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .jwt-hd { padding-bottom: var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .jwt-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(44px, 7vw, 84px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.95;
  }
  .jwt-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .jwt-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 68ch; margin-top: var(--sp-3); line-height: 1.55; }
  .jwt-hd .sub b { color: var(--color-accent); font-weight: 400; }
  .warn {
    margin-top: var(--sp-4);
    padding: var(--sp-3) var(--sp-4);
    border: 1px solid color-mix(in oklch, var(--color-warn) 40%, var(--color-border));
    background: color-mix(in oklch, var(--color-warn) 5%, var(--color-bg-panel));
    font-size: var(--fs-xs);
    color: var(--color-fg-dim);
    font-family: var(--font-mono);
    line-height: 1.55;
  }
  .warn b { color: var(--color-warn); font-weight: 400; }
  .warn i { font-style: italic; color: var(--color-accent); }

  /* token pane */
  .token-pane {
    margin-top: var(--sp-6);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .pane-hd {
    display: flex; justify-content: space-between; align-items: center;
    padding: 6px 12px;
    border-bottom: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: uppercase;
    letter-spacing: 0.14em;
    background: linear-gradient(to bottom, #0c0c0c, #070707);
  }
  .mini-btn {
    border: 1px solid var(--color-border-bright);
    background: transparent;
    color: var(--color-fg-dim);
    font: inherit;
    font-family: var(--font-mono);
    font-size: 10px;
    padding: 2px 10px;
    cursor: pointer;
    text-transform: lowercase;
    letter-spacing: 0.06em;
  }
  .mini-btn:hover:not(:disabled) { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .mini-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .mini-btn.flash { color: var(--color-accent); border-color: var(--color-accent); background: var(--color-bg-raised); }

  .token-stack { padding: var(--sp-3) var(--sp-4) var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-3); }
  .token-inp {
    width: 100%;
    padding: var(--sp-3);
    border: 1px solid var(--color-border);
    background: var(--color-bg-raised);
    color: var(--color-fg);
    font: inherit;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    line-height: 1.55;
    resize: vertical;
    word-break: break-all;
  }
  .token-inp:focus { outline: none; border-color: var(--color-accent-dim); }
  .token-preview {
    padding: var(--sp-2) var(--sp-3);
    border: 1px dashed var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    line-height: 1.5;
    word-break: break-all;
    color: var(--color-fg-faint);
  }
  .tk-header  { color: oklch(0.78 0.11 210); }  /* cyan */
  .tk-payload { color: oklch(0.82 0.13 85); }   /* amber */
  .tk-sig     { color: oklch(0.78 0.16 315); }  /* magenta */
  .tk-dot     { color: var(--color-fg-faint); margin: 0 1px; }

  /* summary */
  .summary {
    margin-top: var(--sp-4);
    padding: var(--sp-4) var(--sp-5);
    border: 1px solid var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 4%, var(--color-bg-panel));
  }
  .summary-hd {
    display: flex; justify-content: space-between; align-items: center;
    padding-bottom: var(--sp-3);
    margin-bottom: var(--sp-3);
    border-bottom: 1px dashed var(--color-border);
    font-family: var(--font-mono);
  }
  .summary-ttl { font-size: 10px; color: var(--color-accent); text-transform: uppercase; letter-spacing: 0.14em; }
  .status {
    font-size: 10px;
    padding: 2px 10px;
    border: 1px solid var(--color-border-bright);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  .status.status-valid { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .status.status-expired { color: var(--color-alert); border-color: color-mix(in oklch, var(--color-alert) 40%, var(--color-border)); }
  .status.status-future { color: var(--color-warn); border-color: color-mix(in oklch, var(--color-warn) 40%, var(--color-border)); }
  .status.status-unknown { color: var(--color-fg-faint); }

  .claim-dl { display: flex; flex-direction: column; gap: 4px; }
  .claim-row {
    display: grid;
    grid-template-columns: 160px 1fr;
    gap: var(--sp-4);
    padding: 6px 0;
    border-bottom: 1px dashed var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
  }
  .claim-row:last-child { border-bottom: 0; }
  .claim-row dt { display: flex; flex-direction: column; gap: 2px; }
  .claim-key { color: var(--color-accent); font-size: var(--fs-sm); }
  .claim-label { color: var(--color-fg-faint); font-size: 10px; }
  .claim-row dd { color: var(--color-fg); word-break: break-all; margin: 0; display: flex; align-items: baseline; gap: 4px; flex-wrap: wrap; }
  .t-mono { font-family: var(--font-mono); }
  .t-faint { color: var(--color-fg-faint); }

  /* header + payload side-by-side */
  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-3);
    margin-top: var(--sp-4);
  }
  @media (max-width: 720px) {
    .two-col { grid-template-columns: 1fr; }
    .claim-row { grid-template-columns: 1fr; }
  }

  /* signature */
  .sig {
    margin-top: var(--sp-4);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .sig-hd {
    display: flex; justify-content: space-between; align-items: center;
    padding: 6px 12px;
    border-bottom: 1px solid var(--color-border);
    background: linear-gradient(to bottom, #0c0c0c, #070707);
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }
  .sig-hd b { color: var(--color-fg); font-weight: 400; }
  .sig-hd .t-accent { color: var(--color-accent); }
  .sig-rows { padding: var(--sp-3) var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-3); }
  .sig-row {
    display: grid;
    grid-template-columns: 80px 1fr auto;
    gap: var(--sp-3);
    align-items: center;
  }
  .sig-label {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }
  .sig-val {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-fg);
    word-break: break-all;
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    padding: 4px 8px;
    max-height: 80px;
    overflow: auto;
  }
  .sig-note {
    padding: 0 var(--sp-4) var(--sp-3);
    font-family: var(--font-mono);
    font-size: 10px;
    line-height: 1.5;
  }

  /* error */
  .err {
    margin-top: var(--sp-4);
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
  .err-body { padding: var(--sp-3) var(--sp-4); font-size: var(--fs-sm); color: var(--color-fg); line-height: 1.55; word-break: break-word; }

  .jwt-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-6);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
`;
