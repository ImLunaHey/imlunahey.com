import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

type Medium = '4k' | 'bluray' | 'dvd' | 'criterion' | 'arrow' | 'vhs';
type Kind = 'film' | 'tv' | 'boxset';

type Item = {
  title: string;
  year: number;
  kind: Kind;
  medium: Medium;
  director?: string;
  creator?: string;
  spine?: string; // criterion / arrow spine number
  note?: string;
  tags: string[];
};

// Hand-authored shelf. Order is reading left→right, top→bottom as it sits on the shelf IRL.
const LIBRARY: Item[] = [
  { title: 'in the mood for love', year: 2000, kind: 'film', medium: 'criterion', director: 'wong kar-wai', spine: '147', note: 'permanent top-5. the print is immaculate.', tags: ['romance', 'asian-cinema'] },
  { title: 'stalker', year: 1979, kind: 'film', medium: 'criterion', director: 'andrei tarkovsky', spine: '888', note: 'slow, worth it. philosophy in long takes.', tags: ['sci-fi', 'russian'] },
  { title: 'perfect days', year: 2023, kind: 'film', medium: '4k', director: 'wim wenders', note: 'the case for small routines.', tags: ['slice-of-life', 'japan'] },
  { title: 'chungking express', year: 1994, kind: 'film', medium: 'criterion', director: 'wong kar-wai', spine: '453', tags: ['asian-cinema'] },
  { title: 'drive my car', year: 2021, kind: 'film', medium: 'bluray', director: 'ryusuke hamaguchi', tags: ['japan'] },
  { title: 'paris, texas', year: 1984, kind: 'film', medium: 'criterion', director: 'wim wenders', spine: '501', tags: ['road-movie'] },
  { title: 'the holy mountain', year: 1973, kind: 'film', medium: 'arrow', director: 'alejandro jodorowsky', note: 'arrow\'s restoration is wild.', tags: ['surreal'] },
  { title: 'eraserhead', year: 1977, kind: 'film', medium: 'criterion', director: 'david lynch', spine: '725', tags: ['surreal', 'horror'] },
  { title: 'twin peaks — the return', year: 2017, kind: 'tv', medium: 'bluray', creator: 'david lynch', note: 'still processing part 8.', tags: ['surreal', 'tv-event'] },
  { title: 'the wire — complete series', year: 2008, kind: 'boxset', medium: 'bluray', creator: 'david simon', tags: ['crime', 'us-tv'] },
  { title: 'breaking bad — complete', year: 2013, kind: 'boxset', medium: 'bluray', creator: 'vince gilligan', tags: ['us-tv'] },
  { title: 'arrival', year: 2016, kind: 'film', medium: '4k', director: 'denis villeneuve', tags: ['sci-fi'] },
  { title: 'blade runner 2049', year: 2017, kind: 'film', medium: '4k', director: 'denis villeneuve', note: 'roger deakins reference disc.', tags: ['sci-fi'] },
  { title: 'the handmaiden', year: 2016, kind: 'film', medium: 'bluray', director: 'park chan-wook', tags: ['korean'] },
  { title: 'parasite', year: 2019, kind: 'film', medium: 'criterion', director: 'bong joon-ho', spine: '1031', tags: ['korean'] },
  { title: 'memories of murder', year: 2003, kind: 'film', medium: 'criterion', director: 'bong joon-ho', spine: '1035', tags: ['korean', 'crime'] },
  { title: 'decision to leave', year: 2022, kind: 'film', medium: 'bluray', director: 'park chan-wook', tags: ['korean'] },
  { title: 'a brighter summer day', year: 1991, kind: 'film', medium: 'criterion', director: 'edward yang', spine: '811', tags: ['taiwanese'] },
  { title: 'yi yi', year: 2000, kind: 'film', medium: 'criterion', director: 'edward yang', spine: '333', tags: ['taiwanese'] },
  { title: 'burning', year: 2018, kind: 'film', medium: 'bluray', director: 'lee chang-dong', tags: ['korean'] },
  { title: 'past lives', year: 2023, kind: 'film', medium: 'bluray', director: 'celine song', tags: ['romance'] },
  { title: 'portrait of a lady on fire', year: 2019, kind: 'film', medium: 'criterion', director: 'céline sciamma', spine: '1068', tags: ['french', 'romance'] },
  { title: 'the zone of interest', year: 2023, kind: 'film', medium: '4k', director: 'jonathan glazer', note: 'the sound design is the movie.', tags: ['drama'] },
  { title: 'severance — season 1', year: 2022, kind: 'tv', medium: 'bluray', creator: 'dan erickson', tags: ['sci-fi', 'us-tv'] },
  { title: 'twin peaks — seasons 1-2', year: 1991, kind: 'boxset', medium: 'bluray', creator: 'david lynch', tags: ['us-tv'] },
  { title: 'akira', year: 1988, kind: 'film', medium: '4k', director: 'katsuhiro otomo', tags: ['anime'] },
  { title: 'princess mononoke', year: 1997, kind: 'film', medium: 'bluray', director: 'hayao miyazaki', tags: ['anime', 'ghibli'] },
  { title: 'spirited away', year: 2001, kind: 'film', medium: 'bluray', director: 'hayao miyazaki', tags: ['anime', 'ghibli'] },
  { title: 'ghost in the shell', year: 1995, kind: 'film', medium: '4k', director: 'mamoru oshii', tags: ['anime', 'sci-fi'] },
  { title: 'seven samurai', year: 1954, kind: 'film', medium: 'criterion', director: 'akira kurosawa', spine: '2', note: 'spine number 2. a quiet flex.', tags: ['japan', 'classic'] },
];

const MEDIUM_LABEL: Record<Medium, string> = {
  '4k': '4k uhd',
  bluray: 'blu-ray',
  dvd: 'dvd',
  criterion: 'criterion',
  arrow: 'arrow',
  vhs: 'vhs',
};

const MEDIUM_TINT: Record<Medium, string> = {
  '4k': 'oklch(0.78 0.16 45)',
  bluray: 'oklch(0.78 0.11 210)',
  dvd: 'var(--color-fg-dim)',
  criterion: 'var(--color-accent)',
  arrow: 'oklch(0.72 0.18 25)',
  vhs: 'oklch(0.82 0.13 85)',
};

// Stable pseudo-random cover color per title so every entry feels distinct.
function tintFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const hue = ((h % 360) + 360) % 360;
  return `oklch(0.55 0.14 ${hue})`;
}

export default function LibraryPage() {
  const [medium, setMedium] = useState<Medium | 'all'>('all');
  const [kind, setKind] = useState<Kind | 'all'>('all');

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: LIBRARY.length };
    for (const it of LIBRARY) m[it.medium] = (m[it.medium] ?? 0) + 1;
    const k: Record<string, number> = { all: LIBRARY.length };
    for (const it of LIBRARY) k[it.kind] = (k[it.kind] ?? 0) + 1;
    return { medium: m, kind: k };
  }, []);

  const filtered = useMemo(() => {
    return LIBRARY.filter((i) => (medium === 'all' || i.medium === medium) && (kind === 'all' || i.kind === kind));
  }, [medium, kind]);

  const criterionCount = counts.medium.criterion ?? 0;

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-lib">
        <header className="page-hd">
          <div className="label" style={{ marginBottom: 8 }}>
            ~/library
          </div>
          <h1>
            library<span className="dot">.</span>
          </h1>
          <p className="sub">
            the physical shelf. <code className="inline">/watching</code> is what i&apos;ve seen; this is what i
            actually own. mostly criterion spines, the odd arrow, the occasional reference disc.
          </p>
          <div className="meta">
            <span>
              volumes <b>{LIBRARY.length}</b>
            </span>
            <span>
              criterion <b className="t-accent">{criterionCount}</b>
            </span>
            <span>
              4k uhd <b>{counts.medium['4k'] ?? 0}</b>
            </span>
            <span>
              tv / boxsets <b>{(counts.kind.tv ?? 0) + (counts.kind.boxset ?? 0)}</b>
            </span>
          </div>
        </header>

        <section className="controls">
          <div className="control-row">
            <span className="control-label">kind</span>
            {(['all', 'film', 'tv', 'boxset'] as const).map((k) => (
              <button
                key={k}
                className={'chip' + (kind === k ? ' on' : '')}
                onClick={() => setKind(k)}
                type="button"
              >
                {k} <span className="chip-n">{counts.kind[k] ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="control-row">
            <span className="control-label">medium</span>
            {(['all', 'criterion', '4k', 'bluray', 'arrow', 'dvd', 'vhs'] as const).map((m) => (
              <button
                key={m}
                className={'chip' + (medium === m ? ' on' : '')}
                onClick={() => setMedium(m)}
                type="button"
              >
                {m === 'all' ? 'all' : MEDIUM_LABEL[m]}{' '}
                <span className="chip-n">{counts.medium[m] ?? 0}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="shelf">
          {filtered.map((it) => {
            const cover = tintFor(it.title);
            return (
              <article key={it.title + it.year} className={'vol m-' + it.medium}>
                <div
                  className="vol-cover"
                  style={{
                    background: `linear-gradient(140deg, ${cover} 0%, color-mix(in oklch, ${cover} 60%, black) 70%)`,
                  }}
                >
                  <div className="vol-medium" style={{ color: MEDIUM_TINT[it.medium], borderColor: MEDIUM_TINT[it.medium] }}>
                    {MEDIUM_LABEL[it.medium]}
                  </div>
                  {it.spine ? <div className="vol-spine">#{it.spine}</div> : null}
                  <div className="vol-year">{it.year}</div>
                  <div className="vol-title">{it.title}</div>
                </div>
                <div className="vol-meta">
                  <div className="vol-creator">
                    {it.director ? `dir · ${it.director}` : it.creator ? `by · ${it.creator}` : ''}
                  </div>
                  {it.note ? <div className="vol-note">{it.note}</div> : null}
                  <div className="vol-tags">
                    {it.tags.map((t) => (
                      <span key={t} className="vol-tag">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
          {filtered.length === 0 ? <div className="empty">no matches on the shelf.</div> : null}
        </section>

        <footer className="lib-footer">
          <span>
            src: <span className="t-accent">hand-catalogued · {LIBRARY.length} volumes</span>
          </span>
          <span>
            ←{' '}
            <Link to="/" className="t-accent">
              home
            </Link>
          </span>
        </footer>
      </main>
    </>
  );
}

const CSS = `
  .shell-lib { max-width: 1280px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-6); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .page-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500; letter-spacing: -0.03em; line-height: 0.9;
    color: var(--color-fg);
  }
  .page-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); max-width: 60ch; margin-top: var(--sp-3); line-height: 1.55; }
  .page-hd .sub .inline {
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    padding: 1px 6px; font-size: 12px; color: var(--color-accent);
    font-family: var(--font-mono);
  }
  .page-hd .meta {
    display: flex; gap: var(--sp-6); flex-wrap: wrap;
    margin-top: var(--sp-5); font-family: var(--font-mono);
    font-size: var(--fs-xs); color: var(--color-fg-faint);
  }
  .page-hd .meta b { color: var(--color-fg); font-weight: 400; }

  .controls {
    display: flex; flex-direction: column; gap: var(--sp-3);
    padding: var(--sp-5) 0 var(--sp-4);
    border-bottom: 1px dashed var(--color-border);
  }
  .control-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .control-label {
    font-family: var(--font-mono); font-size: 10px;
    color: var(--color-fg-faint); text-transform: uppercase;
    letter-spacing: 0.14em; margin-right: var(--sp-2);
  }
  .chip {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    padding: 4px 10px; background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-fg-faint);
    cursor: pointer; letter-spacing: 0.06em;
    text-transform: lowercase;
  }
  .chip:hover { border-color: var(--color-accent-dim); color: var(--color-fg); }
  .chip.on { border-color: var(--color-accent); color: var(--color-accent); background: color-mix(in oklch, var(--color-accent) 10%, transparent); }
  .chip-n { margin-left: 4px; color: var(--color-fg-ghost); }

  .shelf {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--sp-4);
    margin-top: var(--sp-5);
  }
  .vol {
    display: flex; flex-direction: column;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
  }
  .vol:hover { border-color: var(--color-accent-dim); }
  .vol-cover {
    aspect-ratio: 2 / 3;
    padding: var(--sp-3);
    position: relative;
    display: flex; flex-direction: column;
    justify-content: space-between;
    color: #f4f4f4;
    font-family: var(--font-display);
    overflow: hidden;
  }
  .vol-cover::before {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.4) 100%);
    pointer-events: none;
  }
  .vol-cover > * { position: relative; z-index: 1; }
  .vol-medium {
    align-self: flex-start;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    padding: 2px 6px;
    border: 1px solid currentColor;
    text-transform: uppercase;
    background: rgba(0,0,0,0.35);
  }
  .vol-spine {
    align-self: flex-end;
    position: absolute; top: var(--sp-3); right: var(--sp-3);
    font-family: var(--font-mono); font-size: 10px;
    letter-spacing: 0.12em;
    color: rgba(255,255,255,0.8);
  }
  .vol-year {
    font-family: var(--font-mono);
    font-size: 12px;
    letter-spacing: 0.14em;
    opacity: 0.8;
  }
  .vol-title {
    font-size: 20px; font-weight: 500;
    letter-spacing: -0.01em; line-height: 1.1;
    text-shadow: 0 2px 6px rgba(0,0,0,0.5);
    margin-top: 4px;
  }

  .vol-meta {
    padding: var(--sp-3);
    display: flex; flex-direction: column; gap: 6px;
    border-top: 1px dashed var(--color-border);
  }
  .vol-creator {
    font-family: var(--font-mono); font-size: 10px;
    color: var(--color-accent);
    text-transform: lowercase; letter-spacing: 0.08em;
  }
  .vol-note {
    font-size: var(--fs-sm); color: var(--color-fg-dim);
    line-height: 1.5;
  }
  .vol-tags { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 2px; }
  .vol-tag {
    font-family: var(--font-mono); font-size: 9px;
    color: var(--color-fg-faint);
    padding: 1px 5px;
    border: 1px solid var(--color-border);
    text-transform: lowercase; letter-spacing: 0.04em;
  }

  .empty {
    padding: var(--sp-8) 0; text-align: center;
    grid-column: 1 / -1;
    color: var(--color-fg-faint);
    font-family: var(--font-mono); font-size: var(--fs-sm);
  }

  .lib-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-6);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
`;
