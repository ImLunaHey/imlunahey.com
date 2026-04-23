import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

type Mode = 'text' | 'hex' | 'base64';

function toBytes(input: string, mode: Mode): Uint8Array {
  if (mode === 'text') return new TextEncoder().encode(input);
  if (mode === 'hex') {
    const clean = input.replace(/[^0-9a-f]/gi, '');
    if (clean.length % 2 !== 0) throw new Error('hex length must be even');
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    return out;
  }
  // base64
  const clean = input.replace(/\s+/g, '');
  const binary = atob(clean);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function ascii(b: number): string {
  if (b >= 0x20 && b <= 0x7e) return String.fromCharCode(b);
  return '.';
}

function hex2(b: number): string { return b.toString(16).padStart(2, '0'); }

function fmtOffset(n: number, width: number): string {
  return n.toString(16).padStart(width, '0');
}

export default function HexDumpPage() {
  const [mode, setMode] = useState<Mode>('text');
  const [input, setInput] = useState('hello world\n🦁 luna\nbytes go here');
  const [width, setWidth] = useState(16);

  const result = useMemo(() => {
    try {
      return { ok: true as const, bytes: toBytes(input, mode) };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : 'parse error' };
    }
  }, [input, mode]);

  const offsetWidth = useMemo(() => {
    if (!result.ok) return 8;
    const max = result.bytes.length;
    return Math.max(4, Math.ceil(Math.log2(Math.max(1, max)) / 4));
  }, [result]);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-hd">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">hex dump</span>
        </div>

        <header className="hd-hd">
          <h1>hex dump<span className="dot">.</span></h1>
          <p className="sub">
            paste any bytes — get an <code>xxd</code>-style hex + ascii dump. input modes: plain text
            (utf-8), hex string, or base64. printable ascii renders as-is; everything else shows as a dot.
          </p>
        </header>

        <section className="hd-opts">
          <div className="hd-mode">
            <span className="hd-lbl">input</span>
            {(['text', 'hex', 'base64'] as Mode[]).map((m) => (
              <button
                key={m}
                className={`hd-chip ${mode === m ? 'on' : ''}`}
                onClick={() => setMode(m)}
              >{m}</button>
            ))}
          </div>
          <div className="hd-width">
            <span className="hd-lbl">width</span>
            {[8, 16, 24, 32].map((w) => (
              <button
                key={w}
                className={`hd-chip ${width === w ? 'on' : ''}`}
                onClick={() => setWidth(w)}
              >{w}</button>
            ))}
          </div>
        </section>

        <textarea
          className="hd-ta"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={4}
          spellCheck={false}
          autoComplete="off"
          placeholder={mode === 'hex' ? '48656c6c6f' : mode === 'base64' ? 'SGVsbG8=' : 'type anything…'}
        />

        {!result.ok ? (
          <div className="hd-err">✗ {result.error}</div>
        ) : (
          <>
            <div className="hd-stats">
              <span>{result.bytes.length} bytes</span>
              <span>{Math.ceil(result.bytes.length / width)} rows</span>
              <button
                className="hd-btn"
                onClick={() => { try { navigator.clipboard.writeText(renderText(result.bytes, width, offsetWidth)); } catch { /* noop */ } }}
              >copy dump</button>
            </div>

            <section className="hd-dump">
              <Dump bytes={result.bytes} width={width} offsetWidth={offsetWidth} />
            </section>
          </>
        )}
      </main>
    </>
  );
}

function Dump({ bytes, width, offsetWidth }: { bytes: Uint8Array; width: number; offsetWidth: number }) {
  if (bytes.length === 0) return <div className="hd-empty">no bytes</div>;
  const rows: Array<{ offset: number; chunk: Uint8Array }> = [];
  for (let i = 0; i < bytes.length; i += width) {
    rows.push({ offset: i, chunk: bytes.slice(i, i + width) });
  }
  return (
    <div className="hd-grid" style={{ ['--col-w' as string]: `${width}` }}>
      {rows.map((r) => (
        <div key={r.offset} className="hd-row">
          <span className="hd-offset">{fmtOffset(r.offset, offsetWidth)}</span>
          <span className="hd-hexes">
            {Array.from({ length: width }).map((_, i) => {
              const b = r.chunk[i];
              if (b === undefined) return <span key={i} className="hd-byte hd-byte-pad">{'  '}</span>;
              const printable = b >= 0x20 && b <= 0x7e;
              const ctrl = b < 0x20 || b === 0x7f;
              return (
                <span
                  key={i}
                  className={`hd-byte ${ctrl ? 'hd-byte-ctrl' : printable ? 'hd-byte-print' : 'hd-byte-hi'}`}
                  title={`0x${hex2(b)} · ${b} · ${ascii(b) === '.' ? '(non-printable)' : `'${ascii(b)}'`}`}
                >
                  {hex2(b)}
                </span>
              );
            })}
          </span>
          <span className="hd-ascii">
            {Array.from(r.chunk).map((b, i) => {
              const printable = b >= 0x20 && b <= 0x7e;
              return (
                <span key={i} className={printable ? 'hd-char-print' : 'hd-char-dot'}>
                  {printable ? ascii(b) : '.'}
                </span>
              );
            })}
          </span>
        </div>
      ))}
    </div>
  );
}

function renderText(bytes: Uint8Array, width: number, offsetWidth: number): string {
  const out: string[] = [];
  for (let i = 0; i < bytes.length; i += width) {
    const chunk = bytes.slice(i, i + width);
    const hexPart = Array.from(chunk).map(hex2).join(' ').padEnd(width * 3 - 1);
    const asciiPart = Array.from(chunk).map(ascii).join('');
    out.push(`${fmtOffset(i, offsetWidth)}: ${hexPart}  ${asciiPart}`);
  }
  return out.join('\n');
}

const CSS = `
  .shell-hd { max-width: 1180px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .hd-hd { padding: 48px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .hd-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.9;
  }
  .hd-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .hd-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 64ch; margin-top: var(--sp-3); }
  .hd-hd code { font-family: var(--font-mono); color: var(--color-accent); }

  .hd-opts {
    display: flex;
    gap: var(--sp-4);
    margin: var(--sp-4) 0 var(--sp-3);
    flex-wrap: wrap;
    align-items: center;
  }
  .hd-mode, .hd-width { display: flex; gap: 4px; align-items: center; }
  .hd-lbl {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-right: 4px;
  }
  .hd-chip {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    background: transparent;
    color: var(--color-fg-dim);
    border: 1px solid var(--color-border);
    padding: 3px 9px;
    cursor: pointer;
    text-transform: lowercase;
  }
  .hd-chip:hover { color: var(--color-fg); border-color: var(--color-border-bright); }
  .hd-chip.on {
    color: var(--color-accent);
    border-color: var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 6%, transparent);
  }

  .hd-ta {
    width: 100%;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    color: var(--color-fg);
    padding: var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    line-height: 1.5;
    resize: vertical;
    outline: 0;
    white-space: pre;
  }
  .hd-ta:focus { border-color: var(--color-accent-dim); }

  .hd-err {
    margin-top: var(--sp-3);
    padding: var(--sp-3);
    color: var(--color-alert);
    border: 1px solid var(--color-alert-dim);
    font-family: var(--font-mono); font-size: var(--fs-sm);
  }

  .hd-stats {
    display: flex; gap: var(--sp-4); align-items: center;
    margin: var(--sp-3) 0;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .hd-btn {
    margin-left: auto;
    background: transparent;
    color: var(--color-fg-dim);
    border: 1px solid var(--color-border-bright);
    padding: 3px 10px;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: lowercase;
  }
  .hd-btn:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }

  .hd-empty {
    padding: var(--sp-4);
    text-align: center;
    color: var(--color-fg-faint);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    border: 1px dashed var(--color-border);
  }

  .hd-dump {
    padding-bottom: var(--sp-10);
  }
  .hd-grid {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    line-height: 1.5;
    overflow-x: auto;
  }
  .hd-row {
    display: flex;
    gap: var(--sp-3);
    padding: 2px var(--sp-3);
    white-space: nowrap;
    min-width: fit-content;
  }
  .hd-row:hover { background: var(--color-bg-raised); }
  .hd-offset {
    color: var(--color-fg-faint);
    user-select: none;
  }
  .hd-hexes {
    display: inline-flex;
    gap: 6px;
  }
  .hd-byte { min-width: 2ch; }
  .hd-byte-pad { opacity: 0.2; }
  .hd-byte-print { color: var(--color-fg); }
  .hd-byte-ctrl { color: var(--color-alert); }
  .hd-byte-hi { color: var(--color-warn); }
  .hd-ascii {
    color: var(--color-fg-dim);
    letter-spacing: 0;
  }
  .hd-char-print { color: var(--color-fg); }
  .hd-char-dot { color: var(--color-fg-faint); }
`;
