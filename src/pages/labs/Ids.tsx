import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

type IdKind = 'uuidv4' | 'uuidv7' | 'ulid' | 'nanoid' | 'tid' | 'snowflake' | 'cuid';

const KINDS: { id: IdKind; label: string; desc: string }[] = [
  { id: 'uuidv4', label: 'uuid v4', desc: '128-bit random, 8-4-4-4-12 hex' },
  { id: 'uuidv7', label: 'uuid v7', desc: 'time-ordered 128-bit (ms timestamp prefix)' },
  { id: 'ulid', label: 'ulid', desc: '128-bit, crockford base32, sortable' },
  { id: 'nanoid', label: 'nanoid', desc: '21-char url-safe random' },
  { id: 'tid', label: 'tid', desc: 'atproto record key — microseconds + 10b random' },
  { id: 'snowflake', label: 'snowflake', desc: '64-bit: 41b time · 10b machine · 12b seq' },
  { id: 'cuid', label: 'cuid2', desc: '24-char collision-resistant' },
];

// ─── generators ──────────────────────────────────────────────────────────

function uuidv4(): string {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function uuidv7(): string {
  const ms = BigInt(Date.now());
  const rand = new Uint8Array(10);
  crypto.getRandomValues(rand);
  const b = new Uint8Array(16);
  b[0] = Number((ms >> 40n) & 0xffn);
  b[1] = Number((ms >> 32n) & 0xffn);
  b[2] = Number((ms >> 24n) & 0xffn);
  b[3] = Number((ms >> 16n) & 0xffn);
  b[4] = Number((ms >> 8n) & 0xffn);
  b[5] = Number(ms & 0xffn);
  b.set(rand, 6);
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function ulid(): string {
  const ms = Date.now();
  const timePart = encodeCrockford(ms, 10);
  const rand = new Uint8Array(10);
  crypto.getRandomValues(rand);
  let randPart = '';
  for (let i = 0; i < rand.length; i += 5) {
    const b0 = rand[i], b1 = rand[i + 1], b2 = rand[i + 2], b3 = rand[i + 3], b4 = rand[i + 4];
    randPart += CROCKFORD[(b0 >> 3) & 0x1f];
    randPart += CROCKFORD[((b0 & 0x07) << 2) | (b1 >> 6)];
    randPart += CROCKFORD[(b1 >> 1) & 0x1f];
    randPart += CROCKFORD[((b1 & 0x01) << 4) | (b2 >> 4)];
    randPart += CROCKFORD[((b2 & 0x0f) << 1) | (b3 >> 7)];
    randPart += CROCKFORD[(b3 >> 2) & 0x1f];
    randPart += CROCKFORD[((b3 & 0x03) << 3) | (b4 >> 5)];
    randPart += CROCKFORD[b4 & 0x1f];
  }
  return timePart + randPart;
}

function encodeCrockford(n: number, len: number): string {
  let out = '';
  for (let i = len - 1; i >= 0; i--) {
    out = CROCKFORD[n % 32] + out;
    n = Math.floor(n / 32);
  }
  return out;
}

function nanoid(size = 21): string {
  const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < size; i++) out += ALPHA[bytes[i] & 63];
  return out;
}

const TID_ALPHA = '234567abcdefghijklmnopqrstuvwxyz';

function tid(): string {
  const us = BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000));
  const clk = Math.floor(Math.random() * 1024);
  const n = (us << 10n) | BigInt(clk);
  // encode as 13 chars of base32 (high bit forced 0 → leading '2' often)
  let out = '';
  let v = n;
  for (let i = 0; i < 13; i++) {
    out = TID_ALPHA[Number(v & 31n)] + out;
    v = v >> 5n;
  }
  return out;
}

function snowflake(): string {
  // Discord-style: 42b time since epoch · 10b machine · 12b seq
  const EPOCH = 1420070400000n; // Discord epoch; plain example only
  const t = BigInt(Date.now()) - EPOCH;
  const machine = BigInt(Math.floor(Math.random() * 1024));
  const seq = BigInt(Math.floor(Math.random() * 4096));
  const id = (t << 22n) | (machine << 12n) | seq;
  return id.toString();
}

function cuid2(): string {
  const ALPHA = 'abcdefghijklmnopqrstuvwxyz';
  const DIGIT = '0123456789';
  const ALL = ALPHA + DIGIT;
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let out = ALPHA[bytes[0] % 26];
  for (let i = 1; i < 24; i++) out += ALL[bytes[i] % 36];
  return out;
}

// ─── decoders / inspectors ───────────────────────────────────────────────

function inspect(value: string): { kind: IdKind | 'unknown'; fields: Array<[string, string]> } {
  const v = value.trim();
  if (!v) return { kind: 'unknown', fields: [] };

  // uuid v4/v7: 8-4-4-4-12 hex
  const uuid = /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})$/i.exec(v);
  if (uuid) {
    const ver = parseInt(uuid[3][0], 16);
    const variant = (parseInt(uuid[4][0], 16) >> 2) & 0x3;
    const fields: Array<[string, string]> = [
      ['version', `v${ver}`],
      ['variant', variant === 2 ? 'RFC 4122 (10x)' : `bits ${variant.toString(2)}`],
    ];
    if (ver === 7) {
      const msHex = v.replace(/-/g, '').slice(0, 12);
      const ms = parseInt(msHex, 16);
      const date = new Date(ms);
      fields.push(['timestamp', date.toISOString()]);
      fields.push(['age', relTime(ms)]);
    }
    return { kind: ver === 7 ? 'uuidv7' : 'uuidv4', fields };
  }

  // ulid: 26 crockford base32
  if (/^[0-9A-HJKMNP-TV-Z]{26}$/i.test(v)) {
    const u = v.toUpperCase();
    let ms = 0;
    for (let i = 0; i < 10; i++) ms = ms * 32 + CROCKFORD.indexOf(u[i]);
    return {
      kind: 'ulid',
      fields: [
        ['timestamp', new Date(ms).toISOString()],
        ['age', relTime(ms)],
        ['random (hex)', 'last 16 chars → 80 bits'],
      ],
    };
  }

  // tid: 13 chars, alphabet 234567abcdefghijklmnopqrstuvwxyz
  if (/^[234567abcdefghijklmnopqrstuvwxyz]{13}$/.test(v)) {
    let n = 0n;
    for (const ch of v) n = n * 32n + BigInt(TID_ALPHA.indexOf(ch));
    const us = n >> 10n;
    const ms = Number(us / 1000n);
    return {
      kind: 'tid',
      fields: [
        ['timestamp', new Date(ms).toISOString()],
        ['age', relTime(ms)],
        ['microseconds', us.toString()],
        ['clock id', (n & 0x3ffn).toString()],
      ],
    };
  }

  // snowflake: pure numeric, typically 17-20 digits
  if (/^\d{15,20}$/.test(v)) {
    const n = BigInt(v);
    const EPOCH = 1420070400000n; // Discord epoch
    const ms = Number((n >> 22n) + EPOCH);
    const machine = Number((n >> 12n) & 0x3ffn);
    const seq = Number(n & 0xfffn);
    return {
      kind: 'snowflake',
      fields: [
        ['timestamp (discord epoch)', new Date(ms).toISOString()],
        ['age', relTime(ms)],
        ['machine id', String(machine)],
        ['sequence', String(seq)],
      ],
    };
  }

  // nanoid
  if (/^[A-Za-z0-9_-]{21}$/.test(v)) {
    return { kind: 'nanoid', fields: [['bits', '126'], ['alphabet', '64 chars'], ['collision p(1% after)', '~1e18 ids/s for 1k yr']] };
  }

  // cuid2
  if (/^[a-z][a-z0-9]{23}$/.test(v)) {
    return { kind: 'cuid', fields: [['bits', '~113'], ['notes', 'no extractable timestamp']] };
  }

  return { kind: 'unknown', fields: [] };
}

function relTime(ms: number): string {
  const d = Date.now() - ms;
  if (d < 0) return `in ${Math.abs(Math.round(d / 1000))}s`;
  if (d < 60_000) return `${Math.round(d / 1000)}s ago`;
  if (d < 3_600_000) return `${Math.round(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.round(d / 3_600_000)}h ago`;
  if (d < 86_400_000 * 365) return `${Math.round(d / 86_400_000)}d ago`;
  return `${(d / (86_400_000 * 365)).toFixed(1)}y ago`;
}

function gen(kind: IdKind): string {
  switch (kind) {
    case 'uuidv4': return uuidv4();
    case 'uuidv7': return uuidv7();
    case 'ulid': return ulid();
    case 'nanoid': return nanoid();
    case 'tid': return tid();
    case 'snowflake': return snowflake();
    case 'cuid': return cuid2();
  }
}

// ─── page ────────────────────────────────────────────────────────────────

export default function IdsPage() {
  const [kind, setKind] = useState<IdKind>('uuidv7');
  const [count, setCount] = useState(5);
  const [list, setList] = useState<string[]>([]);
  const [inspectIn, setInspectIn] = useState('');

  useEffect(() => { regenerate(kind, count); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, count]);

  const regenerate = (k: IdKind, n: number) => {
    const out: string[] = [];
    for (let i = 0; i < n; i++) out.push(gen(k));
    setList(out);
  };

  const copy = (s: string) => { try { navigator.clipboard.writeText(s); } catch { /* noop */ } };
  const copyAll = () => copy(list.join('\n'));

  const inspected = useMemo(() => inspect(inspectIn), [inspectIn]);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-ids">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">ids</span>
        </div>

        <header className="ids-hd">
          <h1>ids<span className="dot">.</span></h1>
          <p className="sub">
            generate and inspect identifiers. uuid v4/v7, ulid, nanoid, snowflake, cuid2, and atproto tid.
            paste any id to decode its embedded timestamp + structure.
          </p>
        </header>

        <section className="ids-row">
          <div className="ids-col">
            <div className="ids-label">── generate</div>
            <div className="ids-kind-grid">
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  className={`ids-kind ${kind === k.id ? 'on' : ''}`}
                  onClick={() => setKind(k.id)}
                  title={k.desc}
                >
                  <span className="ids-kind-label">{k.label}</span>
                  <span className="ids-kind-desc">{k.desc}</span>
                </button>
              ))}
            </div>
            <div className="ids-actions">
              <label className="ids-count-lbl" htmlFor="ids-count">count</label>
              <input
                id="ids-count"
                type="number"
                className="ids-count"
                min={1}
                max={100}
                value={count}
                onChange={(e) => setCount(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
              />
              <button className="ids-btn" onClick={() => regenerate(kind, count)}>↻ regenerate</button>
              <button className="ids-btn" onClick={copyAll}>copy all</button>
            </div>
            <ul className="ids-list">
              {list.map((id, i) => (
                <li key={i} className="ids-item">
                  <span className="ids-item-idx">{String(i + 1).padStart(2, ' ')}</span>
                  <code className="ids-item-val" onClick={() => copy(id)} title="click to copy">{id}</code>
                </li>
              ))}
            </ul>
          </div>

          <div className="ids-col">
            <div className="ids-label">── inspect</div>
            <textarea
              className="ids-inspect-input"
              value={inspectIn}
              onChange={(e) => setInspectIn(e.target.value)}
              placeholder="paste any id here…"
              rows={3}
              spellCheck={false}
            />
            {inspectIn.trim() ? (
              <div className="ids-inspect-result">
                {inspected.kind === 'unknown' ? (
                  <div className="ids-inspect-unknown">✗ not a recognized id format</div>
                ) : (
                  <>
                    <div className="ids-inspect-hd">
                      <span className="ids-inspect-kind">{KINDS.find((k) => k.id === inspected.kind)?.label ?? inspected.kind}</span>
                      <span className="ids-inspect-ok">✓ valid</span>
                    </div>
                    <dl className="ids-inspect-dl">
                      {inspected.fields.map(([k, v]) => (
                        <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
                      ))}
                    </dl>
                  </>
                )}
              </div>
            ) : (
              <div className="ids-inspect-hint">
                supports: uuid v4/v7 · ulid · nanoid · tid · snowflake · cuid2.
                time-encoding ids expose their timestamp.
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}

const CSS = `
  .shell-ids { max-width: 1180px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .ids-hd { padding: 48px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .ids-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.9;
  }
  .ids-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .ids-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 58ch; margin-top: var(--sp-3); }

  .ids-row {
    display: grid;
    grid-template-columns: 3fr 2fr;
    gap: var(--sp-6);
    padding: var(--sp-6) 0 var(--sp-10);
  }
  .ids-label {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    margin-bottom: var(--sp-3);
  }

  .ids-kind-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 6px;
    margin-bottom: var(--sp-3);
  }
  .ids-kind {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: var(--sp-2) var(--sp-3);
    text-align: left;
    cursor: pointer;
    display: flex; flex-direction: column; gap: 2px;
    font-family: var(--font-mono);
  }
  .ids-kind:hover { border-color: var(--color-border-bright); }
  .ids-kind.on {
    border-color: var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 6%, var(--color-bg-panel));
  }
  .ids-kind-label { color: var(--color-fg); font-size: var(--fs-sm); }
  .ids-kind.on .ids-kind-label { color: var(--color-accent); }
  .ids-kind-desc { color: var(--color-fg-faint); font-size: 10px; }

  .ids-actions {
    display: flex; align-items: center; gap: var(--sp-2);
    margin-bottom: var(--sp-3);
    flex-wrap: wrap;
  }
  .ids-count-lbl {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em;
  }
  .ids-count {
    width: 60px;
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    color: var(--color-fg);
    padding: 4px 8px;
    font-family: var(--font-mono); font-size: var(--fs-sm);
    outline: 0;
  }
  .ids-btn {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    background: transparent;
    color: var(--color-fg-dim);
    border: 1px solid var(--color-border-bright);
    padding: 4px 10px;
    cursor: pointer;
    text-transform: lowercase;
  }
  .ids-btn:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }

  .ids-list {
    list-style: none;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: var(--sp-2);
    display: flex; flex-direction: column; gap: 2px;
    max-height: 520px; overflow-y: auto;
  }
  .ids-item {
    display: grid;
    grid-template-columns: 24px 1fr;
    gap: var(--sp-2);
    align-items: baseline;
    padding: 4px 6px;
    border-bottom: 1px dashed transparent;
  }
  .ids-item:hover { background: var(--color-bg-raised); border-bottom-color: var(--color-border); }
  .ids-item-idx { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: 10px; }
  .ids-item-val {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--color-fg);
    cursor: pointer;
    word-break: break-all;
  }
  .ids-item-val:hover { color: var(--color-accent); }

  .ids-inspect-input {
    width: 100%;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    color: var(--color-fg);
    padding: var(--sp-3);
    font-family: var(--font-mono); font-size: var(--fs-sm);
    resize: vertical;
    outline: 0;
  }
  .ids-inspect-input:focus { border-color: var(--color-accent-dim); }

  .ids-inspect-hint {
    margin-top: var(--sp-3);
    padding: var(--sp-3);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    border: 1px dashed var(--color-border);
    line-height: 1.6;
  }
  .ids-inspect-result {
    margin-top: var(--sp-3);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .ids-inspect-hd {
    display: flex; justify-content: space-between;
    padding: var(--sp-2) var(--sp-3);
    border-bottom: 1px solid var(--color-border);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    background: linear-gradient(to bottom, #0c0c0c, #070707);
  }
  .ids-inspect-kind { color: var(--color-accent); text-transform: lowercase; }
  .ids-inspect-ok { color: var(--color-accent-dim); }
  .ids-inspect-unknown {
    padding: var(--sp-3);
    color: var(--color-alert);
    font-family: var(--font-mono); font-size: var(--fs-sm);
  }
  .ids-inspect-dl {
    padding: var(--sp-3);
    font-family: var(--font-mono); font-size: var(--fs-sm);
  }
  .ids-inspect-dl > div {
    display: grid;
    grid-template-columns: 140px 1fr;
    gap: var(--sp-3);
    padding: 4px 0;
    border-bottom: 1px dashed var(--color-border);
  }
  .ids-inspect-dl > div:last-child { border-bottom: 0; }
  .ids-inspect-dl dt { color: var(--color-fg-faint); text-transform: lowercase; }
  .ids-inspect-dl dd { color: var(--color-fg); word-break: break-all; }

  @media (max-width: 800px) {
    .ids-row { grid-template-columns: 1fr; }
  }
`;
