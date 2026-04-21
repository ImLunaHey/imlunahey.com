import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getGallery, type GalleryData, type GalleryItem, type GalleryKind } from '../server/gallery';

type Filter = 'all' | GalleryKind;

function thumbUrl(publicUrl: string, key: string, width = 400): string {
  const origin = publicUrl.replace(/\/$/, '');
  const path = key.replace(/^\//, '');
  return `${origin}/cdn-cgi/image/width=${width},format=auto,fit=cover/${path}`;
}

function fullUrl(publicUrl: string, key: string): string {
  const origin = publicUrl.replace(/\/$/, '');
  const path = key.replace(/^\//, '');
  return `${origin}/${path}`;
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

type LbState = { publicUrl: string; list: GalleryItem[]; index: number };

export default function GalleryPage() {
  const { data: gallery } = useQuery({ queryKey: ['gallery'], queryFn: () => getGallery() });
  const [lb, setLb] = useState<LbState | null>(null);

  useEffect(() => {
    if (!lb) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLb(null);
      if (e.key === 'ArrowRight')
        setLb((prev) => (prev ? { ...prev, index: (prev.index + 1) % prev.list.length } : prev));
      if (e.key === 'ArrowLeft')
        setLb((prev) => (prev ? { ...prev, index: (prev.index - 1 + prev.list.length) % prev.list.length } : prev));
      if (e.key.toLowerCase() === 'r')
        setLb((prev) => (prev ? { ...prev, index: Math.floor(Math.random() * prev.list.length) } : prev));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lb]);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-gallery">
        <header className="page-hd">
          <div>
            <div className="label" style={{ marginBottom: 8 }}>
              ~/gallery
            </div>
            <h1>
              gallery<span className="dot">.</span>
            </h1>
            <p className="sub">
              photos and midjourney sessions. click any tile for the full image; keyboard nav works in the lightbox.
            </p>
          </div>
          {gallery ? <Counts data={gallery} /> : <CountsSkel />}
        </header>

        {gallery ? <Body data={gallery} openLb={setLb} /> : <BodySkel />}

        <footer className="gallery-footer">
          <span>
            src: <span className="t-accent">r2://imlunahey-gallery/manifest.json</span>
          </span>
          <span>
            ←{' '}
            <Link to="/" className="t-accent">
              home
            </Link>
          </span>
        </footer>
      </main>

      {lb ? (
        <Lightbox
          publicUrl={lb.publicUrl}
          list={lb.list}
          index={lb.index}
          onClose={() => setLb(null)}
          onIndex={(i) => setLb({ ...lb, index: i })}
        />
      ) : null}
    </>
  );
}

function Counts({ data }: { data: GalleryData }) {
  const counts = useMemo(() => {
    let mj = 0;
    let ph = 0;
    for (const it of data.items) {
      if (it.kind === 'mj') mj++;
      else if (it.kind === 'photo') ph++;
    }
    return { all: data.items.length, mj, photo: ph };
  }, [data.items]);
  return (
    <div className="counts">
      <div>
        total · <b>{counts.all.toLocaleString()}</b>
      </div>
      <div>
        midjourney · <b>{counts.mj.toLocaleString()}</b>
      </div>
      <div>
        photos · <b>{counts.photo}</b>
      </div>
      <div>
        updated · <b>{data.generatedAt ? fmtDate(data.generatedAt) : '—'}</b>
      </div>
    </div>
  );
}

function CountsSkel() {
  return (
    <div className="counts">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i}>
          <span className="skel" style={{ display: 'inline-block', width: 100, height: 10 }} />
        </div>
      ))}
    </div>
  );
}

function Body({ data, openLb }: { data: GalleryData; openLb: (s: LbState) => void }) {
  const { status, publicUrl, items } = data;
  const [filter, setFilter] = useState<Filter>('all');
  const [series, setSeries] = useState<string | null>(null);

  const allSeries = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) if (it.series) s.add(it.series);
    return [...s].sort();
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (filter !== 'all' && it.kind !== filter) return false;
      if (series && it.series !== series) return false;
      return true;
    });
  }, [items, filter, series]);

  const counts = useMemo(() => {
    let mj = 0;
    let ph = 0;
    for (const it of items) {
      if (it.kind === 'mj') mj++;
      else if (it.kind === 'photo') ph++;
    }
    return { all: items.length, mj, photo: ph };
  }, [items]);

  if (status !== 'ready' || items.length === 0) return <EmptyState status={status} />;

  const openTile = (target: GalleryItem) => {
    const idx = filtered.findIndex((x) => x.key === target.key);
    openLb({ publicUrl, list: filtered, index: Math.max(0, idx) });
  };
  const surpriseMe = () => {
    if (filtered.length === 0) return;
    openLb({ publicUrl, list: filtered, index: Math.floor(Math.random() * filtered.length) });
  };

  return (
    <>
      <div className="gal-bar">
        <div className="seg">
          {(['all', 'mj', 'photo'] as const).map((m) => (
            <button
              key={m}
              className={filter === m ? 'on' : ''}
              onClick={() => {
                setFilter(m);
                setSeries(null);
              }}
              type="button"
            >
              {m === 'all' ? 'all' : m === 'mj' ? 'midjourney' : 'photos'}
              <span className="n">{counts[m].toLocaleString()}</span>
            </button>
          ))}
        </div>
        {filter !== 'photo' && allSeries.length > 0 ? (
          <select
            className="series-picker"
            value={series ?? ''}
            onChange={(e) => setSeries(e.target.value || null)}
          >
            <option value="">all series</option>
            {allSeries.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ) : null}
        <span className="view">
          showing <b>{filtered.length.toLocaleString()}</b> of {items.length.toLocaleString()}
        </span>
        <div className="spacer" />
        <button className="surprise" type="button" onClick={surpriseMe}>
          ⚄ surprise me
        </button>
      </div>

      <div className="grid">
        {filtered.slice(0, 200).map((it) => (
          <button
            key={it.key}
            type="button"
            className="tile"
            onClick={() => openTile(it)}
            aria-label={it.prompt ?? it.key}
          >
            <img
              src={thumbUrl(publicUrl, it.key, 400)}
              width={it.w}
              height={it.h}
              loading="lazy"
              alt={it.prompt ?? ''}
            />
            <span className={`badge ${it.kind}`}>{it.kind === 'mj' ? 'mj' : '📷'}</span>
            {it.prompt ? <div className="prompt">{truncate(it.prompt, 80)}</div> : null}
          </button>
        ))}
      </div>

      {filtered.length > 200 ? (
        <div className="more-hint">
          rendering first 200 · virtualization coming for larger sets
        </div>
      ) : null}
    </>
  );
}

function BodySkel() {
  return (
    <div className="grid" style={{ marginTop: 'var(--sp-5)' }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="tile skel" />
      ))}
    </div>
  );
}

function EmptyState({ status }: { status: 'unconfigured' | 'empty' | 'error' | 'ready' }) {
  const msg = {
    unconfigured: {
      title: 'gallery not configured yet',
      body: 'set R2_PUBLIC_URL in .env.local (see docs/gallery-setup.md).',
    },
    empty: {
      title: 'no images yet',
      body: 'bucket is reachable but manifest.json is missing. run pnpm gallery:upload.',
    },
    error: {
      title: 'gallery unavailable',
      body: 'the manifest fetch failed. check r2 public access + network.',
    },
    ready: { title: '', body: '' },
  }[status];

  return (
    <div className="empty-state">
      <div className="empty-title">{msg.title}</div>
      <div className="empty-body">{msg.body}</div>
    </div>
  );
}

function Lightbox({
  publicUrl,
  list,
  index,
  onClose,
  onIndex,
}: {
  publicUrl: string;
  list: GalleryItem[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const it = list[index];
  const ref = useRef<HTMLDivElement | null>(null);

  if (!it) return null;

  return (
    <div
      className="lb on"
      ref={ref}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="lb-head">
        <span className="title">
          {it.series ? `${it.series} · ` : ''}
          {it.seed ? `seed ${it.seed}` : it.key.split('/').pop()}
        </span>
        <span>
          {index + 1} / {list.length} · <span className="kbd">esc</span> close · <span className="kbd">←→</span> nav ·{' '}
          <span className="kbd">r</span> random
        </span>
      </div>
      <div className="lb-body">
        <button className="lb-nav prev" type="button" onClick={() => onIndex((index - 1 + list.length) % list.length)}>
          ←
        </button>
        <img
          className="lb-img"
          src={fullUrl(publicUrl, it.key)}
          alt={it.prompt ?? ''}
          width={it.w}
          height={it.h}
        />
        <button className="lb-nav next" type="button" onClick={() => onIndex((index + 1) % list.length)}>
          →
        </button>
      </div>
      {it.prompt ? <div className="lb-caption">{it.prompt}</div> : null}
    </div>
  );
}

const CSS = `
  .shell-gallery { max-width: 1400px; margin: 0 auto; padding: 0 var(--sp-6); }

  .page-hd {
    padding: 64px 0 var(--sp-6);
    border-bottom: 1px solid var(--color-border);
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: end;
    gap: var(--sp-6);
  }
  .page-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.9;
  }
  .page-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 52ch; margin-top: var(--sp-3); }
  .page-hd .counts { color: var(--color-fg-faint); font-size: var(--fs-xs); text-align: right; line-height: 1.8; }
  .page-hd .counts b { color: var(--color-accent); font-weight: 400; }

  .empty-state {
    padding: 80px 0;
    text-align: center;
    border: 1px dashed var(--color-border);
    margin-top: var(--sp-8);
  }
  .empty-title { font-family: var(--font-mono); color: var(--color-fg); font-size: var(--fs-md); margin-bottom: var(--sp-2); }
  .empty-body { color: var(--color-fg-faint); font-size: var(--fs-sm); font-family: var(--font-mono); }

  .gal-bar {
    display: flex; align-items: center; gap: var(--sp-4);
    padding: var(--sp-5) 0 var(--sp-4);
    border-bottom: 1px solid var(--color-border);
    flex-wrap: wrap;
  }
  .seg { display: flex; gap: 2px; }
  .seg button {
    padding: 6px 12px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    color: var(--color-fg-dim);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    cursor: pointer;
  }
  .seg button:hover { color: var(--color-fg); border-color: var(--color-border-bright); }
  .seg button.on { color: var(--color-accent); border-color: var(--color-accent-dim); background: var(--color-bg-raised); }
  .seg button .n { color: var(--color-fg-faint); margin-left: 8px; font-size: var(--fs-xs); }
  .seg button.on .n { color: var(--color-accent-faint); }

  .series-picker {
    padding: 6px 10px;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    color: var(--color-fg);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }
  .view { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .view b { color: var(--color-accent); font-weight: 400; }
  .spacer { flex: 1; }
  .surprise {
    padding: 6px 12px;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-accent-dim);
    color: var(--color-accent);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    cursor: pointer;
  }
  .surprise:hover { background: color-mix(in oklch, var(--color-accent) 12%, var(--color-bg-panel)); }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--sp-3);
    margin-top: var(--sp-5);
  }
  .tile {
    position: relative;
    aspect-ratio: 1;
    border: 1px solid var(--color-border);
    background: var(--color-bg-raised);
    cursor: pointer;
    overflow: hidden;
    padding: 0;
  }
  .tile.skel { cursor: default; }
  .tile:hover { border-color: var(--color-accent-dim); }
  .tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .tile .badge {
    position: absolute;
    top: 6px;
    left: 6px;
    background: rgba(0,0,0,0.6);
    color: var(--color-fg);
    padding: 2px 6px;
    font-family: var(--font-mono);
    font-size: 10px;
    border: 1px solid var(--color-border-bright);
  }
  .tile .badge.mj { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .tile .prompt {
    position: absolute;
    left: 0; right: 0; bottom: 0;
    padding: 8px;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg);
    background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%);
    opacity: 0;
    transition: opacity 0.15s;
  }
  .tile:hover .prompt { opacity: 1; }

  .more-hint {
    text-align: center;
    padding: var(--sp-6) 0;
    color: var(--color-fg-faint);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
  }

  .gallery-footer {
    display: flex;
    justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-10);
    border-top: 1px solid var(--color-border);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    font-family: var(--font-mono);
  }

  .lb {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.92);
    z-index: 100;
    display: flex; flex-direction: column;
  }
  .lb-head {
    display: flex; justify-content: space-between;
    padding: var(--sp-4) var(--sp-6);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    border-bottom: 1px solid var(--color-border);
  }
  .lb-head .title { color: var(--color-fg); }
  .lb-head .kbd {
    display: inline-block;
    padding: 1px 6px;
    border: 1px solid var(--color-border);
    border-radius: 3px;
    margin: 0 2px;
    color: var(--color-fg-dim);
  }
  .lb-body {
    flex: 1; position: relative;
    display: flex; align-items: center; justify-content: center;
    padding: var(--sp-6);
  }
  .lb-img {
    max-width: 100%; max-height: 100%;
    object-fit: contain;
  }
  .lb-nav {
    position: absolute;
    top: 50%; transform: translateY(-50%);
    background: rgba(0,0,0,0.5);
    border: 1px solid var(--color-border);
    color: var(--color-fg);
    padding: 12px 18px;
    font-size: 24px;
    cursor: pointer;
  }
  .lb-nav:hover { background: rgba(0,0,0,0.8); border-color: var(--color-accent-dim); }
  .lb-nav.prev { left: var(--sp-4); }
  .lb-nav.next { right: var(--sp-4); }
  .lb-caption {
    padding: var(--sp-4) var(--sp-6);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-dim);
    max-height: 120px;
    overflow-y: auto;
  }
`;
