import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

type Grapheme = {
  text: string;
  start: number;
  end: number;
  codepoints: number[];
  bytes: number;
};

function countBytes(s: string): number {
  return new TextEncoder().encode(s).length;
}

// Abbreviated block lookup — enough for visual flavor
const BLOCKS: Array<{ from: number; to: number; name: string }> = [
  { from: 0x0000, to: 0x007f, name: 'basic latin' },
  { from: 0x0080, to: 0x00ff, name: 'latin-1 supplement' },
  { from: 0x0100, to: 0x017f, name: 'latin extended-a' },
  { from: 0x0180, to: 0x024f, name: 'latin extended-b' },
  { from: 0x0370, to: 0x03ff, name: 'greek' },
  { from: 0x0400, to: 0x04ff, name: 'cyrillic' },
  { from: 0x0590, to: 0x05ff, name: 'hebrew' },
  { from: 0x0600, to: 0x06ff, name: 'arabic' },
  { from: 0x0900, to: 0x097f, name: 'devanagari' },
  { from: 0x2000, to: 0x206f, name: 'general punctuation' },
  { from: 0x2070, to: 0x209f, name: 'super/subscripts' },
  { from: 0x20a0, to: 0x20cf, name: 'currency symbols' },
  { from: 0x2190, to: 0x21ff, name: 'arrows' },
  { from: 0x2200, to: 0x22ff, name: 'mathematical operators' },
  { from: 0x2500, to: 0x257f, name: 'box drawing' },
  { from: 0x25a0, to: 0x25ff, name: 'geometric shapes' },
  { from: 0x2600, to: 0x26ff, name: 'misc symbols' },
  { from: 0x2700, to: 0x27bf, name: 'dingbats' },
  { from: 0x3000, to: 0x303f, name: 'cjk symbols/punctuation' },
  { from: 0x3040, to: 0x309f, name: 'hiragana' },
  { from: 0x30a0, to: 0x30ff, name: 'katakana' },
  { from: 0x4e00, to: 0x9fff, name: 'cjk unified ideographs' },
  { from: 0xac00, to: 0xd7af, name: 'hangul syllables' },
  { from: 0xd800, to: 0xdfff, name: 'surrogate (bmp)' },
  { from: 0xe000, to: 0xf8ff, name: 'private use' },
  { from: 0xfe00, to: 0xfe0f, name: 'variation selectors' },
  { from: 0x1f000, to: 0x1f02f, name: 'mahjong tiles' },
  { from: 0x1f300, to: 0x1f5ff, name: 'misc symbols & pictographs' },
  { from: 0x1f600, to: 0x1f64f, name: 'emoticons' },
  { from: 0x1f680, to: 0x1f6ff, name: 'transport & map' },
  { from: 0x1f900, to: 0x1f9ff, name: 'supplemental symbols/pictographs' },
  { from: 0x1fa70, to: 0x1faff, name: 'symbols extended-a' },
  { from: 0xe0000, to: 0xe007f, name: 'tag characters' },
  { from: 0xe0100, to: 0xe01ef, name: 'variation selectors supplement' },
];

function blockName(cp: number): string {
  for (const b of BLOCKS) if (cp >= b.from && cp <= b.to) return b.name;
  if (cp >= 0x10000) return 'supplementary';
  return 'basic multilingual';
}

function isCombining(cp: number): boolean {
  // combining marks + variation selectors + zero-width joiner + zero-width non-joiner
  if (cp >= 0x0300 && cp <= 0x036f) return true;
  if (cp >= 0xfe00 && cp <= 0xfe0f) return true;
  if (cp >= 0xe0100 && cp <= 0xe01ef) return true;
  if (cp === 0x200d || cp === 0x200c) return true;
  return false;
}

function segment(text: string): Grapheme[] {
  const out: Grapheme[] = [];
  if (!text) return out;
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    try {
      const seg = new Intl.Segmenter('en', { granularity: 'grapheme' });
      for (const s of seg.segment(text)) {
        const cps: number[] = [];
        for (const ch of s.segment) cps.push(ch.codePointAt(0)!);
        out.push({
          text: s.segment,
          start: s.index,
          end: s.index + s.segment.length,
          codepoints: cps,
          bytes: countBytes(s.segment),
        });
      }
      return out;
    } catch { /* fall through */ }
  }
  let i = 0;
  for (const ch of text) {
    out.push({
      text: ch,
      start: i,
      end: i + ch.length,
      codepoints: [ch.codePointAt(0)!],
      bytes: countBytes(ch),
    });
    i += ch.length;
  }
  return out;
}

function hex(n: number): string {
  return 'U+' + n.toString(16).toUpperCase().padStart(4, '0');
}

const DEFAULT_SAMPLE = `Pokémon 🦁‍⬛ — café · 한글 · 你好 · العربية`;

export default function UnicodePage() {
  const [text, setText] = useState(DEFAULT_SAMPLE);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const graphemes = useMemo(() => segment(text), [text]);
  const bytes = useMemo(() => countBytes(text), [text]);
  const chars = text.length;

  const normalForms = useMemo(() => {
    try {
      return {
        nfc: text.normalize('NFC'),
        nfd: text.normalize('NFD'),
        nfkc: text.normalize('NFKC'),
        nfkd: text.normalize('NFKD'),
      };
    } catch {
      return null;
    }
  }, [text]);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-un">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">unicode</span>
        </div>

        <header className="un-hd">
          <h1>unicode<span className="dot">.</span></h1>
          <p className="sub">
            paste anything: see grapheme segmentation, codepoints, utf-8 byte lengths, and all four
            normalization forms. reveals the gap between "what i typed" and "what the computer sees".
          </p>
        </header>

        <textarea
          className="un-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          spellCheck={false}
          placeholder="type or paste any text…"
        />

        <section className="un-summary">
          <Stat label="graphemes" value={graphemes.length} note="what you read as 'characters'" />
          <Stat label="chars" value={chars} note="js string .length (utf-16 units)" />
          <Stat
            label="codepoints"
            value={graphemes.reduce((s, g) => s + g.codepoints.length, 0)}
          />
          <Stat label="utf-8 bytes" value={bytes} />
          <Stat label="ascii safe" value={/^[\x20-\x7e\s]*$/.test(text) ? 'yes' : 'no'} />
        </section>

        <section className="un-grid">
          {graphemes.map((g, i) => (
            <GraphemeCell
              key={`${g.start}-${i}`}
              g={g}
              hovered={hoverIdx === i}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            />
          ))}
          {graphemes.length === 0 ? <div className="un-empty">type something ↑</div> : null}
        </section>

        {normalForms ? (
          <section className="un-norms">
            <div className="un-norms-hd">── normalization forms</div>
            <NormRow name="NFC" value={normalForms.nfc} base={text} desc="canonical composition" />
            <NormRow name="NFD" value={normalForms.nfd} base={text} desc="canonical decomposition" />
            <NormRow name="NFKC" value={normalForms.nfkc} base={text} desc="compatibility composition" />
            <NormRow name="NFKD" value={normalForms.nfkd} base={text} desc="compatibility decomposition" />
          </section>
        ) : null}
      </main>
    </>
  );
}

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="un-stat">
      <div className="un-stat-lbl">{label}</div>
      <div className="un-stat-val">{value}</div>
      {note ? <div className="un-stat-note">{note}</div> : null}
    </div>
  );
}

function GraphemeCell({
  g, hovered, onMouseEnter, onMouseLeave,
}: {
  g: Grapheme;
  hovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const primary = g.codepoints[0];
  const block = blockName(primary);
  const multi = g.codepoints.length > 1;
  const visible = g.text === ' ' ? '·' : g.text === '\n' ? '⏎' : g.text === '\t' ? '⇥' : g.text;
  return (
    <div
      className={`un-cell ${multi ? 'multi' : ''} ${hovered ? 'hov' : ''}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      title={`${g.codepoints.map(hex).join(' + ')} · ${block} · ${g.bytes} bytes`}
    >
      <div className="un-cell-glyph">{visible}</div>
      <div className="un-cell-cp">
        {g.codepoints.map((cp) => (
          <span key={cp} className={`un-cell-cp-item ${isCombining(cp) ? 'comb' : ''}`}>{hex(cp)}</span>
        ))}
      </div>
      <div className="un-cell-meta">
        <span className="un-cell-block">{block}</span>
        <span className="un-cell-bytes">{g.bytes}b</span>
      </div>
      {multi ? <span className="un-cell-cluster" title="this grapheme is composed of multiple codepoints">⚭ {g.codepoints.length}</span> : null}
    </div>
  );
}

function NormRow({ name, value, base, desc }: { name: string; value: string; base: string; desc: string }) {
  const same = value === base;
  return (
    <div className="un-norm-row">
      <div className="un-norm-name">
        <b>{name}</b>
        <span className="un-norm-desc">{desc}</span>
      </div>
      <div className="un-norm-vals">
        <code className="un-norm-val">{value || '∅'}</code>
        <div className="un-norm-diff">
          <span>{countBytes(value)} bytes</span>
          <span className={same ? 'same' : 'diff'}>{same ? '= input' : '≠ input'}</span>
        </div>
      </div>
    </div>
  );
}

const CSS = `
  .shell-un { max-width: 1200px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .un-hd { padding: 48px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .un-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.9;
  }
  .un-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .un-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 64ch; margin-top: var(--sp-3); }

  .un-input {
    width: 100%;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    color: var(--color-fg);
    padding: var(--sp-3);
    margin-top: var(--sp-5);
    font-family: var(--font-mono); font-size: var(--fs-md);
    resize: vertical;
    outline: 0;
    line-height: 1.5;
  }
  .un-input:focus { border-color: var(--color-accent-dim); }

  .un-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: var(--sp-3);
    padding: var(--sp-4) 0;
    border-bottom: 1px solid var(--color-border);
  }
  .un-stat {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: var(--sp-3);
  }
  .un-stat-lbl {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    text-transform: lowercase;
    letter-spacing: 0.05em;
  }
  .un-stat-val {
    font-family: var(--font-display);
    font-size: var(--fs-2xl);
    font-weight: 500;
    color: var(--color-accent);
    line-height: 1.1;
    margin-top: 4px;
    font-variant-numeric: tabular-nums;
  }
  .un-stat-note {
    margin-top: 4px;
    font-family: var(--font-mono); font-size: 10px;
    color: var(--color-fg-faint);
  }

  .un-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 6px;
    padding: var(--sp-4) 0;
  }
  .un-empty {
    grid-column: 1 / -1;
    padding: var(--sp-8);
    text-align: center;
    color: var(--color-fg-faint);
    font-family: var(--font-mono); font-size: var(--fs-sm);
    border: 1px dashed var(--color-border);
  }

  .un-cell {
    position: relative;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: var(--sp-2);
    display: flex; flex-direction: column; gap: 4px;
    font-family: var(--font-mono);
    transition: border-color 0.1s;
  }
  .un-cell:hover, .un-cell.hov {
    border-color: var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 4%, var(--color-bg-panel));
  }
  .un-cell.multi {
    border-color: color-mix(in oklch, var(--color-warn) 35%, var(--color-border));
  }
  .un-cell-glyph {
    font-size: 28px;
    line-height: 1.1;
    color: var(--color-fg);
    min-height: 38px;
    text-align: center;
    padding: 4px 0;
    font-family: -apple-system, 'Segoe UI Emoji', 'Noto Color Emoji', ui-sans-serif, system-ui;
  }
  .un-cell-cp {
    display: flex; flex-wrap: wrap; gap: 2px;
    justify-content: center;
  }
  .un-cell-cp-item {
    font-size: 10px;
    color: var(--color-accent);
    background: color-mix(in oklch, var(--color-accent) 6%, transparent);
    border: 1px solid var(--color-accent-dim);
    padding: 0 4px;
    letter-spacing: 0.02em;
  }
  .un-cell-cp-item.comb {
    color: var(--color-warn);
    background: color-mix(in oklch, var(--color-warn) 8%, transparent);
    border-color: color-mix(in oklch, var(--color-warn) 40%, var(--color-border));
  }
  .un-cell-meta {
    display: flex; justify-content: space-between;
    font-size: 9px;
    color: var(--color-fg-faint);
    margin-top: auto;
  }
  .un-cell-block { text-transform: lowercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
  .un-cell-bytes { flex-shrink: 0; }
  .un-cell-cluster {
    position: absolute;
    top: 3px; right: 5px;
    font-size: 9px;
    color: var(--color-warn);
  }

  .un-norms {
    padding: var(--sp-4) 0 var(--sp-10);
    border-top: 1px solid var(--color-border);
  }
  .un-norms-hd {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    margin-bottom: var(--sp-3);
  }
  .un-norm-row {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: var(--sp-3);
    padding: var(--sp-3) 0;
    border-bottom: 1px solid var(--color-border);
  }
  .un-norm-row:last-child { border-bottom: 0; }
  .un-norm-name { font-family: var(--font-mono); }
  .un-norm-name b { color: var(--color-accent); font-weight: 400; font-size: var(--fs-md); }
  .un-norm-desc {
    display: block;
    font-size: 10px;
    color: var(--color-fg-faint);
    margin-top: 2px;
  }
  .un-norm-val {
    display: block;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: var(--sp-2) var(--sp-3);
    font-family: var(--font-mono); font-size: var(--fs-sm);
    color: var(--color-fg);
    word-break: break-word;
    white-space: pre-wrap;
  }
  .un-norm-diff {
    display: flex; justify-content: space-between;
    margin-top: 4px;
    font-family: var(--font-mono); font-size: 10px;
    color: var(--color-fg-faint);
  }
  .un-norm-diff .same { color: var(--color-fg-faint); }
  .un-norm-diff .diff { color: var(--color-warn); }

  @media (max-width: 600px) {
    .un-norm-row { grid-template-columns: 1fr; }
  }
`;
