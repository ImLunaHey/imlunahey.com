import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

/**
 * PoetryDB — poetrydb.org — returns poems by author, title, or
 * searching inside lines. Free, no key, CORS-permissive. The corpus
 * is public-domain english-language works, so everything from
 * shakespeare through to dickinson, ~3000 poems total.
 *
 * The appeal here is purely typographic: poems rendered in phosphor
 * mono on a CRT background feels right.
 */

const API = 'https://poetrydb.org';

type Poem = { title: string; author: string; lines: string[]; linecount: string };
type Mode = 'author' | 'title' | 'lines';

async function searchPoems(mode: Mode, q: string): Promise<Poem[]> {
  if (!q.trim()) return [];
  const url = `${API}/${mode}/${encodeURIComponent(q.trim())}`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const j = await r.json();
  if (Array.isArray(j)) return j as Poem[];
  return [];
}

async function randomPoem(): Promise<Poem | null> {
  const r = await fetch(`${API}/random`);
  if (!r.ok) return null;
  const j = await r.json();
  if (Array.isArray(j) && j.length > 0) return j[0] as Poem;
  return null;
}

export default function PoetryPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { q?: string; mode?: string };
  const q = search.q ?? '';
  const mode: Mode = (search.mode === 'title' || search.mode === 'lines' ? search.mode : 'author');
  const [input, setInput] = useState(q);
  useEffect(() => { setInput(q); }, [q]);

  const [poems, setPoems] = useState<Poem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [random, setRandom] = useState<Poem | null>(null);

  useEffect(() => {
    setExpanded(new Set());
    if (!q) { setPoems([]); return; }
    let cancelled = false;
    setLoading(true);
    searchPoems(mode, q).then((p) => {
      if (cancelled) return;
      setPoems(p);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [q, mode]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: '/labs/poetry' as never, search: { q: input.trim() || undefined, mode: mode !== 'author' ? mode : undefined } as never });
  };

  const setMode = (m: Mode) => {
    navigate({ to: '/labs/poetry' as never, search: { q: q || undefined, mode: m !== 'author' ? m : undefined } as never });
  };

  const loadRandom = async () => {
    setRandom(null);
    const p = await randomPoem();
    if (p) setRandom(p);
  };

  const toggle = (i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-poetry">
        <header className="page-hd">
          <div className="label">~/labs/poetry</div>
          <h1>poetry<span className="dot">.</span></h1>
          <p className="sub">
            ~3000 public-domain english-language poems, searchable by author, title, or line content.
            data from <code className="inline">poetrydb.org</code>, no key. read them in phosphor-green mono — the way nature intended.
          </p>
        </header>

        <form className="inp" onSubmit={submit}>
          <div className="mode-group" role="radiogroup" aria-label="search mode">
            {(['author', 'title', 'lines'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={'mode' + (mode === m ? ' active' : '')}
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
              >
                {m}
              </button>
            ))}
          </div>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === 'author' ? 'e.g. dickinson, frost, yeats' : mode === 'title' ? 'e.g. raven, daffodils' : 'a line of text'}
            aria-label="search query"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit">search →</button>
          <button type="button" className="random" onClick={loadRandom}>⚄ random</button>
        </form>

        {random ? (
          <article className="poem solo">
            <button className="close-random" type="button" aria-label="dismiss" onClick={() => setRandom(null)}>×</button>
            <h2 className="p-title">{random.title}</h2>
            <div className="p-author">— {random.author}</div>
            <pre className="p-lines">{random.lines.join('\n')}</pre>
          </article>
        ) : null}

        {loading ? <div className="loading">fetching…</div> : null}

        {!loading && q && poems.length === 0 ? (
          <div className="empty">no matches for <b>{q}</b> ({mode}). the corpus is narrower than you might expect — try a last name, or switch mode.</div>
        ) : null}

        {poems.length > 0 ? (
          <div className="meta">{poems.length.toLocaleString()} poem{poems.length === 1 ? '' : 's'} found</div>
        ) : null}

        <section className="list">
          {poems.map((p, i) => {
            const isOpen = expanded.has(i);
            return (
              <article key={i} className={'poem' + (isOpen ? ' open' : '')}>
                <button className="p-head" type="button" onClick={() => toggle(i)} aria-expanded={isOpen}>
                  <span className="p-chev">{isOpen ? '▾' : '▸'}</span>
                  <span className="p-title-sm">{p.title}</span>
                  <span className="p-author-sm">— {p.author}</span>
                  <span className="p-count">{p.linecount} lines</span>
                </button>
                {isOpen ? <pre className="p-lines">{p.lines.join('\n')}</pre> : null}
              </article>
            );
          })}
        </section>

        {!q && !random && poems.length === 0 ? (
          <div className="empty">search by author, title, or line — or hit <b>random</b>.</div>
        ) : null}

        <footer className="labs-footer">
          <span>source · <span className="t-accent">poetrydb.org</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

const CSS = `
  .shell-poetry { max-width: 900px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 62ch; margin-top: var(--sp-3); line-height: 1.55; }
  .page-hd .inline { background: var(--color-bg-raised); border: 1px solid var(--color-border); padding: 1px 5px; font-size: 11px; color: var(--color-accent); font-family: var(--font-mono); }

  .inp { margin-top: var(--sp-5); display: flex; gap: var(--sp-2); flex-wrap: wrap; }
  .mode-group { display: flex; border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .mode { background: transparent; border: 0; color: var(--color-fg-dim); font-family: var(--font-mono); font-size: var(--fs-xs); padding: 0 var(--sp-3); cursor: pointer; border-right: 1px solid var(--color-border); }
  .mode:last-child { border-right: 0; }
  .mode.active { background: var(--color-accent); color: var(--color-bg); }
  .mode:hover:not(.active) { color: var(--color-fg); }
  .inp input { flex: 1; min-width: 200px; background: var(--color-bg-panel); border: 1px solid var(--color-border); color: var(--color-fg); font-family: var(--font-mono); font-size: var(--fs-md); padding: 10px var(--sp-3); outline: 0; }
  .inp input:focus { border-color: var(--color-accent-dim); }
  .inp button[type=submit] { background: var(--color-accent); color: var(--color-bg); border: 0; padding: 0 var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-sm); cursor: pointer; font-weight: 500; }
  .inp button[type=submit]:hover { background: color-mix(in oklch, var(--color-accent) 85%, white 15%); }
  .random { background: transparent; color: var(--color-accent); border: 1px solid var(--color-accent-dim); padding: 0 var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); cursor: pointer; }
  .random:hover { background: color-mix(in oklch, var(--color-accent) 8%, transparent); }

  .meta { margin-top: var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .loading, .empty { margin-top: var(--sp-4); padding: var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); border: 1px solid var(--color-border); color: var(--color-fg-dim); background: var(--color-bg-panel); }
  .empty { border-style: dashed; text-align: center; color: var(--color-fg-faint); }

  .poem { border: 1px solid var(--color-border); background: var(--color-bg-panel); margin-top: var(--sp-2); }
  .poem.open { border-color: var(--color-accent-dim); }
  .poem.solo { padding: var(--sp-5) var(--sp-4); margin-top: var(--sp-5); border-color: var(--color-accent-dim); background: color-mix(in oklch, var(--color-accent) 3%, var(--color-bg-panel)); position: relative; }
  .close-random { position: absolute; top: 8px; right: 12px; background: transparent; border: 0; color: var(--color-fg-faint); font-size: 24px; cursor: pointer; line-height: 1; }
  .close-random:hover { color: var(--color-accent); }
  .p-head { width: 100%; background: transparent; border: 0; padding: var(--sp-2) var(--sp-3); display: flex; gap: var(--sp-2); align-items: center; cursor: pointer; color: inherit; text-align: left; font-family: var(--font-mono); font-size: var(--fs-xs); }
  .p-head:hover { background: var(--color-bg-raised); }
  .p-chev { color: var(--color-accent); width: 14px; }
  .p-title-sm { color: var(--color-fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .p-author-sm { color: var(--color-fg-dim); }
  .p-count { margin-left: auto; color: var(--color-fg-faint); font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; white-space: nowrap; }
  .p-title { font-family: var(--font-display); font-size: var(--fs-xl); letter-spacing: -0.01em; color: var(--color-fg); margin-bottom: 4px; }
  .p-author { font-family: var(--font-mono); font-size: var(--fs-sm); color: var(--color-fg-dim); margin-bottom: var(--sp-4); }
  .p-lines { font-family: var(--font-mono); font-size: var(--fs-sm); color: var(--color-accent); line-height: 1.7; white-space: pre-wrap; padding: var(--sp-3) var(--sp-4); border-top: 1px dashed var(--color-border); margin: 0; text-shadow: 0 0 4px color-mix(in oklch, var(--color-accent) 30%, transparent); }
  .poem.solo .p-lines { border-top: 0; padding: 0; }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-10); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); }
`;
