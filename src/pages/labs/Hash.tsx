import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

type Algo = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512' | 'MD5';

const ALGOS: { id: Algo; label: string; bits: number; note: string }[] = [
  { id: 'MD5', label: 'md5', bits: 128, note: 'legacy · broken for integrity' },
  { id: 'SHA-1', label: 'sha-1', bits: 160, note: 'legacy · broken' },
  { id: 'SHA-256', label: 'sha-256', bits: 256, note: 'current standard' },
  { id: 'SHA-384', label: 'sha-384', bits: 384, note: 'truncated sha-512' },
  { id: 'SHA-512', label: 'sha-512', bits: 512, note: 'stronger, larger' },
];

// Compact MD5 — SubtleCrypto doesn't implement it.
// Based on the classic Rivest RFC 1321 reference.
function md5(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const msg = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  msg.set(bytes);
  msg[bytes.length] = 0x80;
  const lenBits = BigInt(bytes.length) * 8n;
  for (let i = 0; i < 8; i++) msg[msg.length - 8 + i] = Number((lenBits >> BigInt(i * 8)) & 0xffn);

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const s = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
             5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
             4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
             6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  const K = [0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
             0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
             0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
             0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
             0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
             0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
             0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
             0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391];
  const rl = (x: number, n: number) => ((x << n) | (x >>> (32 - n))) >>> 0;

  for (let off = 0; off < msg.length; off += 64) {
    const M: number[] = [];
    for (let j = 0; j < 16; j++) {
      M.push(msg[off + j * 4] | (msg[off + j * 4 + 1] << 8) | (msg[off + j * 4 + 2] << 16) | (msg[off + j * 4 + 3] << 24));
    }
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F = 0, g = 0;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = (F + A + K[i] + M[g]) >>> 0;
      A = D; D = C; C = B;
      B = (B + rl(F, s[i])) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  const toHex = (n: number) => {
    let out = '';
    for (let i = 0; i < 4; i++) out += ((n >>> (i * 8)) & 0xff).toString(16).padStart(2, '0');
    return out;
  };
  return toHex(a0) + toHex(b0) + toHex(c0) + toHex(d0);
}

async function hashSubtle(algo: Exclude<Algo, 'MD5'>, text: string): Promise<string> {
  const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashFor(algo: Algo, text: string): Promise<string> {
  if (algo === 'MD5') return md5(text);
  return hashSubtle(algo, text);
}

export default function HashPage() {
  const [input, setInput] = useState('hello world');
  const [results, setResults] = useState<Record<Algo, string>>({} as Record<Algo, string>);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const r = {} as Record<Algo, string>;
      for (const a of ALGOS) {
        const h = await hashFor(a.id, input);
        if (cancel) return;
        r[a.id] = h;
      }
      if (!cancel) setResults(r);
    })();
    return () => { cancel = true; };
  }, [input]);

  const bytes = useMemo(() => new TextEncoder().encode(input).length, [input]);
  const copy = (v: string) => { try { navigator.clipboard.writeText(v); } catch { /* noop */ } };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-hash">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">hash</span>
        </div>

        <header className="hash-hd">
          <h1>hash<span className="dot">.</span></h1>
          <p className="sub">
            paste any text — get md5, sha-1, sha-256, sha-384, sha-512 simultaneously. sha variants run
            via the browser's subtlecrypto; md5 is a client-side js implementation (no longer in the
            subtle api, but still common in legacy systems).
          </p>
        </header>

        <textarea
          className="hash-ta"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          placeholder="type anything…"
          spellCheck={false}
        />
        <div className="hash-meta">
          {input.length} chars · {bytes} utf-8 bytes
        </div>

        <section className="hash-list">
          {ALGOS.map((a) => {
            const h = results[a.id];
            return (
              <article key={a.id} className="hash-row">
                <header className="hash-row-hd">
                  <span className="hash-algo">{a.label}</span>
                  <span className="hash-bits">{a.bits} bits</span>
                  <span className="hash-note">{a.note}</span>
                </header>
                <div className="hash-value">
                  <code>{h ?? <span className="skel" style={{ width: '80%', height: 14, display: 'inline-block' }} />}</code>
                </div>
                <button className="hash-copy" onClick={() => h && copy(h)} disabled={!h}>copy</button>
              </article>
            );
          })}
        </section>

        <footer className="hash-footer">
          <p>
            all hashes are computed in your browser — <b>nothing is sent to a server</b>. md5 and sha-1
            are broken for collision resistance; never use them for security-critical purposes. sha-256
            is the modern default.
          </p>
        </footer>
      </main>
    </>
  );
}

const CSS = `
  .shell-hash { max-width: 1080px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .hash-hd { padding: 48px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .hash-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.9;
  }
  .hash-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .hash-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 60ch; margin-top: var(--sp-3); }

  .hash-ta {
    width: 100%;
    margin-top: var(--sp-5);
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    color: var(--color-fg);
    padding: var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-md);
    line-height: 1.5;
    resize: vertical;
    outline: 0;
  }
  .hash-ta:focus { border-color: var(--color-accent-dim); }
  .hash-meta {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    margin: var(--sp-2) 0 var(--sp-4);
  }

  .hash-list {
    display: flex; flex-direction: column; gap: 2px;
    margin-bottom: var(--sp-5);
  }
  .hash-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--sp-3);
    align-items: center;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: var(--sp-3);
  }
  .hash-row-hd {
    grid-column: 1 / -1;
    display: flex; align-items: baseline; gap: var(--sp-3);
    margin-bottom: 6px;
    font-family: var(--font-mono);
  }
  .hash-algo {
    font-size: var(--fs-md);
    color: var(--color-accent);
    text-transform: lowercase;
  }
  .hash-bits { color: var(--color-fg-dim); font-size: var(--fs-xs); }
  .hash-note { color: var(--color-fg-faint); font-size: var(--fs-xs); margin-left: auto; }
  .hash-value {
    min-width: 0;
    overflow: hidden;
  }
  .hash-value code {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--color-fg);
    word-break: break-all;
    display: block;
  }
  .hash-copy {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    background: transparent;
    color: var(--color-fg-dim);
    border: 1px solid var(--color-border-bright);
    padding: 4px 10px;
    cursor: pointer;
    text-transform: lowercase;
  }
  .hash-copy:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .hash-copy:disabled { opacity: 0.4; cursor: not-allowed; }

  .hash-footer {
    padding: var(--sp-5) 0 var(--sp-10);
    border-top: 1px solid var(--color-border);
    color: var(--color-fg-dim);
    font-size: var(--fs-sm);
    line-height: 1.65;
  }
  .hash-footer p { max-width: 68ch; }
  .hash-footer b { color: var(--color-accent); font-weight: 400; }
`;
