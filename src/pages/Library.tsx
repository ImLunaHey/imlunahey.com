import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import LIBRARY from '../data/library.json';

// Source data is built by `pnpm library:build` from data/library.csv (CLZ
// Movies export) → enriched with TMDB metadata → src/data/library.json.
// See scripts/library-build.ts. Re-run that script to refresh after
// adding to the shelf.

type LibraryItem = (typeof LIBRARY)[number];

const TMDB_IMG = 'https://image.tmdb.org/t/p';

function posterUrl(path: string | null, size: 'w185' | 'w342' = 'w342'): string | null {
  if (!path) return null;
  return `${TMDB_IMG}/${size}${path}`;
}

function decadeOf(year: number | null): string | null {
  if (!year) return null;
  return `${Math.floor(year / 10) * 10}s`;
}

// Stable colour for poster fallbacks (when TMDB has no image).
function tintFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const hue = ((h % 360) + 360) % 360;
  return `oklch(0.55 0.14 ${hue})`;
}

type SortKey = 'title' | 'year' | 'added';

export default function LibraryPage() {
  const [search, setSearch] = useState('');
  const [format, setFormat] = useState<string | 'all'>('all');
  const [decade, setDecade] = useState<string | 'all'>('all');
  const [country, setCountry] = useState<string | 'all'>('all');
  const [genre, setGenre] = useState<string | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortKey>('title');

  // facet counts and option lists. Computed once over the whole library
  // so chip labels show full counts even after another filter narrows
  // the list — otherwise stacked filters would hide options the user
  // could still combine.
  const facets = useMemo(() => {
    const formats = new Map<string, number>();
    const decades = new Map<string, number>();
    const countries = new Map<string, number>();
    const genres = new Map<string, number>();
    for (const it of LIBRARY) {
      formats.set(it.format, (formats.get(it.format) ?? 0) + 1);
      const dec = decadeOf(it.releaseYear);
      if (dec) decades.set(dec, (decades.get(dec) ?? 0) + 1);
      for (const c of it.countries) countries.set(c, (countries.get(c) ?? 0) + 1);
      for (const g of it.genres) genres.set(g, (genres.get(g) ?? 0) + 1);
    }
    return {
      formats: [...formats.entries()].sort((a, b) => b[1] - a[1]),
      decades: [...decades.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      // top-N to keep the chip row readable; the rest live behind the
      // search box ("italian", "spain", etc. as plain text terms)
      countries: [...countries.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
      genres: [...genres.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10),
    };
  }, []);

  // parse "Mar 10, 2026" → epoch ms for the "recently added" sort
  const addedMs = (s: string) => {
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : 0;
  };

  // Filter individual rows, then group by imdbId so titles owned on
  // multiple physical formats render as one card with a ×N badge
  // rather than N separate cards. Filter-then-group means a format
  // filter (e.g. DVD) only counts copies that actually match — owning
  // both DVD + Blu-ray and filtering DVD shows ×1 not ×2.
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matching = LIBRARY.filter((it) => {
      if (format !== 'all' && it.format !== format) return false;
      if (decade !== 'all' && decadeOf(it.releaseYear) !== decade) return false;
      if (country !== 'all' && !it.countries.includes(country)) return false;
      if (genre !== 'all' && !it.genres.includes(genre)) return false;
      if (q) {
        const hay = `${it.title} ${it.director ?? ''} ${it.distributor ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    // Dedup key is imdbId + exact title — sharing only an IMDb id
    // isn't enough (a TV series id is shared across every season box
    // set you own). Same imdbId + same title means a literal duplicate
    // physical product; same imdbId + different title means distinct
    // shelf items (different seasons / volumes).
    const byImdbAndTitle = new Map<string, LibraryItem[]>();
    for (const it of matching) {
      const key = `${it.imdbId}${it.title}`;
      const list = byImdbAndTitle.get(key) ?? [];
      list.push(it);
      byImdbAndTitle.set(key, list);
    }

    const arr = [...byImdbAndTitle.values()];
    // sort groups by representative (first row) — for title/year that
    // matches what items-sort would do; for "added" we use the most-
    // recent addedDate across the group's copies, so a recently-bought
    // upgrade bumps the title to the top.
    if (sortBy === 'title') {
      arr.sort((a, b) => a[0].title.localeCompare(b[0].title));
    } else if (sortBy === 'year') {
      arr.sort((a, b) => (b[0].releaseYear ?? 0) - (a[0].releaseYear ?? 0));
    } else {
      const newest = (g: LibraryItem[]) =>
        Math.max(...g.map((i) => addedMs(i.addedDate)));
      arr.sort((a, b) => newest(b) - newest(a));
    }
    return arr;
  }, [search, format, decade, country, genre, sortBy]);

  const totalRows = LIBRARY.length;
  // unique titles — same dedup key as the shelf grouping (imdbId+title),
  // so a tv series with 10 different season box sets reads as 10 titles
  // rather than 1.
  const totalTitles = new Set(LIBRARY.map((i) => `${i.imdbId}${i.title}`)).size;
  const showingCopies = groups.reduce((n, g) => n + g.length, 0);

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
            actually own on disc. exported from clz, enriched with tmdb metadata at build time.
          </p>
          <div className="meta">
            <span>
              titles <b className="t-accent">{totalTitles}</b>
            </span>
            <span>
              copies <b>{totalRows}</b>
            </span>
            {facets.formats.map(([f, n]) => (
              <span key={f}>
                {f.toLowerCase()} <b>{n}</b>
              </span>
            ))}
            <span>
              showing{' '}
              <b>
                {groups.length}
                {showingCopies !== groups.length ? ` (${showingCopies} copies)` : ''}
              </b>
            </span>
          </div>
        </header>

        <section className="controls">
          <div className="control-row">
            <input
              type="search"
              className="search"
              placeholder="search title, director, distributor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="search library"
            />
            <div className="sort-row">
              <span className="control-label">sort</span>
              {(['title', 'year', 'added'] as const).map((k) => (
                <button
                  key={k}
                  className={'chip' + (sortBy === k ? ' on' : '')}
                  onClick={() => setSortBy(k)}
                  type="button"
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          <ChipRow
            label="format"
            value={format}
            options={facets.formats}
            onChange={setFormat}
          />
          <ChipRow
            label="decade"
            value={decade}
            options={facets.decades}
            onChange={setDecade}
          />
          <ChipRow
            label="country"
            value={country}
            options={facets.countries}
            onChange={setCountry}
          />
          <ChipRow
            label="genre"
            value={genre}
            options={facets.genres}
            onChange={setGenre}
          />
        </section>

        <section className="shelf">
          {groups.map((group) => (
            // key must match the dedup key (imdbId + title) — using
            // imdbId alone collides for tv-series whose seasons share
            // an imdb id, and React's reconciliation reuses stale DOM
            // nodes instead of re-rendering on filter / sort changes.
            <Volume
              key={`${group[0].imdbId}${group[0].title}`}
              group={group}
            />
          ))}
          {groups.length === 0 ? (
            <div className="empty">no matches on the shelf.</div>
          ) : null}
        </section>

        <footer className="lib-footer">
          <span>
            src:{' '}
            <span className="t-accent">
              clz export · tmdb-enriched · {totalTitles} titles · {totalRows} copies
            </span>
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

function ChipRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | 'all';
  options: Array<readonly [string, number]>;
  onChange: (v: T | 'all') => void;
}) {
  return (
    <div className="control-row">
      <span className="control-label">{label}</span>
      <button
        className={'chip' + (value === 'all' ? ' on' : '')}
        onClick={() => onChange('all')}
        type="button"
      >
        all
      </button>
      {options.map(([opt, count]) => (
        <button
          key={opt}
          className={'chip' + (value === opt ? ' on' : '')}
          onClick={() => onChange(opt as T)}
          type="button"
        >
          {opt.toLowerCase()} <span className="chip-n">{count}</span>
        </button>
      ))}
    </div>
  );
}

function Volume({ group }: { group: LibraryItem[] }) {
  // representative for shared title/director/year/poster (all copies of
  // the same imdbId share TMDB metadata)
  const item = group[0];
  const count = group.length;
  // unique formats across the group — the 'Allo 'Allo case (2 DVD box
  // sets) collapses to ['DVD'], a film owned on DVD + Blu-ray reads
  // ['DVD', 'Blu-ray'].
  const formats = [...new Set(group.map((g) => g.format))];

  const poster = posterUrl(item.posterPath);
  // titles get long for tv-series box sets — give them a smaller font
  // size so they don't overflow the card's bottom strip
  const titleClass =
    item.title.length > 40 ? 'vol-title vol-title-sm' : 'vol-title';

  return (
    <Link
      to="/library/$imdbId"
      params={{ imdbId: item.imdbId }}
      className="vol vol-link"
    >
      <div className="vol-poster">
        {poster ? (
          <img src={poster} alt={item.title} loading="lazy" />
        ) : (
          <div
            className="vol-poster-fallback"
            style={{
              background: `linear-gradient(140deg, ${tintFor(item.title)} 0%, color-mix(in oklch, ${tintFor(item.title)} 60%, black) 70%)`,
            }}
          >
            <div className="vol-fallback-title">{item.title}</div>
            {item.releaseYear ? (
              <div className="vol-fallback-year">{item.releaseYear}</div>
            ) : null}
          </div>
        )}
        <span className="vol-format">
          {formats.map((f) => f.toLowerCase()).join(' · ')}
        </span>
        {count > 1 ? <span className="vol-copies">×{count}</span> : null}
      </div>
      <div className="vol-meta">
        <div className={titleClass}>{item.title}</div>
        <div className="vol-sub">
          {item.releaseYear ? <span>{item.releaseYear}</span> : null}
          {item.director ? (
            <>
              <span className="vol-dot">·</span>
              <span className="vol-director">{item.director}</span>
            </>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

const CSS = `
  .shell-lib { max-width: 1280px; margin: 0 auto; padding: 0 var(--sp-6); }

  .page-hd { padding: 64px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .page-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500; letter-spacing: -0.03em; line-height: 0.9;
    color: var(--color-fg);
  }
  .page-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); max-width: 64ch; margin-top: var(--sp-3); line-height: 1.55; }
  .page-hd .sub code.inline {
    color: var(--color-accent);
    font-family: var(--font-mono);
    font-size: 0.95em;
    padding: 0 4px;
    background: var(--color-bg-raised);
  }
  .page-hd .meta {
    display: flex; gap: var(--sp-5); flex-wrap: wrap;
    margin-top: var(--sp-5);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .page-hd .meta b { color: var(--color-fg); font-weight: 400; }
  .page-hd .meta b.t-accent { color: var(--color-accent); }

  /* controls */
  .controls {
    padding: var(--sp-4) 0 var(--sp-5);
    display: flex; flex-direction: column; gap: var(--sp-2);
    border-bottom: 1px solid var(--color-border);
  }
  .control-row {
    display: flex; align-items: center; flex-wrap: wrap;
    gap: 6px;
    font-family: var(--font-mono); font-size: var(--fs-xs);
  }
  .control-label {
    color: var(--color-fg-faint);
    text-transform: uppercase; letter-spacing: 0.12em;
    font-size: 10px;
    min-width: 56px;
  }
  .chip {
    padding: 4px 10px;
    background: transparent;
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg-faint);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    text-transform: lowercase; letter-spacing: 0.06em;
    cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px;
  }
  .chip:hover { color: var(--color-fg); border-color: var(--color-accent-dim); }
  .chip.on {
    color: var(--color-accent);
    border-color: var(--color-accent);
    background: color-mix(in oklch, var(--color-accent) 8%, transparent);
  }
  .chip-n {
    font-size: 9px;
    padding: 1px 5px;
    background: var(--color-bg-raised);
    color: var(--color-fg-dim);
  }

  .search {
    flex: 1; min-width: 220px;
    background: var(--color-bg);
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    padding: 8px 12px;
  }
  .search:focus { outline: none; border-color: var(--color-accent); }
  .sort-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

  /* shelf */
  .shelf {
    padding: var(--sp-5) 0 var(--sp-8);
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: var(--sp-4) var(--sp-3);
  }
  .vol {
    display: flex; flex-direction: column;
    gap: var(--sp-2);
    /* skip layout + paint for off-screen cards. critical at this list
       size (~500 cards) — without it the browser pays full cost on
       first paint even though only a dozen are visible. the
       intrinsic-size hint stops the scrollbar from jumping as cards
       enter the viewport and start contributing real height. */
    content-visibility: auto;
    contain-intrinsic-size: auto 280px;
  }
  .vol-link { text-decoration: none; color: inherit; }
  .vol-link:hover { text-decoration: none; }
  .vol-link:hover .vol-poster { border-color: var(--color-accent-dim); }
  .vol-link:hover .vol-title { color: var(--color-accent); }
  .vol-poster {
    position: relative;
    aspect-ratio: 2 / 3;
    overflow: hidden;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
  }
  .vol-poster img {
    width: 100%; height: 100%;
    object-fit: cover;
    display: block;
  }
  .vol-poster-fallback {
    width: 100%; height: 100%;
    display: flex; flex-direction: column; justify-content: flex-end;
    padding: var(--sp-3);
    color: #fff;
  }
  .vol-fallback-title {
    font-family: var(--font-display);
    font-size: 16px; line-height: 1.15;
    letter-spacing: -0.01em;
  }
  .vol-fallback-year {
    font-family: var(--font-mono); font-size: 10px;
    margin-top: 4px;
    opacity: 0.7;
  }
  .vol-format {
    position: absolute;
    top: 6px; right: 6px;
    padding: 2px 6px;
    background: rgba(0, 0, 0, 0.7);
    color: var(--color-accent);
    font-family: var(--font-mono); font-size: 9px;
    text-transform: uppercase; letter-spacing: 0.12em;
    border: 1px solid var(--color-accent-dim);
    /* limits a multi-format pill (DVD · BLU-RAY) to the card width
       so it doesn't bleed off the corner */
    max-width: calc(100% - 12px);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .vol-copies {
    position: absolute;
    top: 6px; left: 6px;
    padding: 2px 6px;
    background: rgba(0, 0, 0, 0.7);
    color: var(--color-fg);
    font-family: var(--font-mono); font-size: 9px;
    text-transform: uppercase; letter-spacing: 0.12em;
    border: 1px solid var(--color-border-bright);
  }

  .vol-meta { padding: 0 2px; }
  .vol-title {
    font-family: var(--font-display);
    font-size: 14px; line-height: 1.2;
    color: var(--color-fg);
    letter-spacing: -0.01em;
  }
  .vol-title-sm { font-size: 12px; }
  .vol-sub {
    margin-top: 4px;
    display: flex; gap: 6px; align-items: baseline;
    font-family: var(--font-mono); font-size: 10px;
    color: var(--color-fg-faint);
  }
  .vol-dot { color: var(--color-fg-ghost); }
  .vol-director {
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    min-width: 0;
  }

  .empty {
    grid-column: 1 / -1;
    padding: var(--sp-10) var(--sp-4);
    text-align: center;
    color: var(--color-fg-faint);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    border: 1px dashed var(--color-border);
  }

  .lib-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-4);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }

  @media (max-width: 760px) {
    .shelf { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: var(--sp-3) var(--sp-2); }
    .vol-title { font-size: 12px; }
    .vol-title-sm { font-size: 11px; }
    .lib-footer { flex-direction: column; gap: var(--sp-3); }
  }
`;
