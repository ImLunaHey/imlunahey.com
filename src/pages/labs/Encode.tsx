import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

type Codec = 'base64' | 'base64url' | 'url' | 'html' | 'hex' | 'binary' | 'rot13' | 'escape';

type Result = { ok: true; value: string; bytes: number } | { ok: false; error: string };

const CODECS: { id: Codec; label: string; desc: string }[] = [
  { id: 'base64', label: 'base64', desc: 'rfc 4648 · = padding' },
  { id: 'base64url', label: 'base64url', desc: 'url-safe · no padding' },
  { id: 'url', label: 'url', desc: 'percent-encoding' },
  { id: 'html', label: 'html', desc: 'entity encoding' },
  { id: 'hex', label: 'hex', desc: 'utf-8 bytes · lowercase' },
  { id: 'binary', label: 'binary', desc: '01 spaced per byte' },
  { id: 'rot13', label: 'rot13', desc: 'letter cipher · self-inverse' },
  { id: 'escape', label: 'json escape', desc: 'quoted json string' },
];

// ─── encoders ─────────────────────────────────────────────────────────────

function bytesFrom(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function bytesTo(b: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(b);
}

function base64Encode(s: string, url = false): string {
  const b = bytesFrom(s);
  let bin = '';
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  let out = btoa(bin);
  if (url) out = out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return out;
}

function base64Decode(s: string, url = false): string {
  let t = s.replace(/\s+/g, '');
  if (url) {
    t = t.replace(/-/g, '+').replace(/_/g, '/');
    const pad = t.length % 4 === 0 ? 0 : 4 - (t.length % 4);
    t = t + '='.repeat(pad);
  }
  const bin = atob(t);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return bytesTo(b);
}

function htmlEncode(s: string): string {
  return s.replace(/[&<>"'`]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;',
  }[c]!)).replace(/[ -￿]/g, (c) => `&#${c.charCodeAt(0)};`);
}

function htmlDecode(s: string): string {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&(\w+);/g, (_, n) => named[n.toLowerCase()] ?? `&${n};`);
}

function hexEncode(s: string): string {
  return Array.from(bytesFrom(s)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexDecode(s: string): string {
  const t = s.replace(/\s+/g, '').replace(/^0x/i, '');
  if (!/^[0-9a-f]*$/i.test(t)) throw new Error('non-hex characters');
  if (t.length % 2 !== 0) throw new Error('hex length must be even');
  const b = new Uint8Array(t.length / 2);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(t.slice(i * 2, i * 2 + 2), 16);
  return bytesTo(b);
}

function binaryEncode(s: string): string {
  return Array.from(bytesFrom(s)).map((b) => b.toString(2).padStart(8, '0')).join(' ');
}

function binaryDecode(s: string): string {
  const parts = s.trim().split(/\s+/);
  const b = new Uint8Array(parts.length);
  for (let i = 0; i < parts.length; i++) {
    if (!/^[01]{1,8}$/.test(parts[i])) throw new Error(`invalid binary at position ${i + 1}`);
    b[i] = parseInt(parts[i], 2);
  }
  return bytesTo(b);
}

function rot13(s: string): string {
  return s.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

function jsonEscape(s: string): string {
  return JSON.stringify(s);
}

function jsonUnescape(s: string): string {
  const t = s.trim();
  const quoted = t.startsWith('"') ? t : `"${t.replace(/"/g, '\\"')}"`;
  const parsed = JSON.parse(quoted);
  if (typeof parsed !== 'string') throw new Error('not a string');
  return parsed;
}

function encode(codec: Codec, s: string): Result {
  try {
    switch (codec) {
      case 'base64':    return { ok: true, value: base64Encode(s, false),     bytes: bytesFrom(s).length };
      case 'base64url': return { ok: true, value: base64Encode(s, true),      bytes: bytesFrom(s).length };
      case 'url':       return { ok: true, value: encodeURIComponent(s),      bytes: bytesFrom(s).length };
      case 'html':      return { ok: true, value: htmlEncode(s),              bytes: bytesFrom(s).length };
      case 'hex':       return { ok: true, value: hexEncode(s),               bytes: bytesFrom(s).length };
      case 'binary':    return { ok: true, value: binaryEncode(s),            bytes: bytesFrom(s).length };
      case 'rot13':     return { ok: true, value: rot13(s),                   bytes: bytesFrom(s).length };
      case 'escape':    return { ok: true, value: jsonEscape(s),              bytes: bytesFrom(s).length };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'encode failed' };
  }
}

function decode(codec: Codec, s: string): Result {
  try {
    let value: string;
    switch (codec) {
      case 'base64':    value = base64Decode(s, false); break;
      case 'base64url': value = base64Decode(s, true); break;
      case 'url':       value = decodeURIComponent(s); break;
      case 'html':      value = htmlDecode(s); break;
      case 'hex':       value = hexDecode(s); break;
      case 'binary':    value = binaryDecode(s); break;
      case 'rot13':     value = rot13(s); break;
      case 'escape':    value = jsonUnescape(s); break;
    }
    return { ok: true, value, bytes: bytesFrom(value).length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'decode failed' };
  }
}

export default function EncodePage() {
  const [codec, setCodec] = useState<Codec>('base64');
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [input, setInput] = useState('hello world 🌎');

  const result = useMemo(
    () => (mode === 'encode' ? encode(codec, input) : decode(codec, input)),
    [mode, codec, input],
  );

  const swap = () => {
    if (result.ok) {
      setInput(result.value);
      setMode((m) => (m === 'encode' ? 'decode' : 'encode'));
    }
  };

  const copy = () => {
    if (result.ok) { try { navigator.clipboard.writeText(result.value); } catch { /* noop */ } }
  };

  const allEncodings = useMemo(() => {
    if (mode !== 'encode') return [];
    return CODECS.map((c) => ({ id: c.id, label: c.label, result: encode(c.id, input) }));
  }, [mode, input]);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-en">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">encode</span>
        </div>

        <header className="en-hd">
          <h1>encode<span className="dot">.</span></h1>
          <p className="sub">
            multi-codec encoder / decoder — base64, base64url, url, html, hex, binary, rot13, json.
            utf-8 throughout. when encoding, the bottom panel shows every codec at once for quick comparison.
          </p>
        </header>

        <section className="en-mode">
          <div className="en-mode-pill">
            <button
              className={`en-mode-btn ${mode === 'encode' ? 'on' : ''}`}
              onClick={() => setMode('encode')}
            >encode →</button>
            <button
              className={`en-mode-btn ${mode === 'decode' ? 'on' : ''}`}
              onClick={() => setMode('decode')}
            >← decode</button>
          </div>

          <div className="en-codecs">
            {CODECS.map((c) => (
              <button
                key={c.id}
                className={`en-codec ${codec === c.id ? 'on' : ''}`}
                onClick={() => setCodec(c.id)}
                title={c.desc}
              >{c.label}</button>
            ))}
          </div>
        </section>

        <section className="en-io">
          <div className="en-panel">
            <header className="en-panel-hd">
              <span>── input · {mode === 'decode' ? codec : 'plain text'}</span>
              <span className="en-panel-bytes">{bytesFrom(input).length} bytes</span>
            </header>
            <textarea
              className="en-textarea"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          <div className="en-swap">
            <button className="en-swap-btn" onClick={swap} title="use result as input" disabled={!result.ok}>
              ⇅
            </button>
          </div>

          <div className="en-panel">
            <header className="en-panel-hd">
              <span>── output · {mode === 'encode' ? codec : 'plain text'}</span>
              {result.ok ? (
                <>
                  <span className="en-panel-bytes">{result.value.length} chars · {result.bytes} utf-8</span>
                  <button className="en-copy" onClick={copy}>copy</button>
                </>
              ) : null}
            </header>
            {result.ok ? (
              <pre className="en-output">{result.value || <em className="t-faint">empty</em>}</pre>
            ) : (
              <div className="en-err">✗ {result.error}</div>
            )}
          </div>
        </section>

        {mode === 'encode' && allEncodings.length > 0 ? (
          <section className="en-all">
            <div className="en-all-hd">── all encodings</div>
            <div className="en-all-grid">
              {allEncodings.map((r) => (
                <article key={r.id} className="en-all-card">
                  <header className="en-all-card-hd">
                    <span className="en-all-label">{r.label}</span>
                    <button
                      className="en-all-pick"
                      onClick={() => setCodec(r.id)}
                      title="use this codec"
                    >{codec === r.id ? '●' : '○'}</button>
                  </header>
                  <pre className="en-all-value">{r.result.ok ? r.result.value : `✗ ${r.result.error}`}</pre>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
}

const CSS = `
  .shell-en { max-width: 1180px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .en-hd { padding: 48px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .en-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.9;
  }
  .en-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .en-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 64ch; margin-top: var(--sp-3); }

  .en-mode {
    display: flex;
    align-items: center;
    gap: var(--sp-4);
    margin: var(--sp-5) 0 var(--sp-4);
    flex-wrap: wrap;
  }

  .en-mode-pill {
    display: inline-flex;
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .en-mode-btn {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    background: transparent;
    color: var(--color-fg-dim);
    border: 0;
    padding: 6px 14px;
    cursor: pointer;
    text-transform: lowercase;
  }
  .en-mode-btn.on {
    background: var(--color-accent);
    color: #000;
  }

  .en-codecs {
    display: flex; gap: 4px; flex-wrap: wrap; flex: 1;
    justify-content: flex-end;
  }
  .en-codec {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    background: transparent;
    color: var(--color-fg-dim);
    border: 1px solid var(--color-border);
    padding: 4px 10px;
    cursor: pointer;
    text-transform: lowercase;
  }
  .en-codec:hover { color: var(--color-fg); border-color: var(--color-border-bright); }
  .en-codec.on {
    color: var(--color-accent);
    border-color: var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 8%, transparent);
  }

  .en-io {
    display: grid;
    grid-template-columns: 1fr 32px 1fr;
    gap: var(--sp-3);
    align-items: stretch;
  }
  .en-panel {
    display: flex; flex-direction: column;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    min-height: 260px;
  }
  .en-panel-hd {
    display: flex; align-items: center; gap: var(--sp-2);
    padding: 8px var(--sp-3);
    border-bottom: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    background: linear-gradient(to bottom, #0c0c0c, #070707);
  }
  .en-panel-bytes {
    margin-left: auto;
    color: var(--color-accent-dim);
  }
  .en-copy {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    background: transparent;
    color: var(--color-fg-dim);
    border: 1px solid var(--color-border-bright);
    padding: 2px 8px;
    cursor: pointer;
  }
  .en-copy:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .en-textarea {
    flex: 1;
    background: transparent;
    border: 0; outline: 0;
    color: var(--color-fg);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    line-height: 1.5;
    padding: var(--sp-3);
    resize: none;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .en-output {
    flex: 1;
    padding: var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    line-height: 1.5;
    color: var(--color-accent);
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
    overflow: auto;
    max-height: 400px;
  }
  .en-err {
    padding: var(--sp-3);
    color: var(--color-alert);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }

  .en-swap {
    display: flex; align-items: center; justify-content: center;
  }
  .en-swap-btn {
    width: 32px; height: 32px;
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg-dim);
    font-family: var(--font-mono);
    font-size: 16px;
    cursor: pointer;
  }
  .en-swap-btn:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .en-swap-btn:disabled { opacity: 0.3; cursor: not-allowed; }

  .en-all {
    padding: var(--sp-5) 0 var(--sp-10);
  }
  .en-all-hd {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    margin-bottom: var(--sp-3);
  }
  .en-all-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--sp-2);
  }
  .en-all-card {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    display: flex; flex-direction: column;
    min-height: 100px;
  }
  .en-all-card-hd {
    display: flex; justify-content: space-between;
    padding: 6px var(--sp-2);
    border-bottom: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    background: linear-gradient(to bottom, #0c0c0c, #070707);
  }
  .en-all-label { color: var(--color-accent); text-transform: lowercase; }
  .en-all-pick {
    background: transparent; border: 0;
    color: var(--color-fg-faint);
    cursor: pointer;
    font-family: var(--font-mono); font-size: var(--fs-sm);
    padding: 0 4px;
  }
  .en-all-pick:hover { color: var(--color-accent); }
  .en-all-value {
    flex: 1;
    padding: var(--sp-2);
    margin: 0;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-fg-dim);
    white-space: pre-wrap;
    word-break: break-all;
    overflow: hidden;
    max-height: 100px;
    text-overflow: ellipsis;
  }

  @media (max-width: 760px) {
    .en-mode { gap: var(--sp-3); }
    .en-codecs { justify-content: flex-start; }
    .en-io {
      grid-template-columns: 1fr;
      gap: var(--sp-2);
    }
    .en-swap { padding: 4px 0; }
    .en-swap-btn { transform: rotate(90deg); }
  }
`;
