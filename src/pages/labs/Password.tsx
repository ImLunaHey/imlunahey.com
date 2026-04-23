import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

const SETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()_-+=[]{}<>?/,.~',
};

type Opts = {
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  avoidSimilar: boolean;
};

const SIMILAR = new Set('0O1lI|`\'"'.split(''));

function buildAlphabet(o: Opts): string {
  let abc = '';
  if (o.lower) abc += SETS.lower;
  if (o.upper) abc += SETS.upper;
  if (o.digits) abc += SETS.digits;
  if (o.symbols) abc += SETS.symbols;
  if (o.avoidSimilar) abc = [...abc].filter((c) => !SIMILAR.has(c)).join('');
  return abc;
}

function gen(o: Opts): string {
  const abc = buildAlphabet(o);
  if (!abc) return '';
  const buf = new Uint32Array(o.length);
  crypto.getRandomValues(buf);
  let out = '';
  for (let i = 0; i < o.length; i++) out += abc[buf[i] % abc.length];
  return out;
}

function entropy(o: Opts): number {
  const abc = buildAlphabet(o);
  if (!abc) return 0;
  return Math.log2(abc.length) * o.length;
}

function strengthLabel(bits: number): { label: string; kind: 'weak' | 'ok' | 'strong' | 'insane' } {
  if (bits < 40) return { label: 'weak', kind: 'weak' };
  if (bits < 60) return { label: 'ok', kind: 'ok' };
  if (bits < 100) return { label: 'strong', kind: 'strong' };
  return { label: 'insane', kind: 'insane' };
}

export default function PasswordPage() {
  const [opts, setOpts] = useState<Opts>({
    length: 24,
    lower: true,
    upper: true,
    digits: true,
    symbols: true,
    avoidSimilar: false,
  });
  const [count, setCount] = useState(5);
  const [list, setList] = useState<string[]>([]);
  const [tick, setTick] = useState(0);

  const bits = useMemo(() => entropy(opts), [opts]);
  const strength = strengthLabel(bits);

  useEffect(() => {
    setList(Array.from({ length: count }, () => gen(opts)));
  }, [opts, count, tick]);

  const set = <K extends keyof Opts>(k: K, v: Opts[K]) => setOpts((o) => ({ ...o, [k]: v }));
  const copy = (s: string) => { try { navigator.clipboard.writeText(s); } catch { /* noop */ } };
  const copyAll = () => copy(list.join('\n'));
  const noAbc = !buildAlphabet(opts);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-pw">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">password</span>
        </div>

        <header className="pw-hd">
          <h1>password<span className="dot">.</span></h1>
          <p className="sub">
            generate passwords in your browser — every byte from <code>crypto.getRandomValues</code>.
            entropy is computed from the alphabet size × length so you can eyeball strength. nothing
            is sent anywhere.
          </p>
        </header>

        <section className="pw-opts">
          <div className="pw-row">
            <label className="pw-lbl">length</label>
            <input
              type="range" min={6} max={128} step={1}
              value={opts.length}
              onChange={(e) => set('length', Number(e.target.value))}
              className="pw-slider"
            />
            <span className="pw-val">{opts.length}</span>
          </div>

          <div className="pw-row">
            <label className="pw-lbl">count</label>
            <input
              type="range" min={1} max={30} step={1}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="pw-slider"
            />
            <span className="pw-val">{count}</span>
          </div>

          <div className="pw-checks">
            <Check label="lowercase (a-z)" value={opts.lower} on={(v) => set('lower', v)} />
            <Check label="uppercase (A-Z)" value={opts.upper} on={(v) => set('upper', v)} />
            <Check label="digits (0-9)" value={opts.digits} on={(v) => set('digits', v)} />
            <Check label="symbols (!@#…)" value={opts.symbols} on={(v) => set('symbols', v)} />
            <Check label="avoid look-alikes (0/O, 1/l/I, |/')" value={opts.avoidSimilar} on={(v) => set('avoidSimilar', v)} />
          </div>

          <div className="pw-meter-row">
            <div className="pw-meter-lbl">
              entropy · <b>{bits.toFixed(1)}</b> bits ·{' '}
              <span className={`pw-strength pw-s-${strength.kind}`}>{strength.label}</span>
            </div>
            <div className="pw-meter">
              <div
                className={`pw-meter-fill pw-s-${strength.kind}`}
                style={{ width: `${Math.min(100, bits)}%` }}
              />
            </div>
          </div>

          <div className="pw-actions">
            <button className="pw-btn primary" onClick={() => setTick((t) => t + 1)} disabled={noAbc}>↻ regenerate</button>
            <button className="pw-btn" onClick={copyAll} disabled={noAbc || list.length === 0}>copy all</button>
          </div>
        </section>

        {noAbc ? (
          <div className="pw-err">pick at least one character class above</div>
        ) : (
          <section className="pw-list">
            {list.map((p, i) => (
              <button key={i} className="pw-item" onClick={() => copy(p)} title="click to copy">
                <span className="pw-idx">{String(i + 1).padStart(2, ' ')}</span>
                <code className="pw-val">{renderPassword(p)}</code>
              </button>
            ))}
          </section>
        )}
      </main>
    </>
  );
}

function renderPassword(s: string) {
  // colour each char class differently so the password is easier to scan
  return [...s].map((c, i) => {
    let cls = 'c-other';
    if (/[a-z]/.test(c)) cls = 'c-lower';
    else if (/[A-Z]/.test(c)) cls = 'c-upper';
    else if (/[0-9]/.test(c)) cls = 'c-digit';
    else cls = 'c-sym';
    return <span key={i} className={cls}>{c}</span>;
  });
}

function Check({ label, value, on }: { label: string; value: boolean; on: (v: boolean) => void }) {
  return (
    <label className="pw-check">
      <input type="checkbox" checked={value} onChange={(e) => on(e.target.checked)} />
      {label}
    </label>
  );
}

const CSS = `
  .shell-pw { max-width: 1080px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .pw-hd { padding: 48px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .pw-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.9;
  }
  .pw-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .pw-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 62ch; margin-top: var(--sp-3); }
  .pw-hd code { font-family: var(--font-mono); color: var(--color-accent); }

  .pw-opts {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: var(--sp-4);
    margin: var(--sp-4) 0;
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  .pw-row {
    display: grid;
    grid-template-columns: 80px 1fr 60px;
    gap: var(--sp-3);
    align-items: center;
  }
  .pw-lbl {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    text-transform: lowercase;
    letter-spacing: 0.05em;
  }
  .pw-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 4px;
    background: var(--color-border-bright);
    outline: 0;
    cursor: pointer;
  }
  .pw-slider::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none;
    width: 14px; height: 14px;
    background: var(--color-accent);
    border-radius: 50%;
    box-shadow: 0 0 6px var(--accent-glow);
    cursor: pointer;
  }
  .pw-slider::-moz-range-thumb {
    width: 14px; height: 14px;
    background: var(--color-accent);
    border-radius: 50%;
    border: 0;
  }
  .pw-val {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--color-accent);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .pw-checks {
    display: flex; flex-wrap: wrap; gap: var(--sp-3);
  }
  .pw-check {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-dim);
    cursor: pointer;
  }
  .pw-check input { accent-color: var(--color-accent); }

  .pw-meter-row { margin-top: var(--sp-2); }
  .pw-meter-lbl {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    margin-bottom: 4px;
  }
  .pw-meter-lbl b { color: var(--color-fg); font-weight: 400; }
  .pw-strength {
    display: inline-block;
    padding: 0 6px;
    margin-left: 4px;
    border: 1px solid currentColor;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .pw-s-weak { color: var(--color-alert); border-color: var(--color-alert-dim); }
  .pw-s-ok { color: var(--color-warn); border-color: color-mix(in oklch, var(--color-warn) 40%, var(--color-border)); }
  .pw-s-strong { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .pw-s-insane { color: #ff44aa; border-color: color-mix(in srgb, #ff44aa 40%, var(--color-border)); }

  .pw-meter {
    height: 10px;
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    overflow: hidden;
  }
  .pw-meter-fill {
    height: 100%;
    transition: width 0.3s, background 0.2s;
  }
  .pw-meter-fill.pw-s-weak { background: var(--color-alert); }
  .pw-meter-fill.pw-s-ok { background: var(--color-warn); }
  .pw-meter-fill.pw-s-strong { background: var(--color-accent); box-shadow: 0 0 10px var(--accent-glow); }
  .pw-meter-fill.pw-s-insane {
    background: linear-gradient(to right, var(--color-accent), #ff44aa);
    box-shadow: 0 0 12px color-mix(in srgb, #ff44aa 50%, transparent);
  }

  .pw-actions { display: flex; gap: var(--sp-2); margin-top: 4px; }
  .pw-btn {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    background: transparent;
    color: var(--color-fg-dim);
    border: 1px solid var(--color-border-bright);
    padding: 6px 12px;
    cursor: pointer;
    text-transform: lowercase;
  }
  .pw-btn:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .pw-btn.primary { background: var(--color-accent); color: #000; border-color: var(--color-accent); }
  .pw-btn.primary:hover { filter: brightness(1.1); }
  .pw-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .pw-err {
    padding: var(--sp-3);
    color: var(--color-alert);
    font-family: var(--font-mono); font-size: var(--fs-sm);
    border: 1px dashed var(--color-alert-dim);
  }

  .pw-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-bottom: var(--sp-10);
  }
  .pw-item {
    display: grid;
    grid-template-columns: 32px 1fr;
    gap: var(--sp-3);
    align-items: baseline;
    padding: 6px var(--sp-3);
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    cursor: pointer;
    text-align: left;
    font-family: var(--font-mono);
    transition: border-color 0.1s;
  }
  .pw-item:hover { border-color: var(--color-accent-dim); }
  .pw-idx { color: var(--color-fg-faint); font-size: var(--fs-xs); }
  .pw-val { font-size: var(--fs-md); color: var(--color-fg); word-break: break-all; }
  .pw-val .c-lower { color: var(--color-fg); }
  .pw-val .c-upper { color: var(--color-accent); }
  .pw-val .c-digit { color: #7cd3f7; }
  .pw-val .c-sym { color: var(--color-warn); }
`;
