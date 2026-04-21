import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

// atproto record keys are "timestamp identifiers": 13-char base32-sortable
// strings packing [1 leading 0 bit][53-bit microsecond timestamp][10-bit clock id].

const ALPHABET = '234567abcdefghijklmnopqrstuvwxyz';

function encodeTid(timestampUs: bigint, clockId: bigint): string {
  if (timestampUs < 0n || timestampUs >= 1n << 53n) throw new Error('timestamp out of range');
  if (clockId < 0n || clockId >= 1n << 10n) throw new Error('clock id out of range');
  const combined = (timestampUs << 10n) | clockId;
  let val = combined;
  const chars: string[] = new Array(13);
  for (let i = 12; i >= 0; i--) {
    chars[i] = ALPHABET[Number(val & 31n)];
    val >>= 5n;
  }
  return chars.join('');
}

type Decoded = { timestampUs: bigint; clockId: bigint; date: Date };

function decodeTid(tid: string): Decoded | { error: string } {
  if (tid.length !== 13) return { error: `expected 13 chars, got ${tid.length}` };
  let val = 0n;
  for (const ch of tid) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) return { error: `"${ch}" is not in the base32-sortable alphabet` };
    val = (val << 5n) | BigInt(idx);
  }
  const clockId = val & ((1n << 10n) - 1n);
  const timestampUs = (val >> 10n) & ((1n << 53n) - 1n);
  const date = new Date(Number(timestampUs / 1000n));
  return { timestampUs, clockId, date };
}

function fmtUtc(d: Date): string {
  const pad = (n: number, w = 2) => n.toString().padStart(w, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.` +
    pad(d.getUTCMilliseconds(), 3) +
    ' utc'
  );
}

function fmtRel(date: Date, now: number): string {
  const diff = now - date.getTime();
  if (diff < 0) return 'in the future';
  if (diff < 1000) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default function TidPage() {
  return (
    <>
      <style>{CSS}</style>
      <main className="shell-tid">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">tid</span>
        </div>

        <header className="tid-hd">
          <h1>
            tid<span className="dot">.</span>
          </h1>
          <p className="sub">
            atproto record keys are <b>timestamp identifiers</b> — 13 chars of base32-sortable text packing a 53-bit
            microsecond timestamp and a 10-bit clock id. live-generate them or paste one to see exactly when it was
            minted and by which clock.
          </p>
        </header>

        <div className="split">
          <Generator />
          <Decoder />
        </div>

        <section className="spec">
          <div className="spec-hd">// format</div>
          <pre className="spec-body">{`13 chars · base32-sortable · alphabet "234567abcdefghijklmnopqrstuvwxyz"

bit layout (65 bits → 13 × 5):
  [1 bit] leading zero
  [53 bits] microseconds since 1970-01-01 utc
  [10 bits] random clock id (disambiguates rapid inserts)

sort order equals time order — new tids always come after older
ones, and two tids with the same microsecond diverge by clock id.`}</pre>
        </section>

        <footer className="tid-footer">
          <span>
            src: <span className="t-accent">rfc 4648-ish base32 · bigint arithmetic</span>
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

function Generator() {
  const [now, setNow] = useState(() => Date.now());
  const [paused, setPaused] = useState(false);
  const [tick, setTick] = useState(0);
  const [copied, setCopied] = useState(false);

  // re-render every 60ms so the tid updates quickly but without burning cycles
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setNow(Date.now());
      setTick((t) => t + 1);
    }, 60);
    return () => clearInterval(id);
  }, [paused]);

  // a single clock id per tick — re-randomise every 4s so you see the field vary too
  const clockSeed = Math.floor(tick / Math.floor(4000 / 60));
  const clockId = BigInt((hash(clockSeed) & 0x3ff) | 0);
  const timestampUs = BigInt(now) * 1000n + BigInt((now % 1000) | 0);

  const tid = encodeTid(timestampUs, clockId);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tid);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };

  return (
    <section className="pane">
      <div className="pane-hd">
        <span className="pane-lbl">// generator</span>
        <div className="pane-ctrls">
          <button type="button" className="pane-btn" onClick={() => setPaused((p) => !p)}>
            {paused ? 'resume' : 'pause'}
          </button>
          <button type="button" className={'pane-btn' + (copied ? ' flash' : '')} onClick={copy}>
            {copied ? 'copied' : 'copy'}
          </button>
        </div>
      </div>
      <div className="tid-big">{tid}</div>
      <dl className="dl">
        <dt>timestamp</dt>
        <dd suppressHydrationWarning>{fmtUtc(new Date(now))}</dd>
        <dt>microseconds</dt>
        <dd className="t-mono">{timestampUs.toString()}</dd>
        <dt>clock id</dt>
        <dd className="t-mono">
          {clockId.toString()} <span className="t-faint">/ 1024</span>
        </dd>
      </dl>
    </section>
  );
}

function Decoder() {
  const [input, setInput] = useState('');
  const trimmed = input.trim();
  const now = Date.now();
  const result = trimmed ? decodeTid(trimmed) : null;

  return (
    <section className="pane">
      <div className="pane-hd">
        <span className="pane-lbl">// decoder</span>
      </div>
      <input
        className="inp"
        type="text"
        placeholder="paste a tid (13 chars)"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
      {!result ? (
        <div className="t-faint decoder-hint">paste any atproto record key — e.g. <code className="inline">3jzfcijpj2z2a</code></div>
      ) : 'error' in result ? (
        <div className="decoder-err">
          <span className="t-alert">// invalid</span>
          <div>{result.error}</div>
        </div>
      ) : (
        <dl className="dl">
          <dt>date</dt>
          <dd>
            <span suppressHydrationWarning>{fmtUtc(result.date)}</span>
            <br />
            <span className="t-faint" suppressHydrationWarning>
              {fmtRel(result.date, now)}
            </span>
          </dd>
          <dt>microseconds</dt>
          <dd className="t-mono">{result.timestampUs.toString()}</dd>
          <dt>clock id</dt>
          <dd className="t-mono">
            {result.clockId.toString()} <span className="t-faint">/ 1024</span>
          </dd>
        </dl>
      )}
    </section>
  );
}

// deterministic cheap hash so clock ids look random without cryptography
function hash(n: number): number {
  let x = n | 0;
  x = (x ^ 61) ^ (x >>> 16);
  x = x + (x << 3);
  x = x ^ (x >>> 4);
  x = Math.imul(x, 0x27d4eb2d);
  x = x ^ (x >>> 15);
  return x >>> 0;
}

const CSS = `
  .shell-tid { max-width: 900px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .tid-hd { padding-bottom: var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .tid-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(44px, 7vw, 84px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.95;
  }
  .tid-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .tid-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 68ch; margin-top: var(--sp-3); line-height: 1.55; }
  .tid-hd .sub b { color: var(--color-accent); font-weight: 400; }

  .split {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-4);
    margin-top: var(--sp-6);
  }
  @media (max-width: 720px) {
    .split { grid-template-columns: 1fr; }
  }

  .pane {
    padding: var(--sp-5);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    display: flex; flex-direction: column;
    gap: var(--sp-4);
  }
  .pane-hd {
    display: flex; justify-content: space-between; align-items: center;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-accent);
    text-transform: uppercase;
    letter-spacing: 0.14em;
    padding-bottom: var(--sp-3);
    border-bottom: 1px dashed var(--color-border);
  }
  .pane-ctrls { display: flex; gap: 4px; }
  .pane-btn {
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
  .pane-btn:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .pane-btn.flash { color: var(--color-accent); border-color: var(--color-accent); background: var(--color-bg-raised); }

  .tid-big {
    font-family: var(--font-display);
    font-size: clamp(28px, 5vw, 48px);
    color: var(--color-accent);
    text-shadow: 0 0 16px var(--accent-glow);
    letter-spacing: 0.06em;
    word-break: break-all;
    padding: var(--sp-2) 0;
  }

  .dl {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: var(--sp-2) var(--sp-4);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
  }
  .dl dt { color: var(--color-fg-faint); text-transform: lowercase; letter-spacing: 0.06em; }
  .dl dd { color: var(--color-fg); word-break: break-all; }
  .dl .t-mono { font-family: var(--font-mono); color: var(--color-fg); }
  .dl .t-faint { color: var(--color-fg-faint); }
  .dl .t-alert { color: var(--color-alert); }

  .inp {
    border: 1px solid var(--color-border);
    background: var(--color-bg-raised);
    padding: 8px 12px;
    font: inherit;
    font-family: var(--font-mono);
    font-size: var(--fs-md);
    color: var(--color-fg);
    letter-spacing: 0.06em;
  }
  .inp:focus { outline: none; border-color: var(--color-accent-dim); }
  .inp::placeholder { color: var(--color-fg-ghost); }

  .decoder-hint {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    line-height: 1.55;
  }
  .decoder-hint .inline {
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    padding: 1px 6px;
    color: var(--color-accent);
  }
  .decoder-err {
    display: flex; flex-direction: column; gap: 4px;
    padding: var(--sp-3);
    border: 1px solid color-mix(in oklch, var(--color-alert) 40%, var(--color-border));
    background: color-mix(in oklch, var(--color-alert) 5%, var(--color-bg-panel));
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg);
  }
  .decoder-err .t-alert { color: var(--color-alert); text-transform: uppercase; letter-spacing: 0.12em; font-size: 10px; }

  .spec {
    margin-top: var(--sp-6);
    padding: var(--sp-4) var(--sp-5);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .spec-hd {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: uppercase;
    letter-spacing: 0.14em;
    margin-bottom: var(--sp-3);
  }
  .spec-body {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-dim);
    line-height: 1.6;
    white-space: pre-wrap;
    margin: 0;
  }

  .tid-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-6);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
`;
