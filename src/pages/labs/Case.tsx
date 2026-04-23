import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

function words(s: string): string[] {
  // split on whitespace + punctuation, and camelCase boundaries
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
}

const TITLE_STOPWORDS = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'if', 'in', 'nor', 'of', 'on', 'or', 'so', 'the', 'to', 'up', 'yet']);

type Conv = { id: string; label: string; note: string; fn: (s: string) => string };

const CONVERSIONS: Conv[] = [
  { id: 'camel', label: 'camelCase', note: 'js identifiers', fn: (s) => {
    const w = words(s);
    if (w.length === 0) return '';
    return w[0].toLowerCase() + w.slice(1).map((x) => x[0].toUpperCase() + x.slice(1).toLowerCase()).join('');
  }},
  { id: 'pascal', label: 'PascalCase', note: 'classes, components', fn: (s) => words(s).map((x) => x[0].toUpperCase() + x.slice(1).toLowerCase()).join('') },
  { id: 'snake', label: 'snake_case', note: 'python, db fields', fn: (s) => words(s).map((x) => x.toLowerCase()).join('_') },
  { id: 'screaming', label: 'SCREAMING_SNAKE_CASE', note: 'constants, env vars', fn: (s) => words(s).map((x) => x.toUpperCase()).join('_') },
  { id: 'kebab', label: 'kebab-case', note: 'urls, css', fn: (s) => words(s).map((x) => x.toLowerCase()).join('-') },
  { id: 'train', label: 'Train-Case', note: 'http headers', fn: (s) => words(s).map((x) => x[0].toUpperCase() + x.slice(1).toLowerCase()).join('-') },
  { id: 'dot', label: 'dot.case', note: 'ns identifiers', fn: (s) => words(s).map((x) => x.toLowerCase()).join('.') },
  { id: 'path', label: 'path/case', note: 'urls, paths', fn: (s) => words(s).map((x) => x.toLowerCase()).join('/') },
  { id: 'sentence', label: 'Sentence case', note: 'prose', fn: (s) => {
    const w = words(s).map((x) => x.toLowerCase());
    if (w.length === 0) return '';
    w[0] = w[0][0].toUpperCase() + w[0].slice(1);
    return w.join(' ');
  }},
  { id: 'title', label: 'Title Case', note: 'headlines', fn: (s) => {
    const w = words(s);
    return w.map((x, i) => {
      const low = x.toLowerCase();
      if (i > 0 && TITLE_STOPWORDS.has(low)) return low;
      return low[0].toUpperCase() + low.slice(1);
    }).join(' ');
  }},
  { id: 'upper', label: 'UPPERCASE', note: 'yelling', fn: (s) => s.toUpperCase() },
  { id: 'lower', label: 'lowercase', note: 'default', fn: (s) => s.toLowerCase() },
  { id: 'swap', label: 'sWaP cAsE', note: 'invert each letter', fn: (s) => {
    let out = '';
    for (const ch of s) {
      const u = ch.toUpperCase(), l = ch.toLowerCase();
      out += ch === u ? l : ch === l ? u : ch;
    }
    return out;
  }},
  { id: 'mock', label: 'sPoNgEcAsE', note: 'alternating', fn: (s) => {
    let out = '', i = 0;
    for (const ch of s) {
      if (/[a-z]/i.test(ch)) {
        out += i % 2 === 0 ? ch.toLowerCase() : ch.toUpperCase();
        i++;
      } else out += ch;
    }
    return out;
  }},
  { id: 'inverse', label: 'INVERSE case', note: 'lowercase → upper, vice versa', fn: (s) => {
    let out = '';
    for (const ch of s) {
      if (/[a-z]/.test(ch)) out += ch.toUpperCase();
      else if (/[A-Z]/.test(ch)) out += ch.toLowerCase();
      else out += ch;
    }
    return out;
  }},
  { id: 'reversed', label: 'reversed', note: 'flip the whole string', fn: (s) => [...s].reverse().join('') },
];

export default function CasePage() {
  const [input, setInput] = useState('hello world from a case converter');
  const results = useMemo(() => CONVERSIONS.map((c) => ({ ...c, value: c.fn(input) })), [input]);

  const copy = (v: string) => { try { navigator.clipboard.writeText(v); } catch { /* noop */ } };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-case">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">case</span>
        </div>

        <header className="case-hd">
          <h1>case<span className="dot">.</span></h1>
          <p className="sub">
            paste anything — get every case style at once. camel, pascal, snake, screaming, kebab,
            train, dot, path, sentence, title (with stopwords), spongecase, and the usual suspects.
          </p>
        </header>

        <textarea
          className="case-ta"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          placeholder="type anything…"
          spellCheck={false}
        />

        <section className="case-list">
          {results.map((r) => (
            <button
              key={r.id}
              className="case-row"
              onClick={() => copy(r.value)}
              title="click to copy"
            >
              <span className="case-k">{r.label}</span>
              <span className="case-v">{r.value || <span className="t-faint">(empty)</span>}</span>
              <span className="case-note">{r.note}</span>
            </button>
          ))}
        </section>
      </main>
    </>
  );
}

const CSS = `
  .shell-case { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .case-hd { padding: 48px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .case-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.9;
  }
  .case-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .case-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 60ch; margin-top: var(--sp-3); }

  .case-ta {
    width: 100%;
    margin: var(--sp-5) 0 var(--sp-4);
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
  .case-ta:focus { border-color: var(--color-accent-dim); }

  .case-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-bottom: var(--sp-10);
  }
  .case-row {
    display: grid;
    grid-template-columns: 190px 1fr 160px;
    gap: var(--sp-3);
    align-items: baseline;
    padding: 8px var(--sp-3);
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    text-align: left;
    cursor: pointer;
    color: inherit;
    transition: border-color 0.1s;
    width: 100%;
  }
  .case-row:hover { border-color: var(--color-accent-dim); background: color-mix(in oklch, var(--color-accent) 3%, var(--color-bg-panel)); }
  .case-k {
    color: var(--color-accent);
    text-transform: none;
  }
  .case-v {
    color: var(--color-fg);
    word-break: break-word;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .case-note {
    color: var(--color-fg-faint);
    font-size: var(--fs-xs);
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .t-faint { color: var(--color-fg-faint); font-style: italic; }

  @media (max-width: 700px) {
    .case-row { grid-template-columns: 1fr; gap: 2px; }
    .case-note { text-align: left; }
  }
`;
