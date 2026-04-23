import { Link } from '@tanstack/react-router';
import { useMemo, useState, type ReactNode } from 'react';

type Match = {
  text: string;
  start: number;
  end: number;
  groups: Array<{ index: number; name?: string; text: string | null; start: number; end: number }>;
};

const FLAGS: { char: string; name: string; desc: string }[] = [
  { char: 'g', name: 'global', desc: 'find all matches' },
  { char: 'i', name: 'ignore case', desc: 'case-insensitive' },
  { char: 'm', name: 'multi-line', desc: '^ and $ match line boundaries' },
  { char: 's', name: 'dot-all', desc: '. matches newlines' },
  { char: 'u', name: 'unicode', desc: 'unicode-aware' },
  { char: 'y', name: 'sticky', desc: 'match at lastIndex only' },
];

const PRESETS: { label: string; pattern: string; flags: string; sample?: string }[] = [
  { label: 'email', pattern: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b', flags: 'g' },
  { label: 'url', pattern: 'https?:\\/\\/[^\\s<>"\'\\)]+', flags: 'g' },
  { label: 'ipv4', pattern: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b', flags: 'g' },
  { label: 'uuid', pattern: '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', flags: 'gi' },
  { label: 'iso date', pattern: '\\d{4}-\\d{2}-\\d{2}(?:T\\d{2}:\\d{2}(?::\\d{2}(?:\\.\\d+)?)?Z?)?', flags: 'g' },
  { label: 'hex color', pattern: '#(?:[0-9a-f]{3}){1,2}\\b', flags: 'gi' },
  { label: 'phone (us)', pattern: '\\+?1?[\\s.-]?\\(?(\\d{3})\\)?[\\s.-]?(\\d{3})[\\s.-]?(\\d{4})', flags: 'g' },
  { label: 'at-uri', pattern: 'at:\\/\\/(did:[a-z]+:[a-zA-Z0-9._:-]+)(?:\\/([a-z0-9.-]+)(?:\\/([a-zA-Z0-9._~-]+))?)?', flags: 'g' },
];

const DEFAULT_SAMPLE = `contact: luna@imlunahey.com or xo@wvvw.me
join us https://bsky.app today — ipv4 192.168.1.1 ipv6 ::1
uuid: 550e8400-e29b-41d4-a716-446655440000
at://did:plc:k6acu4chiwkixvdedcmdgmal/app.bsky.feed.post/3kxyz
born 1990-07-15, died 2026-04-23T14:22:10Z
hex #ff00ff #3a3 phone +1 (555) 123-4567`;

function buildRegex(pattern: string, flags: string): { re: RegExp; err: null } | { re: null; err: string } {
  if (!pattern) return { re: null, err: 'empty pattern' };
  try {
    return { re: new RegExp(pattern, flags), err: null };
  } catch (err) {
    return { re: null, err: err instanceof Error ? err.message : 'invalid regex' };
  }
}

function runRegex(re: RegExp, text: string): Match[] {
  const out: Match[] = [];
  const isGlobal = re.flags.includes('g') || re.flags.includes('y');
  const workRe = isGlobal ? re : new RegExp(re.source, re.flags + 'g');
  let m: RegExpExecArray | null;
  let lastIndex = -1;
  while ((m = workRe.exec(text)) !== null) {
    if (m[0] === '' && workRe.lastIndex === lastIndex) { workRe.lastIndex++; continue; }
    lastIndex = workRe.lastIndex;
    const groups: Match['groups'] = [];
    if (m.indices) {
      for (let i = 1; i < m.length; i++) {
        const idx = m.indices[i];
        groups.push({
          index: i,
          text: m[i] ?? null,
          start: idx?.[0] ?? -1,
          end: idx?.[1] ?? -1,
        });
      }
      if (m.groups && m.indices.groups) {
        for (const name of Object.keys(m.groups)) {
          const idx = m.indices.groups[name];
          const g = groups.find((gg) => gg.start === idx?.[0] && gg.end === idx?.[1]);
          if (g) g.name = name;
        }
      }
    } else {
      for (let i = 1; i < m.length; i++) {
        groups.push({ index: i, text: m[i] ?? null, start: -1, end: -1 });
      }
    }
    out.push({ text: m[0], start: m.index, end: m.index + m[0].length, groups });
    if (!isGlobal) break;
    if (workRe.lastIndex > text.length) break;
  }
  return out;
}

function highlight(text: string, matches: Match[], hoverIdx: number | null): ReactNode[] {
  if (matches.length === 0) return [<span key="0">{text}</span>];
  const parts: ReactNode[] = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (m.start > cursor) parts.push(<span key={`t${i}`}>{text.slice(cursor, m.start)}</span>);
    parts.push(
      <mark key={`m${i}`} className={`rx-match ${hoverIdx === i ? 'hov' : ''}`} data-idx={i}>
        {m.text}
      </mark>,
    );
    cursor = m.end;
  });
  if (cursor < text.length) parts.push(<span key="tail">{text.slice(cursor)}</span>);
  return parts;
}

export default function RegexPage() {
  const [pattern, setPattern] = useState('\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b');
  const [flags, setFlags] = useState('g');
  const [text, setText] = useState(DEFAULT_SAMPLE);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const built = useMemo(() => buildRegex(pattern, flags), [pattern, flags]);
  const matches = useMemo(
    () => (built.re ? runRegex(built.re, text) : []),
    [built.re, text],
  );

  const toggleFlag = (f: string) => {
    setFlags((cur) => (cur.includes(f) ? cur.replace(f, '') : cur + f));
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-rx">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">regex</span>
        </div>

        <header className="rx-hd">
          <h1>regex<span className="dot">.</span></h1>
          <p className="sub">
            live regex tester. highlights every match in your text, lists capture groups, previews
            flag semantics. uses the browser's javascript engine — ecmascript dialect.
          </p>
        </header>

        <section className="rx-presets">
          <span className="rx-presets-lbl">presets</span>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              className="rx-preset"
              onClick={() => { setPattern(p.pattern); setFlags(p.flags); if (p.sample) setText(p.sample); }}
            >{p.label}</button>
          ))}
        </section>

        <section className="rx-pattern">
          <div className="rx-pattern-row">
            <span className="rx-slash">/</span>
            <input
              className={`rx-input ${built.err ? 'err' : ''}`}
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="your pattern…"
              spellCheck={false}
              autoComplete="off"
            />
            <span className="rx-slash">/</span>
            <input
              className="rx-flags"
              value={flags}
              onChange={(e) => setFlags(e.target.value.replace(/[^gimsuy]/g, ''))}
              placeholder="gi"
              spellCheck={false}
              autoComplete="off"
              maxLength={6}
            />
          </div>
          <div className="rx-flag-row">
            {FLAGS.map((f) => (
              <button
                key={f.char}
                className={`rx-flag-chip ${flags.includes(f.char) ? 'on' : ''}`}
                onClick={() => toggleFlag(f.char)}
                title={f.desc}
              >
                <span className="rx-flag-char">{f.char}</span>
                <span className="rx-flag-name">{f.name}</span>
              </button>
            ))}
          </div>
          {built.err ? <div className="rx-err">✗ {built.err}</div> : null}
        </section>

        <section className="rx-two">
          <div className="rx-col">
            <div className="rx-col-hd">
              <span>── text</span>
              <span className="rx-col-ct">
                {matches.length} match{matches.length === 1 ? '' : 'es'}
              </span>
            </div>
            <div
              className="rx-text-wrap"
              onClick={() => { /* keep focus on textarea */ }}
            >
              <pre className="rx-highlight" aria-hidden>
                {highlight(text, matches, hoverIdx)}
                {text.endsWith('\n') ? '\n' : null}
              </pre>
              <textarea
                className="rx-textarea"
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="rx-col">
            <div className="rx-col-hd">
              <span>── matches</span>
              <span className="rx-col-ct">
                {matches.reduce((s, m) => s + m.groups.length, 0)} group{matches.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="rx-matches">
              {matches.length === 0 ? (
                <div className="rx-empty">{built.err ? 'fix the pattern above' : 'no matches'}</div>
              ) : (
                matches.map((m, i) => (
                  <article
                    key={`${m.start}-${i}`}
                    className={`rx-m ${hoverIdx === i ? 'hov' : ''}`}
                    onMouseEnter={() => setHoverIdx(i)}
                    onMouseLeave={() => setHoverIdx(null)}
                  >
                    <header className="rx-m-hd">
                      <span className="rx-m-idx">{String(i + 1).padStart(2, ' ')}</span>
                      <span className="rx-m-range">[{m.start}..{m.end}]</span>
                    </header>
                    <div className="rx-m-text">{m.text}</div>
                    {m.groups.length > 0 ? (
                      <ol className="rx-m-groups">
                        {m.groups.map((g) => (
                          <li key={g.index} className="rx-m-group">
                            <span className="rx-m-group-k">
                              ${g.index}{g.name ? ` (${g.name})` : ''}
                            </span>
                            <span className="rx-m-group-v">{g.text === null ? <em className="t-faint">undefined</em> : g.text}</span>
                          </li>
                        ))}
                      </ol>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

const CSS = `
  .shell-rx { max-width: 1200px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .rx-hd { padding: 48px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .rx-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.9;
  }
  .rx-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .rx-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 58ch; margin-top: var(--sp-3); }

  .rx-presets {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    margin: var(--sp-5) 0 var(--sp-3);
    font-family: var(--font-mono); font-size: var(--fs-xs);
  }
  .rx-presets-lbl {
    color: var(--color-fg-faint);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .rx-preset {
    background: transparent; color: var(--color-fg-dim);
    border: 1px solid var(--color-border); padding: 2px 8px;
    cursor: pointer; font-family: inherit; font-size: inherit;
    text-transform: lowercase;
  }
  .rx-preset:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }

  .rx-pattern {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: var(--sp-3);
    margin-bottom: var(--sp-4);
  }
  .rx-pattern-row {
    display: flex; align-items: center; gap: var(--sp-1);
    font-family: var(--font-mono);
    font-size: var(--fs-md);
  }
  .rx-slash { color: var(--color-fg-faint); font-size: var(--fs-lg); }
  .rx-input {
    flex: 1;
    background: var(--color-bg-raised);
    color: var(--color-accent);
    border: 1px solid var(--color-border);
    padding: 6px 10px;
    font-family: var(--font-mono);
    font-size: var(--fs-md);
    outline: 0;
    min-width: 0;
  }
  .rx-input:focus { border-color: var(--color-accent-dim); }
  .rx-input.err {
    color: var(--color-alert);
    border-color: var(--color-alert-dim);
  }
  .rx-flags {
    width: 80px;
    background: var(--color-bg-raised);
    color: var(--color-warn);
    border: 1px solid var(--color-border);
    padding: 6px 10px;
    font-family: var(--font-mono);
    font-size: var(--fs-md);
    outline: 0;
    text-align: center;
  }

  .rx-flag-row {
    display: flex; gap: 6px; flex-wrap: wrap;
    margin-top: var(--sp-2);
  }
  .rx-flag-chip {
    display: inline-flex; align-items: center; gap: 6px;
    background: transparent;
    border: 1px solid var(--color-border);
    padding: 2px 8px;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .rx-flag-chip:hover { border-color: var(--color-border-bright); color: var(--color-fg-dim); }
  .rx-flag-chip.on {
    color: var(--color-warn);
    border-color: color-mix(in oklch, var(--color-warn) 40%, var(--color-border));
    background: color-mix(in oklch, var(--color-warn) 6%, transparent);
  }
  .rx-flag-char { font-weight: 600; }
  .rx-flag-name { opacity: 0.7; }

  .rx-err {
    margin-top: var(--sp-3);
    padding: var(--sp-2) var(--sp-3);
    color: var(--color-alert);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    border: 1px solid var(--color-alert-dim);
    background: color-mix(in srgb, var(--color-alert) 5%, transparent);
  }

  .rx-two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-4);
    padding-bottom: var(--sp-10);
  }
  .rx-col-hd {
    display: flex; justify-content: space-between;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    margin-bottom: var(--sp-2);
  }
  .rx-col-ct { color: var(--color-accent-dim); }

  .rx-text-wrap {
    position: relative;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    min-height: 360px;
    overflow: hidden;
  }
  .rx-highlight, .rx-textarea {
    position: absolute;
    inset: 0;
    padding: var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    line-height: 1.5;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: break-word;
    overflow: auto;
    margin: 0;
    box-sizing: border-box;
  }
  .rx-highlight {
    color: var(--color-fg);
    pointer-events: none;
    overflow: hidden;
  }
  .rx-textarea {
    color: transparent;
    caret-color: var(--color-fg);
    background: transparent;
    border: 0;
    outline: 0;
    resize: none;
    z-index: 2;
  }
  .rx-match {
    background: color-mix(in oklch, var(--color-warn) 30%, transparent);
    color: var(--color-fg);
    border-radius: 1px;
    padding: 1px 0;
  }
  .rx-match.hov {
    background: var(--color-warn);
    color: #000;
    box-shadow: 0 0 0 2px var(--color-warn);
  }

  .rx-matches {
    max-height: 520px;
    overflow-y: auto;
    display: flex; flex-direction: column; gap: 4px;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: var(--sp-2);
  }
  .rx-m {
    padding: 6px 8px;
    border: 1px solid var(--color-border);
    background: var(--color-bg);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    transition: border-color 0.1s;
  }
  .rx-m.hov { border-color: var(--color-warn); }
  .rx-m-hd {
    display: flex; gap: var(--sp-3);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    margin-bottom: 4px;
  }
  .rx-m-idx { color: var(--color-accent-dim); }
  .rx-m-text {
    background: color-mix(in oklch, var(--color-warn) 15%, transparent);
    padding: 3px 6px;
    color: var(--color-fg);
    word-break: break-all;
    font-size: var(--fs-sm);
  }
  .rx-m-groups {
    list-style: none;
    margin-top: 4px;
    display: flex; flex-direction: column; gap: 2px;
    padding-left: var(--sp-3);
    border-left: 2px solid var(--color-border);
  }
  .rx-m-group {
    display: grid;
    grid-template-columns: 100px 1fr;
    gap: var(--sp-2);
    font-size: var(--fs-xs);
  }
  .rx-m-group-k { color: var(--color-accent); }
  .rx-m-group-v { color: var(--color-fg-dim); word-break: break-all; }

  .rx-empty {
    padding: var(--sp-5);
    text-align: center;
    color: var(--color-fg-faint);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }

  @media (max-width: 800px) {
    .rx-two { grid-template-columns: 1fr; }
    .rx-text-wrap { min-height: 240px; }
  }
`;
