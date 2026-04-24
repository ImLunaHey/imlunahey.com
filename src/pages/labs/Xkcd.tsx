import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { fetchXkcd, type XkcdComic } from '../../server/xkcd';

/**
 * xkcd as a small lab: today's strip, any strip by number, a random
 * one, and keyboard navigation. xkcd doesn't set CORS on its JSON,
 * so fetches go through a tiny server-side proxy.
 */

export default function XkcdPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { n?: number };
  const requested = typeof search.n === 'number' && search.n > 0 ? search.n : undefined;

  const [comic, setComic] = useState<XkcdComic | null>(null);
  const [latest, setLatest] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr('');
    fetchXkcd({ data: { num: requested } })
      .then((c) => {
        if (cancelled) return;
        setComic(c);
        // the latest endpoint also gives us the highest num so we
        // can bound the "next" button + clamp random.
        if (!requested) setLatest(c.num);
        setLoading(false);
      })
      .catch((e) => { if (!cancelled) { setErr(e instanceof Error ? e.message : String(e)); setLoading(false); } });
    return () => { cancelled = true; };
  }, [requested]);

  // fetch latest num once even when viewing a specific comic — needed
  // for bounds and the random button.
  useEffect(() => {
    if (latest !== null) return;
    fetchXkcd({ data: {} }).then((c) => setLatest(c.num)).catch(() => {});
  }, [latest]);

  const go = (n: number | undefined) => {
    navigate({ to: '/labs/xkcd' as never, search: { n } as never });
  };

  const goPrev = () => { if (comic && comic.num > 1) go(comic.num - 1); };
  const goNext = () => { if (comic && latest && comic.num < latest) go(comic.num + 1); };
  const goRandom = () => { if (latest) go(1 + Math.floor(Math.random() * latest)); };
  const goLatest = () => go(undefined);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'r') goRandom();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comic, latest]);

  const atEnd = comic && latest && comic.num >= latest;
  const atStart = comic && comic.num <= 1;

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-xkcd">
        <header className="page-hd">
          <div className="label">~/labs/xkcd</div>
          <h1>xkcd<span className="dot">.</span></h1>
          <p className="sub">
            randall munroe&apos;s webcomic — every strip since 2005, with transcript + mouseover text. arrow keys navigate, <kbd>r</kbd> picks a random one.
          </p>
        </header>

        {err ? <div className="err">{err}</div> : null}
        {loading && !comic ? <div className="loading">loading…</div> : null}

        {comic ? (
          <article className="strip">
            <div className="strip-hd">
              <div>
                <span className="strip-num">#{comic.num}</span>
                <span className="strip-title">{comic.title}</span>
              </div>
              <div className="strip-date">
                {comic.year}-{comic.month.padStart(2, '0')}-{comic.day.padStart(2, '0')}
              </div>
            </div>
            <figure className="strip-fig">
              <img src={comic.img} alt={comic.alt} />
              <figcaption title={comic.alt}>{comic.alt}</figcaption>
            </figure>

            {comic.transcript ? (
              <details className="transcript" open={showTranscript} onToggle={(e) => setShowTranscript(e.currentTarget.open)}>
                <summary>transcript</summary>
                <pre>{comic.transcript}</pre>
              </details>
            ) : null}

            <nav className="x-nav">
              <button type="button" onClick={() => go(1)} disabled={atStart ?? undefined}>⇤ first</button>
              <button type="button" onClick={goPrev} disabled={atStart ?? undefined}>← prev</button>
              <button type="button" onClick={goRandom} disabled={!latest}>⚄ random</button>
              <button type="button" onClick={goNext} disabled={atEnd ?? undefined}>next →</button>
              <button type="button" onClick={goLatest}>latest ⇥</button>
            </nav>

            <div className="direct">
              <a href={`https://xkcd.com/${comic.num}/`} target="_blank" rel="noopener noreferrer" className="t-accent">
                xkcd.com/{comic.num}/ →
              </a>
            </div>
          </article>
        ) : null}

        <footer className="labs-footer">
          <span>source · <span className="t-accent">xkcd.com</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

const CSS = `
  .shell-xkcd { max-width: 820px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 62ch; margin-top: var(--sp-3); line-height: 1.55; }
  .page-hd kbd { background: var(--color-bg-raised); border: 1px solid var(--color-border); padding: 1px 6px; font-size: 11px; font-family: var(--font-mono); color: var(--color-accent); }

  .loading, .err { margin-top: var(--sp-4); padding: var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); border: 1px solid var(--color-border); color: var(--color-fg-dim); background: var(--color-bg-panel); }
  .err { border-color: var(--color-alert); color: var(--color-alert); }

  .strip { margin-top: var(--sp-5); }
  .strip-hd { display: flex; justify-content: space-between; align-items: baseline; font-family: var(--font-mono); font-size: var(--fs-xs); flex-wrap: wrap; gap: var(--sp-2); }
  .strip-num { color: var(--color-accent); margin-right: var(--sp-3); }
  .strip-title { color: var(--color-fg); font-size: var(--fs-md); font-family: var(--font-display); letter-spacing: -0.01em; }
  .strip-date { color: var(--color-fg-faint); }
  .strip-fig { margin-top: var(--sp-3); border: 1px solid var(--color-border); background: #fff; padding: var(--sp-3); }
  .strip-fig img { display: block; max-width: 100%; margin: 0 auto; }
  .strip-fig figcaption { margin-top: var(--sp-2); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg); text-align: center; font-style: italic; }

  .transcript { margin-top: var(--sp-3); border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .transcript summary { padding: var(--sp-2) var(--sp-3); cursor: pointer; font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-dim); user-select: none; }
  .transcript summary:hover { color: var(--color-accent); }
  .transcript pre { padding: var(--sp-3) var(--sp-4); margin: 0; white-space: pre-wrap; font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-dim); line-height: 1.6; border-top: 1px dashed var(--color-border); }

  .x-nav { margin-top: var(--sp-4); display: flex; gap: var(--sp-2); justify-content: space-between; flex-wrap: wrap; }
  .x-nav button { background: transparent; border: 1px solid var(--color-border); color: var(--color-fg-dim); padding: 8px var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); cursor: pointer; }
  .x-nav button:hover:not([disabled]) { border-color: var(--color-accent-dim); color: var(--color-accent); }
  .x-nav button[disabled] { opacity: 0.35; cursor: not-allowed; }

  .direct { margin-top: var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); }
  .direct a { text-decoration: none; }
  .direct a:hover { text-decoration: underline; }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-10); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); }
`;
